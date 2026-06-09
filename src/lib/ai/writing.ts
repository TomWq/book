import {
  attachAiTokenUsage,
  combineAiTokenUsages,
  getAiTokenUsage,
  type AiTokenUsage,
  requestAiJson,
  requestAiTextStream
} from "@/lib/ai/client";
import type {
  ReviewIssue,
  StoredChapterAnalysis,
  StoredChapterDraft,
  StoredChapterLedger,
  StoredCharacterProfile,
  StoredForeshadowing,
  StoredLongFormPlan,
  StoredPlotState,
  StoredReviewReport,
  StoredStoryAnalysis,
  StoredWritingBible,
  StoredWritingTaskCard
} from "@/lib/project-types";

type TaskCardContext = {
  projectName: string;
  projectDescription?: string;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
  longFormPlan?: StoredLongFormPlan | null;
  lastLedger: StoredChapterLedger | null;
  latestDraft: StoredChapterDraft | null;
  latestDraftActualEnding?: string;
  characters: StoredCharacterProfile[];
  chapterCharacterConstraints?: string[];
  foreshadowings: StoredForeshadowing[];
  relatedInspirations?: Array<{
    title: string;
    type: string;
    content: string;
    tags: string[];
  }>;
  storyAnalysis?: StoredStoryAnalysis | null;
  recentChapterAnalyses?: StoredChapterAnalysis[];
  recentChapterTitles?: Array<{ chapterNumber: number; title: string }>;
  userInput?: Partial<
    Pick<
      StoredWritingTaskCard,
      "title" | "chapterGoal" | "continuity" | "mainPlotProgress" | "pleasurePoint" | "endingHook"
    >
  >;
  chapterNumber: number;
  useAnalysisContext?: boolean;
};

export type ChapterDraftContext = {
  projectName?: string;
  projectDescription?: string;
  taskCard: StoredWritingTaskCard;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
  longFormPlan?: StoredLongFormPlan | null;
  lastLedger: StoredChapterLedger | null;
  continuityFacts?: string[];
  previousDraftTail?: string;
  recentChapterTitles?: Array<{ chapterNumber: number; title: string }>;
  characters: StoredCharacterProfile[];
  foreshadowings: StoredForeshadowing[];
  targetWordCount?: number;
};

export type ChapterStateUpdateContext = {
  draft: StoredChapterDraft;
  taskCard: StoredWritingTaskCard;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
  longFormPlan?: StoredLongFormPlan | null;
  lastLedger: StoredChapterLedger | null;
  previousCharacterNames?: string[];
  characters: StoredCharacterProfile[];
  foreshadowings: StoredForeshadowing[];
};

export type CharacterStateUpdate = {
  name: string;
  identity?: string;
  currentGoal?: string;
  longTermGoal?: string;
  secret?: string;
  relationshipToProtagonist?: string;
  attitude?: string;
  abilityBoundary?: string;
  voice?: string;
  knownInformation?: string;
  unknownInformation?: string;
  lastAppearance?: string;
  currentState?: string;
};

export type ForeshadowingStateUpdate = {
  name: string;
  status?: "open" | "partial" | "closed";
  relatedCharacters?: string[];
  relatedLocation?: string;
  expectedRevealChapter?: string;
  revealMethod?: string;
  hiddenInformation?: string;
};

export type ChapterStateUpdateResult = {
  events: string[];
  newCharacters: string[];
  newClues: string[];
  payoff: string;
  cliffhanger: string;
  stateChanges: string[];
  characterUpdates: CharacterStateUpdate[];
  foreshadowingUpdates: ForeshadowingStateUpdate[];
  relationshipChanges: string[];
  mapAndForceUpdates: string[];
  powerSystemUpdates: string[];
  resourceUpdates: string[];
};

type ReviewContext = {
  projectName?: string;
  projectDescription?: string;
  draft: StoredChapterDraft;
  taskCard: StoredWritingTaskCard;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
  longFormPlan?: StoredLongFormPlan | null;
  lastLedger: StoredChapterLedger | null;
  currentLedger?: StoredChapterLedger | null;
  characters: StoredCharacterProfile[];
  foreshadowings: StoredForeshadowing[];
};

type DraftPolishResult = {
  content: string;
  changed: boolean;
  usage?: AiTokenUsage;
};

export type EditContext = {
  mode: string;
  originalText: string;
};

type LongFormPlanContext = {
  projectName: string;
  projectDescription?: string;
  targetTotalWords: number;
  estimatedChapters: number;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
  characters: StoredCharacterProfile[];
  foreshadowings: StoredForeshadowing[];
  storyAnalysis?: StoredStoryAnalysis | null;
};

function asTextList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function cleanPromptText(value: string, limit = 260) {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function buildProjectFactGuardRules(context: LongFormPlanContext) {
  const projectDescription = context.projectDescription;
  const description = cleanPromptText(projectDescription ?? "", 900);
  const title = cleanPromptText(context.projectName, 180);
  const titleRule = title
    ? `书名“${title}”只能作为读者期待、包装方向和卖点语气参考，不是事实源；不得仅凭书名把动作目标、结局承诺、人物关系、具体敌人、资源归属或终局状态写入 confirmedFacts/doNotChange。若这些信息只出现在书名里，必须放到 tagPromises、corePromise 或 openQuestions。`
    : "书名只能作为读者期待、包装方向和卖点语气参考，不是事实源；不得仅凭书名把动作目标、结局承诺、人物关系、具体敌人、资源归属或终局状态写入 confirmedFacts/doNotChange。";

  if (!description) {
    return [
      titleRule,
      "项目简介为空时，必须以创作圣经、主线状态、人物档案和伏笔表作为事实源；confirmedFacts 只能写这些事实源已明确的信息。",
      "如果所有项目事实源都没有明确某个核心方向，openQuestions 必须列出需要作者确认的方向；不要擅自补出不可逆核心关系、最终归属、亲缘身份、重大真相或终局走向。"
    ];
  }

  return [
    titleRule,
    `项目简介是重要事实源：${description}`,
    "项目事实源包括：项目简介、创作圣经、主线状态、人物档案、伏笔表和拆书参考中已迁移到本项目的设定。规划不得只看简介，也不得忽略用户已在状态页维护的设定。",
    "必须先输出结构化“项目事实锁”：confirmedFacts 写所有项目事实源已明确且彼此不冲突的事实；openQuestions 写事实源没有定死或互相有张力的待确认点；doNotChange 写不得改写的事实；doNotRevealEarly 写前期不得提前揭开的核心信息；tagPromises 写题材标签和卖点承诺。",
    "规划不得改写项目事实源里的已发生事实、人物关系、身份状态、核心事件、能力/金手指来源、主线目标、人物当前状态、伏笔限制和读者承诺。",
    "项目事实源中已经明确且不冲突的事实必须原样承接；存在歧义、张力、缺口、标题暗示或跨字段冲突的地方，必须标成“待确认/需作者确认”，不能擅自裁决。",
    "凡是写入 openQuestions 或 doNotRevealEarly 的事项，后续 volumePlan、first10Chapters、first100Pacing、post100Pacing 和 progressionRules 中不得再用确定语气写成已发生/必然发生；如必须提及，只能写“可能/待确认/保留伏笔/视作者选择”。",
    "不要把项目事实源里的核心事件擅自改写成另一种真相；除非事实源明确说明，否则不能把未写出的反转当成既定事实。",
    "不要擅自决定最终情感归属、亲缘/血脉身份、幕后真相、政权/阵营终局等不可逆设定；除非项目事实源已明确，否则只能作为可选方向或待确认伏笔。",
    "前10章只能验证核心机制、建立压力和释放小回报；不能提前揭开核心冤案、终极身份、终极资源用途、最终反派底牌或主线最大反转。"
  ];
}

function asReviewIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const issues: ReviewIssue[] = [];

  value.forEach((item) => {
      if (!item || typeof item !== "object") {
      return;
      }

      const issue = item as Partial<ReviewIssue> & { problem?: unknown };
    const normalized: ReviewIssue = {
      type: String(issue.type ?? "").trim(),
      location: String(issue.location ?? "").trim(),
      severity:
        issue.severity === "high" || issue.severity === "medium" || issue.severity === "low"
          ? issue.severity
          : "medium",
      suggestion: String(issue.suggestion ?? "").trim(),
      problem: String(issue.problem ?? "").trim() || undefined
    };

    if (normalized.type && normalized.location && normalized.suggestion) {
      issues.push(normalized);
    }
  });

  return issues;
}

function asCharacterUpdates(value: unknown): CharacterStateUpdate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<CharacterStateUpdate[]>((updates, item) => {
    if (!item || typeof item !== "object") {
      return updates;
    }

    const update = item as Record<string, unknown>;
    const name = String(update.name ?? "").trim();

    if (!name) {
      return updates;
    }

    updates.push({
      name,
      identity: String(update.identity ?? "").trim() || undefined,
      currentGoal: String(update.currentGoal ?? "").trim() || undefined,
      longTermGoal: String(update.longTermGoal ?? "").trim() || undefined,
      secret: String(update.secret ?? "").trim() || undefined,
      relationshipToProtagonist: String(update.relationshipToProtagonist ?? "").trim() || undefined,
      attitude: String(update.attitude ?? "").trim() || undefined,
      abilityBoundary: String(update.abilityBoundary ?? "").trim() || undefined,
      voice: String(update.voice ?? "").trim() || undefined,
      knownInformation: String(update.knownInformation ?? "").trim() || undefined,
      unknownInformation: String(update.unknownInformation ?? "").trim() || undefined,
      lastAppearance: String(update.lastAppearance ?? "").trim() || undefined,
      currentState: String(update.currentState ?? "").trim() || undefined
    });

    return updates;
  }, []);
}

function asForeshadowingUpdates(value: unknown): ForeshadowingStateUpdate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<ForeshadowingStateUpdate[]>((updates, item) => {
    if (!item || typeof item !== "object") {
      return updates;
    }

    const update = item as Record<string, unknown>;
    const name = String(update.name ?? "").trim();

    if (!name) {
      return updates;
    }

    const status = update.status === "closed" || update.status === "partial" || update.status === "open"
      ? update.status
      : undefined;

    updates.push({
      name,
      status,
      relatedCharacters: asTextList(update.relatedCharacters),
      relatedLocation: String(update.relatedLocation ?? "").trim() || undefined,
      expectedRevealChapter: String(update.expectedRevealChapter ?? "").trim() || undefined,
      revealMethod: String(update.revealMethod ?? "").trim() || undefined,
      hiddenInformation: String(update.hiddenInformation ?? "").trim() || undefined
    });

    return updates;
  }, []);
}

function splitReviewSentences(content: string) {
  return content
    .split(/(?<=[。！？!?])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function shortReviewExcerpt(value: string, limit = 180) {
  const text = value.trim();

  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function rewriteAiFlavorSentence(sentence: string, signals: string[]) {
  let rewritten = sentence;

  signals.forEach((signal) => {
    rewritten = rewritten
      .replace(new RegExp(`(^|[，,。；;：:\\s])${signal}[，,]?`, "g"), "$1")
      .replaceAll(signal, "");
  });

  return rewritten
    .replace(/，{2,}/g, "，")
    .replace(/^，|，$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function detectAiFlavorIssues(content: string): ReviewIssue[] {
  const text = content.trim();

  if (!text) {
    return [];
  }

  const paragraphs = text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const longParagraphs = paragraphs.filter((paragraph) => paragraph.length >= 220);
  const signals = [
    "这意味着",
    "显然",
    "无疑",
    "某种程度上",
    "不禁",
    "仿佛",
    "似乎",
    "也就是说",
    "本质上",
    "总之",
    "从某种意义上",
    "她意识到",
    "他意识到",
    "她知道",
    "他知道"
  ];
  const signalHits = signals.filter((signal) => text.includes(signal));
  const issues: ReviewIssue[] = [];

  if (longParagraphs.length >= 2) {
    const paragraph = shortReviewExcerpt(longParagraphs[0]);

    issues.push({
      type: "ai_flavor",
      location: `“${paragraph}”`,
      severity: "medium",
      problem: "连续长段落太多，读起来像模型在堆叙述，不够像自然网文分镜。",
      suggestion: `这类问题通常不适合机械替换。建议把“${paragraph}”拆成 2-4 个短段，优先补角色动作、对话和即时反应，每段控制在 1-4 句。`
    });
  }

  if (signalHits.length >= 2) {
    const signalSentence = splitReviewSentences(text).find((sentence) =>
      signals.some((signal) => sentence.includes(signal))
    );
    const sentence = signalSentence ? shortReviewExcerpt(signalSentence) : signalHits.slice(0, 2).join(" / ");
    const sentenceSignals = signals.filter((signal) => sentence.includes(signal));
    const rewritten = signalSentence ? rewriteAiFlavorSentence(sentence, sentenceSignals) : "";
    const suggestion =
      rewritten && rewritten !== sentence
        ? `将“${sentence}”改为“${rewritten}”。如果删掉判断词后语义变薄，请再补一个动作、对话或可见反应。`
        : `请定位“${sentence}”，删掉抽象判断词，改成角色动作、对话或即时反应。`;

    issues.push({
      type: "ai_flavor",
      location: `“${sentence}”`,
      severity: "medium",
      problem: `出现“${sentenceSignals.slice(0, 3).join(" / ")}”这类典型书面腔/总结腔标记，容易让正文显得像 AI 在解释故事。`,
      suggestion
    });
  }

  return issues;
}

function buildStoryReference(storyAnalysis?: StoredStoryAnalysis | null) {
  if (!storyAnalysis) {
    return null;
  }

  return {
    genre: storyAnalysis.genre,
    protagonistModel: storyAnalysis.protagonistModel,
    openingModel: storyAnalysis.openingModel,
    goldenFingerMechanism: storyAnalysis.goldenFingerMechanism,
    villainFunction: storyAnalysis.villainFunction,
    supportingRoles: storyAnalysis.supportingRoles,
    mapProgression: storyAnalysis.mapProgression,
    usablePatterns: storyAnalysis.usablePatterns,
    avoidCopying: storyAnalysis.avoidCopying,
    openingHookPattern: storyAnalysis.openingHook,
    mainLoopPattern: storyAnalysis.mainLoop,
    pacingPattern: storyAnalysis.pacing,
    topPleasureTypes: storyAnalysis.topPleasureTypes,
    formula: storyAnalysis.formula,
    migrationAdvice: storyAnalysis.migrationAdvice
  };
}

function buildChapterPatternReferences(chapterAnalyses?: StoredChapterAnalysis[]) {
  return (chapterAnalyses ?? []).map((analysis, index) => ({
    referenceIndex: index + 1,
    conflictPattern: analysis.conflict,
    pressurePattern: analysis.pressurePoint,
    payoffFunction: analysis.payoff,
    cliffhangerFunction: analysis.cliffhanger,
    readerHookFunction: analysis.readerHook,
    pleasureTypes: analysis.pleasurePoints.map((point) => point.type),
    structuralUseOnly:
      "只参考压制、反击、收益、钩子的功能关系，不得复用原书人物、地点、线索、章节事件和具体表达。"
  }));
}

function compactTextList(items: unknown, limit = 6, itemLimit = 180) {
  return asTextList(items)
    .map((item) => cleanPromptText(item, itemLimit))
    .filter(Boolean)
    .slice(0, limit);
}

function isManagedSideThread(value: string) {
  return /^(配角弧线|支线|暗线)：/.test(value.trim()) && !/为重要配角建立|每条支线必须/.test(value);
}

function compactPriorityTextList(
  items: unknown,
  priority: (item: string) => boolean,
  limit = 6,
  itemLimit = 180
) {
  const list = asTextList(items)
    .map((item) => cleanPromptText(item, itemLimit))
    .filter(Boolean);
  const prioritized = list.filter(priority);
  const rest = list.filter((item) => !priority(item));

  return Array.from(new Set([...prioritized, ...rest])).slice(0, limit);
}

function compactTaskCardBible(bible: StoredWritingBible) {
  return {
    workType: cleanPromptText(bible.workType, 120),
    targetReader: cleanPromptText(bible.targetReader, 160),
    corePleasure: cleanPromptText(bible.corePleasure, 220),
    protagonistDesire: cleanPromptText(bible.protagonistDesire, 180),
    worldRules: cleanPromptText(bible.worldRules, 260),
    goldenFingerRules: cleanPromptText(bible.goldenFingerRules, 260),
    powerSystem: cleanPromptText(bible.powerSystem, 220),
    narrativeTaboos: cleanPromptText(bible.narrativeTaboos, 220),
    immutableSettings: cleanPromptText(bible.immutableSettings, 320),
    styleGuide: cleanPromptText(bible.styleGuide, 180)
  };
}

function compactTaskCardPlotState(plotState: StoredPlotState) {
  return {
    currentVolume: cleanPromptText(plotState.currentVolume, 120),
    currentMap: cleanPromptText(plotState.currentMap, 120),
    mainGoal: cleanPromptText(plotState.mainGoal, 220),
    shortTermGoal: cleanPromptText(plotState.shortTermGoal, 220),
    currentStage: cleanPromptText(plotState.currentStage, 260),
    currentEnemy: cleanPromptText(plotState.currentEnemy, 160),
    unresolvedQuestions: compactTextList(plotState.unresolvedQuestions, 6, 160),
    openThreads: compactPriorityTextList(plotState.openThreads, isManagedSideThread, 8, 180),
    nextMilestones: compactTextList(plotState.nextMilestones, 6, 160),
    nextStageGoal: cleanPromptText(plotState.nextStageGoal, 180),
    powerSystemState: cleanPromptText(plotState.powerSystemState, 180),
    mapAndForces: cleanPromptText(plotState.mapAndForces, 220),
    resourceState: cleanPromptText(plotState.resourceState, 180),
    relationshipChanges: compactTextList(plotState.relationshipChanges, 5, 160)
  };
}

function compactTaskCardCharacter(character: StoredCharacterProfile) {
  return {
    name: character.name,
    identity: cleanPromptText(character.identity, 90),
    currentGoal: cleanPromptText(character.currentGoal, 120),
    relationshipToProtagonist: cleanPromptText(character.relationshipToProtagonist, 100),
    attitude: cleanPromptText(character.attitude, 90),
    abilityBoundary: cleanPromptText(character.abilityBoundary, 120),
    knownInformation: cleanPromptText(character.knownInformation, 160),
    unknownInformation: cleanPromptText(character.unknownInformation, 140),
    currentState: cleanPromptText(character.currentState, 140)
  };
}

function compactTaskCardForeshadowing(item: StoredForeshadowing) {
  return {
    name: cleanPromptText(item.name, 80),
    status: item.status,
    plantedChapter: cleanPromptText(item.plantedChapter, 60),
    expectedRevealChapter: cleanPromptText(item.expectedRevealChapter, 80),
    hiddenInformation: cleanPromptText(item.hiddenInformation, 160),
    revealMethod: cleanPromptText(item.revealMethod, 140)
  };
}

function compactTaskCardLedger(ledger: StoredChapterLedger | null) {
  if (!ledger) {
    return null;
  }

  return {
    chapterNumber: ledger.chapterNumber,
    title: cleanPromptText(ledger.title, 80),
    events: compactTextList(ledger.events, 5, 140),
    newClues: compactTextList(ledger.newClues, 5, 140),
    payoff: cleanPromptText(ledger.payoff, 140),
    cliffhanger: cleanPromptText(ledger.cliffhanger, 160),
    stateChanges: compactTextList(ledger.stateChanges, 5, 140),
    carryOverTasks: compactTextList(ledger.carryOverTasks ?? [], 5, 140)
  };
}

function compactTaskCardLatestDraft(draft: StoredChapterDraft | null) {
  if (!draft) {
    return null;
  }

  return {
    chapterNumber: draft.chapterNumber,
    title: cleanPromptText(draft.title, 80),
    ending: cleanPromptText(draft.content.trim().slice(-320), 260)
  };
}

function buildTaskCardStoryReference(storyAnalysis?: StoredStoryAnalysis | null) {
  if (!storyAnalysis) {
    return null;
  }

  return {
    genre: cleanPromptText(storyAnalysis.genre, 100),
    protagonistModel: cleanPromptText(storyAnalysis.protagonistModel, 180),
    openingModel: cleanPromptText(storyAnalysis.openingModel, 180),
    goldenFingerMechanism: cleanPromptText(storyAnalysis.goldenFingerMechanism, 180),
    openingHookPattern: cleanPromptText(storyAnalysis.openingHook, 180),
    mainLoopPattern: cleanPromptText(storyAnalysis.mainLoop, 240),
    pacingPattern: cleanPromptText(storyAnalysis.pacing, 220),
    topPleasureTypes: compactTextList(storyAnalysis.topPleasureTypes, 6, 80),
    usablePatterns: compactTextList(storyAnalysis.usablePatterns, 5, 160),
    avoidCopying: compactTextList(storyAnalysis.avoidCopying, 5, 160)
  };
}

function buildTaskCardChapterPatternReferences(chapterAnalyses?: StoredChapterAnalysis[]) {
  return (chapterAnalyses ?? []).slice(0, 3).map((analysis, index) => ({
    referenceIndex: index + 1,
    conflictPattern: cleanPromptText(analysis.conflict, 160),
    pressurePattern: cleanPromptText(analysis.pressurePoint, 160),
    payoffFunction: cleanPromptText(analysis.payoff, 160),
    cliffhangerFunction: cleanPromptText(analysis.cliffhanger, 160),
    pleasureTypes: compactTextList(analysis.pleasurePoints.map((point) => point.type), 5, 60),
    structuralUseOnly: "只参考功能关系，不复用原书内容。"
  }));
}

function parseChineseChapterNumber(value: string) {
  const digits = "零一二两三四五六七八九";
  const digitValue = (char: string) => {
    if (char === "两") {
      return 2;
    }

    const index = digits.indexOf(char);
    return index >= 0 ? index : 0;
  };
  const text = value.trim();

  if (!text) {
    return null;
  }

  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  if (text === "十") {
    return 10;
  }

  const hundredParts = text.split("百");
  let result = 0;
  let rest = text;

  if (hundredParts.length > 1) {
    result += (hundredParts[0] ? digitValue(hundredParts[0]) : 1) * 100;
    rest = hundredParts.slice(1).join("百");
  }

  const tenParts = rest.split("十");

  if (tenParts.length > 1) {
    result += (tenParts[0] ? digitValue(tenParts[0]) : 1) * 10;
    result += tenParts[1] ? digitValue(tenParts[1]) : 0;
    return result || null;
  }

  result += rest ? digitValue(rest) : 0;
  return result || null;
}

function blueprintChapterNumber(value: string) {
  const text = value.trim();
  const arabicMatch = text.match(/^(?:第\s*)?(\d+)\s*(?:章|[.、:：])/i);

  if (arabicMatch?.[1]) {
    return Number(arabicMatch[1]);
  }

  const chapterMatch = text.match(/^第\s*([零一二两三四五六七八九十百]+)\s*章/);

  if (chapterMatch?.[1]) {
    return parseChineseChapterNumber(chapterMatch[1]);
  }

  const englishMatch = text.match(/^chapter\s*(\d+)/i);

  if (englishMatch?.[1]) {
    return Number(englishMatch[1]);
  }

  return null;
}

function longFormChapterBlueprint(plan: StoredLongFormPlan, chapterNumber?: number) {
  if (!chapterNumber || chapterNumber <= 0 || plan.first10Chapters.length === 0) {
    return "";
  }

  const exact = plan.first10Chapters.find((entry) => blueprintChapterNumber(entry) === chapterNumber);

  if (exact) {
    return exact;
  }

  return plan.first10Chapters[chapterNumber - 1] ?? "";
}

function nearbyLongFormChapterBlueprints(plan: StoredLongFormPlan, chapterNumber?: number) {
  if (!chapterNumber || chapterNumber <= 0 || plan.first10Chapters.length === 0) {
    return [];
  }

  const numberedEntries = plan.first10Chapters
    .map((entry) => ({ entry, chapterNumber: blueprintChapterNumber(entry) }))
    .filter((item): item is { entry: string; chapterNumber: number } => Boolean(item.chapterNumber));
  const nearby = numberedEntries
    .filter((item) => Math.abs(item.chapterNumber - chapterNumber) <= 1)
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map((item) => item.entry);

  if (nearby.length > 0) {
    return nearby;
  }

  return plan.first10Chapters.slice(Math.max(0, chapterNumber - 2), chapterNumber + 1);
}

function buildTaskCardLongFormPlanSummary(plan: StoredLongFormPlan | null | undefined, chapterNumber?: number) {
  if (!plan) {
    return null;
  }

  const currentBlueprint = longFormChapterBlueprint(plan, chapterNumber);

  return {
    targetTotalWords: plan.targetTotalWords,
    estimatedChapters: plan.estimatedChapters,
    corePromise: cleanPromptText(plan.corePromise || plan.planningBasis, 180),
    openingBlueprintPolicy: "开局任务蓝图按任务队列参考；如上一章 carryOverTasks 未完成，优先承接未完成项，蓝图顺位可自然后移。蓝图中写明章节号的条目必须按对应章节读取，不限于前10章。",
    currentChapterPlan: currentBlueprint ? cleanPromptText(currentBlueprint, 220) : "",
    nearbyOpeningPlan: compactTextList(nearbyLongFormChapterBlueprints(plan, chapterNumber), 3, 180),
    currentStage: cleanPromptText(extractLongFormStageText(plan, chapterNumber), 360),
    progressionPacing: compactTextList(plan.progressionPacing, 3, 100),
    rewardPacing: compactTextList(plan.rewardPacing, 3, 100),
    confirmedFacts: compactTextList(plan.confirmedFacts, 4, 100),
    openQuestions: compactTextList(plan.openQuestions, 3, 100),
    doNotChange: compactTextList(plan.doNotChange, 4, 100),
    doNotRevealEarly: compactTextList(plan.doNotRevealEarly, 3, 100),
    tagPromises: compactTextList(plan.tagPromises, 4, 80),
    progressionRules: compactTextList(plan.progressionRules, 4, 100)
  };
}

function buildTaskCardLongFormRules(plan?: StoredLongFormPlan | null, chapterNumber?: number) {
  if (!plan) {
    return [
      "当前项目尚未生成长篇规划；任务卡保持保守节奏，先稳住核心承诺、关键机制和当前阶段目标。"
    ];
  }

  const currentChapterPlan = cleanPromptText(longFormChapterBlueprint(plan, chapterNumber), 280);

  return [
    `长篇规划基准：目标约 ${plan.targetTotalWords} 字，预计 ${plan.estimatedChapters} 章；核心承诺：${cleanPromptText(plan.corePromise || plan.planningBasis, 180)}`,
    currentChapterPlan ? `开局任务蓝图中的当前章节约束：${currentChapterPlan}` : "",
    "开局任务蓝图是任务队列和节奏参考，不是强制一章一条；如果上一章 carryOverTasks 未完成，本章优先承接 carryOverTasks，再把蓝图顺位自然后移。蓝图中的心理、身体反应和现实回响只作为节奏提示，除非用户明确要求本章必须写，否则不要写入任务卡硬规则。",
    cleanPromptText(extractLongFormStageText(plan, chapterNumber), 320),
    plan.doNotChange.length ? `禁止改写核心事实：${compactTextList(plan.doNotChange, 4, 90).join("；")}` : "",
    plan.doNotRevealEarly.length ? `禁止提前揭示：${compactTextList(plan.doNotRevealEarly, 3, 90).join("；")}` : "",
    plan.progressionPacing.length ? `成长节奏上限：${compactTextList(plan.progressionPacing, 3, 90).join("；")}` : "",
    plan.rewardPacing.length ? `收益释放频率：${compactTextList(plan.rewardPacing, 3, 90).join("；")}` : "",
    ...compactTextList(plan.progressionRules, 4, 100)
  ].filter(Boolean);
}

function buildLongFormPlanSummary(plan?: StoredLongFormPlan | null) {
  if (!plan) {
    return null;
  }

  const confirmedFacts = asTextList(plan.confirmedFacts);
  const openQuestions = asTextList(plan.openQuestions);
  const doNotChange = asTextList(plan.doNotChange);
  const doNotRevealEarly = asTextList(plan.doNotRevealEarly);
  const tagPromises = asTextList(plan.tagPromises);

  return {
    targetTotalWords: plan.targetTotalWords,
    estimatedChapters: plan.estimatedChapters,
    planningBasis: plan.planningBasis,
    corePromise: plan.corePromise,
    volumePlan: plan.volumePlan,
    progressionPacing: plan.progressionPacing,
    rewardPacing: plan.rewardPacing,
    confirmedFacts,
    openQuestions,
    doNotChange,
    doNotRevealEarly,
    tagPromises,
    first10Chapters: plan.first10Chapters,
    first100Pacing: plan.first100Pacing,
    post100Pacing: plan.post100Pacing,
    progressionRules: plan.progressionRules
  };
}

function normalizeLongFormChapterRanges(value: string) {
  return value.replace(/[—–－~～至]/g, "-");
}

function extractLongFormStageChunk(value: string, chapterNumber?: number) {
  if (!chapterNumber || chapterNumber <= 0) {
    return null;
  }

  const normalized = normalizeLongFormChapterRanges(value.trim());

  if (!normalized) {
    return null;
  }

  const pattern = /第\s*(\d+)\s*-\s*(?:第\s*)?(\d+)\s*章/g;
  const matches = Array.from(normalized.matchAll(pattern));

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = Number(match[1]);
    const end = Number(match[2]);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }

    if (chapterNumber < start || chapterNumber > end) {
      continue;
    }

    const startIndex = match.index ?? 0;
    const nextIndex = matches[index + 1]?.index ?? normalized.length;
    const text = normalized.slice(startIndex, nextIndex).trim();

    return { start, end, text };
  }

  return null;
}

function extractLongFormStageText(plan: StoredLongFormPlan, chapterNumber?: number) {
  if (!chapterNumber || chapterNumber <= 0) {
    return "";
  }

  const structuredStage =
    extractLongFormStageChunk(plan.first100Pacing, chapterNumber) ??
    extractLongFormStageChunk(plan.post100Pacing, chapterNumber);

  if (structuredStage) {
    return `当前章节属于第${structuredStage.start}-${structuredStage.end}章阶段：${structuredStage.text}`;
  }

  const frontStageEnd = Math.min(100, plan.estimatedChapters);

  if (chapterNumber <= frontStageEnd) {
    return plan.first100Pacing ? `当前章节属于第1-${frontStageEnd}章规划阶段：${plan.first100Pacing}` : "";
  }

  if (!plan.post100Pacing) {
    return plan.first100Pacing
      ? `当前章节已超过原估算约${plan.estimatedChapters}章；仍需承接全书阶段规划：${plan.first100Pacing}`
      : "";
  }

  const stageStart = 101 + Math.floor((chapterNumber - 101) / 50) * 50;
  const stageEnd = Math.min(stageStart + 49, plan.estimatedChapters);
  const normalized = normalizeLongFormChapterRanges(plan.post100Pacing);
  const pattern = new RegExp(`第\\s*${stageStart}\\s*-\\s*(?:第\\s*)?${stageEnd}\\s*章`);
  const match = pattern.exec(normalized);

  if (!match) {
    return `当前章节属于第${stageStart}-${stageEnd}章阶段；后续阶段规划参考：${plan.post100Pacing}`;
  }

  const nextStageStart = stageStart + 50;
  const nextStageEnd = Math.min(nextStageStart + 49, plan.estimatedChapters);
  const nextPattern = new RegExp(`第\\s*${nextStageStart}\\s*-\\s*(?:第\\s*)?${nextStageEnd}\\s*章`);
  const rest = normalized.slice((match.index ?? 0) + match[0].length);
  const nextMatch = nextPattern.exec(rest);
  const stageBody = rest.slice(0, nextMatch?.index ?? rest.length).replace(/^[:：\s]+/, "").trim();

  return `当前章节属于第${stageStart}-${stageEnd}章阶段：${stageBody || plan.post100Pacing}`;
}

function buildLongFormStageClosureRules(plan: StoredLongFormPlan, chapterNumber?: number) {
  const stage =
    extractLongFormStageChunk(plan.first100Pacing, chapterNumber) ??
    extractLongFormStageChunk(plan.post100Pacing, chapterNumber);

  if (!stage || !chapterNumber) {
    return [];
  }

  const isNearStageEnd = chapterNumber >= stage.end - 2;
  const hasClosureSignal = /收束|结案|完成|回收|进入下一阶段|返回|公开审理|破获|解决/.test(stage.text);

  if (!isNearStageEnd && !hasClosureSignal) {
    return [];
  }

  return [
    `阶段收束压力：当前位于长篇规划第${stage.start}-${stage.end}章，规划要求为「${cleanPromptText(stage.text, 300)}」。`,
    isNearStageEnd
      ? "当前已接近或到达本阶段尾声，本章任务卡必须优先收束当前案件/当前任务链；不得再新增需要多章验证的新嫌疑人、新地点、新物证或新组织。"
      : "如果本阶段规划已写明收束、结案、完成、回收或进入下一阶段，任务卡必须朝该收束动作推进，不要继续扩写旁支细节。",
    "悬疑/案件类章节到阶段末尾时，优先安排关键证据对上、嫌疑人正面对质、公开审理、阶段性定罪、现实返回或进入下一案；细枝线索只能压缩成一两句或滚入后续案外暗线。"
  ];
}

function buildLongFormPlanRules(plan?: StoredLongFormPlan | null, chapterNumber?: number) {
  if (!plan) {
    return [
      "当前项目尚未生成长篇规划。任务卡应保持保守节奏：先稳住核心承诺、关键机制和当前阶段目标，避免连续开新地图或大阶段跃迁。"
    ];
  }

  const chapterBlueprint = cleanPromptText(longFormChapterBlueprint(plan, chapterNumber), 420);
  const chapterBlueprintRule =
    chapterNumber && chapterBlueprint
      ? `当前是第 ${chapterNumber} 章，必须优先对齐开局任务蓝图中的本章功能：${chapterBlueprint}`
      : "";
  const currentStageRule = cleanPromptText(extractLongFormStageText(plan, chapterNumber), 900);
  const confirmedFacts = asTextList(plan.confirmedFacts);
  const openQuestions = asTextList(plan.openQuestions);
  const doNotChange = asTextList(plan.doNotChange);
  const doNotRevealEarly = asTextList(plan.doNotRevealEarly);
  const tagPromises = asTextList(plan.tagPromises);
  const stageClosureRules = buildLongFormStageClosureRules(plan, chapterNumber);

  return [
    `长篇规划基准：目标约 ${plan.targetTotalWords} 字，预计 ${plan.estimatedChapters} 章；核心承诺：${cleanPromptText(plan.corePromise || plan.planningBasis, 260)}`,
    confirmedFacts.length ? `项目事实源已确定事实，后续任务卡和正文必须承接：${compactTextList(confirmedFacts, 8, 160).join("；")}` : "",
    openQuestions.length ? `项目事实源待确认点，不得在任务卡或正文中擅自裁决：${compactTextList(openQuestions, 6, 160).join("；")}` : "",
    doNotChange.length ? `禁止改写的核心事实：${compactTextList(doNotChange, 8, 160).join("；")}` : "",
    doNotRevealEarly.length ? `禁止提前揭示的信息：${compactTextList(doNotRevealEarly, 6, 160).join("；")}` : "",
    tagPromises.length ? `必须持续兑现的标签/卖点承诺：${compactTextList(tagPromises, 6, 140).join("；")}` : "",
    chapterBlueprintRule,
    currentStageRule,
    ...stageClosureRules,
    chapterNumber && chapterNumber > 100
      ? currentStageRule
        ? ""
        : plan.post100Pacing
          ? `后续阶段总览：${cleanPromptText(plan.post100Pacing, 900)}`
          : plan.first100Pacing
            ? `超过原估算前段后仍需承接全书卷纲：${cleanPromptText(plan.first100Pacing, 900)}`
            : ""
      : "",
    chapterNumber && chapterNumber <= 100
      ? plan.first100Pacing
        ? `前段节奏只作边界参考，当前任务卡不得提前兑现远期收益：${cleanPromptText(plan.first100Pacing, 700)}`
        : ""
      : "",
    plan.progressionPacing.length
      ? `成长/境界/资源节奏上限：${compactTextList(plan.progressionPacing, 5, 160).join("；")}`
      : "",
    plan.rewardPacing.length ? `收益释放频率：${compactTextList(plan.rewardPacing, 5, 160).join("；")}` : "",
    ...compactTextList(plan.progressionRules, 8, 180),
    chapterNumber
      ? `本章任务卡和正文必须优先遵守“当前章节阶段约束”，不得提前兑现后续阶段的地图、敌人、身份、资源、大收益或终局信息。`
      : "",
    "如果本章任务与长篇规划冲突，优先降低收益等级、推迟大突破、收束支线或改成线索/资格/试用/小收益。"
  ].filter(Boolean);
}

function buildLongFormPlanningGuardRules(context: Pick<LongFormPlanContext, "targetTotalWords" | "estimatedChapters">) {
  const isMediumOrLong = context.targetTotalWords >= 100_000 || context.estimatedChapters >= 60;
  const isLong = context.targetTotalWords >= 300_000 || context.estimatedChapters >= 120;

  if (!isMediumOrLong) {
    return [
      "即使是短中篇，前10章也应先建立机制可信度和第一阶段压力，不要用连续突破替代剧情推进。"
    ];
  }

  return [
    "默认先区分“小台阶”和“大阶段”：小台阶可以是资格、试用、接近门槛、局部能力、一次性资源、关系变化、线索；大阶段是作品内命名层级、身份、地图、权限或核心资源的正式跨档。",
    "必须先识别简介或创作圣经里的成长阶梯、奖励阈值、等级表、职位表、地图表、关系表或资源表：这些默认是“全书长期规则/上限表”，不是前期章节进度表，不能按列出的顺序自动排进第一卷。",
    "除非用户明确选择短篇、开局满级、快穿、极限快节奏等特殊模式，前10章最多允许一次正式大阶段跨档；不要连续两次正式大突破。",
    "如果成长体系有多个命名阶段，前10章默认只验证机制并稳定第一个成长阶段；后续大阶段应按目标篇幅拉开距离，而不是被阈值表或任务清单自动连跳。",
    "如果关键机制依赖某个可量化指标或持续状态，必须区分“临时收益”和“稳定指标”：一次性收获、短期任务、预期收益、试用资格或临时合作不能直接等同为长期稳定指标，只能写成接近门槛、进度条、资格、临时助力或风险预告。",
    "前10章功能应写“本章剧情功能”，不要把每章都写成数值上涨和正式跨档；至少保留日常压力、关系铺垫、机制限制、误判、信息差和下一步目标。",
    "收益频率要服务长篇预算：小收益可以较高频，中收益需要阶段铺垫，大阶段突破必须按卷或阶段收束安排，不能靠数值阈值自动连跳。"
  ].concat(
    isLong
      ? [
          "当前目标属于长篇体量，前30章默认仍是第一阶段主循环建立期；第1卷的任务是让读者相信机制、主角处境和压力升级，不是把核心成长表快速兑现。",
          "长篇体量下，第一卷默认只消耗长期成长阶梯的前段资源；不得把简介里列出的中后期档位、终局目标或高阶敌人直接设成第一卷完成目标。",
          "长篇规划中必须写出“卡点”：关键指标或核心资源达到门槛前的稳定性验证、结算周期、资格审核、代价、风险或外部阻力。"
        ]
      : []
  );
}

function buildRequiredPost100PlanRanges(estimatedChapters: number) {
  if (estimatedChapters <= 100) {
    return ["本书预计不超过100章，post100Pacing 留空；first100Pacing 必须按预计总章数覆盖全书起承转合、阶段压力、阶段爽点、伏笔回收和终局收束。"];
  }

  const ranges = [];
  for (let start = 101; start <= estimatedChapters; start += 50) {
    const end = Math.min(start + 49, estimatedChapters);
    const finalLabel = end === estimatedChapters ? "（剩余结尾）" : "";
    ranges.push(`第${start}-${end}章${finalLabel}：必须写满“阶段目标、主要对手/压力、主角成长上限、地图/势力推进、爽点类型与频率、伏笔埋设/回收、重要支线收束、感情/关系变化、阶段结尾钩子、进入下一阶段条件”`);
  }

  return ranges;
}

function normalizeAiLongFormPlanResponse(response: Partial<StoredLongFormPlan>) {
  return {
    planningBasis: String(response.planningBasis ?? "").trim(),
    corePromise: String(response.corePromise ?? "").trim(),
    volumePlan: asTextList(response.volumePlan),
    progressionPacing: asTextList(response.progressionPacing),
    rewardPacing: asTextList(response.rewardPacing),
    confirmedFacts: asTextList(response.confirmedFacts),
    openQuestions: asTextList(response.openQuestions),
    doNotChange: asTextList(response.doNotChange),
    doNotRevealEarly: asTextList(response.doNotRevealEarly),
    tagPromises: asTextList(response.tagPromises),
    first10Chapters: asTextList(response.first10Chapters).slice(0, 12),
    first100Pacing: String(response.first100Pacing ?? "").trim(),
    post100Pacing: String(response.post100Pacing ?? "").trim(),
    progressionRules: asTextList(response.progressionRules)
  };
}

type AiLongFormPlanPayload = ReturnType<typeof normalizeAiLongFormPlanResponse>;

type LongFormPost100StageResponse = {
  stages?: Array<{
    range?: string;
    stageTarget?: string;
    pressure?: string;
    growthLimit?: string;
    mapAndForces?: string;
    payoffRhythm?: string;
    foreshadowing?: string;
    sideClosure?: string;
    relationshipChange?: string;
    stageHook?: string;
    nextCondition?: string;
    body?: string;
  }>;
  post100Pacing?: string;
};

type LongFormStageStructuredResponse = {
  first100Stages?: LongFormPost100StageResponse["stages"];
  first100Pacing?: string;
};

function buildLongFormPlanPromptContext(context: LongFormPlanContext) {
  return {
    projectName: context.projectName,
    projectDescription: context.projectDescription,
    targetTotalWords: context.targetTotalWords,
    estimatedChapters: context.estimatedChapters,
    bible: context.bible,
    plotState: context.plotState,
    characters: context.characters.slice(0, 8),
    foreshadowings: context.foreshadowings.slice(0, 10),
    storyReference: buildStoryReference(context.storyAnalysis)
  };
}

function normalizePost100StageText(value: unknown) {
  return cleanPromptText(String(value ?? ""), 520);
}

function keywordTokensFromText(value: string) {
  const normalized = value.replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, " ");
  const tokens = normalized.match(/[\p{Script=Han}A-Za-z0-9]{2,}/gu) ?? [];
  const seen = new Set<string>();

  return tokens
    .map((token) => token.trim())
    .filter((token) => {
      if (token.length < 2 || token.length > 18 || seen.has(token)) {
        return false;
      }

      seen.add(token);
      return true;
    })
    .slice(0, 8);
}

function extractPlanEvidenceForQuestions(plan: AiLongFormPlanPayload) {
  const questions = [...plan.openQuestions, ...plan.doNotRevealEarly].slice(0, 12);
  const tokens = keywordTokensFromText(questions.join(" "));
  const planLines = [
    plan.corePromise,
    ...plan.confirmedFacts,
    ...plan.doNotChange,
    ...plan.first10Chapters,
    ...plan.progressionRules,
    ...plan.first100Pacing.split(/(?=第\s*\d+\s*-\s*(?:第\s*)?\d+\s*章)|[。；;]/),
    ...plan.post100Pacing.split(/(?=第\s*\d+\s*-\s*(?:第\s*)?\d+\s*章)|[。；;]/)
  ]
    .map((line) => cleanPromptText(line, 220))
    .filter(Boolean);

  if (tokens.length === 0) {
    return planLines.slice(0, 18);
  }

  const matched = planLines.filter((line) => tokens.some((token) => line.includes(token)));
  return (matched.length > 0 ? matched : planLines).slice(0, 24);
}

function buildPacingTextFromStages(response: LongFormPost100StageResponse, requiredRanges: string[]) {
  const stages = Array.isArray(response.stages) ? response.stages : [];

  if (stages.length === 0) {
    return String(response.post100Pacing ?? "").trim();
  }

  return stages
    .map((stage, index) => {
      const requestedRange = requiredRanges[index]?.match(/第\d+-\d+章/)?.[0] ?? "";
      const aiRange = normalizePost100StageText(stage.range);
      const range = requestedRange || (/\d+\s*-\s*\d+/.test(aiRange) ? aiRange : "") || `第${index + 1}阶段`;
      const parts = [
        ["阶段目标", stage.stageTarget],
        ["主要压力/对手", stage.pressure],
        ["成长上限", stage.growthLimit],
        ["地图/势力推进", stage.mapAndForces],
        ["爽点节奏", stage.payoffRhythm],
        ["伏笔", stage.foreshadowing],
        ["支线收束", stage.sideClosure],
        ["关系变化", stage.relationshipChange],
        ["阶段钩子", stage.stageHook],
        ["进入下一阶段条件", stage.nextCondition]
      ]
        .map(([label, value]) => {
          const text = normalizePost100StageText(value);
          return text ? `${label}：${text}` : "";
        })
        .filter(Boolean);
      const body = normalizePost100StageText(stage.body);
      const detail = parts.length > 0 ? parts.join("；") : body;

      return detail ? `${range}：${detail}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function missingRequiredRanges(response: LongFormPost100StageResponse, requiredRanges: string[]) {
  const stages = Array.isArray(response.stages) ? response.stages : [];

  return requiredRanges.slice(stages.length);
}

function buildFirst100PacingFromResponse(response: LongFormStageStructuredResponse, estimatedChapters: number) {
  const stages = Array.isArray(response.first100Stages) ? response.first100Stages : [];

  if (stages.length === 0) {
    return String(response.first100Pacing ?? "").trim();
  }

  const frontStageEnd = Math.min(100, estimatedChapters);
  const requiredRanges = [];
  const windowSize = frontStageEnd <= 40 ? 10 : 20;

  for (let start = 1; start <= frontStageEnd; start += windowSize) {
    const end = Math.min(start + windowSize - 1, frontStageEnd);
    requiredRanges.push(`第${start}-${end}章`);
  }

  return buildPacingTextFromStages({ stages }, requiredRanges);
}

export async function generateLongFormPlanWithAi(context: LongFormPlanContext) {
  const planningGuardRules = buildLongFormPlanningGuardRules(context);
  const projectFactGuardRules = buildProjectFactGuardRules(context);
  const post100RequiredRanges = buildRequiredPost100PlanRanges(context.estimatedChapters);
  const frontStageEnd = Math.min(100, context.estimatedChapters);
  const promptContext = buildLongFormPlanPromptContext(context);
  const response = await requestAiJson<
    Partial<
      Pick<
        StoredLongFormPlan,
        | "planningBasis"
        | "corePromise"
        | "volumePlan"
        | "progressionPacing"
        | "rewardPacing"
        | "confirmedFacts"
        | "openQuestions"
        | "doNotChange"
        | "doNotRevealEarly"
        | "tagPromises"
        | "first10Chapters"
        | "progressionRules"
      >
    > &
      LongFormStageStructuredResponse
  >({
    messages: [
      {
        role: "system",
        content:
          "你是长篇网文总纲规划师。请严格输出 JSON。你的任务是在正文正式连续生成前，为新书制定“长篇规划 / 长期成长节奏规划”，防止 AI 越写越偏、升级过快、地图乱开、支线吞主线。规划必须通用，不能针对某个题材硬编码；如果作品存在能力、资源、地位、关系、权限、地图、势力或认知成长体系，必须按预计篇幅预算小台阶和大阶段。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            ...promptContext,
            planningRules: [
              "先提炼本书的核心承诺：主角靠什么获得成长、读者期待反复看到什么、主线最终要兑现什么。",
              ...projectFactGuardRules,
              "如果 projectDescription 或 bible 中列出了等级、阈值、奖励、职位、地图、势力、关系、权限、目标清单，必须先判断它是长期规则表、阶段目标表还是当前章节任务；默认按长期规则表处理，不能直接变成第一卷进度。",
              "如果作品存在任何成长阶梯，必须把“当前阶段允许提升什么、不允许越过什么、什么情况允许例外”写进 progressionPacing。",
              "volumePlan 必须体现“长期阶梯分配”：第一卷只建立核心循环和前段成长，后续卷逐步消耗中段、高段、终局档位；除非用户明确要求快节奏，不要第一卷吃完多个核心档位。",
              "为了保证 JSON 稳定，不要输出 Markdown、代码块、换行表格或超长单句；但不能为了变短而省略有效规划。每个阶段仍必须写清目标、压力、回报、收束、成长边界。",
              "质量优先：阶段规划必须贴合本书设定、主角成长、地图/势力/关系/伏笔，不要写成通用套话；如果信息多，用短句和分号拆开，不要压缩成空泛概括。",
              "全书阶段节奏不能写成一句话梗概。每个阶段必须至少包含：阶段目标、主要压力/对手、主角成长上限、地图/势力推进、爽点类型、伏笔埋设或回收、支线收束、关系变化、阶段结尾钩子。",
              "必须建立“支线/配角弧线预算”：每个主要阶段至少规划1-3条服务主线的配角弧线或暗线，例如配角亏欠、误判、秘密、立场摇摆、小目标、资源代价、过去旧事。支线必须能回扣核心承诺，不能成为与主线无关的番外。",
              "first10Chapters 不要求每章都有支线，但至少要在2-3章中安排配角或暗线节拍：配角提供阻力、帮忙、隐瞒、误导、付出代价、获得小高光或暴露秘密。大女主作品也要让配角有自己的目标和选择，但主角仍是因果主轴。",
              "每个阶段必须写具体到本书人物、势力、资源、秘密、情绪关系和主线承诺；不能只写“扩大势力、揭露真相、终局决战”这类空泛词。",
              "按目标总字数和预计章节数规划：每卷/阶段要有开始目标、阶段压力、阶段回报、阶段收束，不要只列地图名。",
              "first10Chapters 必须恰好输出10项，并且每项开头必须是“第1章：”到“第10章：”，不能漏第1章，不能从第2章开始，也不能把多章合并成一项。",
              "前 10 章主要负责建立主角处境、关键机制、第一轮小收益、第一阶段压力和读者期待；不要连续大突破，不要过早开大型副本替代核心承诺。",
              ...planningGuardRules,
              `系统已按目标总字数估算本书约 ${context.estimatedChapters} 章；规划必须按这个预计章数分段，不要假定一定会写到100章。`,
              `first100Stages 实际含义是“第1-${frontStageEnd}章阶段节奏”：如果预计不超过100章，它必须覆盖全书起承转合和终局收束；如果预计超过100章，它只覆盖前100章。`,
              "first100Stages 必须拆成数组项，不要把第1-100章阶段节奏写成一个超长字符串。",
              "凡是 openQuestions、doNotRevealEarly 或输出中的“待确认/未定”事项，在 first100Stages、volumePlan、progressionPacing、rewardPacing 和 progressionRules 中不得写成确定结果；只能写成压力、伏笔、可选方向或待作者确认。",
              "不要把待确认角色结局、最终情感归属、真实动机、血脉身份、幕后真相、政权终局、死亡/成婚/复合/原谅/牺牲/下线/登基/继位等不可逆事项写死。",
              "如果阶段节奏需要使用待确认事项，只能用“制造压力”“关系试探”“出现迹象”“保留伏笔”“可能走向之一”这类表达，不得直接写“死亡、精神失常、原谅、确定复合、确定归属”。",
              context.estimatedChapters > 100
                ? "第101章后的阶段节奏会由第二次 AI 请求单独生成；本次不要输出 post100Pacing。"
                : "预计不超过100章时，post100Pacing 必须留空；不要虚构第101章后的阶段。",
              "rewardPacing 必须写清小收益、中收益、大收益的大致频率；收益可以是能力、境界、金钱、资源、地位、情报、关系或权限。",
              "progressionRules 必须写成后续任务卡能直接执行的硬约束，例如：第几章前只允许小台阶，第几章左右才允许大阶段，越级必须有成本和后果。",
              "不要照搬拆书来源作品的人物、地点、专有设定、具体桥段；拆书只能作为商业节奏参考。"
            ],
            outputSchema: {
              planningBasis: "string，240字以内，说明规划依据、篇幅判断和阶段划分理由",
              corePromise: "string，360字以内，说明核心承诺、长期爽点循环、情绪补偿和终局承诺边界",
              confirmedFacts: "string[]，每项180字以内，最多16项；只写项目事实源已经明确且彼此不冲突的事实，不要加入推测",
              openQuestions: "string[]，每项180字以内，最多14项；写项目事实源没有定死或互相有张力、需要作者后续确认的方向",
              doNotChange: "string[]，每项180字以内，最多16项；写后续规划和正文不得改写的核心事实",
              doNotRevealEarly: "string[]，每项180字以内，最多14项；写前10章或前期不能提前揭示的核心真相、底牌或终局信息",
              tagPromises: "string[]，每项160字以内，最多12项；写题材标签、情绪卖点、读者期待必须兑现的承诺",
              volumePlan: "string[]，每项440字以内，最多12项；每项包含阶段范围、目标、压力、成长上限、回报、伏笔、关系变化、收束",
              progressionPacing: "string[]，每项360字以内，最多16项；写清成长边界、卡点、代价和不能提前兑现的档位",
              rewardPacing: "string[]，每项360字以内，最多16项；写清小/中/大收益频率、类型、出现条件、兑现方式和不能滥发的限制",
              first10Chapters: "string[]，必须恰好10项；每项240字以内；每项以第1章至第10章开头，逐章写功能、压力、收益、伏笔、关系变化或钩子；至少2项要包含配角/暗线节拍且说明如何服务主线",
              first100Stages:
                "array；按第1-20章、第21-40章这类阶段写到前段结束；预计很短时可按每10章；每项字段：range, stageTarget, pressure, growthLimit, mapAndForces, payoffRhythm, foreshadowing, sideClosure, relationshipChange, stageHook, nextCondition；sideClosure 必须写本阶段要推进或收束的配角/暗线；每个字段70-160字以内",
              progressionRules: "string[]，每项280字以内，最多18项；必须能被后续任务卡直接执行"
            }
          },
          null,
          2
        )
      }
    ],
    temperature: 0.22,
    maxTokens: 7600,
    timeoutMs: 300000
  });

  const initialPlan = normalizeAiLongFormPlanResponse(response);
  initialPlan.first100Pacing = buildFirst100PacingFromResponse(response, context.estimatedChapters);
  let post100Pacing = "";
  let post100Usage: AiTokenUsage | undefined;

  if (context.estimatedChapters > 100) {
    const post100Response = await requestAiJson<LongFormPost100StageResponse>({
      messages: [
        {
          role: "system",
          content:
            "你是长篇网文后续阶段规划师。只输出合法 JSON 对象，不要 Markdown，不要解释。你的任务是为第101章后按每50章阶段生成可执行的长篇节奏规划。必须把每个阶段拆成 JSON 数组项，不要把所有内容塞进一个长字符串。"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              ...promptContext,
              corePromise: initialPlan.corePromise,
              confirmedFacts: initialPlan.confirmedFacts,
              openQuestions: initialPlan.openQuestions,
              doNotChange: initialPlan.doNotChange,
              doNotRevealEarly: initialPlan.doNotRevealEarly,
              tagPromises: initialPlan.tagPromises,
              first100Pacing: initialPlan.first100Pacing,
              volumePlan: initialPlan.volumePlan,
              progressionPacing: initialPlan.progressionPacing,
              rewardPacing: initialPlan.rewardPacing,
              requiredRanges: post100RequiredRanges,
              rules: [
                `必须从第101章开始，按每50章一个阶段写到预计终章第${context.estimatedChapters}章。`,
                "stages 数组必须与 requiredRanges 一一对应，不能漏段、合并段或跳段。",
                "每段 range 必须使用“第101-150章”这种格式，最后一段按实际剩余章节写，例如“第401-445章”。",
                "每段必须填写 stageTarget、pressure、growthLimit、mapAndForces、payoffRhythm、foreshadowing、sideClosure、relationshipChange、stageHook、nextCondition。",
                "必须承接第1-100章规划和项目事实锁；不得把 openQuestions 或 doNotRevealEarly 写成确定真相。",
                "凡是 openQuestions、doNotRevealEarly 或前文标注“未定/待确认”的事项，后续阶段只能写成伏笔、压力、可选方向或待作者确认，不能写成确定结局。",
                "禁止擅自写死角色死亡、精神失常、最终CP、原谅/复合、成婚、牺牲、下线、登基、继位、真实血脉、幕后真相、政权最终形式等不可逆结果，除非项目事实源已明确。",
                "内容要具体到本书人物、势力、资源、秘密和主线承诺，不要写通用套话。",
                "为了保证 JSON 稳定，每个字段写中文短句，使用分号表达多点，不要在字段中换行，不要输出引号包裹的对白。"
              ],
              outputSchema: {
                stages:
                  "array；每个 requiredRanges 对应1项；每项字段：range, stageTarget, pressure, growthLimit, mapAndForces, payoffRhythm, foreshadowing, sideClosure, relationshipChange, stageHook, nextCondition；每个字段90-180字以内"
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0.22,
      maxTokens: 5600,
      timeoutMs: 300000
    });

    const missingRanges = missingRequiredRanges(post100Response, post100RequiredRanges);

    if (missingRanges.length > 0) {
      const supplementResponse = await requestAiJson<LongFormPost100StageResponse>({
        messages: [
          {
            role: "system",
            content:
              "你是长篇网文阶段规划补写师。只输出合法 JSON 对象，不要 Markdown，不要解释。你只负责补齐缺失的章节阶段，每个阶段拆成 JSON 数组项。"
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                ...promptContext,
                corePromise: initialPlan.corePromise,
                confirmedFacts: initialPlan.confirmedFacts,
                openQuestions: initialPlan.openQuestions,
                doNotChange: initialPlan.doNotChange,
                doNotRevealEarly: initialPlan.doNotRevealEarly,
                tagPromises: initialPlan.tagPromises,
                existingPost100Pacing: buildPacingTextFromStages(post100Response, post100RequiredRanges),
                missingRequiredRanges: missingRanges,
                rules: [
                  "只补 missingRequiredRanges 中列出的阶段，不要重写已有阶段。",
                  "stages 数组必须与 missingRequiredRanges 一一对应。",
                  "每段必须填写 stageTarget、pressure、growthLimit、mapAndForces、payoffRhythm、foreshadowing、sideClosure、relationshipChange、stageHook、nextCondition。",
                  "不得把 openQuestions、doNotRevealEarly 或待确认事项写成确定结局。"
                ],
                outputSchema: {
                  stages:
                    "array；每个 missingRequiredRanges 对应1项；每项字段：range, stageTarget, pressure, growthLimit, mapAndForces, payoffRhythm, foreshadowing, sideClosure, relationshipChange, stageHook, nextCondition"
                }
              },
              null,
              2
            )
          }
        ],
        temperature: 0.2,
        maxTokens: Math.max(1800, missingRanges.length * 900),
        timeoutMs: 180000
      });
      const mergedStages = [
        ...(Array.isArray(post100Response.stages) ? post100Response.stages : []),
        ...(Array.isArray(supplementResponse.stages) ? supplementResponse.stages : [])
      ];

      post100Response.stages = mergedStages;
      post100Usage = combineAiTokenUsages([getAiTokenUsage(post100Response), getAiTokenUsage(supplementResponse)]);
    } else {
      post100Usage = getAiTokenUsage(post100Response);
    }

    post100Pacing = buildPacingTextFromStages(post100Response, post100RequiredRanges);
  }

  const combinedPlan = {
    ...initialPlan,
    post100Pacing
  };
  const usage = combineAiTokenUsages([getAiTokenUsage(response), post100Usage]);

  return attachAiTokenUsage(combinedPlan, usage ?? getAiTokenUsage(response));
}

type LongFormPlanReviewSlice = {
  pass?: boolean;
  issues?: string[];
  unresolvedCommitmentIssues?: string[];
  repairInstructions?: string[];
};

function compactReviewInput(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return cleanPromptText(value, depth === 0 ? 1200 : 420);
  }

  if (Array.isArray(value)) {
    return value.slice(0, depth === 0 ? 8 : 5).map((item) => compactReviewInput(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 10)
        .map(([key, item]) => [key, compactReviewInput(item, depth + 1)])
    );
  }

  return value;
}

function normalizeLongFormPlanReviewSlice(review: LongFormPlanReviewSlice) {
  const issues = asTextList(review.issues).slice(0, 3);
  const unresolvedCommitmentIssues = asTextList(review.unresolvedCommitmentIssues).slice(0, 3);

  return {
    passed: review.pass !== false && issues.length === 0 && unresolvedCommitmentIssues.length === 0,
    incomplete: false,
    issues,
    unresolvedCommitmentIssues,
    repairInstructions: asTextList(review.repairInstructions).slice(0, 3)
  };
}

async function requestLongFormPlanReviewSlice(input: {
  title: string;
  facts: Record<string, unknown>;
  planPart: Record<string, unknown>;
  rules: string[];
  maxTokens?: number;
}) {
  const buildRequestPayload = (options?: { compact?: boolean; temperature?: number; maxTokens?: number }) => ({
    messages: [
      {
        role: "system" as const,
        content:
          "你是长篇规划事实一致性审稿人。只输出一个合法 JSON 对象，不要 Markdown，不要解释。只判断当前片段，不重写规划，不硬编码任何题材规则。输出总字数必须少于180字；字符串必须用中文短句，不要输出 openQuestions、doNotRevealEarly 等英文字段名。"
      },
      {
        role: "user" as const,
        content: JSON.stringify(
          {
            reviewTitle: input.title,
            facts: options?.compact ? compactReviewInput(input.facts) : input.facts,
            planPart: options?.compact ? compactReviewInput(input.planPart) : input.planPart,
            reviewRules: input.rules,
            outputSchema: {
              pass: "boolean",
              issues: "string[]，最多2项，每项24字以内；没有则空数组",
              unresolvedCommitmentIssues: "string[]，最多2项，每项24字以内；没有则空数组",
              repairInstructions: "string[]，最多2项，每项24字以内；没有则空数组"
            },
            hardLimit: "只返回这4个字段；每个数组最多2项；不要展开分析过程。"
          },
          null,
          2
        )
      }
    ],
    temperature: options?.temperature ?? 0.12,
    maxTokens: options?.maxTokens ?? input.maxTokens ?? 3600,
    timeoutMs: 120000
  });
  const requestPayload = buildRequestPayload();
  let review: {
    pass?: boolean;
    issues?: string[];
    unresolvedCommitmentIssues?: string[];
    repairInstructions?: string[];
  };

  try {
    review = await requestAiJson<typeof review>(requestPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!/缺少 message\.content|响应缺少|截断|JSON 不完整|不是有效 JSON/i.test(message)) {
      throw error;
    }

    review = await requestAiJson<typeof review>({
      ...buildRequestPayload({ compact: true, temperature: 0, maxTokens: Math.max(input.maxTokens ?? 0, 4800) }),
      temperature: 0,
      timeoutMs: 180000
    });
  }

  return attachAiTokenUsage(normalizeLongFormPlanReviewSlice(review), getAiTokenUsage(review));
}

async function safeReviewLongFormPlanSlice(input: {
  title: string;
  facts: Record<string, unknown>;
  planPart: Record<string, unknown>;
  rules: string[];
}) {
  try {
    return await requestLongFormPlanReviewSlice(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "审查步骤执行失败";
    return {
      passed: null,
      incomplete: true,
      issues: [`${input.title}未完成：${message}`],
      unresolvedCommitmentIssues: [],
      repairInstructions: ["这是审查执行异常，不代表规划内容不通过；可重新审查。"]
    };
  }
}

export async function reviewLongFormPlanConsistencyWithAi(context: LongFormPlanContext, plan: AiLongFormPlanPayload) {
  const factReview = await safeReviewLongFormPlanSlice({
    title: "事实锁审查",
    facts: {
      projectName: context.projectName,
      projectDescription: cleanPromptText(context.projectDescription ?? "", 700),
      bible: {
        corePleasure: cleanPromptText(context.bible.corePleasure, 240),
        protagonistDesire: cleanPromptText(context.bible.protagonistDesire, 180),
        goldenFingerRules: cleanPromptText(context.bible.goldenFingerRules, 240),
        immutableSettings: cleanPromptText(context.bible.immutableSettings, 360),
        narrativeTaboos: cleanPromptText(context.bible.narrativeTaboos, 240)
      },
      plotState: {
        mainGoal: cleanPromptText(context.plotState.mainGoal, 180),
        nextStageGoal: cleanPromptText(context.plotState.nextStageGoal, 180)
      }
    },
    planPart: {
      corePromise: cleanPromptText(plan.corePromise, 260),
      confirmedFacts: plan.confirmedFacts.slice(0, 10),
      doNotChange: plan.doNotChange.slice(0, 10),
      tagPromises: plan.tagPromises.slice(0, 8)
    },
    rules: [
      "检查 confirmedFacts/doNotChange/corePromise 是否改写项目简介或稳定设定。",
      "没有明显改写就 pass=true。",
      "只列最严重问题，不做故事推演。"
    ]
  });

  const titleInferenceReview = await safeReviewLongFormPlanSlice({
    title: "书名推断事实审查",
    facts: {
      projectName: context.projectName,
      projectDescription: cleanPromptText(context.projectDescription ?? "", 700),
      bible: {
        corePleasure: cleanPromptText(context.bible.corePleasure, 220),
        protagonistDesire: cleanPromptText(context.bible.protagonistDesire, 160),
        immutableSettings: cleanPromptText(context.bible.immutableSettings, 260)
      },
      plotState: {
        mainGoal: cleanPromptText(context.plotState.mainGoal, 160),
        nextStageGoal: cleanPromptText(context.plotState.nextStageGoal, 160)
      }
    },
    planPart: {
      confirmedFacts: plan.confirmedFacts.slice(0, 12),
      doNotChange: plan.doNotChange.slice(0, 12),
      corePromise: cleanPromptText(plan.corePromise, 260),
      tagPromises: plan.tagPromises.slice(0, 8)
    },
    rules: [
      "书名只能作为读者期待和包装方向，不能单独作为已确定事实来源。",
      "检查 confirmedFacts/doNotChange 是否把只存在于书名中的动作、目标、敌人、结局或人物关系写成既定事实。",
      "如果同一信息在简介、创作圣经或主线状态中也明确出现，可视为通过；否则 pass=false，并建议移入标签承诺或待确认点。"
    ]
  });

  const commitmentReview = await safeReviewLongFormPlanSlice({
    title: "待确认点确定化审查",
    facts: {
      openQuestions: plan.openQuestions.slice(0, 10),
      doNotRevealEarly: plan.doNotRevealEarly.slice(0, 10)
    },
    planPart: {
      corePromise: cleanPromptText(plan.corePromise, 220),
      first100Pacing: cleanPromptText(plan.first100Pacing, 1400),
      post100Pacing: cleanPromptText(plan.post100Pacing, 1800),
      progressionRules: plan.progressionRules.slice(0, 8)
    },
    rules: [
      "检查 openQuestions/doNotRevealEarly 是否在阶段规划里被写成定论。",
      "只要待确认事项被写死为唯一答案，pass=false。",
      "如果只是保留伏笔或可能方向，pass=true。"
    ]
  });

  const irreversibleReview = await safeReviewLongFormPlanSlice({
    title: "不可逆设定写死审查",
    facts: {
      openQuestions: plan.openQuestions.slice(0, 12),
      doNotRevealEarly: plan.doNotRevealEarly.slice(0, 12),
      riskTypes: [
        "最终情感归属/CP",
        "师徒或阵营绑定",
        "亲缘/血脉/身份真相",
        "幕后黑手/终极反派",
        "终局胜负/登顶方式",
        "核心机制最终解释"
      ]
    },
    planPart: {
      evidence: extractPlanEvidenceForQuestions(plan)
    },
    rules: [
      "只审不可逆设定：最终情感归属、师徒绑定、亲缘身份、幕后真相、终局胜负、核心机制解释。",
      "若这些事项在事实源或待确认点里未明确，却在规划证据中被写成确定发生，pass=false。",
      "如果只是作为可能方向、保留伏笔、待作者确认，pass=true。"
    ]
  });

  const openingReview = await safeReviewLongFormPlanSlice({
    title: "前10章提前揭示审查",
    facts: {
      doNotRevealEarly: plan.doNotRevealEarly.slice(0, 10),
      openQuestions: plan.openQuestions.slice(0, 8)
    },
    planPart: {
      first10Chapters: plan.first10Chapters.slice(0, 10)
    },
    rules: [
      "前10章只能埋线、制造压力、验证机制和小收益。",
      "不得揭开核心冤案真相、终极身份、终局底牌或最终情感归属。",
      "没有提前揭示就 pass=true。"
    ]
  });

  const originalityReview = await safeReviewLongFormPlanSlice({
    title: "原创合规审查",
    facts: {
      projectName: context.projectName,
      projectDescription: cleanPromptText(context.projectDescription ?? "", 700),
      narrativeTaboos: cleanPromptText(context.bible.narrativeTaboos, 260),
      immutableSettings: cleanPromptText(context.bible.immutableSettings, 360)
    },
    planPart: {
      confirmedFacts: plan.confirmedFacts.slice(0, 8),
      first10Chapters: plan.first10Chapters.slice(0, 5),
      first100Pacing: cleanPromptText(plan.first100Pacing, 900),
      post100Pacing: cleanPromptText(plan.post100Pacing, 900),
      progressionRules: plan.progressionRules.slice(0, 6)
    },
    rules: [
      "检查规划是否直接使用或强化了知名作品的角色名、势力名、专有设定、标志性组织或同人化表达。",
      "项目简介里出现的外部作品指向也应提示原创化风险：可以作为用户输入事实保留，但后续商业创作建议替换为原创名称和原创势力。",
      "如果存在明显 IP/同人/版权风险，pass=false，并给出原创化建议。"
    ]
  });

  const reviews = [factReview, titleInferenceReview, commitmentReview, irreversibleReview, openingReview, originalityReview];
  const hasIncompleteStep = reviews.some((review) => review.incomplete);
  const hasReviewIssue = reviews.some(
    (review) => review.issues.length > 0 || review.unresolvedCommitmentIssues.length > 0 || review.passed === false
  );
  const result = {
    passed: hasReviewIssue ? false : hasIncompleteStep ? null : reviews.every((review) => review.passed),
    status: hasReviewIssue ? "complete" : hasIncompleteStep ? "incomplete" : "complete",
    issues: reviews.flatMap((review) => review.issues).slice(0, 6),
    unresolvedCommitmentIssues: reviews.flatMap((review) => review.unresolvedCommitmentIssues).slice(0, 6),
    repairInstructions: reviews.flatMap((review) => review.repairInstructions).slice(0, 6),
    reviewSteps: [
      { name: "事实锁审查", passed: factReview.passed, incomplete: factReview.incomplete === true },
      { name: "书名推断审查", passed: titleInferenceReview.passed, incomplete: titleInferenceReview.incomplete === true },
      { name: "待确认点审查", passed: commitmentReview.passed, incomplete: commitmentReview.incomplete === true },
      { name: "不可逆设定审查", passed: irreversibleReview.passed, incomplete: irreversibleReview.incomplete === true },
      { name: "前10章审查", passed: openingReview.passed, incomplete: openingReview.incomplete === true },
      { name: "原创合规审查", passed: originalityReview.passed, incomplete: originalityReview.incomplete === true }
    ],
    reviewError: hasIncompleteStep && !hasReviewIssue
  };

  return attachAiTokenUsage(result, combineAiTokenUsages(reviews.map((review) => getAiTokenUsage(review))));
}

function normalizeDraftTargetWordCount(value?: number) {
  if (!Number.isFinite(value)) {
    return 2500;
  }

  return Math.min(3000, Math.max(800, Math.floor(Number(value))));
}

function estimateDraftMaxTokens(targetWordCount: number) {
  return Math.min(7000, Math.max(2400, Math.ceil(targetWordCount * 1.8)));
}

function estimateDraftStreamMaxTokens(targetWordCount: number) {
  return Math.min(5200, Math.max(1600, Math.ceil(targetWordCount * 1.3)));
}

function estimateDraftContinuationMaxTokens(targetWordCount: number, currentCharacters: number) {
  const maxCharacters = maximumDraftCharacters(targetWordCount);
  const remainingCharacters = Math.max(0, maxCharacters - currentCharacters);

  if (remainingCharacters <= 0) {
    return 1000;
  }

  return Math.min(3600, Math.max(1000, Math.ceil(remainingCharacters * 2.4)));
}

function estimateDraftPolishMaxTokens(content: string) {
  return Math.min(9000, Math.max(2200, Math.ceil(countDraftCharacters(content) * 1.55)));
}

function estimateDraftClosingMaxTokens() {
  return 260;
}

const CHAPTER_DRAFT_TIMEOUT_MS = 180000;
const CHAPTER_DRAFT_REVISION_TIMEOUT_MS = 120000;
const TASK_CARD_TIMEOUT_MS = 180000;
const TASK_CARD_MAX_TOKENS = 5200;

export function countDraftCharacters(content: string) {
  return content.replace(/\s/g, "").length;
}

export function minimumDraftCharacters(targetWordCount?: number) {
  return Math.floor(normalizeDraftTargetWordCount(targetWordCount) * 0.82);
}

export function minimumDraftExpansionCharacters(targetWordCount?: number) {
  return Math.floor(normalizeDraftTargetWordCount(targetWordCount) * 0.85);
}

export function minimumSavableDraftCharacters(targetWordCount?: number) {
  const target = normalizeDraftTargetWordCount(targetWordCount);
  const minimum = minimumDraftCharacters(target);
  const cleanupTolerance = Math.max(12, Math.ceil(target * 0.02));

  return Math.max(1, minimum - cleanupTolerance);
}

export function maximumDraftCharacters(targetWordCount?: number) {
  return Math.ceil(normalizeDraftTargetWordCount(targetWordCount) * 1.25);
}

function estimateEditMaxTokens(originalText: string) {
  return Math.min(18000, Math.max(3200, Math.ceil(countDraftCharacters(originalText) * 2.35)));
}

function isNovelSecondDraftMode(mode?: string) {
  return /小说|网文作者|正文/.test(mode ?? "");
}

function isStrongNovelSecondDraftMode(mode?: string) {
  return /小说正文增强|人工改稿|去机器腔/.test(mode ?? "");
}

export function minimumEditedCharacters(originalText: string, mode?: string) {
  if (mode?.includes("短文")) {
    return 0;
  }

  const originalCharacters = countDraftCharacters(originalText);

  if (originalCharacters < 800) {
    return 0;
  }

  return Math.max(600, Math.floor(originalCharacters * 0.72));
}

export function assertEditedTextComplete(originalText: string, revisedText: string, mode?: string) {
  const minCharacters = minimumEditedCharacters(originalText, mode);

  if (minCharacters <= 0) {
    return;
  }

  const revisedCharacters = countDraftCharacters(revisedText);

  if (revisedCharacters < minCharacters) {
    throw new Error(
      `二稿结果明显偏短：原文 ${countDraftCharacters(originalText)} 字，二稿 ${revisedCharacters} 字，最低应约 ${minCharacters} 字，未保存。请分章节/分段二稿，或减少待改文本后重试。`
    );
  }
}

export function normalizeEditedDraftText(content: string) {
  return normalizeChapterDraftPunctuation(content.trim())
    .replace(/\bAI\b/g, "AI")
    .replace(/深吸一口气[，。]?/g, "")
    .replace(/下意识地?/g, "")
    .replace(/脑子里/g, "心里")
    .replace(/瞳孔(?:猛|骤|微)?(?:地)?一?缩/g, "眼神顿住")
    .replace(/眸色一沉/g, "眼神沉了沉")
    .replace(/倒吸一口凉气/g, "呼吸停了一瞬")
    .replace(/([。！？])\s*\n\s*([”』」]?)/g, "$1\n$2")
    .trim();
}

function buildSecondDraftProfile(mode: string, minCharacters: number) {
  const strongNovelMode = isStrongNovelSecondDraftMode(mode);
  const novelMode = isNovelSecondDraftMode(mode);

  if (strongNovelMode) {
    return {
      editingLevel: "小说人工二稿",
      temperature: 0.46,
      system:
        "你是资深网文二稿编辑。请严格输出 JSON。你的任务不是轻微润色，而是把机器感明显的小说初稿改成更像真人作者二稿的正文：保留事实、人物、剧情顺序和结尾，但允许重排段落、拆散说明、改写句式和压掉模板动作。不得摘要、不得只改前半段、不得改成大纲、不得新增原文没有的设定或剧情。",
      policy: {
        name: "小说正文增强版 = 人工二稿",
        changedParagraphRatio: "建议 55%-75% 自然段有实质变化；如果原文机器腔明显，不能只替换几个词。",
        keepUnchangedText: "只有已经自然、有现场感、没有模板腔的段落才可以原样保留。",
        goal: "让正文读起来像作者改过一遍：有取舍、有毛边、有场面，不像模型按模板顺完。"
      },
      rules: [
        "必须完整处理从开头到结尾，revisedText 只能放二稿正文，不要放说明、标题、项目符号或改稿过程。",
        "保留原文已有事实、人物姓名、场景、关键线索、核心机制、关键转折和章末信息；不要凭空新增人物、道具、动机、风险、世界观名词或关键证据。",
        "允许在相邻段落内重排信息：把集中交代的学历、职业、技能、处境拆进动作、物件、旁人一句话和现场判断里。",
        "允许整段重写机器腔段落：只要剧情事实不变，可以换叙述角度、拆段、合段、删掉解释句、补一两个不改变情节的可见动作。",
        "不要把人物写得一直冷静正确。保留迟疑、卡壳、没接住话、看漏细节、第二眼才反应过来这些真人感。",
        "专业知识必须像角色在场景里临时判断，不像教材讲解；只写当前剧情必须用到的一两个依据，其余靠物件、环境、旁人反应和后果呈现。",
        "删除或替换模板动作和模板心理：深吸一口气、下意识、脑子里、瞳孔猛缩、瞳孔骤缩、瞳孔微缩、眸色一沉、心头一震、心头一紧、倒吸一口凉气、像是、仿佛、某种、显然、无疑、这意味着、未知风险、最强保护伞、彻底绑定。",
        "禁止使用破折号“——”。需要停顿就换句、逗号、冒号或直接让对白打断。",
        "句子节奏要有参差：连续三句长度相近时必须打破；关键处可以短，甚至半句，但不要堆华丽修辞。",
        "少做旁白总结，多给现场细节。不要每段都按“动作 + 解释 + 情绪总结”的顺序写。",
        "对白要带一点人味：可以急、可以噎住、可以不完整；不要所有人都像在交代剧情。",
        "如果原文某段只是信息说明，优先把它改成主角看见、摸到、听到、被人催促或被现场逼出来的反应。",
        `二稿不能明显缩水，除非删掉的是重复解释；最低正文长度约 ${minCharacters} 字。`
      ]
    };
  }

  if (novelMode) {
    return {
      editingLevel: "网文作者二稿",
      temperature: 0.4,
      system:
        "你是网文二稿编辑。请严格输出 JSON。你的任务是完整审读小说正文，识别 AI 味，并进行有感的二稿改写。保留剧情事实和关键转折，但不要只做同义词替换。不得摘要、不得只改前半段、不得省略结尾、不得把小说正文改成大纲。",
      policy: {
        name: "网文作者版 = 有感改稿",
        changedParagraphRatio: "建议 40%-60% 自然段有实质变化；机器腔明显的段落要重写。",
        keepUnchangedText: "自然、具体、有现场感的段落可以保留；说明腔和模板动作不能原样放过。",
        goal: "减少机器式顺滑和平均句，让正文更像连载作者写出来的。"
      },
      rules: [
        "必须从开头到结尾完整处理，revisedText 只能放正文。",
        "保留原文核心信息、剧情顺序、人物关系、关键转折和结尾信息，不新增设定或剧情。",
        "不要只做句内小修；AI 味明显、解释集中、节奏太平均、情绪没有来源的段落可以整段重写。",
        "把集中交代的人设、学历、技能、处境拆散，优先用物件、动作、对话和临场反应带出。",
        "减少连贯得过分的因果链，不要每个动作后都解释意义；让读者从场面里自己看出来。",
        "同类模板动作只保留一次，深吸气、下意识、脑子里、瞳孔猛缩、瞳孔骤缩、瞳孔微缩、眸色一沉、心头一震、心头一紧、倒吸一口凉气、没说话、视线移动等重复表达要替换或删除。",
        "专业知识要像人在现场临时判断，不要像教材总结；能压成一句就不要展开成三句。",
        "禁止使用破折号“——”。",
        "句子长短要变化，关键句可以短一点，保留一点不工整和口语停顿。",
        "可以压缩啰嗦句，但不能大段删剧情、删人物互动、删关键转折，也不要把整章另写成另一个故事。",
        `二稿不能明显缩水，最低正文长度约 ${minCharacters} 字。`
      ]
    };
  }

  return {
    editingLevel: "标准二稿",
    temperature: 0.32,
    system:
      "你是中文内容二稿编辑。请严格输出 JSON。你的任务是完整审读原文，识别 AI 味句子，给出问题原因，并在保留原文主体表达的基础上做二稿修订。不得摘要、不得只改前半段、不得省略结尾、不得把正文改成大纲。",
    policy: {
      name: "标准二稿 = 局部到中度修稿",
      changedParagraphRatio: "通常 25%-45% 自然段有变化；问题明显时可以更高。",
      keepUnchangedText: "自然准确的段落可以保留，模板腔、虚句和平均句要处理。",
      goal: "让不自然的地方变顺，同时保留原意和表达边界。"
    },
    rules: [
      "必须从开头到结尾完整检查原文。",
      "优先处理 AI 味、模板腔、病句、重复解释、节奏太平均、表达软的问题。",
      "改稿方向是降复杂度：少解释、少判断、少概念词，优先用具体动作、对白和直接反应。",
      "不要新增原文没有的设定、道具、风险、因果解释、心理结论或世界观名词。",
      "少用或不用这些书面腔/AI 腔表达：这意味着、未知风险、最强保护伞、彻底绑定、目前能接触到的、某种程度上、显然、无疑。",
      "保留原文核心信息、剧情顺序、人物关系、关键转折和结尾信息。",
      "禁止使用破折号“——”。"
    ]
  };
}

function detectDraftGenerationStyleRisks(content: string) {
  const text = content.trim();

  if (!text) {
    return [];
  }

  const paragraphs = text.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const longInfoParagraphs = paragraphs.filter((paragraph) =>
    paragraph.length > 100 && /学历|履历|简历|培训|知识|专业|行业|技能|经验|术语|理论|规则|体系|机制|资历/.test(paragraph)
  );
  const templateActionCount = (text.match(/深吸一口气|下意识|脑子里|瞳孔(?:猛|骤|微)?(?:地)?一?缩|眸色一沉|心头一震|心头一紧|倒吸一口凉气|像是|仿佛|某种|显然|无疑|这意味着/g) ?? []).length;
  const dashCount = (text.match(/——+/g) ?? []).length;
  const longParagraphCount = paragraphs.filter((paragraph) => paragraph.length >= 220).length;
  const textbookParagraphs = paragraphs.filter((paragraph) =>
    paragraph.length > 90 && /判断|依据|说明|证明|痕迹|死因|勒痕|尸体|现场/.test(paragraph) && /因此|所以|说明|证明|判断|显然/.test(paragraph)
  );
  const risks: string[] = [];

  if (dashCount > 0) {
    risks.push("存在破折号停顿或解释，保存前必须改成自然短句、逗号或对白打断。");
  }

  if (templateActionCount >= 2) {
    risks.push("模板动作/模板心理偏多，需要替换为更具体的身体反应、动作或直接删掉。");
  }

  if (longInfoParagraphs.length > 0) {
    risks.push("人物背景、学历、专业能力交代过集中，需要拆进物件、对话和现场反应里。");
  }

  if (longParagraphCount >= 2) {
    risks.push("长段落偏多，需要拆成更接近网文分镜的短段。");
  }

  if (textbookParagraphs.length > 0) {
    risks.push("专业判断有教材腔，需要改成现场临时观察和人物反应。");
  }

  return risks;
}

export async function polishGeneratedChapterDraftIfNeeded(
  content: string,
  context: ChapterDraftContext,
  targetWordCount?: number
): Promise<DraftPolishResult> {
  const cleaned = prepareChapterDraftContentForSave(
    sanitizeChapterDraftDiction(content, context),
    targetWordCount
  );
  const risks = detectDraftGenerationStyleRisks(cleaned);

  if (risks.length === 0) {
    return { content: cleaned, changed: cleaned !== content.trim() };
  }

  let response: { content?: string };

  try {
    response = await requestAiJson<{ content?: string }>({
      messages: [
        {
          role: "system",
          content:
            "你是网文正文生成阶段的质检改稿助手。请严格输出 JSON。你的任务是在不改变剧情事实、人物、线索、任务卡目标和章末落点的前提下，修掉初稿里的机器腔。只能做表达层面的轻中度改稿，不得新增剧情、不得改成二稿报告、不得摘要、不得删除关键转折。"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              projectName: context.projectName,
              projectDescription: context.projectDescription,
              targetWordCount: normalizeDraftTargetWordCount(targetWordCount),
              originalCharacters: countDraftCharacters(cleaned),
              taskCard: context.taskCard,
              risks,
              content: cleaned,
              polishRules: [
                "输出必须仍然是完整小说正文，只返回 content 字段。",
                "保留原有剧情顺序、人物出场、案情线索、伏笔、爽点和结尾钩子。",
                "不要新增原文没有的人物、道具、证据、世界观名词、能力规则或因果解释。",
                "把集中交代的人物履历、学历、专业知识拆进动作、物件、对话和现场反应里。",
                "删掉或替换深吸一口气、下意识、脑子里、瞳孔猛缩、瞳孔骤缩、瞳孔微缩、眸色一沉、心头一震、心头一紧、倒吸一口凉气、像是、仿佛、某种、显然、无疑、这意味着。",
                "禁止使用破折号“——”。",
                "专业判断要像现场临时观察，不要像教材说明；少写因此、说明、证明这类报告词。",
                "长段落拆短，每段尽量 1-4 句；句子长短要有变化。",
                "允许删掉重复解释，但二稿后不能明显缩水；如果信息必须保留，用更自然的场景方式保留。"
              ],
              outputSchema: {
                content: "string"
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0.38,
      maxTokens: estimateDraftPolishMaxTokens(cleaned),
      timeoutMs: CHAPTER_DRAFT_REVISION_TIMEOUT_MS
    });
  } catch {
    return { content: cleaned, changed: cleaned !== content.trim() };
  }
  const polished = prepareChapterDraftContentForSave(
    sanitizeChapterDraftDiction(String(response.content ?? cleaned), context),
    targetWordCount
  );
  const minCharacters = Math.max(200, Math.floor(countDraftCharacters(cleaned) * 0.82));

  if (countDraftCharacters(polished) < minCharacters) {
    return { content: cleaned, changed: cleaned !== content.trim(), usage: getAiTokenUsage(response) };
  }

  return {
    content: polished,
    changed: polished !== cleaned || cleaned !== content.trim(),
    usage: getAiTokenUsage(response)
  };
}

function isDraftTooShort(content: string, targetWordCount?: number) {
  return countDraftCharacters(content) < minimumDraftExpansionCharacters(targetWordCount);
}

function isDraftTooLong(content: string, targetWordCount?: number) {
  return countDraftCharacters(content) > maximumDraftCharacters(targetWordCount);
}

function hookKeywordGrams(value: string) {
  const stopGrams = new Set([
    "一个",
    "这些",
    "什么",
    "怎么",
    "不会",
    "不是",
    "已经",
    "开始",
    "突然",
    "发现",
    "方向",
    "处理",
    "需要",
    "明确",
    "承接",
    "结尾",
    "本章",
    "主角"
  ]);
  const compact = value.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "");
  const grams = new Set<string>();

  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      const gram = compact.slice(index, index + size);

      if (!stopGrams.has(gram)) {
        grams.add(gram);
      }
    }
  }

  return Array.from(grams);
}

export function draftCoversTaskEndingHook(content: string, endingHook: string) {
  const hook = endingHook.trim();

  if (!hook) {
    return true;
  }

  const endingSection = content.slice(-900);

  if (hook.length >= 12 && endingSection.includes(hook.slice(0, 12))) {
    return true;
  }

  const hitCount = hookKeywordGrams(hook)
    .filter((gram) => endingSection.includes(gram))
    .slice(0, 6)
    .length;

  return hitCount >= 4;
}

export function isChapterDraftEndingIncomplete(content: string) {
  const text = content.trim();

  if (!text) {
    return true;
  }

  const compactTail = text.slice(-80).replace(/\s+/g, "");

  if (!/[。！？!?…”」』）】》]$/.test(compactTail)) {
    return true;
  }

  if (
    /[，,、；;：:—-]$/.test(compactTail) ||
    /(或|和|与|及|以及|但|却|而|并|因为|因此|如果|虽然|按照|只是|甚至|突然|随即|正要|准备|发现|看见|听见|想到|说道|问道|冷声道|沉声道)$/.test(compactTail)
  ) {
    return true;
  }

  const lastParagraph = text.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).at(-1) ?? "";

  if (
    /[“"'][^”"'。！？!?…]{0,40}$/.test(lastParagraph) ||
    /[，,：:]\s*[“"']?[\u4e00-\u9fa5A-Za-z0-9]{1,12}$/.test(lastParagraph)
  ) {
    return true;
  }

  const quoteCheckText = text.slice(-360);
  const lastLeftQuoteIndex = quoteCheckText.lastIndexOf("“");
  const lastRightQuoteIndex = quoteCheckText.lastIndexOf("”");

  if (lastLeftQuoteIndex > lastRightQuoteIndex) {
    return true;
  }

  const quotes = (quoteCheckText.match(/[“”]/g) ?? []).join("");
  const leftQuotes = (quotes.match(/“/g) ?? []).length;
  const rightQuotes = (quotes.match(/”/g) ?? []).length;

  return leftQuotes > rightQuotes;
}

const chapterDraftEndingMarks = new Set(["。", "！", "？", "!", "?", "…"]);
const chapterDraftClosingMarks = new Set(["”", "’", "\"", "）", "】", "》", ")", "]"]);

function trimChapterDraftToLastCompleteSentence(content: string) {
  const text = content.trim();

  if (!text || !isChapterDraftEndingIncomplete(text)) {
    return text;
  }

  let sentenceEndIndex = -1;

  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (chapterDraftEndingMarks.has(text[index])) {
      sentenceEndIndex = index + 1;
      break;
    }
  }

  if (sentenceEndIndex < 0) {
    return text;
  }

  while (sentenceEndIndex < text.length && chapterDraftClosingMarks.has(text[sentenceEndIndex])) {
    sentenceEndIndex += 1;
  }

  return text.slice(0, sentenceEndIndex).trim();
}

function splitDraftParagraphSentences(paragraph: string) {
  const matches = paragraph.match(/[^。！？!?…]+[。！？!?…]+[”’"）】》)]*/g) ?? [];
  const matchedLength = matches.join("").length;
  const tail = paragraph.slice(matchedLength).trim();

  return tail ? [...matches, tail] : matches;
}

export function formatChapterDraftParagraphs(content: string) {
  const maxParagraphCharacters = 220;
  const targetParagraphCharacters = 170;
  const minParagraphCharacters = 80;
  const paragraphs = content
    .trim()
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs
    .flatMap((paragraph) => {
      if (
        countDraftCharacters(paragraph) <= maxParagraphCharacters ||
        /^#/.test(paragraph) ||
        !/[。！？!?…]/.test(paragraph)
      ) {
        return [paragraph];
      }

      const sentences = splitDraftParagraphSentences(paragraph);

      if (sentences.length <= 1) {
        return [paragraph];
      }

      const chunks = sentences.reduce<string[]>((items, sentence) => {
        const current = items.at(-1) ?? "";
        const next = `${current}${sentence}`.trim();
        const currentCharacters = countDraftCharacters(current);
        const nextCharacters = countDraftCharacters(next);

        if (
          current &&
          currentCharacters >= minParagraphCharacters &&
          nextCharacters > targetParagraphCharacters
        ) {
          items.push(sentence.trim());
          return items;
        }

        if (items.length === 0) {
          items.push(sentence.trim());
        } else {
          items[items.length - 1] = next;
        }

        return items;
      }, []);

      const last = chunks.at(-1) ?? "";

      if (chunks.length > 1 && countDraftCharacters(last) < 45) {
        const tail = chunks.pop();
        chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}${tail}`;
      }

      return chunks;
    })
    .join("\n\n");
}

export function prepareChapterDraftContentForSave(content: string, targetWordCount?: number) {
  const text = normalizeChapterDraftPunctuation(content.trim())
    .replace(/^(?:#{1,6}\s*)?第\s*(?:\d+|[零一二两三四五六七八九十百千万]+)\s*章[^\n]{0,40}\n+/, "")
    .trim();

  if (!text) {
    return "";
  }

  if (!isChapterDraftEndingIncomplete(text)) {
    return formatChapterDraftParagraphs(text);
  }

  const trimmed = trimChapterDraftToLastCompleteSentence(text);

  if (!trimmed) {
    return text;
  }

  const originalCharacters = countDraftCharacters(text);
  const trimmedCharacters = countDraftCharacters(trimmed);
  const maxSilentTrimCharacters = Math.max(180, Math.ceil(originalCharacters * 0.18));

  if (
    trimmedCharacters >= minimumDraftCharacters(targetWordCount) &&
    originalCharacters - trimmedCharacters <= maxSilentTrimCharacters
  ) {
    return formatChapterDraftParagraphs(trimmed);
  }

  return formatChapterDraftParagraphs(text);
}

export function prepareChapterDraftContentForForcedCompleteSave(content: string, targetWordCount?: number) {
  const text = normalizeChapterDraftPunctuation(content.trim())
    .replace(/^(?:#{1,6}\s*)?第\s*(?:\d+|[零一二两三四五六七八九十百千万]+)\s*章[^\n]{0,40}\n+/, "")
    .trim();

  if (!text) {
    return "";
  }

  if (!isChapterDraftEndingIncomplete(text)) {
    return formatChapterDraftParagraphs(text);
  }

  const trimmed = trimChapterDraftToLastCompleteSentence(text);

  if (
    trimmed &&
    trimmed !== text &&
    countDraftCharacters(trimmed) >= minimumSavableDraftCharacters(targetWordCount)
  ) {
    return formatChapterDraftParagraphs(trimmed);
  }

  return formatChapterDraftParagraphs(text);
}

export function prepareChapterDraftContentForFastSave(
  content: string,
  context: ChapterDraftContext,
  targetWordCount?: number
) {
  const prepared = prepareChapterDraftContentForSave(
    sanitizeChapterDraftDiction(content, context),
    targetWordCount
  );
  const maxCharacters = maximumDraftCharacters(targetWordCount);

  if (countDraftCharacters(prepared) <= maxCharacters) {
    return prepared;
  }

  const paragraphs = prepared.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    const sentences = splitDraftParagraphSentences(paragraph);
    const parts = sentences.length > 0 ? sentences : [paragraph];

    for (const part of parts) {
      const next = [...chunks, part.trim()].join("\n\n");

      if (countDraftCharacters(next) > maxCharacters) {
        return prepareChapterDraftContentForSave(chunks.join("\n\n") || prepared, targetWordCount);
      }

      chunks.push(part.trim());
    }
  }

  return prepareChapterDraftContentForSave(chunks.join("\n\n") || prepared, targetWordCount);
}

export async function compressChapterDraftToTarget(
  content: string,
  context: ChapterDraftContext,
  targetWordCount: number
) {
  const maxCharacters = maximumDraftCharacters(targetWordCount);
  const minCharacters = minimumDraftCharacters(targetWordCount);
  const originalCarriesHook = draftCoversTaskEndingHook(content, context.taskCard.endingHook);

  if (countDraftCharacters(content) <= maxCharacters) {
    return { content, usage: undefined as AiTokenUsage | undefined };
  }

  let response: { content?: string };

  try {
    response = await requestAiJson<{ content?: string }>({
      messages: [
        {
          role: "system",
          content:
            `你是网文正文压缩编辑。请严格输出 JSON。当前章节明显超过目标篇幅，需要压缩到 ${targetWordCount} 字左右，最高不得超过 ${maxCharacters} 个中文字符。必须保留本章目标、核心冲突、爽点释放和当前已经写出的阶段落点，不要改成提纲、总结或分析。`
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              targetWordCount,
              maxCharacters,
              currentCharacters: countDraftCharacters(content),
              content,
              taskCard: context.taskCard,
              compressionRules: [
                "保留主要场景和关键对话，删掉重复解释、重复心理活动、同义铺垫和多余环境描写。",
                "如果原文已经写出任务卡章末钩子，不要删除；如果原文本来没有写到钩子，不要为了补钩子新增大段剧情。",
                "压缩后仍然必须是完整小说正文，不能变成梗概。",
                "必须保留本章起因、推进、转折、爽点释放和章末落点，不能把正文压到剧情写了一半就结束。",
                "如果无法同时满足字数上限和完整剧情，优先保证剧情完整、前后文通顺，允许略微超过字数上限。",
                "结尾必须以完整句子结束。"
              ],
              outputSchema: {
                content: "string"
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0.25,
      maxTokens: estimateDraftMaxTokens(targetWordCount),
      timeoutMs: CHAPTER_DRAFT_REVISION_TIMEOUT_MS
    });
  } catch {
    return { content: prepareChapterDraftContentForSave(content, targetWordCount), usage: undefined as AiTokenUsage | undefined };
  }

  const compressed = prepareChapterDraftContentForSave(
    String(response.content ?? "").trim(),
    targetWordCount
  );
  const compressedCharacters = countDraftCharacters(compressed);
  const compressedIsUsable =
    compressed &&
    compressedCharacters >= Math.max(minCharacters, minimumDraftExpansionCharacters(targetWordCount)) &&
    compressedCharacters <= Math.ceil(maxCharacters * 1.12) &&
    !isChapterDraftEndingIncomplete(compressed) &&
    (!originalCarriesHook || draftCoversTaskEndingHook(compressed, context.taskCard.endingHook));

  return {
    content: compressedIsUsable ? compressed : content,
    usage: getAiTokenUsage(response)
  };
}

export function assertChapterDraftComplete(content: string) {
  if (isChapterDraftEndingIncomplete(content)) {
    throw new Error("正文结尾疑似被截断，未保存为章节草稿。请重新生成或降低目标字数。");
  }
}

function isCultivationFantasyContext(context: Pick<ChapterDraftContext, "bible" | "plotState" | "taskCard">) {
  const text = [
    context.bible.workType,
    context.bible.worldRules,
    context.bible.goldenFingerRules,
    context.bible.styleGuide,
    context.plotState.currentMap,
    context.plotState.powerSystemState,
    context.taskCard.chapterGoal,
    context.taskCard.mainPlotProgress,
    context.taskCard.rulesNotToBreak.join("、")
  ].join("\n");

  return /玄幻|修仙|仙侠|修炼|宗门|灵气|灵力|境界|炼气|筑基|金丹|元婴|神体|灵根|功法|丹药|法器|长老|家族/.test(text);
}

function baseCharacterName(name: string) {
  return name.replace(/[（(].*?[）)]/g, "").trim();
}

function inferCharacterPronoun(character: StoredCharacterProfile) {
  const stripAutoGenderConstraints = (value: string) =>
    value
      .replace(/[；;，,。\s]*性别[:：](?:女性|男性)[；;，,\s]*叙述代词固定用[“"]?[她他]\/[她他]的[”"]?[；;，,\s]*禁止写成[“"]?[她他]\/[她他]的[”"]?/g, "")
      .replace(/[；;，,。\s]*叙述代词(?:必须|固定)用[“"]?[她他]\/[她他]的[”"]?[；;，,\s]*禁止写成[“"]?[她他]\/[她他]的[”"]?/g, "")
      .trim();
  const text = [
    character.name,
    stripAutoGenderConstraints(character.identity),
    character.relationshipToProtagonist,
    character.currentGoal,
    character.longTermGoal,
    character.secret,
    character.attitude,
    character.voice,
    character.knownInformation,
    character.unknownInformation,
    character.currentState
  ].join("\n");
  const name = baseCharacterName(character.name);

  if (!name) {
    return null;
  }

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const femaleScore =
    (text.match(/性别[:：]?\s*女性|女性角色|女业主|女修士|女修|女主|她\/她的|用“她/g) ?? []).length * 2 +
    (text.match(new RegExp(`${escaped}.{0,16}(?:她|她的)`, "g")) ?? []).length +
    (text.match(new RegExp(`(?:女子|女人|妇人|少女|姑娘|中年女人|中年女子|女捕头|女捕快).{0,30}${escaped}`, "g")) ?? []).length * 3 +
    (text.match(new RegExp(`${escaped}.{0,30}(?:女子|女人|妇人|少女|姑娘|中年女人|中年女子|女捕头|女捕快)`, "g")) ?? []).length * 3;
  const maleScore =
    (text.match(/性别[:：]?\s*男性|男性角色|男业主|男修士|男修|男主|男保安|他\/他的|用“他/g) ?? []).length * 2 +
    (text.match(new RegExp(`${escaped}.{0,16}(?:他|他的)`, "g")) ?? []).length +
    (text.match(new RegExp(`(?:男子|男人|汉子|老者|青年男子|中年男人|中年男子|男捕头|男捕快).{0,30}${escaped}`, "g")) ?? []).length * 3 +
    (text.match(new RegExp(`${escaped}.{0,30}(?:男子|男人|汉子|老者|青年男子|中年男人|中年男子|男捕头|男捕快)`, "g")) ?? []).length * 3;

  if (femaleScore >= maleScore + 2) {
    return "female" as const;
  }

  if (maleScore >= femaleScore + 2) {
    return "male" as const;
  }

  return null;
}

function buildCharacterPronounRules(characters: StoredCharacterProfile[]) {
  return characters
    .map((character) => {
      const gender = inferCharacterPronoun(character);
      const name = baseCharacterName(character.name);

      if (!gender || !name) {
        return "";
      }

      return gender === "female"
        ? `${name}=女性，叙述代词固定用“她/她的”，不要写成“他/他的”。`
        : `${name}=男性，叙述代词固定用“他/他的”，不要写成“她/她的”。`;
    })
    .filter(Boolean);
}

function firstChineseSurname(name: string) {
  const base = baseCharacterName(name);
  const match = base.match(/^[\u4e00-\u9fff]/u);
  return match?.[0] ?? "";
}

function buildFamilyNameConsistencyRules(characters: StoredCharacterProfile[]) {
  const relationCharacters = characters
    .map((character) => ({
      name: baseCharacterName(character.name),
      surname: firstChineseSurname(character.name),
      relationText: [
        character.identity,
        character.relationshipToProtagonist,
        character.currentState,
        character.longTermGoal
      ].join(" ")
    }))
    .filter((item) => item.name && item.surname);
  const familyMembers = relationCharacters.filter((item) =>
    /嫡姐|庶姐|嫡妹|庶妹|姐妹|姐姐|妹妹|兄弟|兄长|弟弟|父亲|母亲|嫡母|姨娘|主母|继母|族兄|族弟|族姐|族妹|府中.*女|家中.*女|宗族.*女/.test(item.relationText)
  );
  const surnames = Array.from(new Set(familyMembers.map((item) => item.surname)));

  if (familyMembers.length < 2 || surnames.length <= 1) {
    return [
      "同一家族、同一府邸或同一宗族内的亲兄弟姐妹，默认必须同姓；如果正文写不同姓，必须明确说明是表亲、继亲、养女、外姓寄居或改姓，否则视为人物关系错误。"
    ];
  }

  return [
    `人物档案里疑似同一家族/府邸/宗族亲属却出现不同姓氏：${familyMembers.map((item) => `${item.name}（${item.relationText.slice(0, 24)}）`).join("；")}。生成正文前必须先统一亲属姓氏，或明确写出表亲、继亲、养女、外姓寄居等解释。`,
    "同一家族、同一府邸或同一宗族内的亲兄弟姐妹，默认必须同姓；如果正文写不同姓，必须明确说明是表亲、继亲、养女、外姓寄居或改姓，否则视为人物关系错误。"
  ];
}

function buildAddressFormRules(context: {
  projectDescription?: string;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
  taskCard?: Pick<StoredWritingTaskCard, "chapterGoal" | "rulesNotToBreak">;
}) {
  const text = [
    context.projectDescription,
    context.bible.workType,
    context.bible.corePleasure,
    context.bible.immutableSettings,
    context.bible.narrativeTaboos,
    context.bible.styleGuide,
    context.plotState.currentMap,
    context.taskCard?.chapterGoal,
    context.taskCard?.rulesNotToBreak.join("、")
  ].join("\n");

  const isAncientContext = /古言|古风|古代|古装|宅斗|内宅|后宅|嫡|庶|世家|宗族|家族|门第|府邸|府中|府里|府上|院里|院中|县衙|衙门|官府|知县|捕快|捕头|仵作|差役|查案|断案|审案/.test(text);

  if (!isAncientContext) {
    return [];
  }

  const isOfficialCaseContext = /县衙|衙门|官府|知县|捕快|捕头|仵作|差役|查案|断案|审案|案发|凶案|命案|物证|验尸/.test(text);
  const isInnerHouseContext = /宅斗|内宅|后宅|嫡|庶|世家|宗族|家族|门第|府邸|府中|府里|府上|院里|院中|婢女|丫鬟/.test(text);

  if (isOfficialCaseContext) {
    return [
      "古代官府、县衙、查案或差役场景里，人物称谓必须按身份和场合使用：官府体系内优先用姓氏/姓名、官职、差役身份或绰号；陌生民众可用姑娘、小哥、差爷等，不得把所有场景统一成“姑娘/小姐”。",
      "任务卡 rulesNotToBreak 不要写成“全篇统一称某某为姑娘/小姐”这类单一称谓规则；需要写称谓限制时，应写“按身份和场景使用称谓”。"
    ];
  }

  if (isInnerHouseContext) {
    return [
      "古言府邸、宅斗、内宅语境里，自家婢女称未出阁府中女儿通常用“姑娘/排行姑娘”；若正文使用“小姐”，必须由创作圣经明确采用该称谓体系。",
      "即使是内宅题材，也不得把所有人对同一角色的称呼强行统一；外人、长辈、官府、仆从和同辈应按身份、亲疏和场景变化。"
    ];
  }

  return [
    "古代语境里称谓必须按身份、亲疏和场合使用；不要混入明显现代口语，也不要把所有人对同一角色的称呼强行统一成一个词。",
    "任务卡 rulesNotToBreak 只能约束称谓口径，不能生成与场景冲突的单一称谓硬规则。"
  ];
}

function fixCharacterPronouns(content: string, characters: StoredCharacterProfile[]) {
  return characters.reduce((text, character) => {
    const gender = inferCharacterPronoun(character);
    const name = baseCharacterName(character.name);

    if (!gender || !name) {
      return text;
    }

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (gender === "female") {
      return text
        .replace(new RegExp(`(${escaped}[。！？!?；;：:\\s”“’"'）】》-]{0,16})他(?=[的也却在是有从把被对向看说问低抬缓微嘴眼身手脚])`, "g"), "$1她")
        .replace(new RegExp(`(${escaped}[^。！？!?]{0,28}，)他(?=[的也却在是有从把被对向看说问低抬缓微嘴眼身手脚])`, "g"), "$1她");
    }

    return text
      .replace(new RegExp(`(${escaped}[。！？!?；;：:\\s”“’"'）】》-]{0,16})她(?=[的也却在是有从把被对向看说问低抬缓微嘴眼身手脚])`, "g"), "$1他")
      .replace(new RegExp(`(${escaped}[^。！？!?]{0,28}，)她(?=[的也却在是有从把被对向看说问低抬缓微嘴眼身手脚])`, "g"), "$1他");
  }, content);
}

function buildNarrativeDictionRules(context: ChapterDraftContext) {
  const pronounRules = buildCharacterPronounRules(context.characters);
  const familyNameRules = buildFamilyNameConsistencyRules(context.characters);
  const addressFormRules = buildAddressFormRules(context);
  const premiseAnchorRules = buildPremiseAnchorRules({
    projectName: context.projectName,
    projectDescription: context.projectDescription,
    bible: context.bible,
    plotState: context.plotState
  });
  const mechanismIntegrityRules = buildMechanismIntegrityRules({
    chapterNumber: context.taskCard.chapterNumber,
    projectName: context.projectName,
    projectDescription: context.projectDescription,
    bible: context.bible,
    plotState: context.plotState
  });
  const protagonistEmbodimentRules = buildProtagonistEmbodimentRules({
    chapterNumber: context.taskCard.chapterNumber,
    projectDescription: context.projectDescription,
    bible: context.bible,
    plotState: context.plotState
  });
  const rules = [
    "正文称谓、对白和物件必须符合当前题材、时代感和世界观，不要混入与题材不符的现代口语。",
    "亲属、师门、家族、宗门称谓必须稳定，不能同一人物一会儿现代口语一会儿古风称谓。",
    pronounRules.length
      ? `人物性别和代词是硬约束：${pronounRules.join("；")}`
      : "",
    `本书作品类型固定为「${context.bible.workType}」，目标读者固定为「${context.bible.targetReader}」，正文不得擅自切换题材频道、时代背景、主角类型或核心卖点。`,
    context.projectDescription
      ? `项目简介是核心承诺参考：正文不要与「${context.projectDescription}」中的主角身份、初始危机、金手指机制和核心卖点明显冲突；具体桥段以任务卡为准。`
      : "",
    ...familyNameRules,
    ...addressFormRules,
    "创作圣经 immutableSettings、narrativeTaboos、corePleasure、styleGuide 中的主分类、题材边界、作品标签和禁止项都是硬约束；如果任务卡与圣经冲突，优先遵守圣经。",
    ...premiseAnchorRules,
    ...mechanismIntegrityRules,
    ...protagonistEmbodimentRules,
    "每段尽量控制在 1-4 句；一个自然段接近 200 字时必须换段，不要写成一大段散文，也不要连续堆很多长句。",
    "优先写动作、对话、冲突、结果和信息推进，不要用华丽词藻、排比句、总结腔或抒情腔去撑篇幅。",
    "语言要像正常网文，不要刻意堆砌比喻、成语、抽象修辞或过度精致的句式。",
    "避免使用“——”破折号制造停顿、解释或转折；需要停顿时优先用逗号、句号、冒号或直接换句。",
    "降低 AI 味是硬要求：不要把人物背景、学历、技能和处境一次性解释完整，要拆进动作、对话、物件和临场反应里。",
    "不要连续使用“她深吸一口气、她下意识、她没说话、脑子里、像是、仿佛、某种”等模板句式；同一页里如果已经出现过类似动作，换成更具体的身体反应或直接删掉。",
    "禁用默认惊讶套话：瞳孔猛缩、瞳孔骤缩、瞳孔微缩、眸色一沉、心头一震、心头一紧、心里咯噔一下、倒吸一口凉气。需要惊讶时写可见动作、短暂停顿、失误、手上物件变化或一句没接住的话。",
    "句子节奏要有毛边：允许短句、半句、停顿、口语化判断和不那么工整的反应；不要每段都写成动作一句、解释一句、情绪总结一句。",
    "人物不要总是冷静正确。早期可以有误判、迟疑、嘴上没接住话、手忙脚乱、看漏细节，再靠第二眼或别人一句话推进。",
    "专业知识不要讲成教材。只保留破案必须用到的一两句判断，其余用观察动作和现场反应证明。"
  ];

  if (isCultivationFantasyContext(context)) {
    rules.push(
      "当前题材按修炼玄幻/修仙语感处理：亲属称谓使用“父亲、母亲、兄长、长兄、族叔、族老、长老、师尊、师兄、师姐”等，不要使用“爸、爸爸、老爸、妈、妈妈、老妈”等现代家庭口语。",
      "修炼玄幻正文禁止出现明显现代生活词和现代制度词，除非创作圣经明确设定存在：手机、微信、短信、警察、公司、老板、上班、医院、学校、公交、出租车、银行卡。",
      "对白可以自然，但不能像现代都市口吻；威胁、讥讽、称呼要符合家族、宗门、修炼世界的身份秩序。"
    );
  }

  return rules.filter(Boolean);
}

function softenPlanningLanguageForDraft(value: string) {
  return value
    .replace(/降维打击/g, "多看出一个不对劲")
    .replace(/专业知识与现场的认知碰撞/g, "旧经验和眼前场面撞在一起")
    .replace(/现代知识与古代现场的认知碰撞/g, "旧经验和眼前场面撞在一起")
    .replace(/现代观察法/g, "习惯性的观察")
    .replace(/专业观察法/g, "习惯性的观察")
    .replace(/微量物证/g, "细小残留")
    .replace(/专业术语/g, "场景里能看见的细节")
    .replace(/专业分析/g, "现场判断")
    .replace(/写清/g, "让读者从场面里看出")
    .replace(/说明原因/g, "用动作或对白带出原因")
    .replace(/解释意义/g, "让后果自己显出来")
    .replace(/触发条件/g, "触发点")
    .replace(/是否符合关键机制/g, "有没有越过本章该有的边界")
    .replace(/收益来源/g, "好处从哪来")
    .replace(/完整专业分析/g, "一两个现场判断")
    .trim();
}

function buildDraftFacingTaskCard(taskCard: StoredWritingTaskCard): StoredWritingTaskCard {
  const rulesNotToBreak = asTextList(taskCard.rulesNotToBreak);
  const priorityRules = rulesNotToBreak.filter((rule) =>
    /必须|心理|身体|现实|梦|醒|害怕|恐惧|反胃|手抖|发抖|迟疑|适应|裂缝|回响|禁止|不得/.test(rule)
  );

  return {
    ...taskCard,
    chapterGoal: cleanPromptText(softenPlanningLanguageForDraft(taskCard.chapterGoal), 260),
    continuity: cleanPromptText(softenPlanningLanguageForDraft(taskCard.continuity), 190),
    mainPlotProgress: cleanPromptText(softenPlanningLanguageForDraft(taskCard.mainPlotProgress), 240),
    requiredCharacters: asTextList(taskCard.requiredCharacters).slice(0, 4),
    pleasurePoint: cleanPromptText(softenPlanningLanguageForDraft(taskCard.pleasurePoint), 220),
    foreshadowingTasks: compactTextList(taskCard.foreshadowingTasks.map(softenPlanningLanguageForDraft), 4, 150),
    rulesNotToBreak: compactTextList(Array.from(new Set([...priorityRules, ...rulesNotToBreak])).map(softenPlanningLanguageForDraft), 12, 150),
    endingHook: cleanPromptText(softenPlanningLanguageForDraft(taskCard.endingHook), 190)
  };
}

function buildPremiseAnchorRules(context: {
  projectName?: string;
  projectDescription?: string;
  bible: Pick<
    StoredWritingBible,
    "corePleasure" | "goldenFingerRules" | "immutableSettings" | "narrativeTaboos" | "worldRules" | "styleGuide"
  >;
  plotState?: Pick<StoredPlotState, "mainGoal" | "shortTermGoal" | "currentStage" | "nextStageGoal">;
}) {
  const anchor = [
    context.projectName ? `书名：${context.projectName}` : "",
    context.projectDescription ? `项目简介：${context.projectDescription}` : "",
    context.bible.corePleasure ? `核心爽点：${context.bible.corePleasure}` : "",
    context.bible.goldenFingerRules ? `金手指/关键机制：${context.bible.goldenFingerRules}` : "",
    context.plotState?.mainGoal ? `当前主线目标：${context.plotState.mainGoal}` : "",
    context.plotState?.shortTermGoal ? `短期目标：${context.plotState.shortTermGoal}` : "",
    context.plotState?.currentStage ? `当前阶段：${context.plotState.currentStage}` : ""
  ].filter(Boolean);

  if (anchor.length === 0) {
    return [];
  }

  return [
    `核心承诺锚点如下：${anchor.join("；")}`,
    "不要求机械重复核心承诺里的原词，但每章必须让本章目标、冲突、收益或章末钩子至少有一项在功能上服务核心承诺，不能只沿着上一章支线继续扩写。",
    "如果书名和简介已经给出明确反差卖点、成长方式、主角身份或读者期待，任务卡和正文必须优先兑现这些承诺，而不是用通用副本、通用秘境、通用敌人替代。",
    "可以开启支线、新地图、新组织或新危机，但它们必须服务核心卖点、金手指机制、主角底层目标或当前主线目标；不能连续多章让支线替代主线。",
    "如果上一章钩子与核心承诺锚点发生冲突，优先把钩子改写成服务核心承诺的压力或选择，而不是顺着钩子改换故事类型。",
    "主角能力、资源、地位或关系的提升必须遵守创作圣经中的关键机制和阶段节奏，不能为了爽点临时换一套升级来源。"
  ];
}

function buildMechanismIntegrityRules(context: {
  chapterNumber?: number;
  projectName?: string;
  projectDescription?: string;
  bible: Pick<StoredWritingBible, "corePleasure" | "goldenFingerRules" | "powerSystem" | "immutableSettings">;
  plotState?: Pick<StoredPlotState, "mainGoal" | "shortTermGoal" | "currentStage" | "powerSystemState" | "resourceState">;
}) {
  const mechanism = [
    context.bible.goldenFingerRules ? `关键机制：${context.bible.goldenFingerRules}` : "",
    context.bible.powerSystem ? `战力/能力体系：${context.bible.powerSystem}` : "",
    context.plotState?.powerSystemState ? `当前能力状态：${context.plotState.powerSystemState}` : "",
    context.plotState?.resourceState ? `当前资源状态：${context.plotState.resourceState}` : ""
  ].filter(Boolean);

  if (mechanism.length === 0) {
    return [];
  }

  return [
    `机制合规基准如下：${mechanism.join("；")}`,
    "本章凡是让主角获得能力、资源、地位、境界、金钱、权限、情报或关系收益，都必须写清收益来源、触发条件、代价/限制，以及为什么符合关键机制。",
    "不得只保留机制名词，却把收益来源偷换成另一套升级方式；如果收益来源不属于关键机制，必须写成外部诱因、线索或临时助力，不能直接替代核心成长方式。",
    "升级和收益必须符合当前阶段节奏；如果一章内跨越多个大阶段、连续突破或获得超出当前阶段的核心资源，必须有明确铺垫、成本和后果，否则应降级为小收益或线索。",
    context.chapterNumber && context.chapterNumber <= 5
      ? `当前仍是第 ${context.chapterNumber} 章早期开局；如果作品是 10 万字以上的中长篇，优先建立机制、压力和第一轮小台阶，不要过早兑现完整大阶段突破。可以把收益拆成资格、试用、预期收益、小额增长、验证机制或风险成本。`
      : "",
    "章末钩子可以制造更大期待，但不能用未铺垫的大机缘直接绕过关键机制。"
  ].filter(Boolean);
}

function buildProtagonistEmbodimentRules(context: {
  chapterNumber?: number;
  projectDescription?: string;
  bible?: StoredWritingBible;
  plotState?: StoredPlotState;
}) {
  const sourceText = [
    context.projectDescription,
    context.bible?.workType,
    context.bible?.targetReader,
    context.bible?.corePleasure,
    context.bible?.protagonistDesire,
    context.bible?.worldRules,
    context.bible?.narrativeTaboos,
    context.bible?.styleGuide,
    context.plotState?.mainGoal,
    context.plotState?.currentStage
  ].filter(Boolean).join("\n");
  const hasDislocationPremise = /穿越|快穿|入梦|梦境|重生|异世|古代|末世|规则怪谈|无限流|副本/.test(sourceText);
  const hasHighPressurePremise = /悬疑|刑侦|法医|尸体|命案|凶案|血|恐怖|惊悚|审讯|追杀|逃亡|灾变/.test(sourceText);

  if (!hasDislocationPremise && !hasHighPressurePremise) {
    return [
      "主角不能只像功能工具人推进剧情；需要在关键压力点保留具体身体反应、情绪判断或现实压力回响，让人物选择有来源。"
    ];
  }

  const earlyChapterRule =
    context.chapterNumber && context.chapterNumber <= 20
      ? `当前仍是第 ${context.chapterNumber} 章，属于主角适应高冲击处境的前期；不能写成无缝适应。`
      : "即使主角已逐渐适应，也要保留压力余波和代价，不要写成完全无感。";

  return [
    earlyChapterRule,
    "主角适应成本按阶段轮换出现即可，不要每章都显性打卡；优先在尸体、梦境异常、权力压制、现实身份被触发或阶段收束后写一次短促反应，平稳查证章节可以只保留专注、疲惫或沉默。",
    "女强不是无所畏惧，但也不是反复害怕；害怕、反胃、手抖、迟疑、现实压力回响等不要连续章节重复同一种表现，能用行动选择体现就不额外解释。",
    "时间与体力必须连续：连续查案、战斗、赶路、审讯或夜探后，要安排可见代价或恢复窗口，例如吃饭、喝水、换药、短睡、轮值、等待天亮、暂回住处、现实醒来缓冲；不能让主角无休止跨场景奔走。",
    "转场必须有时间成本和行动理由：一章内最多保留 2-3 个有效地点，赶路、等待、天色变化和休整可以压缩，但不能完全消失；如果连续多章都是夜间行动，必须处理天亮、休息、官府当值或现实身体疲惫。",
    "如果涉及梦境、穿越、重生或异世，必须区分主观经历时间、异世界时间与现实时间；可以把醒来/再入梦作为休整和现实回响，但必须承接同一世界、同一案件或同一任务进度，不得擅自跳成新世界或重置关系。"
  ];
}

export function sanitizeChapterDraftDiction(content: string, context: ChapterDraftContext) {
  const pronounFixed = normalizeChapterDraftPunctuation(fixCharacterPronouns(content, context.characters))
    .replace(/瞳孔(?:猛|骤|微)?(?:地)?一?缩/g, "眼神顿住")
    .replace(/眸色一沉/g, "眼神沉了沉")
    .replace(/心头一震/g, "心里一震")
    .replace(/心头一紧/g, "心里一紧")
    .replace(/倒吸一口凉气/g, "呼吸停了一瞬");

  if (!isCultivationFantasyContext(context)) {
    return pronounFixed;
  }

  return pronounFixed
    .replace(/老爸|爸爸|爸/g, "父亲")
    .replace(/老妈|妈妈|妈/g, "母亲");
}

function normalizeChapterDraftPunctuation(content: string) {
  return content
    .replace(/——+/g, "，")
    .replace(/([，。！？；：])，/g, "$1")
    .replace(/，([。！？；：])/g, "$1")
    .replace(/，\s*\n/g, "\n");
}

export async function generateWritingTaskCardWithAi(context: TaskCardContext) {
  const familyNameRules = buildFamilyNameConsistencyRules(context.characters);
  const addressFormRules = buildAddressFormRules({
    projectDescription: context.projectDescription,
    bible: context.bible,
    plotState: context.plotState,
    taskCard: context.userInput?.chapterGoal ? { chapterGoal: context.userInput.chapterGoal, rulesNotToBreak: [] } : undefined
  });
  const premiseAnchorRules = buildPremiseAnchorRules({
    projectName: context.projectName,
    projectDescription: context.projectDescription,
    bible: context.bible,
    plotState: context.plotState
  });
  const mechanismIntegrityRules = buildMechanismIntegrityRules({
    chapterNumber: context.chapterNumber,
    projectName: context.projectName,
    projectDescription: context.projectDescription,
    bible: context.bible,
    plotState: context.plotState
  });
  const protagonistEmbodimentRules = buildProtagonistEmbodimentRules({
    chapterNumber: context.chapterNumber,
    projectDescription: context.projectDescription,
    bible: context.bible,
    plotState: context.plotState
  });
  const longFormPlanRules = buildTaskCardLongFormRules(context.longFormPlan, context.chapterNumber);
  const response = await requestAiJson<Partial<StoredWritingTaskCard>>({
    messages: [
      {
        role: "system",
        content:
          "你是网文长篇创作助手。请严格输出 JSON。你的任务是基于创作圣经、主线状态、最近章节台账、拆书结构参考和伏笔表，生成一张“新作品”的本章任务卡。拆书分析只能作为结构参考，用来迁移冲突循环、爽点功能、节奏密度和钩子类型；严禁照搬或续写原书内容，严禁复用原书人物名、地点名、专有设定、具体线索、章节事件、原文表达和同款章末钩子。用户输入不为空时必须优先遵守；用户输入为空时自动补全，但必须围绕当前项目的创作圣经和主线状态生成全新的剧情任务。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            projectName: cleanPromptText(context.projectName, 120),
            projectDescription: cleanPromptText(context.projectDescription ?? "", 800),
            bible: compactTaskCardBible(context.bible),
            plotState: compactTaskCardPlotState(context.plotState),
            longFormPlan: buildTaskCardLongFormPlanSummary(context.longFormPlan, context.chapterNumber),
            lastLedger: compactTaskCardLedger(context.lastLedger),
            latestDraft: compactTaskCardLatestDraft(context.latestDraft),
            latestDraftActualEnding: cleanPromptText(context.latestDraftActualEnding ?? "", 260),
            characters: context.characters.slice(0, 5).map(compactTaskCardCharacter),
            chapterCharacterConstraints: context.chapterCharacterConstraints ?? [],
            foreshadowings: context.foreshadowings.slice(0, 10).map(compactTaskCardForeshadowing),
            relatedInspirations: (context.relatedInspirations ?? []).slice(0, 4).map((item) => ({
              title: cleanPromptText(item.title, 80),
              type: item.type,
              content: cleanPromptText(item.content, 220),
              tags: item.tags.slice(0, 6)
            })),
            storyReference: buildTaskCardStoryReference(context.storyAnalysis),
            chapterPatternReferences: buildTaskCardChapterPatternReferences(context.recentChapterAnalyses),
            recentChapterTitles: (context.recentChapterTitles ?? []).slice(0, 6).map((item) => ({
              chapterNumber: item.chapterNumber,
              title: cleanPromptText(item.title, 40)
            })),
            userInput: context.userInput ?? {},
            useAnalysisContext: context.useAnalysisContext !== false,
            chapterNumber: context.chapterNumber,
            migrationRules: [
              "title 只写章节标题本身，不要包含“第N章”“Chapter N”或序号；标题不追求工整，允许短句式、动作式、地点异常式或线索式。",
              "title 必须参考 recentChapterTitles 避免连续相同字数和相同句式；如果最近 2 个以上标题都是 4 个中文字，本章 title 禁止再用 4 个中文字。",
              "title 不要压成四字成语式概括；优先抓本章具体冲突、物件、线索、地点压力或章末钩子；避免套用固定模板词、空泛气氛词或万能概括词。",
              "titleAlternatives 必须给 3 个备选标题，且三个备选标题的字数和句式不能相同；至少 2 个不能是 4 个中文字。",
              "输出必须精炼：chapterGoal、continuity、mainPlotProgress、pleasurePoint、endingHook 每项控制在 60-140 个中文字；requiredCharacters 不超过 4 个；foreshadowingTasks 不超过 3 条；rulesNotToBreak 不超过 8 条，每条不超过 60 个中文字。",
              "不要在任务卡里写正文片段、长对白、连续动作描写或完整段落；任务卡只写可执行剧情功能。",
              "任务卡里的本章目标、承接、主线推进、爽点和章末钩子都必须服务当前 projectName、projectDescription、bible、plotState。",
              "latestDraftActualEnding 是上一章真实正文落点；continuity 必须优先承接这个落点。lastLedger.cliffhanger 和旧任务卡 endingHook 只能辅助，不能覆盖真实正文。",
              "如果 lastLedger.carryOverTasks 不为空，本章必须优先选择其中 1-2 项承接；不要强行一章清空全部未完成任务，剩余项可以继续滚入后续章节。",
              "carryOverTasks 只承接真正未完成的剧情动作、证据闭环、人物对质或伏笔回收；不要把心理适应、伤痛、恐惧、收益来源、触发条件、写作手法说明当成下一章任务。",
              "requiredCharacters 必须包含本章必须实际出场或被现场比对、质询、阻拦、抢夺、指认的关键人物或角色；如果承接 carryOverTasks，必须把承接任务里的关键参与者写入 requiredCharacters。",
              "任务卡需要维护配角/暗线节奏：每 3-5 章至少安排一次配角小目标、秘密、亏欠、误判、立场变化、资源代价或小高光；但不得每章硬塞，也不得让支线替代主线。",
              "当 characters 中存在当前目标、秘密、未知信息或态度变化尚未兑现的配角时，本章可选择 1 个作为配角节拍：让他/她提供阻力、误导、帮助、隐瞒、付出代价或暴露新信息，并在 mainPlotProgress 里写清如何回扣主线。",
              "requiredCharacters 不应只长期重复主角和工具人；如果本章是配角节拍章，必须把该配角写入 requiredCharacters，并让其在正文中有实际行动或选择。",
              "开局任务蓝图是开局阶段任务队列，不是严格章节编号；当上一章任务拆成多章完成时，不要跳过未完成项，也不要为了追第N章蓝图硬塞新任务。",
              "如果本章主要承接 carryOverTasks，mainPlotProgress 要说明本章承接的是上一章未完成项，并把开局任务蓝图中的新任务延后到后续章节。",
              "如果 latestDraftActualEnding 与 lastLedger.cliffhanger、旧任务卡钩子或主线状态不一致，以 latestDraftActualEnding 为准；缺失事件只能写成后续待发生，不能写成已经发生。",
              "每张任务卡只安排一个核心场面、一个关键发现、一个主要阻力和一个章末钩子；不要把多个专业检验点、多个地点、旧案揭示和嫌疑人反转全塞进同一章。",
              "连续查证章节必须合并节奏：发现线索 -> 验证关键点 -> 对质/收束/转入下一案，不能把撤退、跟踪、伤痛、等待、赶路单独扩成一整章目标。",
              "任务卡必须检查时间与体力连续性：如果上一章已经夜探、奔逃、审讯、受伤、长时间查案或现实疲惫，本章应优先安排休整、天亮后的正式流程、现实醒来缓冲或压缩转场，不能继续无缝奔向新地点。",
              "梦境/穿越类作品不需要默认“完成任务才能醒来”；除非创作圣经明确规定，否则可安排中途醒来再入梦，但再入梦必须承接同一案件进度，不能跳成新世界或重置关系。",
              "悬疑查案章必须设计现场阻力：有人质疑、催促、遮掩、破坏证物、给出错误判断或限制时间。不能只让主角顺畅观察并连续解释。",
              "如果 projectDescription 不为空，它是本书核心承诺参考，任务卡不要明显违背简介里的主角身份、初始危机、金手指机制和核心卖点。",
              ...familyNameRules.slice(0, 2),
              ...addressFormRules.slice(0, 2),
              ...premiseAnchorRules.slice(0, 3),
              ...mechanismIntegrityRules.slice(0, 3),
              ...protagonistEmbodimentRules,
              ...longFormPlanRules,
              "任务卡的 chapterGoal 必须写清本章如何推进核心承诺锚点；mainPlotProgress 必须写清这章推进的是主线还是支线，以及支线如何回到主线。",
              "mainPlotProgress 如果写支线，必须说明：关联配角是谁、该配角本章有什么小目标或压力、这条支线如何给主线提供线索/阻力/情绪补偿/伏笔，不允许只写“推进配角线”。",
              "任务卡只能规划剧情功能，不要安排“用旁白交代人物履历/学历/专业能力/世界观规则”；需要能力展示时，必须写成具体场面、动作、对话或现场判断。",
              "任务卡的 pleasurePoint 不能只是“主角发现线索”；必须包含压制来源、反对者或风险，以及主角如何用一个可见动作扭转局面。",
              "任务卡的 pleasurePoint 必须写清：本章收益是什么、收益来源是什么、触发条件是什么、是否符合关键机制、是否存在越级风险；如果只是铺垫章，可以明确写“小收益/线索/误会加深”，不要强行突破。",
              "最近章节台账只提供连续性，不等于自动变成新主线；如果上一章钩子开启了支线，本章必须说明它如何回扣核心承诺，或如何在本章/下章收束。",
              "阶段收束优先级高于伏笔扩展：如果 longFormPlan、rulesNotToBreak 或 lastLedger.carryOverTasks 显示当前应收束、结案、回收或返回，本章不得把符号、旧案、幕后人、新地点、新物证继续扩成新的调查链；这些只能作为案后钩子保留。",
              "当本章处于收束模式时，foreshadowingTasks 只能写“回收/部分回收/保留为案后钩子/暂不深挖”，不得写“继续追查新线索、前往新地点、调查旧案细节”。",
              "支线使用边界：支线章最多占本章一个核心场面；它可以制造误导、情绪、配角高光或新证据，但章末必须回到主线压力、核心承诺或下一步行动。",
              "任务卡 endingHook 是本章优先争取的章末落点；如果本章任务在目标字数内装不下，允许把 endingHook 作为下一章承接目标，但本章必须留下清楚的阶段性压力或未解决问题。",
              "章节功能可以轮换：允许日常经营、关系铺垫、信息差误会、资源小收益、机制试错、低强度压制，不要每章都强行新敌人、新地图、大战斗或大境界突破。",
              "前10章应优先稳住题材卖点、主角日常循环、关键机制反馈和第一阶段压力；除非大纲明确要求，不要过早开启大型副本或连续升级地图。",
              "必须把 bible.immutableSettings 与 bible.narrativeTaboos 中的主分类、题材边界、作品标签、禁止偏离项写入 rulesNotToBreak，并在本章目标中遵守。",
              "如果 chapterCharacterConstraints 不为空，本章任务卡必须显式使用这些人物约束，并把相关人物写入 requiredCharacters。",
              "rulesNotToBreak 中的称谓规则只能写成“按身份和场景使用称谓”；不要生成“全篇统一称某人为姑娘/小姐/公子/大人”等单一称谓硬规则，除非创作圣经明确指定。",
              "如果 relatedInspirations 不为空，必须把这些灵感作为本章任务素材参考，抽象成当前项目自己的情节任务、爽点、伏笔或钩子；不要原样照搬为正文。",
              "可以借鉴“被压制 -> 反击 -> 获得收益 -> 引出更高压力”的节奏，但要换成当前新书自己的冲突、人物和伏笔。"
            ],
            outputSchema: {
              title: "string",
              titleAlternatives: "string[]",
              chapterGoal: "string",
              continuity: "string",
              mainPlotProgress: "string",
              requiredCharacters: "string[]",
              pleasurePoint: "string",
              foreshadowingTasks: "string[]",
              rulesNotToBreak: "string[]",
              endingHook: "string"
            }
          },
          null,
          2
        )
      }
    ],
    temperature: 0.25,
    maxTokens: TASK_CARD_MAX_TOKENS,
    timeoutMs: TASK_CARD_TIMEOUT_MS
  });

  return attachAiTokenUsage({
    title: cleanPromptText(String(response.title ?? ""), 24),
    titleAlternatives: compactTextList((response as { titleAlternatives?: unknown }).titleAlternatives, 3, 24),
    chapterGoal: cleanPromptText(String(response.chapterGoal ?? ""), 180),
    continuity: cleanPromptText(String(response.continuity ?? ""), 180),
    mainPlotProgress: cleanPromptText(String(response.mainPlotProgress ?? ""), 180),
    requiredCharacters: asTextList(response.requiredCharacters).slice(0, 4),
    pleasurePoint: cleanPromptText(String(response.pleasurePoint ?? ""), 180),
    foreshadowingTasks: compactTextList(response.foreshadowingTasks, 3, 120),
    rulesNotToBreak: compactTextList(response.rulesNotToBreak, 8, 90),
    endingHook: cleanPromptText(String(response.endingHook ?? ""), 160)
  }, getAiTokenUsage(response));
}

export async function generateChapterDraftWithAi(context: ChapterDraftContext) {
  try {
    const targetWordCount = normalizeDraftTargetWordCount(context.targetWordCount);
    const minCharacters = minimumDraftCharacters(targetWordCount);
    const maxCharacters = maximumDraftCharacters(targetWordCount);
    const draftTaskCard = buildDraftFacingTaskCard(context.taskCard);

    const response = await requestAiJson<{ title?: string; titleAlternatives?: unknown; content?: string }>({
      messages: [
        {
          role: "system",
          content:
            `你是网文正文生成助手。请严格输出 JSON。你要根据任务卡和项目状态写出一章正文，要求是连贯的中文小说正文，不要输出提纲、列表或分析。正文目标约 ${targetWordCount} 个中文字，最高不得超过 ${maxCharacters} 字，不要为了凑字重复解释、复述设定或写分析腔。`
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              targetWordCount,
              maxCharacters,
              taskCard: draftTaskCard,
              projectName: context.projectName,
              projectDescription: context.projectDescription,
              bible: context.bible,
              plotState: context.plotState,
              longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
              lastLedger: context.lastLedger,
              continuityFacts: (context.continuityFacts ?? []).slice(0, 14),
              previousDraftTail: context.previousDraftTail,
              recentChapterTitles: (context.recentChapterTitles ?? []).slice(0, 6).map((item) => ({
                chapterNumber: item.chapterNumber,
                title: cleanPromptText(item.title, 40)
              })),
              characters: context.characters,
              foreshadowings: context.foreshadowings,
              writingRules: [
                "title 只写章节标题本身，不要包含“第N章”“Chapter N”或序号；标题不追求工整，允许短句式、动作式、地点异常式或线索式。",
                "title 必须参考 recentChapterTitles 避免连续相同字数和相同句式；如果最近 2 个以上标题都是 4 个中文字，本章 title 禁止再用 4 个中文字。",
                "title 不要压成四字概括或万能气氛词；优先来自本章具体线索、物件、压力或钩子。",
                "titleAlternatives 必须给 3 个备选标题，且三个备选标题的字数和句式不能相同；至少 2 个不能是 4 个中文字。",
                `正文目标约 ${targetWordCount} 字，最高不得超过 ${maxCharacters} 字；篇幅不足时扩写动作、对话、压制过程和爽点释放，不要水字数。`,
                `最高 ${maxCharacters} 字是硬上限，不是写作目标；正文应在接近 ${Math.round(targetWordCount * 1.08)}-${Math.round(targetWordCount * 1.18)} 字时主动收束，不要写到上限才想结尾。`,
                `必须在 ${maxCharacters} 字以内自然收束并写出章末落点，不要写到被系统长度限制截断。`,
                "如果篇幅不足以展开所有细节，优先保留本章目标、核心冲突、爽点释放和章末钩子，压缩铺垫和旁支描写。",
                "节奏经济：环境、进门、躲藏、赶路、伤痛、呼吸、手部动作等过程描写只保留会改变局面的细节；不能把一次撤退、跟踪或身体不适扩成整章主体。",
                "悬疑细节必须换来推进：每个细节要么形成证据、制造误判、逼出人物反应、推动对质或服务章末钩子；纯氛围和重复感受要压缩。",
                "时间与体力连续性必须可信：如果上一章刚经历夜探、奔逃、审讯、长时间查案、受伤或强刺激，本章要处理休息、饥饿、天色、换药、当值、等待或现实醒来缓冲；不能让主角像不需要睡觉一样连续转场。",
                "转场只写有效成本：可用一两句交代天亮、回住处、换班、吃点东西、短睡或现实醒来；不要把休息写成水文，但也不能完全没有。",
                "正文预算必须先保证本章有完整阶段落点：中段细节可以压缩；任务卡 endingHook 优先兑现，但如果目标字数内装不下，可以停在更早的有效压力点，留给下一章承接。",
                "如果目标字数偏短，只保留 3-5 个关键场面，最后 15%-25% 篇幅必须留给本章收束；不要为了兑现所有任务把正文硬撑长。",
                "任务卡 requiredCharacters 是硬要求：除“主角”这类泛称外，名单里的每个具体姓名都必须在正文中以原名实际出现，并有动作、对白、观察、质询、指认、阻拦或选择；不能只在任务卡或台账里出现。",
                "任务卡 foreshadowingTasks 是硬要求：凡是写了本章、必须、通过、回收、承接、处理、证据链、物件、染料、账本、指纹或供词的任务，都必须在正文场面里兑现；不能只写成概括结论。",
                "涉及回收伏笔时，必须让读者看到对应物件、痕迹、人物反应或对质过程；例如衣袖染料、指甲残留、账本、指纹、供词等，不能只让旁白说“线索被回收”。",
                "任务卡和长篇规划里的心理适应、身体反应、现实记忆回响是人物节奏提示，不是每章打卡项；只有任务卡明确写“本章必须”时才需要可见兑现，否则优先写当前场景推进，不要反复写害怕、反胃或手抖。",
                "开写前先把本章拆成 4-7 个可见场面，但不要把场面表输出；正文只能输出小说内容。",
                "本章必须有现场阻力：质疑、催促、证物将被处理、错误结论压过主角、有人遮掩或时间限制。不能写成主角一路顺畅观察和讲解。",
                "专业判断必须写成冲突里的动作：先有人误判或阻拦，再由主角抓住一个具体细节反击。每个专业点最多用一两句，不要连续教学。",
                "每 400 字内至少出现一次外部反应、误解、打断、风险升级或新信息，不要整段整段平铺叙事。",
                "第一遍正文就要避开机器腔：不要集中交代人物履历、学历、技能、世界观规则；每次最多露出一个必要信息，并让它从动作、物件、对话或现场压力里出现。",
                "禁止用旁白给读者做结论：少写“这意味着/说明/证明/显然/无疑/某种/仿佛”；要让人物看见、摸到、听到、被催促或被反驳。",
                "不要使用“深吸一口气、下意识、脑子里、瞳孔猛缩、瞳孔骤缩、瞳孔微缩、眸色一沉、心头一震、心头一紧、倒吸一口凉气”作为默认反应；写更具体的手、眼、步子、语气、物件变化或直接删掉。",
                "如果任务卡涉及任何专业能力、行业知识、技能体系或复杂规则，本章只能写一两个场景内判断，不要解释原理，不要列举知识点，不要出现完整教学链。角色可以先误判、说半句、被别人打断，再用一个具体细节推进。",
                "如果主角刚进入新环境、新身份、新阶段或新规则，必须保留生疏感：不要马上稳定输出专业报告；可以被催促、手忙脚乱、话说得不完整、先照着本能或旧经验做事。",
                "禁止使用破折号“——”。",
                ...buildNarrativeDictionRules(context),
                ...buildLongFormPlanRules(context.longFormPlan, context.taskCard.chapterNumber),
                "previousDraftTail 是上一章实际正文尾段；如果它与 taskCard.continuity、taskCard.endingHook 或 lastLedger 冲突，必须以 previousDraftTail 为准。",
                "continuityFacts 是前文已发生事实，优先级高于临场套话；如果其中显示两个人物已经见过、递过文书、问过话、审过同一案或知道对方身份，正文不得再写成初次相识、重新确认身份或完全陌生。",
                "如果 previousDraftTail 不为空，开头必须直接承接上一章尾段的最后状态，先写过渡桥段，再进入本章冲突。",
                "任务卡 continuity 里提到但上一章尾段没有出现的事件，必须在本章正文中现场写出来，不能用“刚才已经发生”一笔带过。",
                "允许章节功能轮换：不是每章都必须大战、打脸或升级；可以写机制试错、日常经营、关系铺垫、低强度压力和小收益，但必须服务核心承诺。",
                "正文必须围绕本章任务卡推进，不要写成大纲或总结。",
                "正文必须遵守任务卡 rulesNotToBreak 与创作圣经中的题材边界、主分类、作品标签和禁止偏离项；不得把故事写成另一个频道或另一个题材。",
                "正文里凡是发生人物关系、伏笔、主线推进、战力能力、资源收益、知情边界变化，必须让读者从动作、对话、结果和现场后果里看出来；不要用台账口吻解释“变化前后”。",
                "不要照搬拆书来源作品的人物、地点、事件、道具、专有设定或章末钩子。"
              ],
              outputSchema: {
                title: "string",
                titleAlternatives: "string[]",
                content: "string"
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0.48,
      maxTokens: estimateDraftMaxTokens(targetWordCount),
      timeoutMs: CHAPTER_DRAFT_TIMEOUT_MS
    });

    const title = String(response.title ?? "").trim();
    let content = String(response.content ?? "").trim();
    const usages = [getAiTokenUsage(response)];

    if (content.length < 200) {
      throw new Error("AI 返回正文过短，未保存为章节草稿");
    }

    if (
      isDraftTooShort(content, targetWordCount) ||
      isChapterDraftEndingIncomplete(content)
    ) {
      const expansion = await requestAiJson<{ content?: string }>({
        messages: [
          {
            role: "system",
            content:
              `你是网文正文续写助手。上一轮正文可能篇幅不足或结尾被截断。请只输出 JSON，把正文后半段续到完整阶段落点。不要重写开头，不要输出提纲、总结或分析。`
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                targetWordCount,
                minCharacters,
                currentCharacters: countDraftCharacters(content),
                currentContent: content,
                taskCard: context.taskCard,
                projectName: context.projectName,
                projectDescription: context.projectDescription,
                bible: context.bible,
                plotState: context.plotState,
                longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
                continuityFacts: (context.continuityFacts ?? []).slice(0, 14),
                continuationRules: [
                  "只续写正文后半段，不要重复已有内容。",
                  `续写后整章最高不得超过 ${maxCharacters} 字。`,
                  "continuityFacts 是前文已发生事实；续写不得把已经见过、已经知道对方身份或已经处理过同一事件的人物写成陌生人。",
                  "如果当前正文已经接近或超过最高字数，只补完整句和章末落点，不要继续展开新战斗、新设定或新对话。",
                  ...buildNarrativeDictionRules(context),
                  ...buildLongFormPlanRules(context.longFormPlan, context.taskCard.chapterNumber),
                  "如果 currentContent 最后一句明显没写完，必须从断句处自然续上，补完该句，再完成本章事件落点。",
                  "如果 currentContent 已经接近或超过最高字数，不要为了补完 taskCard.endingHook 强行展开；只补完整句和阶段性落点，把未完成任务留给下一章承接。",
                  "如果任务卡明确写“本章必须”落实心理适应、身体反应或现实回响，而已有正文完全没有体现，续写只补一处短促、具体的反应；如果只是阶段性提示，不要为了打卡强行补害怕、反胃或手抖。",
                  "续写时优先补推进，不要继续放大环境、赶路、躲藏、撤退、伤痛和呼吸动作；这些过程只保留会改变局面的细节。",
                  "重点补足场景推进、人物对话、压制过程、反击动作和爽点释放。",
                  "如果已有内容过早收尾，可以补一个更清楚的阶段性压力或未解决问题。",
                  "任务卡 endingHook 优先兑现；如果篇幅不够，允许不完整兑现，但不要把正文写成半截。",
                  "续写结尾必须以完整句子结束，不能停在逗号、顿号、破折号、连词或半句话。"
                ],
                outputSchema: {
                  content: "string"
                }
              },
              null,
              2
            )
          }
        ],
        temperature: 0.42,
        maxTokens: estimateDraftContinuationMaxTokens(targetWordCount, countDraftCharacters(content)),
        timeoutMs: CHAPTER_DRAFT_REVISION_TIMEOUT_MS
      });
      const extra = String(expansion.content ?? "").trim();

      if (extra.length >= 200) {
        content = `${content}\n\n${extra}`;
        usages.push(getAiTokenUsage(expansion));
      }
    }

    const polished = await polishGeneratedChapterDraftIfNeeded(content, context, targetWordCount);
    content = polished.content;
    usages.push(polished.usage);

    if (isDraftTooLong(content, targetWordCount)) {
      const compressed = await compressChapterDraftToTarget(content, context, targetWordCount);
      content = compressed.content;
      usages.push(compressed.usage);
    }

    if (isDraftTooLong(content, targetWordCount)) {
      content = prepareChapterDraftContentForFastSave(content, context, targetWordCount);
    }

    return attachAiTokenUsage({
      title: title || context.taskCard.title,
      titleAlternatives: compactTextList(response.titleAlternatives, 3, 24),
      content
    }, combineAiTokenUsages(usages));
  } catch (error) {
    throw error;
  }
}

export async function* streamChapterDraftTextWithAi(
  context: ChapterDraftContext,
  onUsage?: (usage: AiTokenUsage) => void
) {
  const targetWordCount = normalizeDraftTargetWordCount(context.targetWordCount);
  const maxCharacters = maximumDraftCharacters(targetWordCount);
  const draftTaskCard = buildDraftFacingTaskCard(context.taskCard);

  yield* requestAiTextStream({
    messages: [
      {
        role: "system",
        content:
          `你是网文正文生成助手。请直接输出连贯的中文小说正文，不要输出 JSON、提纲、列表或分析。必须严格遵守任务卡、创作圣经、人物已知信息和伏笔限制。正文目标约 ${targetWordCount} 个中文字，最高不得超过 ${maxCharacters} 字，不要为了凑字重复解释、复述设定或写分析腔。`
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            targetWordCount,
            maxCharacters,
            taskCard: draftTaskCard,
            projectName: context.projectName,
            projectDescription: context.projectDescription,
            bible: context.bible,
            plotState: context.plotState,
            longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
            lastLedger: context.lastLedger,
            continuityFacts: (context.continuityFacts ?? []).slice(0, 14),
            previousDraftTail: context.previousDraftTail,
            characters: context.characters,
            foreshadowings: context.foreshadowings,
            writingRules: [
              `正文目标约 ${targetWordCount} 字，最高不得超过 ${maxCharacters} 字；篇幅不足时扩写动作、对话、压制过程和爽点释放，不要水字数。`,
              `最高 ${maxCharacters} 字是硬上限，不是写作目标；正文应在接近 ${Math.round(targetWordCount * 1.08)}-${Math.round(targetWordCount * 1.18)} 字时主动收束，不要写到上限才想结尾。`,
              `必须在 ${maxCharacters} 字以内自然收束并写出章末落点，不要写到被系统长度限制截断。`,
              "如果篇幅不足以展开所有细节，优先保留本章目标、核心冲突、爽点释放和章末钩子，压缩铺垫和旁支描写。",
              "节奏经济：环境、进门、躲藏、赶路、伤痛、呼吸、手部动作等过程描写只保留会改变局面的细节；不能把一次撤退、跟踪或身体不适扩成整章主体。",
              "悬疑细节必须换来推进：每个细节要么形成证据、制造误判、逼出人物反应、推动对质或服务章末钩子；纯氛围和重复感受要压缩。",
              "时间与体力连续性必须可信：如果上一章刚经历夜探、奔逃、审讯、长时间查案、受伤或强刺激，本章要处理休息、饥饿、天色、换药、当值、等待或现实醒来缓冲；不能让主角像不需要睡觉一样连续转场。",
              "转场只写有效成本：可用一两句交代天亮、回住处、换班、吃点东西、短睡或现实醒来；不要把休息写成水文，但也不能完全没有。",
              "正文预算必须先保证本章有完整阶段落点：中段细节可以压缩；任务卡 endingHook 优先兑现，但如果目标字数内装不下，可以停在更早的有效压力点，留给下一章承接。",
              "如果目标字数偏短，只保留 3-5 个关键场面，最后 15%-25% 篇幅必须留给本章收束；不要为了兑现所有任务把正文硬撑长。",
              "任务卡 requiredCharacters 是硬要求：除“主角”这类泛称外，名单里的每个具体姓名都必须在正文中以原名实际出现，并有动作、对白、观察、质询、指认、阻拦或选择；不能只在任务卡或台账里出现。",
              "任务卡 foreshadowingTasks 是硬要求：凡是写了本章、必须、通过、回收、承接、处理、证据链、物件、染料、账本、指纹或供词的任务，都必须在正文场面里兑现；不能只写成概括结论。",
              "涉及回收伏笔时，必须让读者看到对应物件、痕迹、人物反应或对质过程；例如衣袖染料、指甲残留、账本、指纹、供词等，不能只让旁白说“线索被回收”。",
              "任务卡和长篇规划里的心理适应、身体反应、现实记忆回响是人物节奏提示，不是每章打卡项；只有任务卡明确写“本章必须”时才需要可见兑现，否则优先写当前场景推进，不要反复写害怕、反胃或手抖。",
              "开写前先把本章拆成 4-7 个可见场面，但不要把场面表输出；正文只能输出小说内容。",
              "本章必须有现场阻力：质疑、催促、证物将被处理、错误结论压过主角、有人遮掩或时间限制。不能写成主角一路顺畅观察和讲解。",
              "专业判断必须写成冲突里的动作：先有人误判或阻拦，再由主角抓住一个具体细节反击。每个专业点最多用一两句，不要连续教学。",
              "每 400 字内至少出现一次外部反应、误解、打断、风险升级或新信息，不要整段整段平铺叙事。",
              "第一遍正文就要避开机器腔：不要集中交代人物履历、学历、技能、世界观规则；每次最多露出一个必要信息，并让它从动作、物件、对话或现场压力里出现。",
              "禁止用旁白给读者做结论：少写“这意味着/说明/证明/显然/无疑/某种/仿佛”；要让人物看见、摸到、听到、被催促或被反驳。",
              "不要使用“深吸一口气、下意识、脑子里、瞳孔猛缩、瞳孔骤缩、瞳孔微缩、眸色一沉、心头一震、心头一紧、倒吸一口凉气”作为默认反应；写更具体的手、眼、步子、语气、物件变化或直接删掉。",
              "如果任务卡涉及任何专业能力、行业知识、技能体系或复杂规则，本章只能写一两个场景内判断，不要解释原理，不要列举知识点，不要出现完整教学链。角色可以先误判、说半句、被别人打断，再用一个具体细节推进。",
              "如果主角刚进入新环境、新身份、新阶段或新规则，必须保留生疏感：不要马上稳定输出专业报告；可以被催促、手忙脚乱、话说得不完整、先照着本能或旧经验做事。",
              "禁止使用破折号“——”。",
              ...buildNarrativeDictionRules(context),
              ...buildLongFormPlanRules(context.longFormPlan, context.taskCard.chapterNumber),
              "continuityFacts 是前文已发生事实，优先级高于临场套话；如果其中显示两个人物已经见过、递过文书、问过话、审过同一案或知道对方身份，正文不得再写成初次相识、重新确认身份或完全陌生。",
              "previousDraftTail 是上一章实际正文尾段；如果它与 taskCard.continuity、taskCard.endingHook 或 lastLedger 冲突，必须以 previousDraftTail 为准。",
              "如果 previousDraftTail 不为空，开头必须直接承接上一章尾段的最后状态，先写过渡桥段，再进入本章冲突。",
              "任务卡 continuity 里提到但上一章尾段没有出现的事件，必须在本章正文中现场写出来，不能用“刚才已经发生”一笔带过。",
              "先承接上一章真实正文落点，再推进本章目标。",
              "允许章节功能轮换：不是每章都必须大战、打脸或升级；可以写机制试错、日常经营、关系铺垫、低强度压力和小收益，但必须服务核心承诺。",
              "必须遵守任务卡 rulesNotToBreak 与创作圣经中的题材边界、主分类、作品标签和禁止偏离项；不得把故事写成另一个频道或另一个题材。",
              "爽点必须有压制和释放，不要空泛总结。",
              "人物不能知道自己不知道的信息。",
              "正文里凡是发生人物关系、伏笔、主线推进、战力能力、资源收益、知情边界变化，必须让读者从动作、对话、结果和现场后果里看出来；不要用台账口吻解释“变化前后”。",
              "结尾必须留下可承接的阶段性压力；任务卡章末钩子优先兑现，但不要为了它超长展开。"
            ]
          },
          null,
          2
        )
      }
    ],
    temperature: 0.48,
    maxTokens: estimateDraftStreamMaxTokens(targetWordCount),
    timeoutMs: CHAPTER_DRAFT_TIMEOUT_MS,
    allowLengthFinish: true,
    onUsage
  });
}

export async function* streamChapterDraftExpansionTextWithAi(
  context: ChapterDraftContext,
  currentContent: string,
  onUsage?: (usage: AiTokenUsage) => void
) {
  const targetWordCount = normalizeDraftTargetWordCount(context.targetWordCount);
  const currentCharacters = countDraftCharacters(currentContent);
  const minCharacters = minimumDraftExpansionCharacters(targetWordCount);
  const maxCharacters = maximumDraftCharacters(targetWordCount);

  yield* requestAiTextStream({
    messages: [
      {
        role: "system",
        content:
          `你是网文正文续写助手。上一轮正文当前 ${currentCharacters} 字，最低参考 ${minCharacters} 字，最高参考 ${maxCharacters} 字。请直接输出续写正文，不要重写开头，不要输出提纲、总结或分析。目标是把整章补足到接近 ${targetWordCount} 字，并写出完整章末落点。`
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            targetWordCount,
            minCharacters,
            maxCharacters,
            currentCharacters,
            currentContent,
            taskCard: context.taskCard,
            projectName: context.projectName,
            projectDescription: context.projectDescription,
            bible: context.bible,
            plotState: context.plotState,
            longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
            continuityFacts: (context.continuityFacts ?? []).slice(0, 14),
            characters: context.characters,
            foreshadowings: context.foreshadowings,
            continuationRules: [
              "只续写正文后半段，不要重复已有内容。",
              `续写后整章最高不得超过 ${maxCharacters} 字。`,
              "continuityFacts 是前文已发生事实；续写不得把已经见过、已经知道对方身份或已经处理过同一事件的人物写成陌生人。",
              "如果当前正文已经接近或超过最高字数，只补完整句和章末落点，不要继续展开新战斗、新设定或新对话。",
              "续写也不能补成说明书：不要集中补人物履历、专业知识或世界观规则；只补场面推进、动作、对白和结尾落点。",
              "禁止使用破折号“——”和模板动作“深吸一口气、下意识、脑子里、瞳孔猛缩、瞳孔骤缩、瞳孔微缩、眸色一沉、心头一震、心头一紧、倒吸一口凉气”。",
              ...buildNarrativeDictionRules(context),
              ...buildLongFormPlanRules(context.longFormPlan, context.taskCard.chapterNumber),
              "续写也必须遵守任务卡 rulesNotToBreak 与创作圣经中的题材边界、主分类、作品标签和禁止偏离项；不得补写成另一个频道或另一个题材。",
              "如果 currentContent 最后一句明显没写完，必须从断句处自然续上，补完该句，再完成本章事件落点。",
              "如果 currentContent 已经接近或超过最高字数，不要为了补完 taskCard.endingHook 强行展开；只补完整句和阶段性落点，把未完成任务留给下一章承接。",
              "如果任务卡明确写“本章必须”落实心理适应、身体反应或现实回响，而已有正文完全没有体现，续写只补一处短促、具体的反应；如果只是阶段性提示，不要为了打卡强行补害怕、反胃或手抖。",
              "如果 currentContent 缺少 taskCard.requiredCharacters 中的具体姓名，续写必须让缺失人物以原名出场并产生有效动作、对白、观察、质询、指认、阻拦或选择。",
              "如果 currentContent 缺少 taskCard.foreshadowingTasks 中的本章回收/处理任务，续写必须补出对应物件、痕迹、人物反应或对质过程；不要只写概括结论。",
              "重点补足场景推进、人物对话、压制过程、反击动作和爽点释放。",
              "如果已有内容过早收尾，可以补一个更清楚的阶段性压力或未解决问题。",
              "任务卡 endingHook 优先兑现；如果篇幅不够，允许不完整兑现，但不要把正文写成半截。",
              "续写结尾必须以完整句子结束，不能停在逗号、顿号、破折号、连词或半句话。"
            ]
          },
          null,
          2
        )
      }
    ],
    temperature: 0.42,
    maxTokens: estimateDraftContinuationMaxTokens(targetWordCount, currentCharacters),
    timeoutMs: CHAPTER_DRAFT_REVISION_TIMEOUT_MS,
    onUsage
  });
}

export async function* streamChapterDraftClosingTextWithAi(
  context: ChapterDraftContext,
  currentContent: string,
  onUsage?: (usage: AiTokenUsage) => void
) {
  const targetWordCount = normalizeDraftTargetWordCount(context.targetWordCount);
  const currentCharacters = countDraftCharacters(currentContent);
  const tail = currentContent.slice(-700);

  yield* requestAiTextStream({
    messages: [
      {
        role: "system",
        content:
          "你是网文正文补尾助手。正文被输出长度限制截断了。请只补完最后半句话或最后一小段，让正文以完整句子结束；不要重写前文，不要继续展开新剧情，不要输出分析或说明。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            targetWordCount,
            currentCharacters,
            tail,
            taskCard: context.taskCard,
            closingRules: [
              "只补 1-3 句，优先补完当前断句。",
              "如果可以，把章末钩子自然收住；不能完整展开也不要开新事件。",
              "必须以句号、问号、叹号、右引号或省略号结束。",
              "不要重复 tail 里的原文。"
            ]
          },
          null,
          2
        )
      }
    ],
    temperature: 0.28,
    maxTokens: estimateDraftClosingMaxTokens(),
    timeoutMs: CHAPTER_DRAFT_REVISION_TIMEOUT_MS,
    onUsage
  });
}

export async function repairChapterDraftAgainstTaskCardWithAi(
  context: ChapterDraftContext,
  content: string,
  repairIssues: string[],
  targetWordCount?: number
): Promise<DraftPolishResult> {
  const normalizedTargetWordCount = normalizeDraftTargetWordCount(targetWordCount ?? context.targetWordCount);
  const maxCharacters = maximumDraftCharacters(normalizedTargetWordCount);
  const response = await requestAiJson<{ content?: string }>({
    messages: [
      {
        role: "system",
        content:
          "你是长篇网文正文硬任务修复编辑。请严格输出 JSON。你的任务不是润色，而是修复正文没有执行任务卡硬要求的问题。必须保留原章主要顺序和已写成的有效内容，但要改掉会导致审稿高风险的缺口。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            targetWordCount: normalizedTargetWordCount,
            maxCharacters,
            repairIssues,
            currentContent: content,
            taskCard: context.taskCard,
            projectName: context.projectName,
            projectDescription: context.projectDescription,
            bible: context.bible,
            plotState: context.plotState,
            longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
            lastLedger: context.lastLedger,
            continuityFacts: (context.continuityFacts ?? []).slice(0, 14),
            characters: context.characters,
            foreshadowings: context.foreshadowings,
            repairRules: [
              "必出人物必须在正文中以任务卡给出的姓名实际出现，并发生有效动作、对白、观察、质询、指认、阻拦或选择；不能只在台账式旁白里提一下。",
              "伏笔任务如果要求回收物件、染料、账本、指纹、供词、旧线索或人物身上痕迹，正文必须让读者看到对应物件/痕迹/对质过程，不能只写成结论。",
              "如果正文处于阶段收束模式，必须把新线索降级为案后钩子或背景压力，优先合并既有证据、人物供词和前文线索，推进对质、定责、回收、返回或阶段性结案。",
              "修复时不要新增另一个更大的新案、新地点、新组织、新嫌疑人或多章调查链。",
              "修复可以压缩或删除原文中拖慢节奏、继续扩案的段落，把篇幅让给任务卡硬要求。",
              "保持小说正文形态，不要输出提纲、任务卡、审稿说明或项目符号。",
              "禁止使用破折号“——”。",
              ...buildNarrativeDictionRules(context),
              ...buildLongFormPlanRules(context.longFormPlan, context.taskCard.chapterNumber),
              `最终正文最高不得超过 ${maxCharacters} 字；如果篇幅不够，优先执行 repairIssues 和本章阶段落点。`
            ],
            outputSchema: {
              content: "string"
            }
          },
          null,
          2
        )
      }
    ],
    temperature: 0.22,
    maxTokens: estimateDraftMaxTokens(normalizedTargetWordCount),
    timeoutMs: CHAPTER_DRAFT_REVISION_TIMEOUT_MS
  });
  const repairedContent = String(response.content ?? "").trim();

  if (repairedContent.length < 200) {
    return { content, changed: false, usage: getAiTokenUsage(response) };
  }

  return {
    content: repairedContent,
    changed: repairedContent !== content,
    usage: getAiTokenUsage(response)
  };
}

export async function extractChapterStateUpdateWithAi(context: ChapterStateUpdateContext) {
  const mechanismIntegrityRules = buildMechanismIntegrityRules({
    chapterNumber: context.draft.chapterNumber,
    bible: context.bible,
    plotState: context.plotState
  });
  const longFormPlanRules = buildLongFormPlanRules(context.longFormPlan, context.draft.chapterNumber);
  const response = await requestAiJson<Partial<ChapterStateUpdateResult>>({
    messages: [
      {
        role: "system",
        content:
          "你是长篇网文项目状态管理员。请严格输出 JSON。你的任务是读完本章正文后，提取会影响后续创作和关系图谱的结构化状态更新。必须基于正文和任务卡，不要编造正文没有发生的关系、地点、伏笔或战力变化。输出要具体，避免空话。人物关系、地图势力、伏笔挂载和战力资源变化会直接进入图谱，所以要写成可连接的实体关系。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            draft: {
              chapterNumber: context.draft.chapterNumber,
              title: context.draft.title,
              content: context.draft.content
            },
            taskCard: context.taskCard,
            bible: context.bible,
            plotState: context.plotState,
            longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
            lastLedger: context.lastLedger,
            existingCharacters: context.characters.map((character) => ({
              name: character.name,
              identity: character.identity,
              relationshipToProtagonist: character.relationshipToProtagonist,
              knownInformation: character.knownInformation,
              unknownInformation: character.unknownInformation,
              currentState: character.currentState,
              lastAppearance: character.lastAppearance
            })),
            existingForeshadowings: context.foreshadowings.map((item) => ({
              name: item.name,
              status: item.status,
              relatedCharacters: item.relatedCharacters,
              relatedLocation: item.relatedLocation,
              hiddenInformation: item.hiddenInformation
            })),
            graphExtractionPlan: {
              characterRelationGraph:
                "由 characterUpdates 与 relationshipChanges 生成。必须只记录真实出场人物、真实关系推进、态度变化和立场变化。",
              mapForceGraph:
                "由 mapAndForceUpdates 与 foreshadowingUpdates.relatedLocation 生成。只记录顶层地点/势力/组织，不记录房间、前厅、后山、枯井等内部场景。没有明确地点或势力变化时必须返回空数组，不要硬凑。",
              foreshadowingGraph:
                "由 foreshadowingUpdates 与 newClues 生成。必须写清伏笔名称、状态、关联人物、关联地点、隐藏信息、预计回收方式。",
              plotProgressGraph:
                "由 stateChanges、events、cliffhanger 生成。必须写清本章推进了哪条主线或支线、留下了什么下一步压力。",
              powerGraph:
                "由 powerSystemUpdates 与 characterUpdates.abilityBoundary 生成。必须写清境界/战力/能力边界/金手指变化、限制、代价和不能突破的边界。没有明确战力系统或能力变化时必须返回空数组，不要把动作句写进去。",
              resourceGraph:
                "由 resourceUpdates、payoff、newClues 生成。必须写清主角获得或失去的资源、功法、道具、线索、权限或收益。没有明确资源变化时必须返回空数组，不要把情绪回报或普通剧情推进当资源。",
              knowledgeGraph:
                "由 characterUpdates.knownInformation、unknownInformation、secret 生成。必须写清每个重要人物本章后知道什么、不知道什么、误判什么、隐藏什么。",
              causalityGraph:
                "由 events、payoff、cliffhanger 生成。events 写原因和行动，payoff 写结果收益，cliffhanger 写下一章承接压力。"
            },
            extractionRules: [
              "events 只写本章真实发生的关键事件，3-6 条。",
              "events 必须服务章节因果网：每条尽量包含触发原因、人物行动和直接结果，不要只写氛围。",
              "提取状态时必须以现有 plotState.mainGoal、shortTermGoal、currentStage 和任务卡为参照；不要因为本章出现新地图、新组织或新危机，就自动把它升级为新的长期主线。",
              "如果任务卡或长篇规划显示本章处于收束、结案、回收或返回阶段，newClues 只能记录能服务当前收束的关键证据；案后暗线只能写进 cliffhanger 或 foreshadowingUpdates，不得把它扩成 plotState 的新主线或下一章必须深挖的任务。",
              "伏笔更新要区分“案内证据”和“案后钩子”：案内证据用于对质、定责、结案；案后钩子只保留为未回收伏笔，不能自动生成新地点、新嫌疑人、新旧案调查链。",
              ...mechanismIntegrityRules,
              ...longFormPlanRules,
              "角色对外撒谎、遮掩、误导、猜测或临时编造的说法，不能当成真实设定入库；必须标注为“某角色对外宣称/误导信息”，真实状态以旁白、系统提示和已发生事件为准。",
              "newCharacters 只写本章首次出现或第一次进入重要剧情的人物姓名，不要把“主角”“众人”“敌人”当人物名。",
              "characterUpdates 必须覆盖本章出场的重要人物，记录他们本章后的当前状态、已知信息、未知信息、秘密、能力边界、与主角关系或态度变化。",
              "relationshipChanges 只记录关系真的变化、立场变化或被明确加深的内容，必须写出双方姓名，格式建议：第N章：A 与 B 因某事件关系变化为……",
              "mapAndForceUpdates 只记录顶层地点、势力、组织、阵营、地图推进相关变化，必须写出地点或势力名称；不要把前厅、后山、枯井、房间、院落等内部场景单独写成地图/势力节点，内部场景只放在 events 或 foreshadowingUpdates.relatedLocation 中。",
              "stateChanges 必须覆盖主线/支线推进网：写清本章推进了哪条主线或支线、当前阶段发生了什么变化、下一步压力是什么；如果只是临时支线，要标明它服务哪条既有主线，不要改写主线目标。",
              "powerSystemUpdates 只记录战力、能力边界、金手指、限制、代价变化，必须写清变化前后、收益来源、触发条件、新增限制、代价或能力边界；如果本章没有这类变化就返回空数组。",
              "resourceUpdates 只记录资源/收益网：功法、丹药、装备、线索、证据、名额、权限、财富、声望等获得/失去/消耗，必须写清来源和是否符合关键机制；如果本章没有这类变化就返回空数组。",
              "foreshadowingUpdates 记录新埋伏笔、部分回收、已回收伏笔，并写清 relatedCharacters、relatedLocation、hiddenInformation 或 revealMethod。",
              "knownInformation 和 unknownInformation 是知情/秘密网核心字段：不能空泛写“待补充”，必须根据正文写人物本章后明确知道/不知道的信息；没有变化时沿用已有边界。",
              "cliffhanger 必须提取章末钩子；没有明显钩子时写最后留下的未解决压力。",
              "所有内容都要能直接用于下一章任务卡和八类关系图谱：人物、地图势力、伏笔、主线、战力、资源、知情、章节因果。"
            ],
            outputSchema: {
              events: "string[]",
              newCharacters: "string[]",
              newClues: "string[]",
              payoff: "string",
              cliffhanger: "string",
              stateChanges: "string[]",
              characterUpdates: [
                {
                  name: "string",
                  identity: "string",
                  currentGoal: "string",
                  longTermGoal: "string",
                  secret: "string",
                  relationshipToProtagonist: "string",
                  attitude: "string",
                  abilityBoundary: "string",
                  voice: "string",
                  knownInformation: "string",
                  unknownInformation: "string",
                  lastAppearance: "string",
                  currentState: "string"
                }
              ],
              foreshadowingUpdates: [
                {
                  name: "string",
                  status: "open | partial | closed",
                  relatedCharacters: "string[]",
                  relatedLocation: "string",
                  expectedRevealChapter: "string",
                  revealMethod: "string",
                  hiddenInformation: "string"
                }
              ],
              relationshipChanges: "string[]",
              mapAndForceUpdates: "string[]",
              powerSystemUpdates: "string[]",
              resourceUpdates: "string[]"
            }
          },
          null,
          2
        )
      }
    ],
    temperature: 0.18,
    maxTokens: 2600
  });

  return attachAiTokenUsage({
    events: asTextList(response.events).slice(0, 8),
    newCharacters: asTextList(response.newCharacters).slice(0, 8),
    newClues: asTextList(response.newClues).slice(0, 10),
    payoff: String(response.payoff ?? "").trim(),
    cliffhanger: String(response.cliffhanger ?? "").trim(),
    stateChanges: asTextList(response.stateChanges).slice(0, 12),
    characterUpdates: asCharacterUpdates(response.characterUpdates).slice(0, 12),
    foreshadowingUpdates: asForeshadowingUpdates(response.foreshadowingUpdates).slice(0, 12),
    relationshipChanges: asTextList(response.relationshipChanges).slice(0, 10),
    mapAndForceUpdates: asTextList(response.mapAndForceUpdates).slice(0, 10),
    powerSystemUpdates: asTextList(response.powerSystemUpdates).slice(0, 10),
    resourceUpdates: asTextList(response.resourceUpdates).slice(0, 10)
  }, getAiTokenUsage(response));
}

export async function reviewChapterDraftWithAi(context: ReviewContext) {
  try {
    const familyNameRules = buildFamilyNameConsistencyRules(context.characters);
    const addressFormRules = buildAddressFormRules({
      projectDescription: context.projectDescription,
      bible: context.bible,
      plotState: context.plotState,
      taskCard: context.taskCard
    });
    const premiseAnchorRules = buildPremiseAnchorRules({
      projectName: context.projectName,
      projectDescription: context.projectDescription,
      bible: context.bible,
      plotState: context.plotState
    });
    const mechanismIntegrityRules = buildMechanismIntegrityRules({
      chapterNumber: context.draft.chapterNumber,
      projectName: context.projectName,
      projectDescription: context.projectDescription,
      bible: context.bible,
      plotState: context.plotState
    });
    const protagonistEmbodimentRules = buildProtagonistEmbodimentRules({
      chapterNumber: context.draft.chapterNumber,
      projectDescription: context.projectDescription,
      bible: context.bible,
      plotState: context.plotState
    });
    const longFormPlanRules = buildLongFormPlanRules(context.longFormPlan, context.draft.chapterNumber);
    const response = await requestAiJson<Partial<StoredReviewReport> & { issues?: unknown }>({
      messages: [
        {
          role: "system",
          content:
            "你是网文一致性审稿器。请严格输出 JSON。你要检查章节是否违背创作圣经、人物知道了不该知道的信息、是否忘记上一章钩子、是否推进主线，以及是否有明显 AI 味。AI 味检测是硬要求，不是可选项；如果正文存在长段落、抽象总结、书面腔、模板式转折、情绪空泛或句子过于平均，必须明确写进 issues，不能只抓章末钩子。"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              draft: context.draft,
              taskCard: context.taskCard,
              projectDescription: context.projectDescription,
              bible: context.bible,
              plotState: context.plotState,
              longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
              lastLedger: context.lastLedger,
              currentLedger: context.currentLedger,
              characters: context.characters,
              foreshadowings: context.foreshadowings,
              reviewRules: [
                "必须检查正文是否偏离创作圣经中的目标读者、作品类型、主分类、题材边界、作品标签和禁止偏离项。",
                ...familyNameRules,
                ...addressFormRules,
                "必须检查称谓是否符合当前身份和场景：官府、县衙、江湖、宗门、内宅、商铺、市井等场景的称呼不能混用；也不能把所有人对同一角色的称呼强行统一成一个词。",
                "必须检查人物亲属关系与姓氏是否一致：同一家族、同一府邸、宗族内的嫡姐、庶姐、兄弟、父女等亲属默认同姓；若正文写成不同姓且未解释为表亲、继亲、养女或外姓寄居，必须作为 high severity 的人物关系错误指出。",
                ...protagonistEmbodimentRules,
                ...premiseAnchorRules,
                ...mechanismIntegrityRules,
                ...longFormPlanRules,
                "必须检查正文是否只是在延续上一章支线，却没有让本章目标、收益、冲突或章末钩子回到核心承诺；如果是，应标为 high severity 的“主线偏移风险”。",
                "如果长篇规划、任务卡或不可违反规则显示本章应收束、结案、回收或返回，但正文继续新增旧案、新地点、新物证、新组织、新嫌疑人或多章调查链，应标为 high severity 的“阶段收束失控”。",
                "伏笔可以保留为案后钩子，但不能在收束章被正文继续深挖成新主线；审稿建议应要求降级为一两句压力点，或滚入后续案外暗线，而不是让本章继续查。",
                "审稿口径不是要求一章完成整张任务卡；如果正文已经完成一个合理阶段落点，并且未完成任务可以通过章节台账里的“滚入下一章的未完成任务”承接到后续章节，不要标为任务未完成。",
                "开局任务蓝图是开局任务队列和节奏参考，不是严格章节编号；如果上一章任务拆成多章完成，不要仅因第N章没有执行蓝图第N条就判定跑偏。但如果蓝图中明确写了当前章节号和“必须”要求，应检查任务卡和正文是否落实或正确承接。",
                "如果正文没有完成任务卡全部内容，应判断是否留下清楚阶段性压力、未解决线索或下一步动作；只有既没阶段落点、又没有可承接方向时，才标为中高风险。",
                "必须逐项核验本章收益：收益是什么、来源是什么、触发条件是什么、是否符合关键机制、是否造成阶段越级；如果来源偷换或越级过快，应标为 high severity 的“关键机制失真”。",
                "如果正文保留了关键机制的名词，但实际让主角靠另一套资源、奇遇、外力或副本收益完成核心成长，应指出这是机制偷换，并建议改成符合关键机制的小收益、线索或外部诱因。",
                "如果角色为了遮掩真相对外编造收益来源，正文必须明确这是借口或误导，不能让读者或项目台账误以为真实成长来源已经变成另一套机制。",
                "不要按固定题材关键词审稿；判断标准是桥段功能是否服务项目简介、核心爽点、关键机制和当前主线目标。",
                "如果正文把故事写成另一个频道、另一个题材，或无视主题/角色标签，应作为 high severity 问题指出。",
                "不要把已经进入当前章节台账、主线状态、资源状态、地图势力、人物档案或伏笔表的信息标为“未入库”；只有长期复用的信息完全没有被记录时，才提醒用户确认补充。",
                "一次性岗位、临时地点、普通道具、普通交易或过场公司名称，不要默认要求用户手动同步；除非它会成为长期势力、长期规则、关键资源来源或主线线索。",
                "如果任务卡 rulesNotToBreak 与正文冲突，应指出冲突位置和改法。",
                "AI 味要单独检查：长段落、抽象总结、书面腔、模板式推进、过度解释、句式平均、缺少具体动作和对话，都要明确指出。",
                "如果正文存在明显 AI 味，即使章末钩子也有问题，也不能只报钩子；AI 味问题必须单独列出。",
                "issues[].type 必须是中文短标签，例如：规则违反、AI 味、主线偏移风险、人物行为风险、章末钩子弱化、设定一致性问题；禁止输出 rule violation、consistency issue、style issue 等英文类型。",
                "problem、location、suggestion、overall 和 stateUpdateSuggestions 都是给用户看的中文文案，不要写 characters、characterProfiles、taskCard、chapterGoal、mainPlotProgress、pleasurePoint、endingHook、foreshadowingTasks、rulesNotToBreak、carryOverTasks、plotState、bible、longFormPlan、ledger、chapterLedger、currentLedger、lastLedger、draft、chapterDraft、currentDraft、previousDraftTail、latestDraftActualEnding、cliffhanger、payoff、style、stateUpdateSuggestions、shouldUpdateState 等内部字段名；请改写成人物档案、章节任务卡、本章目标、主线推进、爽点回报、章末钩子、伏笔任务、不可违反设定、滚入下一章的未完成任务、主线状态、创作圣经、长篇规划、章节台账、当前章节台账、上一章台账、正文草稿、上一章正文结尾、上一章真实结尾、风格、状态同步建议。",
                "problem、location、suggestion、overall 和 stateUpdateSuggestions 都不要使用破折号“——”或“—”；需要停顿时用逗号、句号、冒号或直接换句。",
                "如果正文结尾已经留下追问、质疑、异常发现、阻拦或身份暴露风险等可承接压力，不要因为任务卡章末钩子没有完整兑现而标记“章末钩子弱化”；未写完的任务可以留给下一章。",
                "审稿建议不得把任务卡章末钩子整段追加到正文里；如果确实需要加强结尾，只能建议补一两句短压力点或提示人工处理。",
                "不要把人物档案、章节台账或代词推断说成“创作圣经明确规定”。只有 bible 字段原文直接写明的内容，才能称为创作圣经设定；人物姓名、身份、代词、已知/未知信息应称为人物档案或正文证据。",
                "每条 issue 必须可执行：location 必须逐字摘录正文中真实存在的原句或原段，不允许概括、改写、仿写或拼接正文；如果无法逐字摘录，只能写“全文/相关段落”，并在 problem 里说明需人工定位。",
                "suggestion 里的“原句”也必须逐字来自正文草稿；不能为了说明问题而编一个类似原句。如果无法提供真实原句，必须写“需手动处理：……”并说明处理方向。",
                "自动替换建议必须写成“将‘正文真实原句’改为‘改句’”或“在‘正文真实原句’后补入‘补写内容’”。",
                "如果 suggestion 使用“将原句改为改句”，改句必须是可以直接放回正文的完整句子或完整段落，不能只给半句话、摘要、修改方向或省略上下文；否则请明确写“需手动处理：……”并说明处理方向。",
                "如果确实无法给出原句替换，也要在 problem 里说明为什么无法自动替换，并给出人工修改方向。"
              ],
              outputSchema: {
                overall: "string",
                shouldUpdateState: "boolean",
                stateUpdateSuggestions: "string[]",
                issues: [
                  {
                    type: "string",
                    location: "string",
                    severity: "low | medium | high",
                    problem: "string",
                    suggestion: "string"
                  }
                ]
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0.2,
      maxTokens: 1600
    });

    const issues = [...asReviewIssues(response.issues), ...detectAiFlavorIssues(context.draft.content)];

    return attachAiTokenUsage({
      overall: String(response.overall ?? "").trim(),
      shouldUpdateState: Boolean(response.shouldUpdateState),
      stateUpdateSuggestions: asTextList(response.stateUpdateSuggestions),
      issues
    }, getAiTokenUsage(response));
  } catch {
    return null;
  }
}

export async function editDraftTextWithAi(context: EditContext) {
  const minCharacters = minimumEditedCharacters(context.originalText, context.mode);
  const profile = buildSecondDraftProfile(context.mode, minCharacters);
  const response = await requestAiJson<{
    aiFlavorSentences?: unknown;
    diagnosis?: unknown;
    revisedText?: string;
  }>({
    messages: [
      {
        role: "system",
        content: profile.system
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            mode: context.mode,
            editingLevel: profile.editingLevel,
            originalText: context.originalText,
            originalCharacters: countDraftCharacters(context.originalText),
            minimumRevisedCharacters: minCharacters,
            editPolicy: profile.policy,
            editingRules: profile.rules,
            outputSchema: {
              aiFlavorSentences: "string[]",
              diagnosis: "string[]",
              revisedText: "string"
            }
          },
          null,
          2
        )
      }
    ],
    temperature: profile.temperature,
    maxTokens: estimateEditMaxTokens(context.originalText)
  });

  const revisedText = normalizeEditedDraftText(String(response.revisedText ?? ""));

  if (revisedText.length < 10) {
    throw new Error("AI 没有返回有效二稿内容");
  }

  assertEditedTextComplete(context.originalText, revisedText, context.mode);

  return attachAiTokenUsage({
    aiFlavorSentences: asTextList(response.aiFlavorSentences),
    diagnosis: asTextList(response.diagnosis),
    revisedText
  }, getAiTokenUsage(response));
}

export async function* streamEditDraftTextWithAi(
  context: EditContext,
  onUsage?: (usage: AiTokenUsage) => void
) {
  const minCharacters = minimumEditedCharacters(context.originalText, context.mode);
  const profile = buildSecondDraftProfile(context.mode, minCharacters);

  yield* requestAiTextStream({
    messages: [
      {
        role: "system",
        content: profile.system.replace("请严格输出 JSON。", "请直接输出处理后的正文，不要输出 JSON、分析标题、项目符号或改稿说明。")
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            mode: context.mode,
            editingLevel: profile.editingLevel,
            originalText: context.originalText,
            originalCharacters: countDraftCharacters(context.originalText),
            minimumRevisedCharacters: minCharacters,
            editPolicy: {
              ...profile.policy,
              output: "直接输出二稿正文。"
            },
            editingRules: profile.rules
          },
          null,
          2
        )
      }
    ],
    temperature: profile.temperature,
    maxTokens: estimateEditMaxTokens(context.originalText),
    onUsage
  });
}
