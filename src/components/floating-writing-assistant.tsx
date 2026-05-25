"use client";

import { CSSProperties, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoLanMascot } from "@/components/molan-mascot";
import { WritingAssistantPanel } from "@/components/writing-assistant-panel";

function getProjectId(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = match?.[1] ?? "";

  return projectId && projectId !== "new" ? projectId : "";
}

const introDismissedKey = "writing-assistant:intro-dismissed";
const routeTipDismissedPrefix = "writing-assistant:route-tip-dismissed:";
const launcherPositionKey = "writing-assistant:launcher-position";
const launcherSize = 92;
const launcherMargin = 12;

type LauncherPosition = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

type MoLanTip = {
  title: string;
  message: string;
};

function clampLauncherPosition(position: LauncherPosition) {
  if (typeof window === "undefined") {
    return position;
  }

  return {
    x: Math.min(Math.max(position.x, launcherMargin), window.innerWidth - launcherSize - launcherMargin),
    y: Math.min(Math.max(position.y, launcherMargin), window.innerHeight - launcherSize - launcherMargin)
  };
}

function cleanAuthorName(value?: string) {
  return String(value ?? "").trim().replace(/[，。！？,.!?]+$/g, "");
}

function routeTipKey(pathname: string) {
  return `${routeTipDismissedPrefix}${pathname || "/"}`;
}

function pickTip(tips: MoLanTip[]) {
  return tips[Math.floor(Math.random() * tips.length)] ?? tips[0];
}

function restTip(): MoLanTip {
  return pickTip([
    {
      title: "主人主人，暂停一下",
      message: "你已经陪故事待了很久啦。墨澜建议先喝口水，眼睛也该休息一小会儿。"
    },
    {
      title: "系统温柔提醒",
      message: "创作不是冲刺，是长跑。主人要不要先歇两分钟，我在这里等你回来。"
    },
    {
      title: "墨澜检测到疲劳气息",
      message: "主人今天已经很努力啦。稍微放松一下，下一段剧情会更顺。"
    }
  ]);
}

function getMoLanTips(pathname: string, projectId: string, authorName?: string): MoLanTip[] {
  const name = cleanAuthorName(authorName);

  if (pathname === "/") {
    return [
      {
        title: name ? `${name}主人，墨澜在这里` : "主人主人，墨澜在这里",
        message: "今天想先做什么？写正文、拆模板，还是整理一下脑子里的新点子？"
      },
      {
        title: "主人，今日创作模式待命",
        message: "不用一上来就写很多。先推进一小步，故事就会继续往前走。"
      },
      {
        title: "墨澜已上线",
        message: "主人要是卡住了，就把问题丢给我。书名、人设、剧情钩子都可以。"
      },
      {
        title: "主人今天想走哪条线？",
        message: "创作线、拆书线、模板线都可以。我会跟在旁边帮你看节奏。"
      }
    ];
  }

  if (pathname === "/projects") {
    return [
      {
        title: "主人，项目卷宗已展开",
        message: "哪本书最需要救一下？点进去，我陪你一起捋。"
      },
      {
        title: "墨澜正在看书架",
        message: "这些都是主人的世界。要不要挑一本继续推进？"
      },
      {
        title: "主人，先别慌",
        message: "项目多也没关系。我们一本一本看，先找今天最值得推进的那本。"
      }
    ];
  }

  if (pathname === "/projects/new") {
    return [
      {
        title: "主人，新书孵化舱开启",
        message: "书名、简介、主角名都可以先让我试试。不好听我们就继续换。"
      },
      {
        title: "墨澜闻到了新坑的气息",
        message: "主人只要给一点题材方向，我就能先打几版名字和简介。"
      },
      {
        title: "主人，别怕空白页",
        message: "新书刚开始都像雾。我们先捏出主角，再慢慢点亮世界。"
      }
    ];
  }

  if (projectId && pathname.includes("/writing")) {
    return [
      {
        title: "主人，章节创作辅助已待命",
        message: "这一章要不要先加一个冲突点？爽点、反转、钩子我都能帮你盯。"
      },
      {
        title: "墨澜正在守着正文区",
        message: "主人写完一段，我可以帮你看节奏顺不顺、人物有没有跑偏。"
      },
      {
        title: "主人，别让章节平着过去",
        message: "如果感觉不够爽，我们可以补一个误会、压迫、反击或者新线索。"
      },
      {
        title: "系统提示：章末钩子很重要",
        message: "主人要不要让我帮你想一个能把读者拽到下一章的收尾？"
      }
    ];
  }

  if (projectId) {
    return [
      {
        title: "主人，当前作品已锁定",
        message: "要不要我帮你检查一下设定、人物关系，或者下一章该往哪推？"
      },
      {
        title: "墨澜正在读取作品气息",
        message: "主线、人物、伏笔都可以拿来问我。我们把故事捋顺一点。"
      },
      {
        title: "主人，这本书可以继续推进",
        message: "如果不知道下一步写什么，我可以先给你三种章节方向。"
      }
    ];
  }

  if (pathname === "/templates") {
    return [
      {
        title: "主人，模板库已打开",
        message: "看到顺眼的爆款结构，就让我帮你拆成自己的新故事骨架。"
      },
      {
        title: "墨澜开始翻模板啦",
        message: "这些不是答案，是素材。我们可以把它们改造成主人的风格。"
      },
      {
        title: "主人，要不要偷学一点节奏？",
        message: "拆书不是照搬，是看清爽点怎么铺、冲突怎么递进。"
      }
    ];
  }

  if (pathname.startsWith("/templates/")) {
    return [
      {
        title: "主人，这份模板可以炼化",
        message: "节奏、爽点、人设关系都能换皮迁移，我可以帮你生成新书方案。"
      },
      {
        title: "墨澜检测到可用结构",
        message: "这套结构可以继续拆。主人想保留爽点，还是重做人设？"
      }
    ];
  }

  if (pathname === "/stats") {
    return [
      {
        title: "主人，创作轨迹已记录",
        message: "字数不是压力，是你给故事留下的脚印。今天写一点也很棒。"
      },
      {
        title: "墨澜正在看你的进度",
        message: "连续推进比爆肝更厉害。主人稳稳写，故事会自己长大。"
      },
      {
        title: "主人今天已经努力过啦",
        message: "如果状态好，我们继续；如果有点累，也可以让墨澜帮你做轻任务。"
      }
    ];
  }

  if (pathname.startsWith("/settings")) {
    return [
      {
        title: "主人，系统设置区到了",
        message: "模型、账号、数据工具都在这里。哪里看不懂，墨澜帮你翻译成人话。"
      },
      {
        title: "墨澜正在检查配置",
        message: "这里不用急着乱点。主人不确定怎么选，就先问我。"
      }
    ];
  }

  return [
    {
      title: "主人主人，我在这里",
      message: "有任何小说创作相关的问题，都可以随时点我。"
    },
    {
      title: "墨澜待命中",
      message: "主人负责灵感，我负责帮你把灵感理成能写的东西。"
    }
  ];
}

export function FloatingWritingAssistant({ authorName }: { authorName?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = useMemo(() => getProjectId(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [visibleTip, setVisibleTip] = useState<MoLanTip | null>(null);
  const [launcherPosition, setLauncherPosition] = useState<LauncherPosition | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const autoHideTipRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef(Date.now());
  const currentQuery = searchParams.toString();
  const currentPath = currentQuery ? `${pathname}?${currentQuery}` : pathname;
  const workbenchParams = new URLSearchParams();
  const contextualTips = useMemo(() => getMoLanTips(pathname, projectId, authorName), [authorName, pathname, projectId]);

  useEffect(() => {
    try {
      const rawPosition = window.localStorage.getItem(launcherPositionKey);
      const parsed = rawPosition ? JSON.parse(rawPosition) as LauncherPosition : null;

      if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
        setLauncherPosition(clampLauncherPosition(parsed));
      }
    } catch {
      window.localStorage.removeItem(launcherPositionKey);
    }
  }, []);

  useEffect(() => {
    if (pathname === "/assistant" || open) {
      setVisibleTip(null);
      return;
    }

    if (autoHideTipRef.current) {
      window.clearTimeout(autoHideTipRef.current);
    }

    const hasSeenIntro = window.localStorage.getItem(introDismissedKey) === "1";
    const routeDismissed = window.sessionStorage.getItem(routeTipKey(pathname)) === "1";
    const hasWorkedLong = Date.now() - sessionStartedAtRef.current > 1000 * 60 * 90;

    if (routeDismissed) {
      setVisibleTip(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleTip(hasSeenIntro
        ? hasWorkedLong ? restTip() : pickTip(contextualTips)
        : {
            title: "主人主人，我在这里",
            message: "我是墨澜。你有任何小说创作相关的问题，都可以随时找我哦。"
          });
    }, 520);

    autoHideTipRef.current = window.setTimeout(() => {
      setVisibleTip(null);
    }, 9000);

    return () => {
      window.clearTimeout(timer);

      if (autoHideTipRef.current) {
        window.clearTimeout(autoHideTipRef.current);
      }
    };
  }, [contextualTips, open, pathname]);

  useEffect(() => {
    function handleResize() {
      setLauncherPosition((current) => current ? clampLauncherPosition(current) : current);
    }

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (pathname === "/assistant") {
    return null;
  }

  if (projectId) {
    workbenchParams.set("projectId", projectId);
  }

  workbenchParams.set("returnTo", currentPath);

  const workbenchQuery = workbenchParams.toString();
  const workbenchHref = workbenchQuery ? `/assistant?${workbenchQuery}` : "/assistant";

  function enterWorkbench() {
    setOpen(false);
    dismissTip();
    router.push(workbenchHref);
  }

  function dismissTip() {
    setVisibleTip(null);
    window.localStorage.setItem(introDismissedKey, "1");
    window.sessionStorage.setItem(routeTipKey(pathname), "1");
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) {
      return;
    }

    drag.moved = true;
    suppressClickRef.current = true;
    setLauncherPosition(clampLauncherPosition({
      x: drag.originX + deltaX,
      y: drag.originY + deltaY
    }));
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (!drag.moved) {
      return;
    }

    setOpen(false);
    dismissTip();
    setLauncherPosition((current) => {
      if (current) {
        window.localStorage.setItem(launcherPositionKey, JSON.stringify(current));
      }

      return current;
    });
  }

  const launcherStyle: CSSProperties | undefined = launcherPosition
    ? { left: launcherPosition.x, top: launcherPosition.y, right: "auto", bottom: "auto" }
    : undefined;
  const tipSide = launcherPosition && launcherPosition.x < 210 ? "left" : "right";

  return (
    <>
      <div className="floating-ai-launcher" style={launcherStyle}>
        {visibleTip && !open ? (
          <div className="floating-ai-greeting" role="status" data-side={tipSide}>
            <button type="button" aria-label="关闭墨澜提示" onClick={dismissTip}>
              ×
            </button>
            <strong>{visibleTip.title}</strong>
            <span>{visibleTip.message}</span>
          </div>
        ) : null}

        <button
          className="floating-ai-button"
          type="button"
          aria-label="打开墨澜 AI 创作助手"
          aria-expanded={open}
          aria-controls="writing-assistant-drawer"
          data-mood={open ? "listening" : visibleTip ? "speaking" : "idle"}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }

            dismissTip();
            setOpen((current) => !current);
          }}
        >
          <MoLanMascot />
        </button>
      </div>

      {open ? (
        <WritingAssistantPanel
          projectId={projectId}
          className="writing-assistant-drawer"
          authorName={authorName}
          actions={
            <>
              <button
                type="button"
                className="writing-assistant-workbench-button"
                onClick={enterWorkbench}
              >
                进入工作台
              </button>
              <button type="button" aria-label="关闭 AI 创作顾问" onClick={() => setOpen(false)}>
                ×
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
