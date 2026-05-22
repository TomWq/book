import type { EntityRelation, PleasurePoint, StoredChapter } from "@/lib/project-types";

export type { EntityRelation, PleasurePoint } from "@/lib/project-types";

export type ChapterAnalysisInput = Pick<
  StoredChapter,
  "id" | "chapterNumber" | "title" | "content"
>;

const conflictKeywords = [
  "退婚",
  "羞辱",
  "冷笑",
  "逼",
  "反派",
  "对手",
  "危机",
  "争夺",
  "背叛",
  "嘲讽",
  "不服",
  "看不起"
];

const payoffKeywords = [
  "系统",
  "奖励",
  "反击",
  "打脸",
  "亮起",
  "获得",
  "拿到",
  "突破",
  "震惊",
  "安静"
];

const goldenFingerKeywords = ["系统", "面板", "空间", "传承", "重生", "签到", "模拟器", "血脉", "天赋"];
const identityKeywords = ["身份", "少主", "继承人", "宗门", "家族", "父亲", "旧案", "真相"];
const resourceKeywords = ["灵石", "丹药", "功法", "合同", "股份", "资源", "名额", "线索", "账本"];
const characterNoiseTokens = [
  "的",
  "并不",
  "不再",
  "不会",
  "不能",
  "没有",
  "很清",
  "默默",
  "拿",
  "身边",
  "此时",
  "面前",
  "心里",
  "沉思",
  "思忖",
  "思索",
  "反应",
  "表",
  "面",
  "声",
  "声音",
  "目光",
  "眼神",
  "神色",
  "脸色",
  "身体",
  "动作",
  "身份",
  "情况",
  "选择",
  "决定",
  "发现",
  "意识",
  "想到",
  "觉得",
  "知道",
  "明白",
  "开始",
  "继续",
  "只能",
  "需要",
  "必须",
  "已经",
  "转身",
  "摇",
  "听",
  "看",
  "说",
  "从",
  "被",
  "把",
  "给",
  "和",
  "与",
  "对",
  "将",
  "却",
  "也",
  "都",
  "就",
  "才",
  "又",
  "还",
  "更",
  "最",
  "已",
  "正",
  "来",
  "去",
  "到",
  "出",
  "这",
  "那"
];

const characterRoleSuffixes = [
  "老",
  "总",
  "少",
  "爷",
  "姐",
  "哥",
  "叔",
  "姨",
  "大夫",
  "医生",
  "教官",
  "导师",
  "掌柜",
  "长老",
  "院长",
  "局长",
  "队长",
  "师父",
  "师傅"
];

function splitSentences(content: string) {
  return content
    .split(/(?<=[。！？!?])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findSentence(sentences: string[], keywords: string[]) {
  return sentences.find((sentence) => keywords.some((keyword) => sentence.includes(keyword)));
}

function inferPleasureType(content: string) {
  if (content.includes("系统") || content.includes("奖励")) {
    return "金手指奖励";
  }

  if (content.includes("震惊") || content.includes("安静")) {
    return "众人震惊";
  }

  if (content.includes("退婚") || content.includes("羞辱") || content.includes("看不起")) {
    return "被轻视后反击";
  }

  if (content.includes("反派") || content.includes("对手")) {
    return "打脸反派";
  }

  return "情绪释放";
}

function countKeywordHits(analyses: Array<ReturnType<typeof analyzeChapter>>, keywords: string[]) {
  return analyses.reduce((count, analysis) => {
    const content = [
      analysis.summary,
      analysis.mainEvent,
      analysis.conflict,
      analysis.payoff,
      analysis.cliffhanger,
      ...analysis.newInformation,
      ...analysis.stateChanges
    ].join("\n");

    return count + keywords.filter((keyword) => content.includes(keyword)).length;
  }, 0);
}

function inferGenre(topTypes: string[], analyses: Array<ReturnType<typeof analyzeChapter>>) {
  const allText = analyses
    .map((analysis) => `${analysis.summary}\n${analysis.conflict}\n${analysis.payoff}`)
    .join("\n");

  if (/灵石|宗门|修炼|丹药|功法|境界/.test(allText)) {
    return "玄幻 / 修仙升级";
  }

  if (/直播|粉丝|热搜|平台/.test(allText)) {
    return "直播 / 娱乐爽文";
  }

  if (/重生|前世|上一世/.test(allText)) {
    return "重生复仇";
  }

  if (topTypes.some((type) => type.includes("金手指"))) {
    return "系统金手指流";
  }

  return "爽点驱动型网文";
}

export function normalizeCharacterName(value: string) {
  const compact = String(value ?? "")
    .replace(/[《》“”"'`【】\[\]（）()]/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!compact) {
    return "";
  }

  const firstPart = compact.split(/[：:，,。；;、！？!?]/)[0] ?? "";
  const noiseIndex = characterNoiseTokens
    .map((token) => firstPart.indexOf(token))
    .filter((index) => index > 0)
    .sort((a, b) => a - b)[0];
  const candidate = (typeof noiseIndex === "number" ? firstPart.slice(0, noiseIndex) : firstPart)
    .replace(/[啊呢吧吗呀啦嘛呐了的着过]+$/g, "")
    .trim();

  if (!/^[\u4e00-\u9fa5A-Za-z·]{2,6}$/.test(candidate)) {
    return "";
  }

  if (/[啊呢吧吗呀啦嘛呐了的着过]$/.test(candidate)) {
    return "";
  }

  if (characterNoiseTokens.some((token) => candidate.includes(token))) {
    return "";
  }

  if (/^(主角|众人|敌人|反派|男人|女人|少年|少女|老人|同学|老师|医生|护士|教官|师兄|师姐|父亲|母亲)$/.test(candidate)) {
    return "";
  }

  const looksLikeChineseName = /^[\u4e00-\u9fa5]{2,4}$/.test(candidate);
  const looksLikeRoleName = characterRoleSuffixes.some(
    (suffix) => candidate.length > suffix.length && candidate.endsWith(suffix)
  );
  const looksLikeForeignName = /^[A-Za-z·]{2,}$/.test(candidate);

  return looksLikeChineseName || looksLikeRoleName || looksLikeForeignName ? candidate : "";
}

export function sanitizeCharacterNames(values: string[]) {
  return Array.from(
    new Set(values.map((value) => normalizeCharacterName(value)).filter(Boolean))
  );
}

export function normalizeCharacterMentions(values: string[]) {
  const normalizedValues = values.map((value) => ({
    raw: String(value ?? "").trim(),
    normalized: normalizeCharacterName(value)
  }));
  const baseNames = Array.from(
    new Set(
      normalizedValues
        .map((item) => item.normalized)
        .filter((name) => name.length >= 2 && name.length <= 4)
    )
  ).sort((a, b) => a.length - b.length || a.localeCompare(b, "zh-CN"));

  return normalizedValues
    .map((item) => {
      if (!item.normalized) {
        return "";
      }

      const prefixBase = baseNames.find(
        (name) => item.normalized !== name && item.normalized.startsWith(name)
      );

      return prefixBase ?? item.normalized;
    })
    .filter(Boolean);
}

function extractPotentialCharacters(content: string) {
  const matches = content.match(/[秦赵王李陈林周吴郑钱孙][\u4e00-\u9fa5]{1,5}/g) ?? [];
  return sanitizeCharacterNames(matches).slice(0, 5);
}

export function analyzeChapter(chapter: ChapterAnalysisInput) {
  const sentences = splitSentences(chapter.content);
  const firstSentence = sentences[0] ?? chapter.content.slice(0, 80);
  const lastSentence = sentences.at(-1) ?? firstSentence;
  const conflict = findSentence(sentences, conflictKeywords) ?? firstSentence;
  const payoff = findSentence(sentences, payoffKeywords) ?? lastSentence;
  const type = inferPleasureType(chapter.content);

  const pleasurePoints: PleasurePoint[] = [
    {
      type,
      setup: conflict,
      release: payoff,
      whyItWorks:
        type === "情绪释放"
          ? "本章通过冲突后的状态变化给读者继续阅读的理由。"
          : "本章先制造压制和误判，再释放反击或奖励，形成清晰的情绪回报。",
      drivesMainPlot: true
    }
  ];

  return {
    summary: `${chapter.title}：${firstSentence}`,
    mainEvent: firstSentence,
    conflict,
    pressurePoint: conflict,
    payoff,
    cliffhanger: lastSentence,
    readerHook: `读者会想知道：${lastSentence}`,
    newInformation: sentences.slice(0, 3),
    newCharacters: extractPotentialCharacters(chapter.content),
    stateChanges: [payoff],
    entityRelations: [] as EntityRelation[],
    pleasurePoints
  };
}

export function buildStoryAnalysis(analyses: Array<ReturnType<typeof analyzeChapter>>) {
  const typeCounts = new Map<string, number>();

  analyses.forEach((analysis) => {
    analysis.pleasurePoints.forEach((point) => {
      typeCounts.set(point.type, (typeCounts.get(point.type) ?? 0) + 1);
    });
  });

  const topTypes = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([type, count]) => `${type} ${count} 次`);
  const genre = inferGenre(topTypes, analyses);
  const hasGoldenFinger = countKeywordHits(analyses, goldenFingerKeywords) > 0;
  const hasIdentityLine = countKeywordHits(analyses, identityKeywords) > 0;
  const hasResourceLine = countKeywordHits(analyses, resourceKeywords) > 0;
  const topPleasure = topTypes[0]?.replace(/\s+\d+\s*次$/, "") || "情绪释放";
  const firstConflict = analyses[0]?.conflict ?? "尚未形成明确开局钩子";
  const openingModel = firstConflict.includes("退婚")
    ? "关系破裂与公开压力开局"
    : firstConflict.includes("看不起") || firstConflict.includes("羞辱")
      ? "误判压制开局"
      : "核心问题先行开局";
  const goldenFingerMechanism = hasGoldenFinger
    ? "特殊机制早期提供方向和第一次收益，中后期应增加代价、限制或门槛。"
    : "当前样本未出现强外挂机制，可把信息差、身份差或资源差作为推进动力。";
  const usablePatterns = [
    "先建立压力或误判，再给核心人物一个有限行动窗口。",
    "每章保留一个明确状态变化，让读者知道剧情没有原地打转。",
    hasResourceLine ? "用资源、线索或资格变化承接回报，并推动下一层冲突。" : "用新的阻碍或待解问题承接回报，避免单章结束后失去追读理由。",
    hasIdentityLine ? "身份、旧案或秘密线只露一角，不提前讲透真相。" : "重要信息分批揭示，保留断章钩子。"
  ];
  const avoidCopying = [
    "不要照搬原作角色姓名、势力名和标志性设定。",
    "不要按原作章节顺序重写同一组桥段。",
    "不要复制原文句子、口头禅或独特场景表达。",
    "只能复用抽象结构：压制、反击、收益、升级和断章方式。"
  ];

  return {
    genre,
    protagonistModel: "处于压力、误判或资源不足状态，但逐步获得行动窗口的核心人物",
    openingModel,
    goldenFingerMechanism,
    villainFunction: "阻力方负责制造压力、误判和升级成本，不能只做一次性衬托工具。",
    supportingRoles: "配角承担见证、误判、资源转交和信息差放大的功能。",
    mapProgression: "从个人处境进入小圈层冲突，再逐步扩展到更高层级的关系、势力或地图。",
    usablePatterns,
    avoidCopying,
    openingHook: firstConflict,
    mainLoop: "压力 / 误判 → 冲突加码 → 核心人物获得行动窗口 → 回报释放 → 留下下一章钩子",
    pacing:
      analyses.length >= 3
        ? "当前样本基本做到每章都有冲突或状态变化，适合继续进入 AI 精拆。"
        : "章节样本较少，节奏判断还需要更多章节。",
    topPleasureTypes: topTypes,
    formula: `${openingModel} → ${topPleasure} → 状态变化 → 引出新的阻碍或信息`,
    migrationAdvice: "迁移时只保留压力、行动窗口、回报和断章方式，题材、人设、世界观与具体桥段需要重新设计。"
  };
}
