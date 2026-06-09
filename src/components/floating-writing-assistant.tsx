"use client";

import { CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
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
const launcherHiddenKey = "writing-assistant:launcher-hidden";
const launcherWidth = 86;
const launcherHeight = 96;
const launcherMargin = 12;
const defaultAssistantName = "墨澜";

type LauncherPosition = {
  x: number;
  y: number;
};

type LauncherAnchor = {
  right: number;
  bottom: number;
};

type LauncherDimensions = {
  width: number;
  height: number;
};

type StoredLauncherPosition = LauncherPosition & Partial<LauncherAnchor>;

type DragState = {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  originX: number;
  originY: number;
  coordinateMode: "client" | "page";
  moved: boolean;
};

type MoLanTip = {
  title: string;
  message: string;
};

function getViewportSize() {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }

  const viewport = window.visualViewport;

  return {
    width: Math.max(window.innerWidth, document.documentElement.clientWidth, viewport?.width ?? 0),
    height: Math.max(window.innerHeight, document.documentElement.clientHeight, viewport?.height ?? 0)
  };
}

function getLauncherDimensions(element?: HTMLElement | null): LauncherDimensions {
  const rect = element?.getBoundingClientRect();

  return {
    width: rect?.width && Number.isFinite(rect.width) ? rect.width : launcherWidth,
    height: rect?.height && Number.isFinite(rect.height) ? rect.height : launcherHeight
  };
}

function clampLauncherPosition(position: LauncherPosition, dimensions: LauncherDimensions = getLauncherDimensions()) {
  if (typeof window === "undefined") {
    return position;
  }

  const { width, height } = getViewportSize();
  const maxX = Math.max(launcherMargin, width - dimensions.width - launcherMargin);
  const maxY = Math.max(launcherMargin, height - dimensions.height - launcherMargin);

  return {
    x: Math.min(Math.max(position.x, launcherMargin), maxX),
    y: Math.min(Math.max(position.y, launcherMargin), maxY)
  };
}

function getLauncherAnchor(position: LauncherPosition, dimensions: LauncherDimensions): LauncherAnchor {
  const { width, height } = getViewportSize();

  return {
    right: width - position.x - dimensions.width,
    bottom: height - position.y - dimensions.height
  };
}

function getPositionFromAnchor(anchor: LauncherAnchor, dimensions: LauncherDimensions): LauncherPosition {
  const { width, height } = getViewportSize();

  return {
    x: width - dimensions.width - anchor.right,
    y: height - dimensions.height - anchor.bottom
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type PointerLike = {
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
};

function pageViewportPoint(event: PointerLike) {
  const viewport = window.visualViewport;

  return {
    x: event.pageX - window.scrollX - (viewport?.offsetLeft ?? 0),
    y: event.pageY - window.scrollY - (viewport?.offsetTop ?? 0)
  };
}

function clientViewportPoint(event: PointerLike) {
  return {
    x: event.clientX,
    y: event.clientY
  };
}

function choosePointerCoordinateMode(event: PointerLike, rect: DOMRect): DragState["coordinateMode"] {
  const point = clientViewportPoint(event);
  const pagePoint = pageViewportPoint(event);
  const inClientRect =
    point.x >= rect.left - 2 &&
    point.x <= rect.right + 2 &&
    point.y >= rect.top - 2 &&
    point.y <= rect.bottom + 2;
  const inPageRect =
    pagePoint.x >= rect.left - 2 &&
    pagePoint.x <= rect.right + 2 &&
    pagePoint.y >= rect.top - 2 &&
    pagePoint.y <= rect.bottom + 2;

  return inPageRect && !inClientRect ? "page" : "client";
}

function pointerViewportPoint(event: PointerLike, mode: DragState["coordinateMode"]) {
  return mode === "page" ? pageViewportPoint(event) : clientViewportPoint(event);
}

function isPointerCaptureTarget(target: EventTarget | null | undefined): target is Element {
  return target instanceof Element &&
    typeof target.hasPointerCapture === "function" &&
    typeof target.releasePointerCapture === "function";
}

function cleanAuthorName(value?: string) {
  return String(value ?? "").trim().replace(/[，。！？,.!?]+$/g, "");
}

function cleanAssistantName(value?: string) {
  return String(value ?? "").trim().replace(/[，。！？,.!?]+$/g, "") || defaultAssistantName;
}

function personalizeTip(tip: MoLanTip, assistantName: string): MoLanTip {
  return {
    title: tip.title.replaceAll(defaultAssistantName, assistantName),
    message: tip.message.replaceAll(defaultAssistantName, assistantName)
  };
}

function personalizeTips(tips: MoLanTip[], assistantName: string) {
  return tips.map((tip) => personalizeTip(tip, assistantName));
}

function routeTipKey(pathname: string) {
  return `${routeTipDismissedPrefix}${pathname || "/"}`;
}

function pickTip(tips: MoLanTip[]) {
  return tips[Math.floor(Math.random() * tips.length)] ?? tips[0];
}

function restTip(assistantName: string): MoLanTip {
  return pickTip(personalizeTips([
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
  ], assistantName));
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

export function FloatingWritingAssistant({ authorName, assistantName }: { authorName?: string; assistantName?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = useMemo(() => getProjectId(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [visibleTip, setVisibleTip] = useState<MoLanTip | null>(null);
  const [launcherPosition, setLauncherPosition] = useState<LauncherPosition | null>(null);
  const [launcherHidden, setLauncherHidden] = useState(false);
  const launcherRef = useRef<HTMLDivElement | null>(null);
  const launcherAnchorRef = useRef<LauncherAnchor | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const autoHideTipRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef(Date.now());
  const currentQuery = searchParams.toString();
  const currentPath = currentQuery ? `${pathname}?${currentQuery}` : pathname;
  const workbenchParams = new URLSearchParams();
  const assistantDisplayName = useMemo(() => cleanAssistantName(assistantName), [assistantName]);
  const contextualTips = useMemo(
    () => personalizeTips(getMoLanTips(pathname, projectId, authorName), assistantDisplayName),
    [assistantDisplayName, authorName, pathname, projectId]
  );

  useEffect(() => {
    try {
      setLauncherHidden(window.localStorage.getItem(launcherHiddenKey) === "1");
      const rawPosition = window.localStorage.getItem(launcherPositionKey);
      const parsed = rawPosition ? JSON.parse(rawPosition) as StoredLauncherPosition : null;

      if (parsed && isFiniteNumber(parsed.x) && isFiniteNumber(parsed.y)) {
        const dimensions = getLauncherDimensions(launcherRef.current);
        const anchor = isFiniteNumber(parsed.right) && isFiniteNumber(parsed.bottom)
          ? { right: parsed.right, bottom: parsed.bottom }
          : null;
        const nextPosition = clampLauncherPosition(
          anchor ? getPositionFromAnchor(anchor, dimensions) : parsed,
          dimensions
        );

        launcherAnchorRef.current = getLauncherAnchor(nextPosition, dimensions);
        setLauncherPosition(nextPosition);
      }
    } catch {
      window.localStorage.removeItem(launcherPositionKey);
    }
  }, []);

  useEffect(() => {
    if (pathname === "/assistant" || open || launcherHidden) {
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
        ? hasWorkedLong ? restTip(assistantDisplayName) : pickTip(contextualTips)
        : {
            title: "主人主人，我在这里",
            message: `我是${assistantDisplayName}。你有任何小说创作相关的问题，都可以随时找我哦。`
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
  }, [assistantDisplayName, contextualTips, launcherHidden, open, pathname]);

  useEffect(() => {
    function handleResize() {
      setLauncherPosition((current) => {
        if (!current) {
          return current;
        }

        const dimensions = getLauncherDimensions(launcherRef.current);
        const anchor = launcherAnchorRef.current ?? getLauncherAnchor(current, dimensions);
        const nextPosition = clampLauncherPosition(getPositionFromAnchor(anchor, dimensions), dimensions);
        launcherAnchorRef.current = getLauncherAnchor(nextPosition, dimensions);

        return nextPosition;
      });
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.body.classList.remove("floating-ai-dragging");
    };
  }, []);

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

  function hideLauncher() {
    setOpen(false);
    setLauncherHidden(true);
    dismissTip();
    window.localStorage.setItem(launcherHiddenKey, "1");
  }

  function restoreLauncher() {
    setLauncherHidden(false);
    window.localStorage.removeItem(launcherHiddenKey);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const mode = choosePointerCoordinateMode(event, rect);
    const point = pointerViewportPoint(event, mode);

    dragRef.current = {
      pointerId: event.pointerId,
      startPointerX: point.x,
      startPointerY: point.y,
      originX: rect.left,
      originY: rect.top,
      coordinateMode: mode,
      moved: false
    };
    document.body.classList.add("floating-ai-dragging");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveLauncher(event: PointerLike) {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const point = pointerViewportPoint(event, drag.coordinateMode);
    const deltaX = point.x - drag.startPointerX;
    const deltaY = point.y - drag.startPointerY;

    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) {
      return;
    }

    drag.moved = true;
    suppressClickRef.current = true;
    const dimensions = getLauncherDimensions(launcherRef.current);
    const nextPosition = clampLauncherPosition({
      x: drag.originX + deltaX,
      y: drag.originY + deltaY
    }, dimensions);

    launcherAnchorRef.current = getLauncherAnchor(nextPosition, dimensions);
    setLauncherPosition(nextPosition);
  }

  function endDrag(pointerId: number, releaseTarget?: EventTarget | null) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== pointerId) {
      return;
    }

    dragRef.current = null;
    document.body.classList.remove("floating-ai-dragging");

    if (isPointerCaptureTarget(releaseTarget)) {
      if (releaseTarget.hasPointerCapture(pointerId)) {
        releaseTarget.releasePointerCapture(pointerId);
      }
    }

    if (!drag.moved) {
      return;
    }

    setOpen(false);
    dismissTip();
    setLauncherPosition((current) => {
      if (current) {
        const dimensions = getLauncherDimensions(launcherRef.current);
        const anchor = launcherAnchorRef.current ?? getLauncherAnchor(current, dimensions);

        window.localStorage.setItem(launcherPositionKey, JSON.stringify({ ...current, ...anchor }));
      }

      return current;
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    moveLauncher(event);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      moveLauncher(event);
    }

    endDrag(event.pointerId, event.currentTarget);
  }

  function handleDocumentPointerMove(event: globalThis.PointerEvent) {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    moveLauncher(event);
  }

  function handleDocumentPointerUp(event: globalThis.PointerEvent) {
    endDrag(event.pointerId, event.target ?? null);
  }

  useEffect(() => {
    function handleTouchMove(event: TouchEvent) {
      if (!dragRef.current) {
        return;
      }

      event.preventDefault();
    }

    document.addEventListener("pointermove", handleDocumentPointerMove, true);
    document.addEventListener("pointerup", handleDocumentPointerUp, true);
    document.addEventListener("pointercancel", handleDocumentPointerUp, true);
    document.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });

    return () => {
      document.removeEventListener("pointermove", handleDocumentPointerMove, true);
      document.removeEventListener("pointerup", handleDocumentPointerUp, true);
      document.removeEventListener("pointercancel", handleDocumentPointerUp, true);
      document.removeEventListener("touchmove", handleTouchMove, true);
    };
  }, []);

  const launcherStyle: CSSProperties | undefined = launcherPosition
    ? { left: launcherPosition.x, top: launcherPosition.y, right: "auto", bottom: "auto" }
    : undefined;
  const tipSide = launcherPosition && launcherPosition.x < 210 ? "left" : "right";

  if (pathname === "/assistant") {
    return null;
  }

  if (launcherHidden && !open) {
    return (
      <button
        type="button"
        className="floating-ai-restore-button"
        aria-label={`显示${assistantDisplayName}小助手`}
        onClick={restoreLauncher}
      >
        助手
      </button>
    );
  }

  return (
    <>
      {!open ? (
        <div className="floating-ai-launcher" style={launcherStyle} ref={launcherRef}>
          <button
            type="button"
            className="floating-ai-hide-button"
            aria-label={`隐藏${assistantDisplayName}小助手`}
            title="隐藏小助手"
            onClick={hideLauncher}
          >
            ×
          </button>

          {visibleTip ? (
            <div className="floating-ai-greeting" role="status" data-side={tipSide}>
              <button type="button" aria-label={`关闭${assistantDisplayName}提示`} onClick={dismissTip}>
                ×
              </button>
              <strong>{visibleTip.title}</strong>
              <span>{visibleTip.message}</span>
            </div>
          ) : null}

          <button
            className="floating-ai-button"
            type="button"
            aria-label={`打开${assistantDisplayName} AI 创作助手`}
            aria-expanded={open}
            aria-controls="writing-assistant-drawer"
            data-mood={visibleTip ? "speaking" : "idle"}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }

              dismissTip();
              setOpen(true);
            }}
          >
            <MoLanMascot />
          </button>
        </div>
      ) : null}

      {open ? (
        <WritingAssistantPanel
          projectId={projectId}
          className="writing-assistant-drawer"
          title={assistantDisplayName}
          authorName={authorName}
          assistantName={assistantDisplayName}
          actions={
            <>
              <button
                type="button"
                className="writing-assistant-workbench-button"
                onClick={enterWorkbench}
              >
                进入工作台
              </button>
              <button type="button" aria-label={`关闭${assistantDisplayName}`} onClick={() => setOpen(false)}>
                ×
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
