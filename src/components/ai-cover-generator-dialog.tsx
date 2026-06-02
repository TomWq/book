"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { requestCoverImageGeneration } from "@/lib/cover-image-generation-events";

type AiCoverGeneratorDialogProps = {
  open: boolean;
  title: string;
  authorName?: string;
  onClose: () => void;
  onGenerated: (coverImageUrl: string) => Promise<void> | void;
};

type CoverQuota = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
};

const stylePromptGroups = [
  {
    label: "热门",
    prompts: [
      { name: "男频爆款", text: "像番茄小说男频爆款封面，书名是最大视觉，主角和爽点一眼能看懂，整体要有上架成品感" },
      { name: "都市逆袭", text: "都市逆袭爽文封面，现代城市与超凡力量结合，标题要像网文平台成品" },
      { name: "玄幻修仙", text: "玄幻修仙封面，云海仙山、法阵、飞剑、神兽或宗门压迫感，标题用大气中文书法字" },
      { name: "规则怪谈", text: "规则怪谈悬疑封面，诡异空间、冷色压迫、强钩子，标题清晰醒目" },
      { name: "女频复仇", text: "女频重生复仇封面，古风华丽、红金或白金配色，人物情绪克制，标题装帧精致" },
      { name: "全民转职", text: "全民转职封面，职业觉醒法阵、技能特效、怪物压迫、学院或战场背景，标题要燃" }
    ]
  },
  {
    label: "都市爽文",
    prompts: [
      { name: "职场逆袭", text: "都市职场逆袭封面，写字楼、数据屏、合同文件、主角从容翻盘，标题商业感强" },
      { name: "都市神豪", text: "都市神豪封面，高楼夜景、豪车、黑卡、金色光效，主角气场强，标题巨大醒目" },
      { name: "高手下山", text: "都市高手下山封面，山门、都市天际线、医武双绝气质，主角冷静强势，标题有江湖感" },
      { name: "赘婿逆袭", text: "赘婿逆袭封面，家族压迫、身份反转、冷峻男主，标题厚重有打脸爽感" },
      { name: "鉴宝捡漏", text: "都市鉴宝捡漏封面，古玩市场、玉石光泽、透视感特效、众人震惊，标题有暴富爽点" },
      { name: "医武双绝", text: "都市医武封面，银针、药鼎、拳劲或龙形气劲，主角沉稳强大，标题有高手气质" }
    ]
  },
  {
    label: "玄幻仙侠",
    prompts: [
      { name: "废柴崛起", text: "玄幻废柴崛起封面，少年、古老祭坛、血脉觉醒、天地异象，标题霸气厚重" },
      { name: "东方仙侠", text: "东方仙侠封面，青衣剑修、仙门云海、飞剑流光、古典留白，标题飘逸但清晰" },
      { name: "御兽流", text: "御兽封面，主角与神兽并肩，巨兽占据视觉中心，能量环绕，标题有史诗感" },
      { name: "宗门争霸", text: "玄幻宗门争霸封面，山门大阵、弟子列阵、掌门威压、云海金光，标题有压迫感" },
      { name: "魔道反派", text: "魔道反派封面，黑红气息、破碎王座、邪异法阵、主角冷眼俯视，标题锋利醒目" },
      { name: "国风志怪", text: "国风志怪封面，山海异兽、古籍符箓、青绿山水与神秘光影，标题古雅但有冲击力" }
    ]
  },
  {
    label: "科幻游戏",
    prompts: [
      { name: "系统升级", text: "系统流升级封面，主角面前浮现系统面板、奖励光效、战力突破，标题有强烈爽文感" },
      { name: "全民转职", text: "全民转职封面，职业觉醒法阵、技能特效、怪物压迫、学院或战场背景，标题要燃" },
      { name: "游戏降临", text: "游戏降临封面，现实城市与副本裂缝融合，装备、技能、怪物清晰，标题像爆款网游文" },
      { name: "赛博都市", text: "赛博都市封面，霓虹街道、机械义体、数据光幕、冷色未来感，标题硬朗清晰" },
      { name: "星际机甲", text: "星际机甲封面，巨型机甲、星舰、宇宙战场、蓝白能量光，标题硬核科幻感" },
      { name: "AI未来", text: "AI未来封面，数据洪流、仿生人剪影、城市中控屏、冷色科技感，标题清晰高级" }
    ]
  },
  {
    label: "悬疑末世",
    prompts: [
      { name: "规则怪谈", text: "规则怪谈悬疑封面，诡异空间、冷色压迫、强钩子，标题清晰醒目" },
      { name: "无限副本", text: "无限流副本封面，诡异门廊、倒计时、红色警示光、多人剪影，标题紧张醒目" },
      { name: "灵异悬疑", text: "灵异悬疑封面，老宅、红伞、雾气、纸符或诡影，画面克制高级，标题有压迫感" },
      { name: "末世生存", text: "末世生存封面，废墟、破晓、危机和希望并存，标题厚重醒目，商业感强" },
      { name: "末世囤货", text: "末世囤货封面，城市废墟、安全屋、物资、风雪或丧尸威胁，标题醒目有安全感" },
      { name: "刑侦推理", text: "刑侦推理封面，雨夜街巷、警戒线、档案照片、冷光手电，标题克制有悬念" }
    ]
  },
  {
    label: "女频古言",
    prompts: [
      { name: "古言权谋", text: "古言权谋封面，宫墙、凤冠、烛火、暗纹锦衣，女主眼神坚定，标题端庄贵气" },
      { name: "宫斗宅斗", text: "宫斗宅斗封面，深宫回廊、珠帘、华服女子、暗色烛光，标题精致有暗涌" },
      { name: "穿书反派", text: "古风穿书反派封面，卷轴、命簿、华丽衣袂、女主笑意克制，标题轻巧有钩子" },
      { name: "医妃逆袭", text: "古代医妃封面，药箱、银针、王府庭院、清冷女主，标题华丽醒目" },
      { name: "仙侠虐恋", text: "女频仙侠封面，仙台、落花、长剑、白衣男女远景，唯美但有宿命感标题" },
      { name: "重生嫡女", text: "重生嫡女封面，朱门、锦衣、金簪、女主回眸，标题有复仇和贵气" }
    ]
  },
  {
    label: "女频现言",
    prompts: [
      { name: "现言豪门", text: "现言豪门封面，都市夜景、冷感西装、红裙或白裙、情绪拉扯，标题精致高级" },
      { name: "先婚后爱", text: "先婚后爱封面，婚戒、协议书、城市公寓、男女主若即若离，标题浪漫清晰" },
      { name: "娱乐圈", text: "娱乐圈甜宠封面，聚光灯、红毯、摄影机、明星感人物，标题精致有流量感" },
      { name: "霸总追妻", text: "霸总追妻封面，雨夜车灯、冷峻西装、红裙背影、情绪拉满，标题强戏剧感" },
      { name: "校园青春", text: "校园青春封面，操场、课桌、夏日光影、少年少女剪影，标题清新明亮" },
      { name: "女性成长", text: "女性成长封面，城市清晨、通勤、咖啡、独立女性背影，标题干净高级" }
    ]
  },
  {
    label: "种田年代",
    prompts: [
      { name: "年代文", text: "年代文封面，复古街巷、暖色阳光、自行车、粮票或老物件，人物真实有烟火气" },
      { name: "种田经商", text: "种田经商封面，田园、铺子、粮仓、美食或银票，温暖明亮，标题清爽耐看" },
      { name: "美食经营", text: "美食经营封面，热气腾腾的小店、招牌、烟火人间、食物特写，标题亲切有食欲" },
      { name: "七零八零", text: "七零八零年代封面，搪瓷杯、老式院落、军绿色元素、暖阳人物，标题复古耐看" },
      { name: "萌宝团宠", text: "萌宝团宠封面，温暖家庭、小院、可爱孩子和柔和阳光，标题甜暖醒目" },
      { name: "空间囤货", text: "空间囤货封面，仓库货架、灵泉空间、田园与物资并置，标题有爽感和安全感" }
    ]
  },
  {
    label: "历史军事",
    prompts: [
      { name: "历史争霸", text: "历史争霸封面，城墙、战旗、甲胄、烽火与帝王气，标题大气有权谋感" },
      { name: "架空王朝", text: "架空王朝封面，金殿、龙纹、棋盘、群臣剪影，标题庄重有帝王权谋感" },
      { name: "寒门科举", text: "寒门科举封面，书卷、贡院、青衫书生、晨光门楼，标题清雅但有上升感" },
      { name: "大明大唐", text: "王朝历史封面，宫城、旌旗、甲士、地图纹理，标题厚重有历史纵深" },
      { name: "战争军旅", text: "战争军旅封面，硝烟、战壕、军装剪影、火光与钢铁质感，标题硬朗醒目" },
      { name: "谍战风云", text: "谍战封面，旧上海街灯、密码纸、风衣背影、暗色胶片感，标题紧张高级" }
    ]
  },
  {
    label: "轻松脑洞",
    prompts: [
      { name: "沙雕爆笑", text: "沙雕爆笑封面，夸张表情、反差道具、明亮色彩、轻喜剧构图，标题有网感" },
      { name: "萌宠治愈", text: "萌宠治愈封面，软萌宠物、暖色房间、阳光和小物件，标题可爱清爽" },
      { name: "脑洞反套路", text: "脑洞反套路封面，荒诞场景、强反差主体、醒目标题，整体有短视频爆点感" },
      { name: "直播带货", text: "直播带货封面，手机直播间界面、弹幕、商品、主角自信出镜，标题有流量感" },
      { name: "萌娃奶爸", text: "萌娃奶爸封面，年轻父亲、可爱孩子、生活小混乱、明亮温暖，标题亲切有梗" },
      { name: "动物成精", text: "动物拟人奇幻封面，灵动动物、城市或山林奇遇、轻松幽默氛围，标题清楚有趣" }
    ]
  },
  {
    label: "短剧爆款",
    prompts: [
      { name: "强冲突短剧", text: "短剧爆款封面，人物表情强烈、冲突关系一眼看懂，大标题占画面上半部，颜色高对比" },
      { name: "身份反转", text: "身份反转封面，穷困外表与豪门背景强对比、众人震惊，标题突出反差和逆袭爽点" },
      { name: "婚恋拉扯", text: "婚恋短剧封面，男女主近景对峙、戒指或协议书、冷暖光对比，标题直给情绪钩子" },
      { name: "复仇归来", text: "复仇归来封面，主角正面强势、背后火光或豪宅、反派阴影，标题有回归碾压感" },
      { name: "真假千金", text: "真假千金封面，华丽宴会、两位女性对比、身份牌或项链线索，标题清楚有戏剧性" },
      { name: "战神归来", text: "战神归来封面，军装或黑衣主角、城市夜景、风暴光效，标题霸气醒目" }
    ]
  }
];

export function AiCoverGeneratorDialog({
  open,
  title,
  authorName,
  onClose,
  onGenerated
}: AiCoverGeneratorDialogProps) {
  const [bookTitle, setBookTitle] = useState(title);
  const [bookAuthor, setBookAuthor] = useState(authorName ?? "");
  const [stylePrompt, setStylePrompt] = useState("");
  const [quota, setQuota] = useState<CoverQuota | null>(null);
  const [configured, setConfigured] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [activePromptGroup, setActivePromptGroup] = useState(stylePromptGroups[0].label);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setBookTitle(title);
    setBookAuthor(authorName ?? "");
    setError("");
    setIsLoadingStatus(true);
    fetch("/api/cover-image/generate", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(body?.error || "获取封面生成状态失败");
        }

        setConfigured(Boolean(body.configured));
        setQuota(body.quota ?? null);
      })
      .catch((statusError) => setError(statusError instanceof Error ? statusError.message : "获取封面生成状态失败"))
      .finally(() => setIsLoadingStatus(false));
  }, [authorName, open, title]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const remaining = quota?.remaining ?? 0;
  const isGenerating = false;
  const canGenerate = configured && remaining > 0 && bookTitle.trim().length > 0 && !isGenerating;
  const quotaHint = isLoadingStatus
    ? "正在读取今日剩余次数..."
    : remaining > 0
      ? `点击生成会消耗 1 次，生成后剩余 ${Math.max(0, remaining - 1)} 次。`
      : "今日次数已用完，请明天再试。";
  const selectedPromptGroup = stylePromptGroups.find((group) => group.label === activePromptGroup) ?? stylePromptGroups[0];

  function generateCover() {
    if (!canGenerate) {
      return;
    }

    setError("");
    requestCoverImageGeneration({
      title: bookTitle,
      authorName: bookAuthor,
      stylePrompt,
      onGenerated
    });
    onClose();
  }

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="tag-dialog-backdrop ai-cover-dialog-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="tag-dialog ai-cover-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-cover-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tag-dialog-head">
          <div>
            <h3 id="ai-cover-dialog-title">AI 生成封面</h3>
            <span className="muted">每日次数按当前 Key 的后台配置限制，生成后可预览、下载或选择使用。</span>
          </div>
          <button className="tag-dialog-close" type="button" onClick={onClose} aria-label="关闭 AI 生成封面">
            ×
          </button>
        </div>

        <div className="ai-cover-dialog-body">
          <div className="split-panels">
            <div className="field">
              <div className="field-label">书名</div>
              <input value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} maxLength={60} placeholder="请输入书名" />
            </div>
            <div className="field">
              <div className="field-label">作者名</div>
              <input value={bookAuthor} onChange={(event) => setBookAuthor(event.target.value)} maxLength={20} placeholder="请输入作者名" />
            </div>
          </div>

          <div className="field">
            <div className="field-label">画面风格描述（选填，不写 AI 也会根据小说标题自动推断）</div>
            <textarea
              value={stylePrompt}
              onChange={(event) => setStylePrompt(event.target.value)}
              maxLength={500}
              placeholder="写题材、主角姿态、场景、色彩、氛围和封面质感，例如：都市逆袭，雨夜高楼，主角背影，冷色霓虹，强商业封面感"
            />
            <div className="field-hint">{stylePrompt.length}/500</div>
          </div>
          <section className="ai-cover-prompt-library" aria-labelledby="ai-cover-prompt-library-title">
            <div className="ai-cover-prompt-head">
              <div>
                <div className="field-label" id="ai-cover-prompt-library-title">画面风格参考</div>
                <span>按题材挑一个，再按你的书微调描述。</span>
              </div>
              <div className="ai-cover-prompt-tabs" aria-label="封面风格分类">
                {stylePromptGroups.map((group) => (
                  <button
                    key={group.label}
                    className={group.label === selectedPromptGroup.label ? "active" : ""}
                    type="button"
                    onClick={() => setActivePromptGroup(group.label)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ai-cover-style-grid">
              {selectedPromptGroup.prompts.map((prompt) => (
                <button
                  key={prompt.text}
                  className={stylePrompt === prompt.text ? "ai-cover-prompt-card active" : "ai-cover-prompt-card"}
                  type="button"
                  onClick={() => setStylePrompt(prompt.text)}
                >
                  <strong>{prompt.name}</strong>
                  <span>{prompt.text}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="quote-box warning-box">
            {isLoadingStatus
              ? "正在读取今日剩余次数..."
              : configured
                ? `今日还可免费生成 ${remaining}/${quota?.limit ?? 3} 次。`
                : "后台还没有配置封面生图 Key，请管理员先到授权后台填写。"}
          </div>
          {error ? <div className="field-hint project-cover-error">{error}</div> : null}
        </div>

        <div className="tag-dialog-foot">
          <span>{quotaHint}</span>
          <div className="hero-actions">
            <button className="button" type="button" onClick={onClose}>
              取消
            </button>
            <button className="button primary" type="button" onClick={generateCover} disabled={!canGenerate}>
              后台生成封面
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
