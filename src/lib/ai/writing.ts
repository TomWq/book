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
  characters: StoredCharacterProfile[];
  chapterCharacterConstraints?: string[];
  foreshadowings: StoredForeshadowing[];
  storyAnalysis?: StoredStoryAnalysis | null;
  recentChapterAnalyses?: StoredChapterAnalysis[];
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
  previousDraftTail?: string;
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

function buildLongFormPlanSummary(plan?: StoredLongFormPlan | null) {
  if (!plan) {
    return null;
  }

  return {
    targetTotalWords: plan.targetTotalWords,
    estimatedChapters: plan.estimatedChapters,
    planningBasis: plan.planningBasis,
    corePromise: plan.corePromise,
    volumePlan: plan.volumePlan,
    progressionPacing: plan.progressionPacing,
    rewardPacing: plan.rewardPacing,
    first10Chapters: plan.first10Chapters,
    first100Pacing: plan.first100Pacing,
    post100Pacing: plan.post100Pacing,
    progressionRules: plan.progressionRules
  };
}

function buildLongFormPlanRules(plan?: StoredLongFormPlan | null, chapterNumber?: number) {
  if (!plan) {
    return [
      "当前项目尚未生成长篇规划。任务卡应保持保守节奏：先稳住核心承诺、关键机制和当前阶段目标，避免连续开新地图或大阶段跃迁。"
    ];
  }

  const first10Rule =
    chapterNumber && chapterNumber <= 10 && plan.first10Chapters.length > 0
      ? `当前是第 ${chapterNumber} 章，必须优先对齐长篇规划的前10章功能：${plan.first10Chapters.join("；")}`
      : "";

  return [
    `长篇规划基准：目标约 ${plan.targetTotalWords} 字，预计 ${plan.estimatedChapters} 章；核心承诺：${plan.corePromise || plan.planningBasis}`,
    first10Rule,
    chapterNumber && chapterNumber > 100
      ? plan.post100Pacing
        ? `100章后收束节奏参考：${plan.post100Pacing}`
        : plan.first100Pacing
          ? `前100章后的章节仍需承接全书卷纲；已有前100章参考：${plan.first100Pacing}`
          : ""
      : plan.first100Pacing
        ? `前100章节奏参考：${plan.first100Pacing}`
        : "",
    plan.post100Pacing && (!chapterNumber || chapterNumber <= 100)
      ? `100章后规划只作为远期边界，不要提前兑现：${plan.post100Pacing}`
      : "",
    plan.progressionPacing.length
      ? `成长/境界/资源节奏上限：${plan.progressionPacing.join("；")}`
      : "",
    plan.rewardPacing.length ? `收益释放频率：${plan.rewardPacing.join("；")}` : "",
    ...plan.progressionRules,
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

export async function generateLongFormPlanWithAi(context: LongFormPlanContext) {
  const planningGuardRules = buildLongFormPlanningGuardRules(context);
  const response = await requestAiJson<
    Partial<
      Pick<
        StoredLongFormPlan,
        | "planningBasis"
        | "corePromise"
        | "volumePlan"
        | "progressionPacing"
        | "rewardPacing"
        | "first10Chapters"
        | "first100Pacing"
        | "post100Pacing"
        | "progressionRules"
      >
    >
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
            projectName: context.projectName,
            projectDescription: context.projectDescription,
            targetTotalWords: context.targetTotalWords,
            estimatedChapters: context.estimatedChapters,
            bible: context.bible,
            plotState: context.plotState,
            characters: context.characters.slice(0, 8),
            foreshadowings: context.foreshadowings.slice(0, 10),
            storyReference: buildStoryReference(context.storyAnalysis),
            planningRules: [
              "先提炼本书的核心承诺：主角靠什么获得成长、读者期待反复看到什么、主线最终要兑现什么。",
              "如果 projectDescription 或 bible 中列出了等级、阈值、奖励、职位、地图、势力、关系、权限、目标清单，必须先判断它是长期规则表、阶段目标表还是当前章节任务；默认按长期规则表处理，不能直接变成第一卷进度。",
              "如果作品存在任何成长阶梯，必须把“当前阶段允许提升什么、不允许越过什么、什么情况允许例外”写进 progressionPacing。",
              "volumePlan 必须体现“长期阶梯分配”：第一卷只建立核心循环和前段成长，后续卷逐步消耗中段、高段、终局档位；除非用户明确要求快节奏，不要第一卷吃完多个核心档位。",
              "按目标总字数和预计章节数规划：每卷/阶段要有开始目标、阶段压力、阶段回报、阶段收束，不要只列地图名。",
              "前 10 章主要负责建立主角处境、关键机制、第一轮小收益、第一阶段压力和读者期待；不要连续大突破，不要过早开大型副本替代核心承诺。",
              ...planningGuardRules,
              "前 100 章需要有清晰的节奏表：哪些章节段落做机制验证、小爽点、中爽点、大爽点、地图/势力升级、伏笔埋设与回收。",
              "100章后也必须规划：写清后期阶段如何升级、如何收束支线、如何回收伏笔、如何逼近终局；不能只规划前100章。",
              "rewardPacing 必须写清小收益、中收益、大收益的大致频率；收益可以是能力、境界、金钱、资源、地位、情报、关系或权限。",
              "progressionRules 必须写成后续任务卡能直接执行的硬约束，例如：第几章前只允许小台阶，第几章左右才允许大阶段，越级必须有成本和后果。",
              "不要照搬拆书来源作品的人物、地点、专有设定、具体桥段；拆书只能作为商业节奏参考。"
            ],
            outputSchema: {
              planningBasis: "string：为什么按这个篇幅和节奏规划",
              corePromise: "string：本书核心承诺和长期爽点循环",
              volumePlan: "string[]：每项包含卷/阶段、章节范围、阶段目标、阶段回报、收束条件",
              progressionPacing: "string[]：成长层级/能力/资源/地位/权限/关系/地图等节奏，必须写章节范围和允许上限；必须说明哪些档位属于长期后置，不得前期兑现",
              rewardPacing: "string[]：小收益/中收益/大收益频率与类型",
              first10Chapters: "string[]：前10章每章功能，不写正文；长篇体量下不得安排进入第二个命名大阶段，不得每章都写数值上涨",
              first100Pacing: "string：前100章节奏表，按章节段落说明",
              post100Pacing: "string：100章后到完结的后期节奏，必须说明后期阶段目标、成长上限、支线收束、伏笔回收、终局推进",
              progressionRules: "string[]：任务卡生成时必须遵守的硬规则"
            }
          },
          null,
          2
        )
      }
    ],
    temperature: 0.22,
    maxTokens: 3200
  });

  return attachAiTokenUsage({
    planningBasis: String(response.planningBasis ?? "").trim(),
    corePromise: String(response.corePromise ?? "").trim(),
    volumePlan: asTextList(response.volumePlan),
    progressionPacing: asTextList(response.progressionPacing),
    rewardPacing: asTextList(response.rewardPacing),
    first10Chapters: asTextList(response.first10Chapters).slice(0, 12),
    first100Pacing: String(response.first100Pacing ?? "").trim(),
    post100Pacing: String(response.post100Pacing ?? "").trim(),
    progressionRules: asTextList(response.progressionRules)
  }, getAiTokenUsage(response));
}

function normalizeDraftTargetWordCount(value?: number) {
  if (!Number.isFinite(value)) {
    return 2500;
  }

  return Math.min(3000, Math.max(800, Math.floor(Number(value))));
}

function estimateDraftMaxTokens(targetWordCount: number) {
  return Math.min(6500, Math.max(1200, Math.ceil(targetWordCount * 1.15)));
}

function estimateDraftContinuationMaxTokens(targetWordCount: number, currentCharacters: number) {
  const maxCharacters = maximumDraftCharacters(targetWordCount);
  const remainingCharacters = Math.max(0, maxCharacters - currentCharacters);

  if (remainingCharacters <= 0) {
    return 620;
  }

  return Math.min(1800, Math.max(360, Math.ceil(remainingCharacters * 1.25)));
}

function estimateDraftClosingMaxTokens() {
  return 260;
}

export function countDraftCharacters(content: string) {
  return content.replace(/\s/g, "").length;
}

export function minimumDraftCharacters(targetWordCount?: number) {
  return Math.floor(normalizeDraftTargetWordCount(targetWordCount) * 0.7);
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
  return Math.min(14000, Math.max(2600, Math.ceil(countDraftCharacters(originalText) * 1.8)));
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

function isDraftTooShort(content: string, targetWordCount?: number) {
  return countDraftCharacters(content) < minimumDraftExpansionCharacters(targetWordCount);
}

function isDraftTooLong(content: string, targetWordCount?: number) {
  return countDraftCharacters(content) > maximumDraftCharacters(targetWordCount);
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

  const quoteCheckText = text.slice(-360);
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
  const text = content.trim();

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

  if (countDraftCharacters(trimmed) >= minimumDraftCharacters(targetWordCount)) {
    return formatChapterDraftParagraphs(trimmed);
  }

  return formatChapterDraftParagraphs(text);
}

export async function compressChapterDraftToTarget(
  content: string,
  context: ChapterDraftContext,
  targetWordCount: number
) {
  const maxCharacters = maximumDraftCharacters(targetWordCount);
  const minCharacters = minimumDraftCharacters(targetWordCount);

  if (countDraftCharacters(content) <= maxCharacters) {
    return { content, usage: undefined as AiTokenUsage | undefined };
  }

  const response = await requestAiJson<{ content?: string }>({
    messages: [
      {
        role: "system",
        content:
          `你是网文正文压缩编辑。请严格输出 JSON。当前章节明显超过目标篇幅，需要压缩到 ${targetWordCount} 字左右，最高不得超过 ${maxCharacters} 个中文字符。必须保留本章目标、核心冲突、爽点释放和章末钩子，不要改成提纲、总结或分析。`
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
              "不要删除任务卡要求的章末钩子。",
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
    maxTokens: estimateDraftMaxTokens(targetWordCount)
  });

  const compressed = prepareChapterDraftContentForSave(
    String(response.content ?? "").trim(),
    targetWordCount
  );
  const compressedCharacters = countDraftCharacters(compressed);
  const compressedIsUsable =
    compressed &&
    compressedCharacters >= minCharacters &&
    compressedCharacters <= Math.ceil(maxCharacters * 1.12) &&
    !isChapterDraftEndingIncomplete(compressed);

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
  const femaleScore =
    (text.match(/性别[:：]?\s*女性|女性角色|女业主|女修士|女修|女主|她\/她的|用“她/g) ?? []).length * 2 +
    (text.match(/(?:她|她的)/g) ?? []).length;
  const maleScore =
    (text.match(/性别[:：]?\s*男性|男性角色|男业主|男修士|男修|男主|男保安|他\/他的|用“他/g) ?? []).length * 2 +
    (text.match(/(?:他|他的)/g) ?? []).length;

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
    "创作圣经 immutableSettings、narrativeTaboos、corePleasure、styleGuide 中的主分类、题材边界、作品标签和禁止项都是硬约束；如果任务卡与圣经冲突，优先遵守圣经。",
    ...premiseAnchorRules,
    ...mechanismIntegrityRules,
    "每段尽量控制在 1-4 句；一个自然段接近 200 字时必须换段，不要写成一大段散文，也不要连续堆很多长句。",
    "优先写动作、对话、冲突、结果和信息推进，不要用华丽词藻、排比句、总结腔或抒情腔去撑篇幅。",
    "语言要像正常网文，不要刻意堆砌比喻、成语、抽象修辞或过度精致的句式。"
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

export function sanitizeChapterDraftDiction(content: string, context: ChapterDraftContext) {
  const pronounFixed = fixCharacterPronouns(content, context.characters);

  if (!isCultivationFantasyContext(context)) {
    return pronounFixed;
  }

  return pronounFixed
    .replace(/老爸|爸爸|爸/g, "父亲")
    .replace(/老妈|妈妈|妈/g, "母亲");
}

export async function generateWritingTaskCardWithAi(context: TaskCardContext) {
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
  const longFormPlanRules = buildLongFormPlanRules(context.longFormPlan, context.chapterNumber);
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
            projectName: context.projectName,
            projectDescription: context.projectDescription,
            bible: context.bible,
            plotState: context.plotState,
            longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
            lastLedger: context.lastLedger,
            latestDraft: context.latestDraft,
            characters: context.characters,
            chapterCharacterConstraints: context.chapterCharacterConstraints ?? [],
            foreshadowings: context.foreshadowings,
            storyReference: buildStoryReference(context.storyAnalysis),
            chapterPatternReferences: buildChapterPatternReferences(context.recentChapterAnalyses),
            userInput: context.userInput ?? {},
            useAnalysisContext: context.useAnalysisContext !== false,
            chapterNumber: context.chapterNumber,
            migrationRules: [
              "必须先从拆书结果抽象出结构功能，再迁移到当前新书变量。",
              "任务卡里的本章目标、承接、主线推进、爽点和章末钩子都必须服务当前 projectName、projectDescription、bible、plotState。",
              "如果 projectDescription 不为空，它是本书核心承诺参考，任务卡不要明显违背简介里的主角身份、初始危机、金手指机制和核心卖点。",
              ...premiseAnchorRules,
              ...mechanismIntegrityRules,
              ...longFormPlanRules,
              "任务卡的 chapterGoal 必须写清本章如何推进核心承诺锚点；mainPlotProgress 必须写清这章推进的是主线还是支线，以及支线如何回到主线。",
              "任务卡的 pleasurePoint 必须写清：本章收益是什么、收益来源是什么、触发条件是什么、是否符合关键机制、是否存在越级风险；如果只是铺垫章，可以明确写“小收益/线索/误会加深”，不要强行突破。",
              "最近章节台账只提供连续性，不等于自动变成新主线；如果上一章钩子开启了支线，本章必须说明它如何回扣核心承诺，或如何在本章/下章收束。",
              "章节功能可以轮换：允许日常经营、关系铺垫、信息差误会、资源小收益、机制试错、低强度压制，不要每章都强行新敌人、新地图、大战斗或大境界突破。",
              "前10章应优先稳住题材卖点、主角日常循环、关键机制反馈和第一阶段压力；除非大纲明确要求，不要过早开启大型副本或连续升级地图。",
              "必须把 bible.immutableSettings 与 bible.narrativeTaboos 中的主分类、题材边界、作品标签、禁止偏离项写入 rulesNotToBreak，并在本章目标中遵守。",
              "不得为了套用拆书结构而改变当前新书的目标读者、主分类、主题标签、角色标签、时代背景、核心人设或力量体系。",
              "如果 chapterCharacterConstraints 不为空，本章任务卡必须显式使用这些人物约束，并把相关人物写入 requiredCharacters。",
              "如果拆书内容里出现具体人物、地点、道具、组织、案件、秘密、台词或章节事件，不得写入任务卡。",
              "可以借鉴“被压制 -> 反击 -> 获得收益 -> 引出更高压力”的节奏，但要换成当前新书自己的冲突、人物和伏笔。"
            ],
            outputSchema: {
              title: "string",
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
    maxTokens: 2200
  });

  return attachAiTokenUsage({
    title: String(response.title ?? "").trim(),
    chapterGoal: String(response.chapterGoal ?? "").trim(),
    continuity: String(response.continuity ?? "").trim(),
    mainPlotProgress: String(response.mainPlotProgress ?? "").trim(),
    requiredCharacters: asTextList(response.requiredCharacters),
    pleasurePoint: String(response.pleasurePoint ?? "").trim(),
    foreshadowingTasks: asTextList(response.foreshadowingTasks),
    rulesNotToBreak: asTextList(response.rulesNotToBreak),
    endingHook: String(response.endingHook ?? "").trim()
  }, getAiTokenUsage(response));
}

export async function generateChapterDraftWithAi(context: ChapterDraftContext) {
  try {
    const targetWordCount = normalizeDraftTargetWordCount(context.targetWordCount);
    const minCharacters = minimumDraftCharacters(targetWordCount);
    const maxCharacters = maximumDraftCharacters(targetWordCount);

    const response = await requestAiJson<{ title?: string; content?: string }>({
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
              taskCard: context.taskCard,
              projectName: context.projectName,
              projectDescription: context.projectDescription,
              bible: context.bible,
              plotState: context.plotState,
              longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
              lastLedger: context.lastLedger,
              previousDraftTail: context.previousDraftTail,
              characters: context.characters,
              foreshadowings: context.foreshadowings,
              writingRules: [
                `正文目标约 ${targetWordCount} 字，最高不得超过 ${maxCharacters} 字；篇幅不足时扩写动作、对话、压制过程和爽点释放，不要水字数。`,
                `必须在 ${maxCharacters} 字以内自然收束并写出章末落点，不要写到被系统长度限制截断。`,
                "如果篇幅不足以展开所有细节，优先保留本章目标、核心冲突、爽点释放和章末钩子，压缩铺垫和旁支描写。",
                ...buildNarrativeDictionRules(context),
                ...buildLongFormPlanRules(context.longFormPlan, context.taskCard.chapterNumber),
                "如果 previousDraftTail 不为空，开头必须直接承接上一章尾段的最后状态，先写过渡桥段，再进入本章冲突。",
                "任务卡 continuity 里提到但上一章尾段没有出现的事件，必须在本章正文中现场写出来，不能用“刚才已经发生”一笔带过。",
                "允许章节功能轮换：不是每章都必须大战、打脸或升级；可以写机制试错、日常经营、关系铺垫、低强度压力和小收益，但必须服务核心承诺。",
                "正文必须围绕本章任务卡推进，不要写成大纲或总结。",
                "正文必须遵守任务卡 rulesNotToBreak 与创作圣经中的题材边界、主分类、作品标签和禁止偏离项；不得把故事写成另一个频道或另一个题材。",
                "正文里凡是发生人物关系、伏笔、主线推进、战力能力、资源收益、知情边界变化，必须写清“谁、发生了什么、变化前后”，便于章节后沉淀到状态图谱。",
                "不要照搬拆书来源作品的人物、地点、事件、道具、专有设定或章末钩子。"
              ],
              outputSchema: {
                title: "string",
                content: "string"
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0.48,
      maxTokens: estimateDraftMaxTokens(targetWordCount)
    });

    const title = String(response.title ?? "").trim();
    let content = String(response.content ?? "").trim();
    const usages = [getAiTokenUsage(response)];

    if (content.length < 200) {
      throw new Error("AI 返回正文过短，未保存为章节草稿");
    }

    if (isDraftTooShort(content, targetWordCount) || isChapterDraftEndingIncomplete(content)) {
      const expansion = await requestAiJson<{ content?: string }>({
        messages: [
          {
            role: "system",
            content:
              `你是网文正文续写助手。上一轮正文可能篇幅不足或结尾被截断。请只输出 JSON，把正文补足到接近 ${targetWordCount} 字，并写出完整章末落点。不要重写开头，不要输出提纲、总结或分析。`
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
                continuationRules: [
                  "只续写正文后半段，不要重复已有内容。",
                  `续写后整章最高不得超过 ${maxCharacters} 字。`,
                  "如果当前正文已经接近或超过最高字数，只补完整句和章末落点，不要继续展开新战斗、新设定或新对话。",
                  ...buildNarrativeDictionRules(context),
                  ...buildLongFormPlanRules(context.longFormPlan, context.taskCard.chapterNumber),
                  "如果 currentContent 最后一句明显没写完，必须从断句处自然续上，补完该句，再完成本章事件落点。",
                  "重点补足场景推进、人物对话、压制过程、反击动作和爽点释放。",
                  "如果已有内容过早收尾，要把结尾钩子自然后移到补写内容最后。",
                  "必须保留任务卡要求的章末钩子。",
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
        maxTokens: estimateDraftContinuationMaxTokens(targetWordCount, countDraftCharacters(content))
      });
      const extra = String(expansion.content ?? "").trim();

      if (extra.length >= 200) {
        content = `${content}\n\n${extra}`;
        usages.push(getAiTokenUsage(expansion));
      }
    }

    content = sanitizeChapterDraftDiction(content, context);
    content = prepareChapterDraftContentForSave(content, targetWordCount);

    if (isDraftTooLong(content, targetWordCount)) {
      const compressed = await compressChapterDraftToTarget(content, context, targetWordCount);
      content = compressed.content;
      usages.push(compressed.usage);
    }

    return attachAiTokenUsage({
      title: title || context.taskCard.title,
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
            taskCard: context.taskCard,
            projectName: context.projectName,
            projectDescription: context.projectDescription,
            bible: context.bible,
            plotState: context.plotState,
            longFormPlan: buildLongFormPlanSummary(context.longFormPlan),
            lastLedger: context.lastLedger,
            previousDraftTail: context.previousDraftTail,
            characters: context.characters,
            foreshadowings: context.foreshadowings,
            writingRules: [
              `正文目标约 ${targetWordCount} 字，最高不得超过 ${maxCharacters} 字；篇幅不足时扩写动作、对话、压制过程和爽点释放，不要水字数。`,
              `必须在 ${maxCharacters} 字以内自然收束并写出章末落点，不要写到被系统长度限制截断。`,
              "如果篇幅不足以展开所有细节，优先保留本章目标、核心冲突、爽点释放和章末钩子，压缩铺垫和旁支描写。",
              ...buildNarrativeDictionRules(context),
              ...buildLongFormPlanRules(context.longFormPlan, context.taskCard.chapterNumber),
              "如果 previousDraftTail 不为空，开头必须直接承接上一章尾段的最后状态，先写过渡桥段，再进入本章冲突。",
              "任务卡 continuity 里提到但上一章尾段没有出现的事件，必须在本章正文中现场写出来，不能用“刚才已经发生”一笔带过。",
              "先承接上一章钩子，再推进本章目标。",
              "允许章节功能轮换：不是每章都必须大战、打脸或升级；可以写机制试错、日常经营、关系铺垫、低强度压力和小收益，但必须服务核心承诺。",
              "必须遵守任务卡 rulesNotToBreak 与创作圣经中的题材边界、主分类、作品标签和禁止偏离项；不得把故事写成另一个频道或另一个题材。",
              "爽点必须有压制和释放，不要空泛总结。",
              "人物不能知道自己不知道的信息。",
              "正文里凡是发生人物关系、伏笔、主线推进、战力能力、资源收益、知情边界变化，必须写清“谁、发生了什么、变化前后”，便于章节后沉淀到状态图谱。",
              "结尾必须留下任务卡里的章末钩子。"
            ]
          },
          null,
          2
        )
      }
    ],
    temperature: 0.48,
    maxTokens: estimateDraftMaxTokens(targetWordCount),
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
            characters: context.characters,
            foreshadowings: context.foreshadowings,
            continuationRules: [
              "只续写正文后半段，不要重复已有内容。",
              `续写后整章最高不得超过 ${maxCharacters} 字。`,
              "如果当前正文已经接近或超过最高字数，只补完整句和章末落点，不要继续展开新战斗、新设定或新对话。",
              ...buildNarrativeDictionRules(context),
              ...buildLongFormPlanRules(context.longFormPlan, context.taskCard.chapterNumber),
              "续写也必须遵守任务卡 rulesNotToBreak 与创作圣经中的题材边界、主分类、作品标签和禁止偏离项；不得补写成另一个频道或另一个题材。",
              "如果 currentContent 最后一句明显没写完，必须从断句处自然续上，补完该句，再完成本章事件落点。",
              "重点补足场景推进、人物对话、压制过程、反击动作和爽点释放。",
              "如果已有内容过早收尾，要把结尾钩子自然后移到补写内容最后。",
              "必须保留任务卡要求的章末钩子。",
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
    onUsage
  });
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
                ...premiseAnchorRules,
                ...mechanismIntegrityRules,
                ...longFormPlanRules,
                "必须检查正文是否只是在延续上一章支线，却没有让本章目标、收益、冲突或章末钩子回到核心承诺；如果是，应标为 high severity 的“主线偏移风险”。",
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
                "problem、location、suggestion 和 overall 都是给用户看的中文文案，不要写 characters、taskCard、plotState、bible、ledger、draft、cliffhanger、payoff、style 等内部字段名；请改写成人物档案、章节任务卡、主线状态、创作圣经、章节台账、正文草稿、章末钩子、爽点回报、风格。",
                "不要把人物档案、章节台账或代词推断说成“创作圣经明确规定”。只有 bible 字段原文直接写明的内容，才能称为创作圣经设定；人物姓名、身份、代词、已知/未知信息应称为人物档案或正文证据。",
                "每条 issue 必须可执行：location 优先填写正文中可定位的原句或原段，不要只写“结尾段/全文”；suggestion 必须写成“将‘原句’改为‘改句’”或“在‘原句’后补入‘补写内容’”。",
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
  const response = await requestAiJson<{
    aiFlavorSentences?: unknown;
    diagnosis?: unknown;
    revisedText?: string;
  }>({
    messages: [
      {
        role: "system",
        content:
          "你是网文标准二稿编辑。请严格输出 JSON。你的任务是完整审读原文，识别 AI 味句子，给出问题原因，并在保留原文主体表达的基础上做局部修稿。标准二稿只解决 AI 味、模板腔、平均句子、虚句和表达软的问题，不做全文重写，不做洗稿，不做文风翻新。原文本身合适的句子必须原样保留。不得摘要、不得只改前半段、不得省略结尾、不得把小说正文改成大纲。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            mode: context.mode,
            editingLevel: "标准二稿",
            originalText: context.originalText,
            originalCharacters: countDraftCharacters(context.originalText),
            minimumRevisedCharacters: minCharacters,
            editPolicy: {
              name: "标准二稿 = 局部修稿",
              maxChangedParagraphRatio: "原则上不超过 30%-40%；原文质量尚可时应更少。",
              keepUnchangedText: "没有明显问题的段落和句子必须逐字复制回 revisedText。",
              goal: "让不自然的地方变顺，而不是让全文变成另一版。"
            },
            editingRules: [
              "必须从开头到结尾完整检查原文，但输出时要尽量保留原文原句。",
              "没有明显 AI 味、模板腔、病句、重复解释、节奏太平均的问题，就不要改。",
              "优先做句内小修：删掉废话、换掉生硬词、拆短长句、补一个动作或反应；不要整段重写。",
              "只重写 AI 味明显、抽象空泛、重复解释、节奏太平均、爽点不够狠或情绪没有来源的句子。",
              "改稿方向是降复杂度：少解释、少判断、少概念词，优先用短句、动作、对白和直接反应。",
              "不要新增原文没有的设定、道具、风险、因果解释、心理结论或世界观名词。",
              "不要把一句对白扩写成一段说明，也不要把简单动作改成复杂设定说明。",
              "少用或不用这些书面腔/AI 腔表达：这意味着、未知风险、最强保护伞、彻底绑定、目前能接触到的、某种程度上、显然、无疑。",
              "如果原文已经是普通口语或简单动作，宁可不改，也不要强行润色。",
              "保留原文核心信息、剧情顺序、人物关系、关键转折和结尾信息。",
              "如果是小说正文，输出必须仍然是正文，不要改成简介、任务卡、提纲或总结。",
              "可以压缩啰嗦句，但不能大段删剧情、删人物互动、删关键转折，也不要把整章另写成一个新版本。",
              "如果篇幅过长无法一次完整处理，必须在 revisedText 里明确说明无法完整处理，不要输出残缺版本冒充完成。"
            ],
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
    temperature: 0.28,
    maxTokens: estimateEditMaxTokens(context.originalText)
  });

  const revisedText = String(response.revisedText ?? "").trim();

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

  yield* requestAiTextStream({
    messages: [
      {
        role: "system",
        content:
          "你是网文标准二稿编辑。请直接输出处理后的正文，不要输出 JSON、分析标题或项目符号。标准二稿只做局部修稿：解决 AI 味、模板腔、平均句子、虚句和表达软的问题，不做全文重写，不做洗稿，不做文风翻新。原文本身合适的句子必须原样保留。不得摘要、不得只改前半段、不得省略结尾、不得把小说正文改成大纲。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            mode: context.mode,
            editingLevel: "标准二稿",
            originalText: context.originalText,
            originalCharacters: countDraftCharacters(context.originalText),
            minimumRevisedCharacters: minCharacters,
            editPolicy: {
              name: "标准二稿 = 局部修稿",
              maxChangedParagraphRatio: "原则上不超过 30%-40%；原文质量尚可时应更少。",
              keepUnchangedText: "没有明显问题的段落和句子必须逐字复制回输出正文。",
              goal: "让不自然的地方变顺，而不是让全文变成另一版。"
            },
            editingRules: [
              "必须从开头到结尾完整检查原文，但输出时要尽量保留原文原句。",
              "没有明显 AI 味、模板腔、病句、重复解释、节奏太平均的问题，就不要改。",
              "优先做句内小修：删掉废话、换掉生硬词、拆短长句、补一个动作或反应；不要整段重写。",
              "只重写 AI 味明显、抽象空泛、重复解释、节奏太平均、爽点不够狠或情绪没有来源的句子。",
              "改稿方向是降复杂度：少解释、少判断、少概念词，优先用短句、动作、对白和直接反应。",
              "不要新增原文没有的设定、道具、风险、因果解释、心理结论或世界观名词。",
              "不要把一句对白扩写成一段说明，也不要把简单动作改成复杂设定说明。",
              "少用或不用这些书面腔/AI 腔表达：这意味着、未知风险、最强保护伞、彻底绑定、目前能接触到的、某种程度上、显然、无疑。",
              "如果原文已经是普通口语或简单动作，宁可不改，也不要强行润色。",
              "保留原文核心信息、剧情顺序、人物关系和结尾信息。",
              "如果是小说正文，输出必须仍然是正文，不要改成简介、任务卡、提纲或总结。",
              "减少抽象总结句，改成具体动作、反应和判断。",
              "句子长短要有变化，关键句可以短一点。",
              "不复制粘贴式洗稿，不改写成另一个故事。",
              "可以压缩啰嗦句，但不能大段删剧情、删人物互动、删关键转折，也不要把整章另写成一个新版本。"
            ]
          },
          null,
          2
        )
      }
    ],
    temperature: 0.32,
    maxTokens: estimateEditMaxTokens(context.originalText),
    onUsage
  });
}
