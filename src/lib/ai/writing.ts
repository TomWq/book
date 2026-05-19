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
  StoredPlotState,
  StoredReviewReport,
  StoredStoryAnalysis,
  StoredWritingBible,
  StoredWritingTaskCard
} from "@/lib/projects";

type TaskCardContext = {
  projectName: string;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
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
  taskCard: StoredWritingTaskCard;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
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
  draft: StoredChapterDraft;
  taskCard: StoredWritingTaskCard;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
  lastLedger: StoredChapterLedger | null;
  characters: StoredCharacterProfile[];
  foreshadowings: StoredForeshadowing[];
};

export type EditContext = {
  mode: string;
  originalText: string;
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

function normalizeDraftTargetWordCount(value?: number) {
  if (!Number.isFinite(value)) {
    return 2500;
  }

  return Math.min(8000, Math.max(800, Math.floor(Number(value))));
}

function estimateDraftMaxTokens(targetWordCount: number) {
  return Math.min(12000, Math.max(2600, Math.ceil(targetWordCount * 1.7)));
}

export function countDraftCharacters(content: string) {
  return content.replace(/\s/g, "").length;
}

export function minimumDraftCharacters(targetWordCount?: number) {
  return Math.floor(normalizeDraftTargetWordCount(targetWordCount) * 0.7);
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
  return countDraftCharacters(content) < minimumDraftCharacters(targetWordCount);
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

  const quotes = (text.match(/[“”]/g) ?? []).join("");
  const leftQuotes = (quotes.match(/“/g) ?? []).length;
  const rightQuotes = (quotes.match(/”/g) ?? []).length;

  return leftQuotes > rightQuotes;
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

function buildNarrativeDictionRules(context: ChapterDraftContext) {
  const rules = [
    "正文称谓、对白和物件必须符合当前题材、时代感和世界观，不要混入与题材不符的现代口语。",
    "亲属、师门、家族、宗门称谓必须稳定，不能同一人物一会儿现代口语一会儿古风称谓。"
  ];

  if (isCultivationFantasyContext(context)) {
    rules.push(
      "当前题材按修炼玄幻/修仙语感处理：亲属称谓使用“父亲、母亲、兄长、长兄、族叔、族老、长老、师尊、师兄、师姐”等，不要使用“爸、爸爸、老爸、妈、妈妈、老妈”等现代家庭口语。",
      "修炼玄幻正文禁止出现明显现代生活词和现代制度词，除非创作圣经明确设定存在：手机、微信、短信、警察、公司、老板、上班、医院、学校、公交、出租车、银行卡。",
      "对白可以自然，但不能像现代都市口吻；威胁、讥讽、称呼要符合家族、宗门、修炼世界的身份秩序。"
    );
  }

  return rules;
}

export function sanitizeChapterDraftDiction(content: string, context: ChapterDraftContext) {
  if (!isCultivationFantasyContext(context)) {
    return content;
  }

  return content
    .replace(/老爸|爸爸|爸/g, "父亲")
    .replace(/老妈|妈妈|妈/g, "母亲");
}

export async function generateWritingTaskCardWithAi(context: TaskCardContext) {
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
            bible: context.bible,
            plotState: context.plotState,
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
              "任务卡里的本章目标、承接、主线推进、爽点和章末钩子都必须服务当前 projectName、bible、plotState。",
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

    const response = await requestAiJson<{ title?: string; content?: string }>({
      messages: [
        {
          role: "system",
          content:
            `你是网文正文生成助手。请严格输出 JSON。你要根据任务卡和项目状态写出一章正文，要求是连贯的中文小说正文，不要输出提纲、列表或分析。正文目标约 ${targetWordCount} 个中文字，允许上下浮动 10%-15%，不要为了凑字重复解释、复述设定或写分析腔。`
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              targetWordCount,
              taskCard: context.taskCard,
              bible: context.bible,
              plotState: context.plotState,
              lastLedger: context.lastLedger,
              previousDraftTail: context.previousDraftTail,
              characters: context.characters,
              foreshadowings: context.foreshadowings,
              writingRules: [
                `正文目标约 ${targetWordCount} 字，篇幅不足时扩写动作、对话、压制过程和爽点释放，不要水字数。`,
                ...buildNarrativeDictionRules(context),
                "如果 previousDraftTail 不为空，开头必须直接承接上一章尾段的最后状态，先写过渡桥段，再进入本章冲突。",
                "任务卡 continuity 里提到但上一章尾段没有出现的事件，必须在本章正文中现场写出来，不能用“刚才已经发生”一笔带过。",
                "正文必须围绕本章任务卡推进，不要写成大纲或总结。",
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
      temperature: 0.7,
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
                bible: context.bible,
                plotState: context.plotState,
                continuationRules: [
                  "只续写正文后半段，不要重复已有内容。",
                  ...buildNarrativeDictionRules(context),
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
        temperature: 0.72,
        maxTokens: estimateDraftMaxTokens(Math.max(800, targetWordCount - countDraftCharacters(content)))
      });
      const extra = String(expansion.content ?? "").trim();

      if (extra.length >= 200) {
        content = `${content}\n\n${extra}`;
        usages.push(getAiTokenUsage(expansion));
      }
    }

    content = sanitizeChapterDraftDiction(content, context);
    assertChapterDraftComplete(content);

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

  yield* requestAiTextStream({
    messages: [
      {
        role: "system",
        content:
          `你是网文正文生成助手。请直接输出连贯的中文小说正文，不要输出 JSON、提纲、列表或分析。必须严格遵守任务卡、创作圣经、人物已知信息和伏笔限制。正文目标约 ${targetWordCount} 个中文字，允许上下浮动 10%-15%，不要为了凑字重复解释、复述设定或写分析腔。`
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            targetWordCount,
            taskCard: context.taskCard,
            bible: context.bible,
            plotState: context.plotState,
            lastLedger: context.lastLedger,
            previousDraftTail: context.previousDraftTail,
            characters: context.characters,
            foreshadowings: context.foreshadowings,
            writingRules: [
              `正文目标约 ${targetWordCount} 字，篇幅不足时扩写动作、对话、压制过程和爽点释放，不要水字数。`,
              ...buildNarrativeDictionRules(context),
              "如果 previousDraftTail 不为空，开头必须直接承接上一章尾段的最后状态，先写过渡桥段，再进入本章冲突。",
              "任务卡 continuity 里提到但上一章尾段没有出现的事件，必须在本章正文中现场写出来，不能用“刚才已经发生”一笔带过。",
              "先承接上一章钩子，再推进本章目标。",
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
    temperature: 0.7,
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
  const minCharacters = minimumDraftCharacters(targetWordCount);

  yield* requestAiTextStream({
    messages: [
      {
        role: "system",
        content:
          `你是网文正文续写助手。上一轮正文当前 ${currentCharacters} 字，最低参考 ${minCharacters} 字，可能篇幅不足或结尾被截断。请直接输出续写正文，不要重写开头，不要输出提纲、总结或分析。目标是把整章补足到接近 ${targetWordCount} 字，并写出完整章末落点。`
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            targetWordCount,
            minCharacters,
            currentCharacters,
            currentContent,
            taskCard: context.taskCard,
            bible: context.bible,
            plotState: context.plotState,
            characters: context.characters,
            foreshadowings: context.foreshadowings,
            continuationRules: [
              "只续写正文后半段，不要重复已有内容。",
              ...buildNarrativeDictionRules(context),
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
    temperature: 0.72,
    maxTokens: estimateDraftMaxTokens(Math.max(800, targetWordCount - currentCharacters)),
    onUsage
  });
}

export async function extractChapterStateUpdateWithAi(context: ChapterStateUpdateContext) {
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
                "由 mapAndForceUpdates 与 foreshadowingUpdates.relatedLocation 生成。只记录顶层地点/势力/组织，不记录房间、前厅、后山、枯井等内部场景。",
              foreshadowingGraph:
                "由 foreshadowingUpdates 与 newClues 生成。必须写清伏笔名称、状态、关联人物、关联地点、隐藏信息、预计回收方式。",
              plotProgressGraph:
                "由 stateChanges、events、cliffhanger 生成。必须写清本章推进了哪条主线或支线、留下了什么下一步压力。",
              powerGraph:
                "由 powerSystemUpdates 与 characterUpdates.abilityBoundary 生成。必须写清境界/能力/金手指变化、限制、代价和不能突破的边界。",
              resourceGraph:
                "由 resourceUpdates、payoff、newClues 生成。必须写清主角获得或失去的资源、功法、道具、线索、权限或收益。",
              knowledgeGraph:
                "由 characterUpdates.knownInformation、unknownInformation、secret 生成。必须写清每个重要人物本章后知道什么、不知道什么、误判什么、隐藏什么。",
              causalityGraph:
                "由 events、payoff、cliffhanger 生成。events 写原因和行动，payoff 写结果收益，cliffhanger 写下一章承接压力。"
            },
            extractionRules: [
              "events 只写本章真实发生的关键事件，3-6 条。",
              "events 必须服务章节因果网：每条尽量包含触发原因、人物行动和直接结果，不要只写氛围。",
              "newCharacters 只写本章首次出现或第一次进入重要剧情的人物姓名，不要把“主角”“众人”“敌人”当人物名。",
              "characterUpdates 必须覆盖本章出场的重要人物，记录他们本章后的当前状态、已知信息、未知信息、秘密、能力边界、与主角关系或态度变化。",
              "relationshipChanges 只记录关系真的变化、立场变化或被明确加深的内容，必须写出双方姓名，格式建议：第N章：A 与 B 因某事件关系变化为……",
              "mapAndForceUpdates 只记录顶层地点、势力、组织、阵营、地图推进相关变化，必须写出地点或势力名称；不要把前厅、后山、枯井、房间、院落等内部场景单独写成地图/势力节点，内部场景只放在 events 或 foreshadowingUpdates.relatedLocation 中。",
              "stateChanges 必须覆盖主线/支线推进网：写清本章推进了哪条主线或支线、当前阶段发生了什么变化、下一步压力是什么。",
              "powerSystemUpdates 只记录战力、能力、金手指、限制、代价变化，必须写清变化前后、新增限制、代价或能力边界。",
              "resourceUpdates 只记录资源/收益网：功法、丹药、装备、线索、证据、名额、权限、财富、声望等获得/失去/消耗。",
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
    const response = await requestAiJson<Partial<StoredReviewReport> & { issues?: unknown }>({
      messages: [
        {
          role: "system",
          content:
            "你是网文一致性审稿器。请严格输出 JSON。你要检查章节是否违背创作圣经、人物知道了不该知道的信息、是否忘记上一章钩子、是否推进主线，以及是否有明显 AI 味。"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              draft: context.draft,
              taskCard: context.taskCard,
              bible: context.bible,
              plotState: context.plotState,
              lastLedger: context.lastLedger,
              characters: context.characters,
              foreshadowings: context.foreshadowings,
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

    return attachAiTokenUsage({
      overall: String(response.overall ?? "").trim(),
      shouldUpdateState: Boolean(response.shouldUpdateState),
      stateUpdateSuggestions: asTextList(response.stateUpdateSuggestions),
      issues: asReviewIssues(response.issues)
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
