import {
  attachAiTokenUsage,
  combineAiTokenUsages,
  getAiTokenUsage,
  requestAiJson
} from "@/lib/ai/client";
import { maxProjectDescriptionLength } from "@/lib/project-limits";
import { randomUUID } from "node:crypto";

export type ProjectCreationAssistAction = "titles" | "protagonists" | "description" | "titleConcept" | "storyDesign";
export type TitleNamingStyle = "fanqie" | "qidian";
export type TagTaxonomyStyle = "fanqie" | "qidian";
export type DescriptionWritingStyle = "fanqie" | "qidian";
export type DescriptionAssistMode = "generate" | "polish";
export type WorkLengthType = "short" | "medium" | "long" | "epic";
export type ProjectCreationCharacterRole = "男主" | "女主" | "男配" | "女配";
export type ProjectCreationCharacterInput = {
  role: ProjectCreationCharacterRole;
  name?: string;
};

export type ProjectCreationAssistInput = {
  action: ProjectCreationAssistAction;
  name?: string;
  storyIdea?: string;
  titleConcept?: string;
  genre?: string;
  categoryDescription?: string;
  targetReader?: string;
  tags?: string[];
  protagonistNames?: string[];
  protagonistCharacters?: ProjectCreationCharacterInput[];
  coreSellingPoint?: string;
  goldenFinger?: string;
  openingHook?: string;
  workLengthType?: WorkLengthType;
  targetTotalWords?: number;
  description?: string;
  descriptionAssistMode?: DescriptionAssistMode;
  titleNamingStyle?: TitleNamingStyle;
  tagTaxonomyStyle?: TagTaxonomyStyle;
  descriptionWritingStyle?: DescriptionWritingStyle;
  avoidTitles?: string[];
};

export type ProjectCreationStoryDesign = {
  titleOptions: string[];
  logline: string;
  intro: string;
  coreSellingPoint: string;
  coreConflict: string;
  protagonistDesign: string;
  goldenFinger: string;
  openingHook: string;
  mainLoop: string;
  worldSetting: string;
  characterSuggestions: ProjectCreationCharacterInput[];
  first10Chapters: string[];
  pleasurePoints: string[];
  foreshadowing: string[];
  risksToAvoid: string[];
  recommendedGenre: string;
  recommendedTags: string[];
};

export type ProjectCreationAssistResult = {
  titles: string[];
  protagonistNames: string[];
  protagonistCharacters: ProjectCreationCharacterInput[];
  description: string;
  titleConcept: string;
  storyDesign: ProjectCreationStoryDesign | null;
};

const maxProjectCharacters = 20;

function stringField(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const item = record[key];

    if (typeof item === "string" && item.trim()) {
      return item;
    }
  }

  return "";
}

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function compactText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function textList(value: unknown, limit: number, maxLength: number) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|；|;/)
      : [];

  return items
    .map((item) => compactText(item, maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

function cleanTitleText(value: string) {
  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[“"‘'「『【\[（(]+/, "")
    .replace(/[”"’'」』】\]）)]+$/, "")
    .trim();
}

function titleFingerprint(value: string) {
  return cleanTitleText(value)
    .replace(/[《》“”"‘'「」『』【】[\]（）()：:，,。.!！?？、\s_-]+/g, "")
    .toLowerCase();
}

function titleBigrams(value: string) {
  const chars = Array.from(titleFingerprint(value));

  if (chars.length <= 1) {
    return chars;
  }

  return chars.slice(0, -1).map((char, index) => `${char}${chars[index + 1]}`);
}

function titleSimilarity(a: string, b: string) {
  const left = titleBigrams(a);
  const right = titleBigrams(b);

  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightCounts = new Map<string, number>();
  right.forEach((item) => rightCounts.set(item, (rightCounts.get(item) ?? 0) + 1));
  const overlap = left.reduce((sum, item) => {
    const count = rightCounts.get(item) ?? 0;

    if (count <= 0) {
      return sum;
    }

    rightCounts.set(item, count - 1);
    return sum + 1;
  }, 0);

  return (2 * overlap) / (left.length + right.length);
}

function isTitleTooClose(candidate: string, avoidTitle: string) {
  const candidateKey = titleFingerprint(candidate);
  const avoidKey = titleFingerprint(avoidTitle);

  if (!candidateKey || !avoidKey) {
    return false;
  }

  if (candidateKey === avoidKey) {
    return true;
  }

  if ((candidateKey.length >= 4 || avoidKey.length >= 4) && (candidateKey.includes(avoidKey) || avoidKey.includes(candidateKey))) {
    return true;
  }

  return titleSimilarity(candidateKey, avoidKey) >= 0.72;
}

function uniqueTitles(titles: string[], avoidTitles: string[]) {
  return titles.reduce<string[]>((result, title) => {
    const cleanTitle = cleanTitleText(title);

    if (!cleanTitle) {
      return result;
    }

    const isRepeated = result.some((item) => isTitleTooClose(cleanTitle, item));
    const isAvoided = avoidTitles.some((item) => isTitleTooClose(cleanTitle, item));

    if (!isRepeated && !isAvoided) {
      result.push(cleanTitle);
    }

    return result;
  }, []);
}

function titleCharacterLength(value: string) {
  return Array.from(value.replace(/\s/g, "")).length;
}

type TitleQualityOptions = {
  style: TitleNamingStyle;
  titleConcept?: string;
  directLabelTerms?: string[];
  hasConcreteTitleFacts?: boolean;
  strict?: boolean;
};

type ScoredTitle = {
  title: string;
  index: number;
  score: number;
};

function joinPromptSignals(values: Array<string | undefined>) {
  return values.map((item) => String(item ?? "").trim()).filter(Boolean).join(" ");
}

function hasConcreteTitleFacts(values: Array<string | undefined>) {
  const meaningfulValues = values
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .filter((item) => {
      const parts = item.split(/[，,、/；;\s]+/).map((part) => titleFingerprint(part)).filter(Boolean);
      const compact = titleFingerprint(item);

      if (parts.length >= 2 && parts.every((part) => part.length <= 6)) {
        return false;
      }

      return compact.length >= 8;
    });
  const signal = joinPromptSignals(meaningfulValues);
  const compactSignal = titleFingerprint(signal);

  if (compactSignal.length >= 12) {
    return true;
  }

  return meaningfulValues.some((item) => titleFingerprint(item).length >= 8);
}

function titleQualityScore(title: string, options: TitleQualityOptions) {
  const cleanTitle = cleanTitleText(title);
  const compactTitle = cleanTitle.replace(/\s+/g, "");
  const compactFingerprint = titleFingerprint(cleanTitle);
  const length = titleCharacterLength(cleanTitle);
  const titleConceptFingerprint = titleFingerprint(options.titleConcept ?? "");

  if (!compactTitle || !compactFingerprint) {
    return -100;
  }

  if (options.style === "qidian" && (length < 2 || length > 12)) {
    return -90;
  }

  if (options.style === "fanqie" && (length < 8 || length > 24)) {
    return -80;
  }

  if (/[：:]/.test(cleanTitle)) {
    return -85;
  }

  let score = 100;

  if (options.style === "qidian" && /[，,。.!！?？；;]/.test(cleanTitle)) {
    score -= 18;
  }

  if (options.style === "qidian" && /[：:]/.test(cleanTitle)) {
    score -= 8;
  }

  if (options.style === "fanqie") {
    if (/(从|自)[^，,。.!！?？；;：:]{1,10}(到|至|入|进)[^，,。.!！?？；;：:]{1,12}/.test(compactTitle)) {
      return -75;
    }

    if (/^(步步|一路|从此|后来|最终)/.test(compactTitle)) {
      score -= 24;
    }

    if (/(之路|路上|成长路|逆袭路|成名路|上位路|掌权路|传|记|录)$/.test(compactTitle)) {
      score -= 30;
    }

    if (/(受欺|受辱|受虐|被欺|被辱|被虐).{0,8}(封|称|成|为|掌|夺|权)/.test(compactTitle)) {
      score -= 32;
    }

    if (/^(她|他|你|我|谁|吾|朕)/.test(compactTitle)) {
      if (!options.hasConcreteTitleFacts) {
        return -70;
      }

      score -= 28;
    }

    if (/^[^，,。.!！?？；;：:]{2,16}[，,][^，,。.!！?？；;：:]{2,16}$/.test(compactTitle)) {
      if (!options.hasConcreteTitleFacts) {
        return -70;
      }

      score -= 26;
    }

    if (/(整个|所有|人人|众人|全都|无人|一切).{0,8}(为|替|给|向|被|都)/.test(compactTitle)) {
      score -= 16;
    }

    if (/^一[\u4e00-\u9fa5]{1,2}.{0,12}(让|令|使|把)/.test(compactTitle)) {
      score -= 18;
    }

    if (/以[^，,。.!！?？；;：:]{1,8}之力/.test(compactTitle)) {
      score -= 26;
    }

    if (!options.hasConcreteTitleFacts && /(她|他|你|我|吾|朕).{0,8}(敢|要|只|就|偏|却|不)/.test(compactTitle)) {
      return -70;
    }
  }

  if (options.style === "qidian") {
    if (length <= 4) {
      const titleConceptFingerprint = titleFingerprint(options.titleConcept ?? "");
      const hasDirectConceptSignal =
        titleConceptFingerprint.length > 0 &&
        titleBigrams(compactTitle).some((item) => titleConceptFingerprint.includes(item));

      if (titleConceptFingerprint.length >= 4 && !hasDirectConceptSignal) {
        score -= 8;
      }
    }
  }

  if (titleConceptFingerprint.length >= 8 && titleConceptFingerprint.includes(compactFingerprint)) {
    score -= 26;
  }

  const directLabelHits = (options.directLabelTerms ?? [])
    .map((item) => titleFingerprint(item))
    .filter((item) => item.length >= 2 && compactFingerprint.includes(item)).length;

  if (directLabelHits >= 2) {
    score -= 18;
  } else if (directLabelHits === 1 && compactFingerprint.length <= 6) {
    score -= 12;
  }

  if (options.style === "qidian") {
    if (length >= 3 && length <= 8) {
      score += 8;
    }
  } else {
    if (length >= 8 && length <= 18) {
      score += 7;
    }
  }

  return score;
}

function selectDiverseTitles(scoredTitles: ScoredTitle[], limit: number) {
  const selected: ScoredTitle[] = [];
  const remaining = [...scoredTitles];

  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = 0;
    let bestRank = -Infinity;

    remaining.forEach((candidate, index) => {
      const closestSelectedSimilarity =
        selected.length > 0
          ? Math.max(...selected.map((item) => titleSimilarity(candidate.title, item.title)))
          : 0;
      const rank = candidate.score - closestSelectedSimilarity * 24 - candidate.index * 0.01;

      if (rank > bestRank) {
        bestRank = rank;
        bestIndex = index;
      }
    });

    selected.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }

  return selected;
}

function normalizeTitles(titles: string[], avoidTitles: string[], qualityOptions?: TitleQualityOptions) {
  const uniqueCandidates = uniqueTitles(titles, avoidTitles);

  if (!qualityOptions) {
    return uniqueCandidates.slice(0, 8);
  }

  const scoredTitles = uniqueCandidates
    .map((title, index) => ({
      title,
      index,
      score: titleQualityScore(title, qualityOptions)
    }))
    .filter((item) => item.score > -60 && (!qualityOptions.strict || item.score >= 62));

  return selectDiverseTitles(scoredTitles, 8).map((item) => item.title);
}

function normalizeTitlesWithFallback(
  titles: string[],
  avoidTitles: string[],
  qualityOptions: TitleQualityOptions,
  limit = 8
) {
  const strictTitles = normalizeTitles(titles, avoidTitles, qualityOptions);

  if (strictTitles.length > 0) {
    return strictTitles.slice(0, limit);
  }

  const uniqueCandidates = uniqueTitles(titles, avoidTitles);
  const scoredTitles = uniqueCandidates
    .map((title, index) => ({
      title,
      index,
      score: titleQualityScore(title, qualityOptions)
    }))
    .filter((item) => item.score > -60);

  return selectDiverseTitles(scoredTitles, limit).map((item) => item.title);
}

function normalizeStoryDesign(
  value: unknown,
  avoidTitles: string[] = [],
  titleQualityOptions?: TitleQualityOptions,
  targetReader?: string
): ProjectCreationStoryDesign | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = "storyDesign" in value && (value as Record<string, unknown>).storyDesign
    ? (value as Record<string, unknown>).storyDesign
    : value;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const titleOptions = normalizeTitles(
    textList(record.titleOptions ?? record.titles, 10, 80),
    avoidTitles,
    titleQualityOptions
  ).slice(0, 6);
  const characterSuggestions = normalizeCharacters(
    record.characterSuggestions ?? record.characters ?? record.protagonistCharacters,
    targetReader
  ).slice(0, 8);
  const design: ProjectCreationStoryDesign = {
    titleOptions,
    logline: compactText(stringField(record, ["logline", "oneSentence", "pitch"]), 220),
    intro: compactText(stringField(record, ["intro", "description", "summary"]), maxProjectDescriptionLength),
    coreSellingPoint: compactText(stringField(record, ["coreSellingPoint", "sellingPoint"]), 320),
    coreConflict: compactText(stringField(record, ["coreConflict", "conflict"]), 360),
    protagonistDesign: compactText(stringField(record, ["protagonistDesign", "protagonist", "protagonistModel"]), 360),
    goldenFinger: compactText(stringField(record, ["goldenFinger", "goldenFingerMechanism", "keyMechanism"]), 360),
    openingHook: compactText(stringField(record, ["openingHook", "hook"]), 360),
    mainLoop: compactText(stringField(record, ["mainLoop", "storyLoop", "coreLoop"]), 360),
    worldSetting: compactText(stringField(record, ["worldSetting", "world", "setting"]), 520),
    characterSuggestions,
    first10Chapters: textList(record.first10Chapters ?? record.chapters, 10, 320),
    pleasurePoints: textList(record.pleasurePoints ?? record.payoffs ?? record.sellingPoints, 10, 320),
    foreshadowing: textList(record.foreshadowing ?? record.foreshadowingPlan, 8, 300),
    risksToAvoid: textList(record.risksToAvoid ?? record.avoidCopying ?? record.risks, 8, 300),
    recommendedGenre: compactText(stringField(record, ["recommendedGenre", "genre"]), 40),
    recommendedTags: textList(record.recommendedTags ?? record.tags, 6, 40)
  };
  const hasContent =
    design.titleOptions.length > 0 ||
    design.logline ||
    design.intro ||
    design.coreSellingPoint ||
    design.coreConflict ||
    design.goldenFinger ||
    design.first10Chapters.length > 0;

  return hasContent ? design : null;
}

function normalizeResult(
  value: Partial<ProjectCreationAssistResult>,
  avoidTitles: string[] = [],
  titleQualityOptions?: TitleQualityOptions,
  targetReader?: string
) {
  return attachAiTokenUsage({
    titles: normalizeTitles(list(value.titles), avoidTitles, titleQualityOptions),
    protagonistNames: list(value.protagonistNames).slice(0, maxProjectCharacters),
    protagonistCharacters: normalizeCharacters(value.protagonistCharacters, targetReader),
    description: compactText(String(value.description ?? ""), maxProjectDescriptionLength),
    titleConcept: stringField(value, ["titleConcept", "polishedTitleConcept", "titleDirection", "directionMaterial", "content"])
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500),
    storyDesign: normalizeStoryDesign(value, avoidTitles, titleQualityOptions, targetReader)
  }, getAiTokenUsage(value));
}

function normalizeSimpleTitles(titles: string[], avoidTitles: string[], titleNamingStyle: TitleNamingStyle) {
  void titleNamingStyle;
  const seenKeys = new Set<string>();
  const avoidKeys = new Set(avoidTitles.map(titleFingerprint).filter(Boolean));

  return titles
    .map(cleanTitleText)
    .filter(Boolean)
    .filter((title) => {
      const key = titleFingerprint(title);

      if (!key || seenKeys.has(key) || avoidKeys.has(key)) {
        return false;
      }

      seenKeys.add(key);
      return true;
    })
    .slice(0, 6);
}

async function generateSimpleTitlesWithAi(input: ProjectCreationAssistInput, titleNamingStyle: TitleNamingStyle) {
  const titleConcept = String(input.titleConcept ?? "").replace(/\s+/g, " ").trim().slice(0, 500);

  if (!titleConcept) {
    throw new Error("请先在书本名称上方填写起名前描述，再让 AI 起名。");
  }

  const isLengthLimitError = (error: unknown) =>
    error instanceof Error && /长度限制截断|length/i.test(error.message);
  const avoidTitles = (input.avoidTitles ?? []).map(cleanTitleText).filter(Boolean);
  const styleDescription = titleNamingStyle === "qidian"
    ? "起点小说风格：短书名，偏凝练，有类型感和书架感。"
    : "番茄小说风格：中长书名，直白好懂，要让读者快速看出主角处境、冲突或爽点，不要生成短书名。";
  const buildTitleMessages = (retry = false, compact = false): Parameters<typeof requestAiJson>[0]["messages"] => [
      {
        role: "system",
        content: compact
          ? "只输出合法 JSON 对象：{\"titles\":[\"...\"]}。不要解释。"
          : "你是中文网文平台的新书起名编辑。只输出合法 JSON 对象，格式为 {\"titles\":[\"...\"]}。不要解释、分析、Markdown 或额外字段。"
      },
      {
        role: "user",
        content: compact
          ? JSON.stringify({
              task: `${retry ? "重新" : ""}根据描述生成 6 个${titleNamingStyle === "qidian" ? "起点小说风格" : "番茄小说风格"}的中文网文书名`,
              styleDescription,
              description: titleConcept,
              avoidTitles: avoidTitles.slice(0, 8),
              output: { titles: ["string"] }
            })
          : JSON.stringify(
              {
                task: `${retry ? "重新" : ""}根据描述生成 6 个${titleNamingStyle === "qidian" ? "起点小说风格" : "番茄小说风格"}的中文网文书名。`,
                styleDescription,
                description: titleConcept,
                avoidTitles: avoidTitles.slice(0, 12),
                outputSchema: {
                  titles: "string[]"
                }
              },
            )
      }
    ];
  const requestTitles = async (retry = false, compact = false, maxTokens = 1400) =>
    requestAiJson<Partial<ProjectCreationAssistResult>>({
      messages: buildTitleMessages(retry, compact),
      temperature: titleNamingStyle === "fanqie" ? 0.9 : 0.58,
      maxTokens
    });
  const attempts = [
    { retry: false, compact: false, maxTokens: 1400 },
    { retry: true, compact: true, maxTokens: 2200 },
    { retry: true, compact: false, maxTokens: 2200 }
  ];
  let titles: string[] = [];
  let usage: ReturnType<typeof getAiTokenUsage>;
  let lastLengthError: unknown;

  for (const attempt of attempts) {
    try {
      const response = await requestTitles(attempt.retry, attempt.compact, attempt.maxTokens);
      const nextTitles = normalizeSimpleTitles(list(response.titles), avoidTitles, titleNamingStyle);

      if (nextTitles.length > titles.length) {
        titles = nextTitles;
      }

      usage = getAiTokenUsage(response) ?? usage;

      if (titles.length >= 6) {
        break;
      }
    } catch (error) {
      if (!isLengthLimitError(error)) {
        throw error;
      }

      lastLengthError = error;
    }
  }

  if (titles.length === 0 && lastLengthError) {
    throw lastLengthError;
  }

  return attachAiTokenUsage({
    titles,
    protagonistNames: [],
    protagonistCharacters: [],
    description: "",
    titleConcept: "",
    storyDesign: null
  }, usage);
}

function normalizeCharacterRole(value: unknown, fallback: ProjectCreationCharacterRole = "男主"): ProjectCreationCharacterRole {
  return value === "男主" || value === "女主" || value === "男配" || value === "女配" ? value : fallback;
}

function defaultCharacterRoleForReader(index: number, targetReader?: string): ProjectCreationCharacterRole {
  return targetReader === "女频"
    ? index === 0
      ? "女主"
      : index === 1
        ? "男主"
        : "女配"
    : index === 1
      ? "女主"
      : "男主";
}

function normalizeCharacters(value: unknown, targetReader?: string): ProjectCreationCharacterInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item, index): ProjectCreationCharacterInput[] => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const raw = item as { role?: unknown; name?: unknown };
      const name = String(raw.name ?? "").trim();

      if (!name) {
        return [];
      }

      const role = normalizeCharacterRole(raw.role, defaultCharacterRoleForReader(index, targetReader));

      return [{
        role,
        name
      }];
    })
    .slice(0, maxProjectCharacters);
}

function titleCraftRules(titleNamingStyle: TitleNamingStyle) {
  const sharedRules = [
    "书名不是标签改写。genre、tags、goldenFinger 是幕后创作约束，不是必须出现在书名里的词。",
    "genre、targetReader、tags 只能决定市场方向和读者期待，不能被当成已经发生的剧情事实。",
    "只有 titleConcept、coreSellingPoint、openingHook、description、用户填写的人物名和用户明确填写的 goldenFinger 才能作为具体事实来源。",
    "如果具体事实来源里没有出现某个事件、道具、身份关系、专有制度或具体资源，书名不能凭空发明它。",
    "不要从标签脑补具体桥段。不能因为某个题材或主题标签，就自动生成未经用户确认的仪式、契约、道具、资源、职位、身份关系、特殊机制或单章动作。",
    "可把标签翻译成抽象读者钩子：主角处境、权力位置、长期矛盾、核心反差、行动方式、命运问题、规则压力；不要翻译成未经确认的具体道具或单章动作。",
    "默认不要直接使用用户选择的主分类、题材标签、主题标签、角色标签、金手指类型词；除非用户在 titleConcept 中明确要求某个词必须进标题。",
    "不要把主分类、题材、角色标签、金手指类型直接连成一个标题。",
    "关系类标签只能转成关系张力、阵营牵引或剧情矛盾，不要写成低质占有式卖点。",
    "当前书名输入框 name 只用于用户最后确认，不是起名事实来源；AI 起名时不要根据 name 延续、改写或放大上一轮标题。",
    "性格类标签不要直接写成标签词，要体现为行动方式、选择代价、布局方式或剧情结果。",
    "高频类型词可以使用，但不能成为标题唯一卖点；每个标题都要有一个具体新信息。",
    "同一批 6 个标题必须走不同卖点方向，不要围绕同一个名词反复变体。",
    "严禁把用户构思压缩成低质梗句、口号句、吐槽句或关键词拼接句。",
    "严禁把标题写成大纲摘要、人物履历、阶段路线或结局剧透；书名只能抓一个最有张力的入口。",
    "严禁使用冒号副标题、从 A 到 B、步步/一路/最终、某某之路、某某传、某某录这类传记式或课程式结构。",
    "不要把主角最终获得的最高位置直接写成标题终点；可以写权力压力、身份反差或目标感，但不要把完整成长路线摊开。",
    "每个候选返回前先自检：标题中的具体名词、具体动作、具体关系和具体资源，是否能从用户输入中找到依据；找不到就改成更抽象、更可迁移的表达。",
    "严禁低质梗句、说明书式标题、口号式标题、把设定直接写成机制说明的标题。",
    "遇到直白设定时，要转成更有书架感的概念、制度、命运或冲突，不要直接写成段子。"
  ];

  return titleNamingStyle === "qidian"
    ? [
        ...sharedRules,
        "起点风格要短、稳、耐看，优先 2-8 个中文字符，最多 12 字；用意象、职业、制度、命运主题和世界观名词承载卖点。",
        "起点短标题也不能空泛，不要只生成类型词、角色标签词或古风气氛词。",
        "起点短标题必须能被普通读者解释出至少两项：主体、矛盾、动作、题材方向、长期目标；不能只靠两个漂亮字拼成生造词。",
        "如果标题需要解释半天才知道是什么意思，或者读者只能感觉“像古风但不知道讲什么”，就不合格。",
        "起点短标题可以从制度、暗线、身份、命运、城市规则、能力代价里取意象；不要照搬这些规则里的词。"
      ]
    : [
        ...sharedRules,
        "番茄风格可以更直给，但要像一个真实书名，而不是短视频夸张标题。建议 8-20 个中文字符，最多 24 字。",
        "番茄风格的正向打法：身份/处境前置 + 强动作动词 + 目标或爽点承诺 + 反差钩子。标题要让读者快速知道主角是谁、被什么压住、靠什么翻盘、最后爽在哪里。",
        "优先从用户输入里抽取可前置的身份或处境，再选择一个有行动感的动词，接一个目标压力或权力位置；不要把它写成解释句。",
        "可以直出核心卖点词或题材词，但只能直出 1 个最能分流目标读者的词；不要把多个标签堆成标题。",
        "可以把终局爽点前置成承诺，但要压缩成一个明确目标，不要写成完整成长履历。",
        "只有在用户输入给出具体处境、具体身份、具体开局或具体资源时，番茄标题才允许写成具体剧情钩子。",
        "如果用户只给了题材、读者、标签和风格要求，不能编具体桥段；标题应转向长期矛盾、人物姿态、目标压力或题材气质，保持自然书名感。"
      ];
}

function descriptionTask(descriptionWritingStyle: DescriptionWritingStyle, descriptionAssistMode: DescriptionAssistMode) {
  const modeRule = descriptionAssistMode === "polish"
    ? "本次是润色用户已经写好的简介：保留原简介的核心信息、人物关系、设定和剧情方向，只按平台风格优化表达、节奏、冲突和吸引力；不要改成另一版故事，不要删掉关键设定、关键压力或追读钩子。"
    : "本次是生成完整作品简介：写清开局处境、核心冲突、主要卖点、关键机制、主角反击方式和追读期待；不要把全书成长线、阶段路线或结局讲完。";

  return descriptionWritingStyle === "qidian"
    ? [
        modeRule,
        "风格偏起点：设定质感更强，语气更稳，少喊口号，少用标签堆叠。",
        "简介要交代主角身份、开局异常、核心矛盾和长期悬念；可以保留爽点，但不要写成平台标签广告。",
        "不要用【标签+标签+卖点】开头，不要使用番茄式强刺激口号表达。",
        "控制在 300-600 字，最多 800 字；必须自然成段，不能在关键冲突、机制说明或追读钩子处突然收尾；不能低俗、血腥、违法，不能照搬已有作品。只返回 description 字段，不要额外字段。"
      ].join("")
    : [
        modeRule,
        "风格偏番茄小说：开头可用【标签+标签+卖点】概括，随后交代主角处境、危机、关键机制或反击方式，以及追读钩子。",
        "表达要直接、强冲突、强期待，让读者迅速知道爽点在哪里。",
        "控制在 300-600 字，最多 800 字；必须自然成段，不能在关键冲突、机制说明或追读钩子处突然收尾；不能低俗、血腥、违法，不能照搬已有作品。只返回 description 字段，不要额外字段。"
      ].join("");
}

function titleConceptTask() {
  return [
    "把用户为 AI 起名准备的粗略想法，整理成更适合起名使用的方向素材。",
    "本次不是生成书名，也不是生成简介，只返回 titleConcept 字段。",
    "输出一段自然中文，建议 120-420 字，最多 500 字；不要写字段名，不要用等号，不要项目符号。",
    "尽量覆盖：主角初始身份或处境，后续成长或目标方向，读者期待主角靠什么反击、拿回什么，整体标题气质，尽量避开什么联想。",
    "必须保留用户原意。用户没有明确给出的具体事件、身份、道具、地点、官职、关系、资源和机制，不要擅自补成具体事实。",
    "可以根据主分类、读者、标签和已有简介判断市场方向，但只能补成抽象表达，不能脑补具体桥段。",
    "如果信息很少，就把不确定处写成宽泛方向，让作者后续可继续改；不要为了显得具体而编剧情。"
  ].join("");
}

function storyDesignTask(descriptionWritingStyle: DescriptionWritingStyle) {
  const introStyle = descriptionWritingStyle === "qidian"
    ? "简介偏起点：设定可信、悬念稳、长期目标清楚，少用口号。"
    : "简介偏番茄：冲突前置、爽点清楚、压制和反击明显，读者一眼能看懂卖点。";

  return [
    "根据作者给出的小说大概思路、方向或零散设定，生成一份原创新书整体设计。",
    "用户可能只给一句方向，也可能给多个点。请先保留用户确定的核心，不确定处用商业网文结构补齐，但不能把补齐内容伪装成用户原话。",
    "必须输出 storyDesign 对象，不要输出 Markdown、解释或额外字段。",
    "设计重点不是写正文，而是帮作者完成立项：书名方向、简介、核心冲突、主角模型、金手指/关键机制、开局钩子、主循环、前 10 章推进、爽点、伏笔和避坑。",
    introStyle,
    "书名必须原创，不要照搬已有作品名、角色名、专有世界观名词或标志性设定。",
    "金手指要有边界、代价或触发条件，不能只是无上限外挂；要能支撑长篇状态管理。",
    "核心冲突必须包含压制来源、主角反击方式、升级敌人或新地图的入口。",
    "前 10 章不是流水账，要体现：开局压力、第一次反击、第一次收益、信息差、章末钩子和主线目标建立。",
    "risksToAvoid 必须提醒哪些地方容易跑偏、容易抄袭感强、容易金手指失控或爽点重复。",
    "如果 currentProject.targetReader 为空或未明确，请根据 storyIdea 自行判断更适合男频、女频或泛读者方向；不要默认按男频设计。",
    "如果用户提到某本现有作品，只能抽象其通用结构，不得复制人物、桥段、专有设定和章节顺序。"
  ].join("");
}

function descriptionStyleRules(descriptionWritingStyle: DescriptionWritingStyle) {
  return descriptionWritingStyle === "qidian"
    ? [
        "简介风格偏起点：重设定可信度、长期悬念、主角选择和世界规则。",
        "少用强营销语、少用感叹句，避免把简介写成短视频推文。",
        "可以制造期待，但要通过问题、代价、秘密和世界变化来制造期待。"
      ]
    : [
        "简介风格偏番茄：开头快、卖点清楚、冲突直给，尽快抛出压制、反击和追读钩子。",
        "可以使用更强的情绪词和节奏句，但不要低俗擦边或夸张到失真。",
        "读完第一屏要知道主角为什么被压、靠什么翻盘、后面还有什么更大的爽点。"
      ];
}

type StoryDesignSegmentResponse = {
  storyDesign?: Record<string, unknown> | null;
};

function isLengthLimitError(error: unknown) {
  return error instanceof Error && /长度限制截断|未正常结束：length|finish_reason.*length|\blength\b/i.test(error.message);
}

function storyDesignSegmentRecord(response: StoryDesignSegmentResponse) {
  return response.storyDesign && typeof response.storyDesign === "object" ? response.storyDesign : {};
}

async function generateSegmentedStoryDesignWithAi(input: {
  project: ProjectCreationAssistInput;
  titleNamingStyle: TitleNamingStyle;
  tagTaxonomyStyle: TagTaxonomyStyle;
  descriptionWritingStyle: DescriptionWritingStyle;
  characterSlots: ProjectCreationCharacterInput[];
  requestedCharacterSlots: ProjectCreationCharacterInput[];
  avoidTitles: string[];
  directLabelTerms: string[];
  titleFactualSources: string;
  hasConcreteTitleFactInputs: boolean;
  titleDirectionGuide: Record<string, string>;
}) {
  const {
    project,
    titleNamingStyle,
    tagTaxonomyStyle,
    descriptionWritingStyle,
    characterSlots,
    requestedCharacterSlots,
    avoidTitles,
    directLabelTerms,
    titleFactualSources,
    hasConcreteTitleFactInputs,
    titleDirectionGuide
  } = input;
  const currentProject = {
    name: "",
    storyIdea: project.storyIdea,
    titleConcept: project.titleConcept,
    genre: project.genre,
    categoryDescription: project.categoryDescription,
    targetReader: project.targetReader,
    tags: project.tags ?? [],
    protagonistNames: project.protagonistNames ?? [],
    characterSlots,
    requestedCharacterSlots,
    coreSellingPoint: project.coreSellingPoint,
    goldenFinger: project.goldenFinger,
    openingHook: project.openingHook,
    workLengthType: project.workLengthType,
    targetTotalWords: project.targetTotalWords,
    description: project.description,
    titleNamingStyle,
    tagTaxonomyStyle,
    descriptionWritingStyle,
    directLabelTerms,
    titleFactualSources,
    hasConcreteTitleFactInputs,
    titleDirectionGuide,
    previousTitlesInCurrentContext: avoidTitles
  };
  const readerRules = [
    project.targetReader?.trim()
      ? `当前 targetReader「${project.targetReader.trim()}」是用户明确选择的频道，整体设计必须尊重它。`
      : "当前未指定 targetReader。必须先从 storyIdea 判断目标读者，不要默认男频；若构思更适合女频，可以按女频人物关系、情绪补偿、成长线和关系张力设计。",
    project.targetReader === "女频"
      ? "女频整体设计默认第一主角是女主。characterSuggestions 第一项必须是 role=女主，姓名要有明确女性气质；不要给女主、女配使用明显男性名或偏男性的中性名。男主是关系张力或对手/搭档功能，不要把故事主视角写成男主升级流。"
      : null,
    project.targetReader === "男频"
      ? "男频整体设计默认第一主角是男主。characterSuggestions 第一项通常应是 role=男主，姓名要有男性气质；女主/女配不能使用明显男性名。"
      : null
  ].filter((item): item is string => Boolean(item));
  const commonRules = [
    storyDesignTask(descriptionWritingStyle),
    "这是分段生成：每次只输出本段 outputSchema 中列出的字段，但每段都要保持足够信息量，不要写成精简版、占位符或泛泛模板话。",
    "三段内容最终会被系统合并成一份 storyDesign，因此本段必须和已有上下文保持同一本书、同一主角、同一核心机制。",
    project.targetTotalWords
      ? `整体设计需要符合当前作品体量：${project.workLengthType ?? "medium"}，目标约 ${Math.round(project.targetTotalWords / 10000)} 万字；主循环、前 10 章和伏笔要能支撑这个体量。`
      : null,
    "storyIdea 是作者真实想法，是本次最重要输入。必须围绕它扩展，不要改成另一本完全不同的书。",
    "titleConcept、coreSellingPoint、goldenFinger、openingHook、description 是已有表单草稿；如果它们与 storyIdea 不冲突，可以吸收进设计。",
    "genre、targetReader、tags 是市场坐标，只用来判断平台口味和读者期待，不要机械堆进结果。",
    "characterSlots 在 storyDesign 中主要表示角色顺序和角色性别，不代表必须沿用旧名字；characterSuggestions 必须重新给出匹配 role 的姓名。",
    "输出必须能被回填到新书创建表单，所以 titleOptions、intro、coreSellingPoint、goldenFinger、openingHook 不能空泛。",
    "不要写成纯设定百科。每个关键机制都要落到冲突、爽点、章节推进或状态管理里。",
    "版权边界：可以借鉴通用类型结构，不能复刻原文表达、角色名称、标志性人设、独特世界观和具体桥段。",
    ...readerRules
  ].filter((item): item is string => Boolean(item));
  const buildPartMessages = (part: {
    partName: string;
    task: string;
    outputSchema: Record<string, unknown>;
    context?: Record<string, unknown>;
  }) => [
      {
        role: "system" as const,
        content:
          "你是中文网文平台的新书立项编辑，擅长把作者的零散脑洞扩展成可连载、可管理、可避坑的原创网文方案。请严格输出 JSON，不要输出解释、Markdown 或代码块。"
      },
      {
        role: "user" as const,
        content: JSON.stringify(
          {
            task: part.task,
            partName: part.partName,
            currentProject,
            existingDesignContext: part.context ?? {},
            styleRules: commonRules,
            outputSchema: {
              storyDesign: part.outputSchema
            }
          },
          null,
          2
        )
      }
    ];
  const requestPart = async (part: {
    partName: string;
    task: string;
    outputSchema: Record<string, unknown>;
    context?: Record<string, unknown>;
    temperature: number;
    maxTokens: number;
  }) => {
    try {
      return await requestAiJson<StoryDesignSegmentResponse>({
        messages: buildPartMessages(part),
        temperature: part.temperature,
        maxTokens: part.maxTokens,
        timeoutMs: 120000
      });
    } catch (error) {
      if (!isLengthLimitError(error)) {
        throw error;
      }

      try {
        return await requestAiJson<StoryDesignSegmentResponse>({
          messages: buildPartMessages({
            ...part,
            task: [
              part.task,
              "本次是长度/JSON 完整性重试。不要改成精简版，必须保留本段字段数量和关键设计点；每个字段或数组项按 outputSchema 的建议长度写完整，避免超长句和重复解释，确保 JSON 正常闭合。"
            ].join("\n")
          }),
          temperature: Math.max(0.2, part.temperature - 0.05),
          maxTokens: Math.max(part.maxTokens + 1800, 5200),
          timeoutMs: 150000
        });
      } catch (retryError) {
        if (isLengthLimitError(retryError)) {
          throw new Error(`AI 分段生成「${part.partName}」仍被长度限制截断，请稍后重试。系统会保留完整方案结构，不会降级为精简版。`);
        }

        throw retryError;
      }
    }
  };

  const foundationResponse = await requestPart({
    partName: "立项骨架",
    task:
      "生成新书整体设计的立项骨架。本段负责书名方向、简介、核心卖点、核心冲突、主角模型、金手指/关键机制、开局钩子、主循环、世界观简表、主要角色建议和推荐分类标签。",
    outputSchema: {
      titleOptions: "string[]，6 个候选书名，原创、可上架、不同卖点方向，避开 previousTitlesInCurrentContext",
      logline: "string，一句话卖点，必须点出主角处境、核心反差和追读期待",
      intro: "string，300-600 字作品简介，冲突前置、信息完整但不剧透全书，不能在关键钩子处突然收尾",
      coreSellingPoint: "string，2-3 句，说明商业卖点、目标读者为什么会追、和同题材的差异",
      coreConflict: "string，2-3 句，包含压制来源、主角反击方式、升级敌人或新地图入口",
      protagonistDesign: "string，2-3 句，主角身份、底层欲望、短期目标、长期目标和人物弱点",
      goldenFinger: "string，2-3 句，金手指或关键机制，必须包含限制、代价、触发条件或反噬边界",
      openingHook: "string，2-3 句，第一章可用开局钩子，包含危机、误判、选择压力和章末钩子",
      mainLoop: "string，2-3 句，可持续循环，说明每轮压制、反击、收益、信息差和升级入口",
      worldSetting: "string，2-3 句，世界观简表，突出规则、势力/地图、资源体系和题材差异",
      characterSuggestions: "Array<{ role: '男主' | '女主' | '男配' | '女配'; name: string }>，4-6 个主要人物，姓名必须匹配 role，说明顺序以主视角和剧情功能为准",
      recommendedGenre: "string，最适合回填到主分类的题材方向",
      recommendedTags: "string[]，4-6 个标签，覆盖题材、人物、机制和爽点口味"
    },
    temperature: 0.72,
    maxTokens: 4200
  });
  const foundationRecord = storyDesignSegmentRecord(foundationResponse);
  const foundationDesign = normalizeStoryDesign(
    { storyDesign: foundationRecord },
    avoidTitles,
    undefined,
    project.targetReader
  );

  if (!foundationDesign) {
    throw new Error("AI 没有生成可用的新书整体设计骨架，请补充一点主角处境、冲突或题材方向后重试。");
  }

  const chapterResponse = await requestPart({
    partName: "前 10 章推进",
    task:
      "基于立项骨架，生成前 10 章推进。本段只输出 first10Chapters，但要写得可执行：每章都要有章节任务、冲突压力、爽点或收益、信息差/伏笔、章末钩子。",
    context: {
      foundation: {
        logline: foundationDesign.logline,
        coreConflict: foundationDesign.coreConflict,
        protagonistDesign: foundationDesign.protagonistDesign,
        goldenFinger: foundationDesign.goldenFinger,
        openingHook: foundationDesign.openingHook,
        mainLoop: foundationDesign.mainLoop,
        worldSetting: foundationDesign.worldSetting,
        characterSuggestions: foundationDesign.characterSuggestions
      }
    },
    outputSchema: {
      first10Chapters:
        "string[]，必须正好 10 条。每条建议 120-220 字，格式自然即可，但必须包含：本章剧情任务、主要冲突、主角行动、爽点/收益、留下的钩子。不要流水账，不要只写章节标题。"
    },
    temperature: 0.66,
    maxTokens: 4200
  });
  const chapterRecord = storyDesignSegmentRecord(chapterResponse);
  const first10Chapters = textList(chapterRecord.first10Chapters, 10, 260);
  const detailContext = {
    foundation: {
      logline: foundationDesign.logline,
      coreConflict: foundationDesign.coreConflict,
      protagonistDesign: foundationDesign.protagonistDesign,
      goldenFinger: foundationDesign.goldenFinger,
      mainLoop: foundationDesign.mainLoop,
      worldSetting: foundationDesign.worldSetting
    },
    first10Chapters
  };
  const [pleasureResponse, foreshadowingResponse, riskResponse] = await Promise.all([
    requestPart({
      partName: "爽点设计",
      task:
        "基于立项骨架和前 10 章推进，生成爽点设计。本段只输出 pleasurePoints，每一条都要能指导后续长篇创作。",
      context: detailContext,
      outputSchema: {
        pleasurePoints:
          "string[]，8-10 条。每条必须说明：爽点前的压制、释放位置、为什么有效、是否推动主线。不要只写爽点名称。"
      },
      temperature: 0.62,
      maxTokens: 3000
    }),
    requestPart({
      partName: "伏笔安排",
      task:
        "基于立项骨架和前 10 章推进，生成伏笔安排。本段只输出 foreshadowing，每一条都要能直接进入后续伏笔管理。",
      context: detailContext,
      outputSchema: {
        foreshadowing:
          "string[]，6-8 条。每条必须说明：埋设章节或位置、关联人物/物品/规则、预计回收方式、不能提前透露的信息。"
      },
      temperature: 0.58,
      maxTokens: 2600
    }),
    requestPart({
      partName: "避坑清单",
      task:
        "基于立项骨架和前 10 章推进，生成避坑清单。本段只输出 risksToAvoid，每一条都要指出风险和具体规避办法。",
      context: detailContext,
      outputSchema: {
        risksToAvoid:
          "string[]，6-8 条。每条必须说明：容易跑偏或像抄袭/金手指失控/爽点重复的风险，以及具体规避办法。"
      },
      temperature: 0.56,
      maxTokens: 2600
    })
  ]);
  const mergedResponse = {
    storyDesign: {
      ...foundationRecord,
      ...chapterRecord,
      ...storyDesignSegmentRecord(pleasureResponse),
      ...storyDesignSegmentRecord(foreshadowingResponse),
      ...storyDesignSegmentRecord(riskResponse)
    }
  };
  const normalized = normalizeResult(mergedResponse as Partial<ProjectCreationAssistResult>, avoidTitles, undefined, project.targetReader);

  if (!normalized.storyDesign) {
    throw new Error("AI 没有生成可用的新书整体设计，请补充一点主角处境、冲突或题材方向后重试。");
  }

  return attachAiTokenUsage(
    normalized,
    combineAiTokenUsages([
      getAiTokenUsage(foundationResponse),
      getAiTokenUsage(chapterResponse),
      getAiTokenUsage(pleasureResponse),
      getAiTokenUsage(foreshadowingResponse),
      getAiTokenUsage(riskResponse)
    ])
  );
}

function isTitlesAssistAction(action: ProjectCreationAssistAction) {
  return action === "titles";
}

export async function generateProjectCreationAssistWithAi(input: ProjectCreationAssistInput) {
  const titleNamingStyle = input.titleNamingStyle === "qidian" ? "qidian" : "fanqie";
  const tagTaxonomyStyle = input.tagTaxonomyStyle === "qidian" ? "qidian" : "fanqie";
  const descriptionWritingStyle = input.descriptionWritingStyle === "qidian" ? "qidian" : "fanqie";
  const descriptionAssistMode = input.descriptionAssistMode === "polish" ? "polish" : "generate";

  if (isTitlesAssistAction(input.action)) {
    return generateSimpleTitlesWithAi(input, titleNamingStyle);
  }

  if (input.action === "storyDesign" && !compactText(input.storyIdea, 2000)) {
    throw new Error("请先写一点小说思路或方向，再让 AI 做整体设计。");
  }

  const requestedAction: ProjectCreationAssistAction = input.action;
  const legacyTitleFlow: boolean = false;
  const titleGenerationBatchId = legacyTitleFlow ? randomUUID().slice(0, 8) : "";
  const characterSlots = (input.protagonistCharacters?.length
    ? input.protagonistCharacters
    : (input.protagonistNames ?? []).map((name, index) => ({
        role: defaultCharacterRoleForReader(index, input.targetReader),
        name
      }))
  )
    .map((item, index) => ({
      role: normalizeCharacterRole(item.role, defaultCharacterRoleForReader(index, input.targetReader)),
      name: String(item.name ?? "").trim()
    }))
    .slice(0, maxProjectCharacters);
  const requestedCharacterSlots = characterSlots.length > 0
    ? characterSlots
    : input.targetReader === "女频"
      ? [
          { role: "女主" as const, name: "" },
          { role: "男主" as const, name: "" }
        ]
      : [
          { role: "男主" as const, name: "" },
          { role: "女主" as const, name: "" }
        ];
  const actionConfig: Record<
    ProjectCreationAssistAction,
    {
      task: string;
      outputSchema: Record<string, unknown>;
      temperature: number;
      maxTokens: number;
    }
  > = {
    titles: {
      task:
        titleNamingStyle === "qidian"
          ? "先在内部理解用户输入，再生成至少 16 个自然书名并筛选，最后只返回 6 个中文网文新书名。风格偏起点：短、稳、有书架感，优先 3-8 个中文字符，最多 12 字。标题应像正常中文书名，语序通顺，不硬拼词；可以锚定身份、出身、成长或权力方向，但不要为了锚定素材生造词。不要生成代词开头的句子残片。"
          : "先在内部从用户输入中抽取可入题元素，并判断事实密度，再生成至少 16 个自然书名并筛选，最后只返回 6 个中文网文新书名。风格偏番茄小说：8-24 字，直给但必须可信、顺口、像书名。优先使用“身份/处境 + 强动作 + 目标/爽点承诺”的高信息结构，至少覆盖身份处境型、强动作型、目标承诺型、反差钩子型 4 条路线。有具体事实才写具体剧情钩子；事实不足时写长期矛盾、人物姿态或目标压力。不要生成 4-6 字古风短名，不要编桥段，不要写成冒号副标题、成长履历或从起点到终点的大纲摘要。",
      outputSchema: {
        titles: "string[]"
      },
      temperature: 0.9,
      maxTokens: 1100
    },
    protagonists: {
      task:
        "只为新建作品表单里的人物栏生成中文角色名。必须逐行理解 characterSlots 的 role：男主/男配只能生成男性气质姓名，女主/女配只能生成女性气质姓名；不要把女主、女配生成男性名。已有 name 的行不要强行改名，空白行必须给出对应姓名。名字要像中文网文角色，易读、好记、有辨识度，避免生僻字堆砌，避免像真实公众人物。",
      outputSchema: {
        protagonistCharacters: "Array<{ role: '男主' | '女主' | '男配' | '女配'; name: string }>",
        protagonistNames: "string[]"
      },
      temperature: 0.8,
      maxTokens: 520
    },
    description: {
      task: descriptionTask(descriptionWritingStyle, descriptionAssistMode),
      outputSchema: {
        description: "string"
      },
      temperature: 0.65,
      maxTokens: 1000
    },
    titleConcept: {
      task: titleConceptTask(),
      outputSchema: {
        titleConcept: "string"
      },
      temperature: 0.55,
      maxTokens: 520
    },
    storyDesign: {
      task: storyDesignTask(descriptionWritingStyle),
      outputSchema: {
        storyDesign: {
          titleOptions: "string[]，4-6 个候选书名",
          logline: "string，一句话卖点",
          intro: "string，300-600 字作品简介，最多 800 字，信息完整但不剧透全书",
          coreSellingPoint: "string，核心商业卖点",
          coreConflict: "string，压制来源 + 反击方式 + 升级入口",
          protagonistDesign: "string，主角身份、底层欲望、短期目标和长期目标",
          goldenFinger: "string，金手指或关键机制，包含限制、代价或触发条件",
          openingHook: "string，第一章可用开局钩子",
          mainLoop: "string，可持续循环，例如被误判 → 被挑衅 → 反击 → 获益 → 引出更高层敌人",
          worldSetting: "string，世界观简表，突出规则和题材差异",
          characterSuggestions: "Array<{ role: '男主' | '女主' | '男配' | '女配'; name: string }>",
          first10Chapters: "string[]，10 条，每条说明章节任务和钩子",
          pleasurePoints: "string[]，爽点设计，说明压制、释放和主线作用",
          foreshadowing: "string[]，伏笔安排",
          risksToAvoid: "string[]，版权、设定、节奏和金手指避坑",
          recommendedGenre: "string",
          recommendedTags: "string[]"
        }
      },
      temperature: 0.72,
      maxTokens: 2600
    }
  };
  const currentTask = actionConfig[input.action];
  const titleSeedName = "";
  const directLabelTerms =
    legacyTitleFlow && !input.titleConcept?.trim()
      ? [input.genre, ...(input.tags ?? []), input.goldenFinger]
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      : [];
  const titleFactualSources = joinPromptSignals([
    input.titleConcept,
    input.storyIdea,
    input.coreSellingPoint,
    input.openingHook,
    input.description,
    input.goldenFinger,
    ...(input.protagonistNames ?? []),
    ...characterSlots.map((item) => item.name)
  ]);
  const hasConcreteTitleFactInputs = hasConcreteTitleFacts([
    input.titleConcept,
    input.storyIdea,
    input.coreSellingPoint,
    input.openingHook,
    input.description,
    input.goldenFinger,
    ...(input.protagonistNames ?? []),
    ...characterSlots.map((item) => item.name)
  ]);
  const titleDirectionGuide = {
    originLine: "出身线：主角起点、身份位置、原始处境。只从用户文字提取；没有就写空。",
    growthLine: "成长线：主角从哪里走到哪里，能力/地位/视野如何变化。只从用户文字提取；没有就写空。",
    powerOrGoalLine: "权力/目标线：主角想拿到的位置、资源、秩序、胜利或长期目标。只从用户文字提取；不能把长期目标替换成具体官职、具体职位或具体组织身份。",
    pleasureLine: "爽点线：读者期待的压制、反差、反击、回报或情绪补偿。可以抽象概括，但不能新增具体事件。",
    styleRequirement: "风格要求：作者明确想要的叙事气质、人物气质、感情线强弱和平台风格。这里是要遵守的正向要求。",
    avoidDirection: "避雷方向：作者明确不要的套路、隐喻、关系走向、标题质感或剧情联想。这里是禁止方向，不要当成书名卖点。"
  };

  if (legacyTitleFlow && !hasConcreteTitleFactInputs) {
    throw new Error("请先补充起名方向素材。只靠主分类和标签，AI 容易生成空泛套路名。");
  }

  const styleRules = [
    titleNamingStyle === "qidian"
      ? "书名优先短、稳、耐看，但必须让读者能看出至少一个素材锚点；不要只生成看似古风但没有信息量的概念词，也不要生成主语句、动作句或简介半句。"
      : "书名可以比起点更直给，但不能为了刺激感编事实；优先呈现人物姿态、长期矛盾、目标压力或已知处境，不要生成起点式短名，也不要生成夸张短视频句。",
    legacyTitleFlow && input.titleConcept?.trim()
      ? "如果提供了起名构思 titleConcept，优先依据它来命名；不要把它原句压缩成标题，也不要让上一轮生成出的 title 反过来主导这一轮。"
      : null,
    false
      ? `必须理解 genre、targetReader 和 tags 背后的读者期待。当前标签体系是${tagTaxonomyStyle === "qidian" ? "起点分类，genre 是大类，tags 是子类" : "番茄分类，genre 是主分类，tags 是主题/角色"}；这些是市场坐标，不是剧情事实。默认不要把这些标签词直接写进书名，也不要从它们脑补具体桥段。`
      : null,
    false
      ? [
          "生成标题前，先在内部按 titleDirectionGuide 从用户输入抽取命名资产：出身线、成长线、权力/目标线、爽点线、风格要求、避雷方向。",
          "可入题元素的优先级：用户原话里的主角身份 > 出身地点/起点 > 成长终点 > 长期权力目标 > 抽象气质。先保证标题是正常中文书名，再考虑使用素材。",
          "方向资产只用于判断书名的主体、张力和气质，最终标题不要暴露这些字段名，也不要把方向线机械拼起来。",
          "弱信息包装不能成为标题主干：如果标题只有抽象气氛，而没有清楚主体或目标，就不合格。",
          "标题优先自然、顺口、能上书架；其次才是证据完整。不要为了证明每条方向都用上而写成长句或说明书。",
          "风格要求是正向约束，可以影响标题气质；避雷方向是禁止约束，不能反向写进标题里当卖点。",
          titleNamingStyle === "fanqie"
            ? "番茄标题生成时，优先尝试这些商业结构：身份/处境 + 强动作 + 目标承诺；开局压力 + 反击方式 + 爽点；反套路身份 + 行动动词 + 权力目标；外界误判 + 主角翻盘动作。每个标题只选一种结构。"
            : null,
          "用户没有明确给出的具体事件、道具、资源、关系、官职、地点、身份状态和单章动作，不要擅自写进标题；但可以使用抽象的处境、目标、命运感和权力感。",
          "同一批候选必须从不同命名路线里挑选，不要围绕同一个意象、同一个动作、同一个身份词或同一个结局反复改字。",
          titleNamingStyle === "fanqie"
            ? "番茄标题必须让读者一眼知道故事卖点，但卖点只能来自已知输入或抽象长期矛盾；不要输出短词、谜语词、纯意象词、名词短语堆叠、全员震惊式夸张句、具体桥段编造、冒号副标题或成长履历标题。"
            : "起点标题可以短，但不能只有气氛；标题必须语序自然、像书名，不要生造词，不要用代词开头，不要写成句子型标题。"
        ].join("")
      : null,
    ...(legacyTitleFlow ? titleCraftRules(titleNamingStyle) : []),
    legacyTitleFlow && input.titleConcept?.trim()
      ? "如果构思里出现现成作品名、角色名或专有名词，不要直接照搬进书名，要转成原创意象、身份或冲突。"
      : null,
    legacyTitleFlow && input.avoidTitles?.length
      ? "用户正在重新生成书名。需要避开本轮已经出现过的标题，不要只做同义改写或换序。"
      : null,
    directLabelTerms.length > 0
      ? "directLabelTerms 是用户选择的分类/标签原词。生成书名时默认不要直接使用这些词，要转成原创意象、动作、场景或冲突。"
      : null,
    false
      ? "titleFactualSources 是可用于标题具体名词和具体动作的事实来源。若其中没有某个具体事件、道具、资源、关系身份、地点、身份状态、专有制度或行为结果，标题不得凭空新增；只能写抽象冲突、长期压力、人物姿态或市场气质。"
      : null,
    false
      ? [
          "最终只返回 titles 字段，不要返回分析过程、自检字段或方向字段。",
          "不要把风格要求、读者标签、关系标签直接塞进标题；它们只负责约束标题气质。",
          "不要把标题写成“身份 + 冒号 + 成长路径”的表单句，也不要把用户构思原句压缩成标题。",
          "不要用标题概括全书路线；如果构思包含多个阶段，只选开局处境、核心反差、长期压力或人物姿态中的一个切口。",
          "同一批标题必须像 6 个不同方向的备选方案，不要像同一个标题模板的同义改写。"
        ].join("")
      : null,
    input.action === "description"
      ? "简介要先让读者知道主角是谁、被什么压住、靠什么翻盘、后面有什么更大期待。"
      : input.action === "storyDesign"
        ? "本次要输出完整新书整体设计，但仍然只返回 outputSchema 要求的 JSON 字段。"
        : "本次只处理当前任务，不要顺手补充其他字段。",
    input.action === "description" && input.genre?.trim()
      ? `主分类「${input.genre.trim()}」是简介的故事发动机，不是可忽略标签；生成简介必须体现这个主分类的核心机制${input.categoryDescription?.trim() ? `：${input.categoryDescription.trim()}` : ""}。如果主题/角色标签和主分类争夺表达空间，以主分类框架为准，标签只作为口味叠加。`
      : null,
    input.action === "description" && input.categoryDescription?.trim()
      ? "不能只写标签氛围、人物性格或单一场景；必须让读者在简介里看出主分类承诺的基础故事形态。"
      : null,
    input.action === "titleConcept"
      ? [
          "本次只润色 titleConcept，不生成书名、不生成简介、不改人物名。",
          "润色后的文字要直接写给 AI 起名使用，重点是补足可命名的方向资产，而不是堆标签。",
          "不要把主分类、标签、金手指类型直接拼成句子；它们只用于理解市场方向。",
          "不要使用等号、字段名、序号、项目符号或配置表口吻。",
          "不要写成固定模板；要像作者自己的起名备忘，清楚但自然。"
        ].join("")
      : null,
    input.action === "description" && input.targetTotalWords
      ? `简介需要符合当前作品体量：${input.workLengthType ?? "medium"}，目标约 ${Math.round(input.targetTotalWords / 10000)} 万字；不要把短篇写成长篇无限升级，也不要把长篇写成很快收尾。`
      : null,
    input.action === "storyDesign" && input.targetTotalWords
      ? `整体设计需要符合当前作品体量：${input.workLengthType ?? "medium"}，目标约 ${Math.round(input.targetTotalWords / 10000)} 万字；请给出能支撑该体量的主循环、阶段升级和前 10 章节奏。`
      : null,
    input.action === "storyDesign"
      ? [
          "storyIdea 是作者真实想法，是本次最重要输入。必须围绕它扩展，不要改成另一本完全不同的书。",
          "titleConcept、coreSellingPoint、goldenFinger、openingHook、description 是已有表单草稿；如果它们与 storyIdea 不冲突，可以吸收进设计。",
          "genre、targetReader、tags 是市场坐标，只用来判断平台口味和读者期待，不要机械堆进结果。",
          input.targetReader?.trim()
            ? `当前 targetReader「${input.targetReader.trim()}」是用户明确选择的频道，整体设计必须尊重它。`
            : "当前未指定 targetReader。必须先从 storyIdea 判断目标读者，不要默认男频；若构思更适合女频，可以按女频人物关系、情绪补偿、成长线和关系张力设计。",
          input.targetReader === "女频"
            ? "女频整体设计默认第一主角是女主。characterSuggestions 第一项必须是 role=女主，姓名要有明确女性气质；不要给女主、女配使用明显男性名或偏男性的中性名。男主是关系张力或对手/搭档功能，不要把故事主视角写成男主升级流。"
            : null,
          input.targetReader === "男频"
            ? "男频整体设计默认第一主角是男主。characterSuggestions 第一项通常应是 role=男主，姓名要有男性气质；女主/女配不能使用明显男性名。"
            : null,
          "characterSlots 在 storyDesign 中主要表示角色顺序和角色性别，不代表必须沿用旧名字；characterSuggestions 必须重新给出匹配 role 的姓名。",
          "输出必须能被回填到新书创建表单，所以 titleOptions、intro、coreSellingPoint、goldenFinger、openingHook 不能空泛。",
          "不要写成纯设定百科。每个关键机制都要落到冲突、爽点、章节推进或状态管理里。",
          "版权边界：可以借鉴通用类型结构，不能复刻原文表达、角色名称、标志性人设、独特世界观和具体桥段。"
        ].join("")
      : null,
    input.action === "protagonists"
      ? [
          "人物取名必须按 requestedCharacterSlots 顺序返回 protagonistCharacters。",
          "每个返回项都要包含 role 和 name；protagonistNames 也要按相同顺序给出 name。",
          "男主、男配使用男性姓名；女主、女配使用女性姓名。不要让女主/女配出现明显男性名。",
          "不同角色的名字要有差异，不要同音堆叠，不要套用同一个姓氏模板。"
        ].join("")
      : null,
    ...(input.action === "description" ? descriptionStyleRules(descriptionWritingStyle) : []),
    "如果用户已经输入内容，请保留核心意思并增强网文吸引力。",
    "所有输出必须服务当前题材和标签，不要生成泛泛模板话。"
  ].filter((item): item is string => Boolean(item));

  const mergedAvoidTitles = (extraAvoidTitles: string[] = []) =>
    Array.from(new Set([...(input.avoidTitles ?? []), ...extraAvoidTitles].map(cleanTitleText).filter(Boolean))).slice(0, 100);
  const previousTitlesInCurrentContext = (extraAvoidTitles: string[] = []) =>
    mergedAvoidTitles(extraAvoidTitles).filter(Boolean);
  const titleQualityOptions: TitleQualityOptions = {
    style: titleNamingStyle,
    titleConcept: input.titleConcept,
    directLabelTerms,
    hasConcreteTitleFacts: hasConcreteTitleFactInputs,
    strict: true
  };

  if (input.action === "storyDesign") {
    return generateSegmentedStoryDesignWithAi({
      project: input,
      titleNamingStyle,
      tagTaxonomyStyle,
      descriptionWritingStyle,
      characterSlots,
      requestedCharacterSlots,
      avoidTitles: mergedAvoidTitles(),
      directLabelTerms,
      titleFactualSources,
      hasConcreteTitleFactInputs,
      titleDirectionGuide
    });
  }

  const buildMessages = (compact = false, extraAvoidTitles: string[] = []) => [
      {
        role: "system" as const,
        content:
          "你是中文网文平台的新书立项编辑，擅长番茄、起点、七猫等平台常见的书名、简介和主角命名包装。请严格输出 JSON，不要输出解释。你的目标是帮作者生成原创方案，不能复制已有作品名、简介、角色和专有设定。"
      },
      {
        role: "user" as const,
        content: JSON.stringify(
          {
            task: currentTask.task,
            currentProject: {
              name: titleSeedName,
              storyIdea: input.storyIdea,
              titleConcept: input.titleConcept,
              genre: input.genre,
              categoryDescription: input.categoryDescription,
              targetReader: input.targetReader,
              tags: input.tags ?? [],
              protagonistNames: input.protagonistNames ?? [],
              characterSlots,
              requestedCharacterSlots,
              coreSellingPoint: input.coreSellingPoint,
              goldenFinger: input.goldenFinger,
              openingHook: input.openingHook,
              workLengthType: input.workLengthType,
              targetTotalWords: input.targetTotalWords,
              description: input.description,
              titleNamingStyle,
              tagTaxonomyStyle,
              descriptionWritingStyle,
              directLabelTerms,
              titleFactualSources,
              hasConcreteTitleFactInputs,
              titleDirectionGuide,
              titleGenerationBatchId,
              previousTitlesInCurrentContext: previousTitlesInCurrentContext(extraAvoidTitles),
              rejectedInCurrentRequest: extraAvoidTitles.map(cleanTitleText).filter(Boolean)
            },
            styleRules,
            retryMode: compact ? "compact_title_retry" : "standard",
            compactRetryRules: compact
              ? [
                  titleNamingStyle === "qidian"
                    ? "每个标题控制在 2-10 个中文字符，绝对不要超过 12 个中文字符。"
                    : "每个标题控制在 8-24 个中文字符，必须是中长标题，不要输出 4-6 字短名。",
                  "只返回 titles 数组，不要返回其他字段。",
                  "不要复述 titleConcept 的原句，不要使用现成作品或角色名。",
                  "必须避开本轮已拒绝的重复标题，不要只换一个字、换词序或换同义词。",
                  titleNamingStyle === "fanqie"
                    ? "优先生成身份/处境 + 强动作 + 目标承诺的标题，也可以用开局压力 + 反击方式 + 爽点；不要生成起点式短名、抽象意象词、古风谜语词、冒号副标题、成长路径标题或编造具体桥段的夸张句。"
                    : "优先生成自然、有书架感、有素材锚点的短标题；不要只生成抽象气氛词，不要生成代词开头的句子残片。",
                  "用户没有明确给出的具体事件、道具、资源、关系、官职、地点、身份状态和单章动作，不要擅自写进标题。",
                  "不要把 genre 和 tags 直接拼成标题，也不要从 genre 和 tags 脑补具体桥段。",
                  "不要使用第一人称炫耀句、机制说明句、口号句、说明书标题或低质梗句。"
                ]
              : [],
            outputSchema: currentTask.outputSchema
          },
          null,
          2
        )
      }
    ];
  const buildSimpleTitleMessages = (extraAvoidTitles: string[] = []) => [
      {
        role: "system" as const,
        content:
          "你是中文网文平台的新书立项编辑。请严格输出 JSON，不要解释。"
      },
      {
        role: "user" as const,
        content: JSON.stringify(
          {
            task:
              titleNamingStyle === "qidian"
                ? "返回 6 个起点风格中文书名，只返回 titles。短、稳、有类型气质，最多 12 字，但不能只是抽象气氛词，不能是代词开头的句子残片。"
                : "返回 6 个番茄风格中文书名，只返回 titles。8-24 字，直给但自然可信；优先用身份/处境 + 强动作 + 目标承诺，或开局压力 + 反击方式 + 爽点。事实不足时写长期矛盾和人物姿态，不要编具体桥段，不要写冒号副标题或成长履历。",
            currentProject: {
              titleConcept: input.titleConcept,
              genre: input.genre,
              targetReader: input.targetReader,
              tags: input.tags ?? [],
              coreSellingPoint: input.coreSellingPoint,
              goldenFinger: input.goldenFinger,
              openingHook: input.openingHook,
              description: input.description,
              titleNamingStyle,
              titleFactualSources,
              hasConcreteTitleFactInputs,
              titleDirectionGuide,
              titleGenerationBatchId,
              previousTitlesInCurrentContext: previousTitlesInCurrentContext(extraAvoidTitles),
              rejectedInCurrentRequest: extraAvoidTitles.map(cleanTitleText).filter(Boolean)
            },
            rules: [
              "genre、targetReader、tags 只是市场坐标，不是剧情事实。",
              "hasConcreteTitleFactInputs 为 false 时，说明用户只给了低信息题材/标签；此时不要生成代词开头的具体剧情句或宏大结果句。",
              "先按 titleDirectionGuide 从用户输入抽出命名方向，再用 1-2 条方向组合标题。",
              "titleGenerationBatchId 只是本次生成的变化种子；同题材同构思重新生成时，也要换命名路线，不要重复上一轮的第一反应。",
              "previousTitlesInCurrentContext 是当前页面、当前输入上下文里上一轮已经给过用户的标题；必须避开，不要同义改写。",
              "rejectedInCurrentRequest 是本次已被质量筛选拒绝的标题，只在当前请求内避开，不代表历史项目限制。",
              titleNamingStyle === "fanqie"
                ? "番茄风格必须是中长标题，不要输出 4-6 字古风短名，也不要写成编造桥段的夸张短视频句、冒号副标题或从起点到终点的大纲摘要。"
                : "起点风格可以短，但必须有用户素材锚点，不要只写气氛词，不要用代词开头。",
              titleNamingStyle === "fanqie"
                ? "至少 4 个标题要有清楚动词或行动感，并包含身份/处境、反击方式、目标承诺中的至少两项。"
                : null,
              "如果 titleFactualSources 没有具体事件、道具、资源、身份关系、地点、身份状态或专有制度，不要把它们写进标题。",
              "不能把用户原始身份替换成另一种身份状态，不能把长期目标写成已经完成的具体官职、头衔或掌控动作。",
              "优先写抽象冲突、人物姿态、长期压力和追读问题。",
              "不要把 genre 和 tags 直接拼成标题。"
            ],
            outputSchema: {
              titles: "string[]"
            }
          },
          null,
          2
        )
      }
    ];
  const buildConservativeTitleMessages = (extraAvoidTitles: string[] = []) => [
      {
        role: "system" as const,
        content:
          "你是中文网文平台的新书立项编辑。请严格输出 JSON，不要解释。"
      },
      {
        role: "user" as const,
        content: JSON.stringify(
          {
            task:
              titleNamingStyle === "qidian"
                ? "返回 6 个起点风格中文书名，只返回 titles。2-12 字，像正常书名。"
                : "返回 6 个番茄风格中文书名，只返回 titles。8-24 字，稳一点，像正常书名，不要短视频文案，不要冒号副标题或成长履历。宁可朴素，也必须给出可用书名。",
            currentProject: {
              titleConcept: input.titleConcept,
              genre: input.genre,
              targetReader: input.targetReader,
              tags: input.tags ?? [],
              coreSellingPoint: input.coreSellingPoint,
              goldenFinger: input.goldenFinger,
              openingHook: input.openingHook,
              description: input.description,
              titleNamingStyle,
              titleFactualSources,
              hasConcreteTitleFactInputs,
              previousTitlesInCurrentContext: previousTitlesInCurrentContext(extraAvoidTitles)
            },
            rules: [
              "这是一轮保守兜底起名。优先保证可用、通顺、像书名。",
              "如果用户没有给具体剧情事实，不要写代词开头的剧情句，不要写宏大结果句，不要编身份、地点、资源、事件或动作。",
              "可以用题材气质、长期矛盾、目标压力、人物姿态做标题，但必须自然。",
              titleNamingStyle === "fanqie"
                ? "优先给出带行动感的标题：身份或处境 + 动作 + 目标/爽点承诺。"
                : null,
              "只选一个命名切口，不要把开局、过程和结局全部写进一个标题。",
              "如果拿不准，就用主角处境或核心压力生成自然标题，不要返回空数组。",
              "不要把 genre 和 tags 直接拼成标题。",
              "避开 previousTitlesInCurrentContext，不要同义改写。"
            ],
            outputSchema: {
              titles: "string[]"
            }
          },
          null,
          2
        )
      }
    ];

  try {
    const response = await requestAiJson<Partial<ProjectCreationAssistResult>>({
      messages: buildMessages(),
      temperature: currentTask.temperature,
      maxTokens: currentTask.maxTokens
    });

    const normalized = normalizeResult(
      response,
      mergedAvoidTitles(),
      legacyTitleFlow ? titleQualityOptions : undefined,
      input.targetReader
    );
    const generatedTitles = list(response.titles).map(cleanTitleText).filter(Boolean);
    const rejectedTitles = false
      ? generatedTitles.filter((title) => !normalized.titles.some((item) => titleFingerprint(item) === titleFingerprint(title)))
      : [];

    if (legacyTitleFlow && titleNamingStyle === "fanqie") {
      const acceptableTitles = normalized.titles.filter((title) => titleCharacterLength(title) <= 24);
      const hasEnoughShortTitles = acceptableTitles.length >= 3;
      const looksTooLong = normalized.titles.length > 0 && normalized.titles.every((title) => titleCharacterLength(title) > 24);

      if (!hasEnoughShortTitles || looksTooLong || normalized.titles.length < 3) {
        const compactResponse = await requestAiJson<Partial<ProjectCreationAssistResult>>({
          messages: buildMessages(true, rejectedTitles),
          temperature: 0.65,
          maxTokens: 900
        });

        const compactNormalized = normalizeResult(compactResponse, mergedAvoidTitles(rejectedTitles), titleQualityOptions, input.targetReader);
        const compactShortTitles = compactNormalized.titles.filter((title) => titleCharacterLength(title) <= 24);

        if (compactNormalized.titles.length === 0) {
          const conservativeResponse = await requestAiJson<Partial<ProjectCreationAssistResult>>({
            messages: buildConservativeTitleMessages(rejectedTitles),
            temperature: 0.55,
            maxTokens: 700
          });

          const conservativeNormalized = normalizeResult(conservativeResponse, mergedAvoidTitles(rejectedTitles), {
            ...titleQualityOptions,
            strict: false
          }, input.targetReader);
          const conservativeTitles = normalizeTitlesWithFallback(
            list(conservativeResponse.titles),
            mergedAvoidTitles(rejectedTitles),
            titleQualityOptions
          );

          if (conservativeTitles.length === 0) {
            return normalizeResult({ titles: [] }, mergedAvoidTitles(rejectedTitles), titleQualityOptions, input.targetReader);
          }

          return attachAiTokenUsage({
            ...conservativeNormalized,
            titles: conservativeTitles
          }, getAiTokenUsage(conservativeResponse));
        }

        return attachAiTokenUsage({
          ...compactNormalized,
          titles: compactShortTitles.length > 0 ? compactShortTitles : compactNormalized.titles
        }, getAiTokenUsage(compactResponse));
      }

      return attachAiTokenUsage({
        ...normalized,
        titles: acceptableTitles
      }, getAiTokenUsage(response));
    }

    const minimumTitleCount = legacyTitleFlow && titleNamingStyle === "qidian" ? 5 : 3;

    if (legacyTitleFlow && normalized.titles.length < minimumTitleCount) {
      const retryResponse = await requestAiJson<Partial<ProjectCreationAssistResult>>({
        messages: buildMessages(true, rejectedTitles),
        temperature: 0.7,
        maxTokens: 900
      });

      const retryNormalized = normalizeResult(retryResponse, mergedAvoidTitles(rejectedTitles), titleQualityOptions, input.targetReader);

      if (retryNormalized.titles.length === 0) {
        const conservativeResponse = await requestAiJson<Partial<ProjectCreationAssistResult>>({
          messages: buildConservativeTitleMessages(rejectedTitles),
          temperature: 0.55,
          maxTokens: 700
        });

        const conservativeNormalized = normalizeResult(conservativeResponse, mergedAvoidTitles(rejectedTitles), {
          ...titleQualityOptions,
          strict: false
        }, input.targetReader);
        const conservativeTitles = normalizeTitlesWithFallback(
          list(conservativeResponse.titles),
          mergedAvoidTitles(rejectedTitles),
          titleQualityOptions
        );

        if (conservativeTitles.length === 0) {
          return normalizeResult({ titles: [] }, mergedAvoidTitles(rejectedTitles), titleQualityOptions, input.targetReader);
        }

        return attachAiTokenUsage({
          ...conservativeNormalized,
          titles: conservativeTitles
        }, getAiTokenUsage(conservativeResponse));
      }

      return retryNormalized;
    }

    return normalized;
  } catch (error) {
    if (legacyTitleFlow) {
      try {
        const response = await requestAiJson<Partial<ProjectCreationAssistResult>>({
          messages: buildSimpleTitleMessages(),
          temperature: 0.65,
          maxTokens: 700
        });

        const normalized = normalizeResult(response, mergedAvoidTitles(), titleQualityOptions, input.targetReader);

        if (normalized.titles.length > 0) {
          return normalized;
        }

        const fallbackTitles = normalizeTitlesWithFallback(list(response.titles), mergedAvoidTitles(), titleQualityOptions);

        if (fallbackTitles.length === 0) {
          return normalizeResult({ titles: [] }, mergedAvoidTitles(), titleQualityOptions, input.targetReader);
        }

        return attachAiTokenUsage({
          ...normalized,
          titles: fallbackTitles
        }, getAiTokenUsage(response));
      } catch {
        return normalizeResult({ titles: [] }, mergedAvoidTitles(), titleQualityOptions, input.targetReader);
      }
    }

    throw error;
  }
}
