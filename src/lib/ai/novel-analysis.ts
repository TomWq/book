import {
  attachAiTokenUsage,
  combineAiTokenUsages,
  getAiTokenUsage,
  requestAiJson
} from "@/lib/ai/client";
import {
  analyzeChapter,
  buildStoryAnalysis,
  normalizeCharacterMentions,
  normalizeCharacterName
} from "@/lib/analysis";
import type { StoredChapter } from "@/lib/projects";

export type ChapterAnalysisResult = ReturnType<typeof analyzeChapter>;
export type StoryAnalysisResult = ReturnType<typeof buildStoryAnalysis>;

type AiChapterAnalysisResult = ChapterAnalysisResult;
type AiStoryAnalysisResult = StoryAnalysisResult;

export type AnalysisRunResult<T> = {
  analysis: T;
  usedAi: boolean;
  usedFallback: boolean;
  error?: string;
};

function buildChapterMessages(chapter: StoredChapter, options?: { compact?: boolean }) {
  const content = trimChapterContentForAnalysis(chapter.content);
  const qualityRules = [
    "summary 必须概括本章完整剧情，不少于 40 个中文字符。",
    "mainEvent/conflict/pressurePoint/payoff/cliffhanger/readerHook 必须包含具体事件或信息点。",
    "pleasurePoints 至少 1 条，setup 写爽点前的压制，release 写释放位置和结果，whyItWorks 写为什么读者会爽。",
    "所有 string 字段必须简洁，单字段不超过 90 个中文字符。",
    "newInformation/newCharacters/stateChanges 每个数组最多 4 条，每条不超过 40 个中文字符。",
    "entityRelations 最多 4 条，evidence 不超过 45 个中文字符。",
    "pleasurePoints 最多 2 条。",
    "newInformation/newCharacters/stateChanges 不能乱编；原文没有就返回空数组。",
    "newCharacters 只能输出本章首次出场或第一次进入重要剧情的人物姓名或稳定称呼，例如“王老”“李教官”。禁止输出动作短语、半句话、语气词、主角+动作片段，例如“陈迹并不”“陈迹没有”“陈迹身边”。",
    "entityRelations 用来给图谱画真实关系线，只输出原文能证明的关系。source/target 必须是人物、地点、势力、线索、事件或物品的短名称；type 写关系类型，例如“敌对”“协助”“收到线索”“发生于”“隶属势力”；evidence 写原文依据的简短说明。没有明确关系就返回空数组。",
    "不要输出模板句，例如“本章通过冲突后的状态变化给读者继续阅读的理由”。"
  ];

  if (options?.compact) {
    qualityRules.push(
      "这是紧凑重试：必须输出更短 JSON，不能扩写分析文章。",
      "summary 控制在 50-80 个中文字符，其余 string 字段控制在 40-70 个中文字符。",
      "newInformation/newCharacters/stateChanges 每个数组最多 3 条。",
      "entityRelations 最多 3 条。",
      "pleasurePoints 只输出 1 条，选择本章最强爽点。"
    );
  }

  return [
    {
      role: "system" as const,
      content:
        "你是一个资深网文拆书编辑，专门给作者做可复用结构分析。请严格输出 JSON，不要输出多余说明。必须基于章节原文，写出具体人物、事件、压制、反击、收益、钩子。禁止空话、套话、泛泛而谈，禁止只写“本章通过”“情绪释放”“推动剧情发展”。"
    },
    {
      role: "user" as const,
      content: JSON.stringify(
        {
          task: "analyze_chapter",
          mode: options?.compact ? "compact_retry" : "standard",
          qualityRules,
          chapter: {
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            content
          },
          outputSchema: {
            summary: "string",
            mainEvent: "string",
            conflict: "string",
            pressurePoint: "string",
            payoff: "string",
            cliffhanger: "string",
            readerHook: "string",
            newInformation: "string[]",
            newCharacters: "string[]",
            stateChanges: "string[]",
            entityRelations: [
              {
                source: "string",
                target: "string",
                type: "string",
                evidence: "string"
              }
            ],
            pleasurePoints: [
              {
                type: "string",
                setup: "string",
                release: "string",
                whyItWorks: "string",
                drivesMainPlot: "boolean"
              }
            ]
          }
        },
        null,
        2
      )
    }
  ];
}

function buildStoryMessages(chapters: Array<AiChapterAnalysisResult>) {
  return [
    {
      role: "system" as const,
      content:
        "你是一个资深网文商业结构分析师。请严格输出 JSON，不要输出多余说明。你要从章节拆解中提炼可复用的爆款结构，必须写得具体、可执行、有判断。禁止输出通用套话，禁止把任何小说都说成“爽点驱动型网文”。"
    },
    {
      role: "user" as const,
      content: JSON.stringify(
        {
          task: "analyze_story",
          qualityRules: [
            "openingHook 要指出具体开局事件，而不是摘一句环境描写。",
            "mainLoop 要写出这本书自己的循环，不要用通用箭头模板。",
            "pacing 要给出小爽点/大爽点/断章/地图推进的频率判断。",
            "usablePatterns 要能直接用于新书迁移，每条都要具体。",
            "avoidCopying 要指出本书哪些角色、桥段、专有设定不能照搬。",
            "formula 必须是这本书的商业公式，不少于 30 个中文字符。"
          ],
          chapterAnalyses: chapters.map((chapter) => ({
            summary: compactStorySignal(chapter.summary),
            conflict: compactStorySignal(chapter.conflict),
            payoff: compactStorySignal(chapter.payoff),
            cliffhanger: compactStorySignal(chapter.cliffhanger),
            pleasurePoints: chapter.pleasurePoints.slice(0, 2).map((point) => ({
              type: compactStorySignal(point.type, 24),
              setup: compactStorySignal(point.setup),
              release: compactStorySignal(point.release),
              whyItWorks: compactStorySignal(point.whyItWorks)
            }))
          })),
          outputSchema: {
            genre: "string",
            protagonistModel: "string",
            openingModel: "string",
            goldenFingerMechanism: "string",
            villainFunction: "string",
            supportingRoles: "string",
            mapProgression: "string",
            usablePatterns: "string[]",
            avoidCopying: "string[]",
            openingHook: "string",
            mainLoop: "string",
            pacing: "string",
            topPleasureTypes: "string[]",
            formula: "string",
            migrationAdvice: "string"
          }
        },
        null,
        2
      )
    }
  ];
}

function compactStorySignal(value: string, maxLength = 140) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function sanitizeChapterResult(result: Partial<ChapterAnalysisResult>, chapter: StoredChapter) {
  const fallback = analyzeChapter(chapter);
  const rawRelations = Array.isArray(result.entityRelations) ? result.entityRelations : [];
  const entityRelations = rawRelations
    .map((relation) => {
      const source = normalizeRelationEntity(String(relation.source ?? ""));
      const target = normalizeRelationEntity(String(relation.target ?? ""));
      const type = String(relation.type ?? "").trim();
      const evidence = String(relation.evidence ?? "").trim();

      return {
        source,
        target,
        type,
        evidence,
        chapterNumber: chapter.chapterNumber
      };
    })
    .filter(
      (relation) =>
        relation.source &&
        relation.target &&
        relation.source !== relation.target &&
        relation.type &&
        relation.evidence
    )
    .slice(0, 12);

  return {
    summary: compactChapterSignal(result.summary?.trim() || fallback.summary, 140),
    mainEvent: compactChapterSignal(result.mainEvent?.trim() || fallback.mainEvent),
    conflict: compactChapterSignal(result.conflict?.trim() || fallback.conflict),
    pressurePoint: compactChapterSignal(result.pressurePoint?.trim() || fallback.pressurePoint),
    payoff: compactChapterSignal(result.payoff?.trim() || fallback.payoff),
    cliffhanger: compactChapterSignal(result.cliffhanger?.trim() || fallback.cliffhanger),
    readerHook: compactChapterSignal(result.readerHook?.trim() || fallback.readerHook),
    newInformation:
      Array.isArray(result.newInformation) && result.newInformation.length > 0
        ? cleanCompactList(result.newInformation, 4)
        : cleanCompactList(fallback.newInformation, 4),
    newCharacters:
      Array.isArray(result.newCharacters) && result.newCharacters.length > 0
        ? Array.from(new Set(normalizeCharacterMentions(result.newCharacters.map((item) => String(item))))).slice(0, 4)
        : fallback.newCharacters.slice(0, 4),
    stateChanges:
      Array.isArray(result.stateChanges) && result.stateChanges.length > 0
        ? cleanCompactList(result.stateChanges, 4)
        : cleanCompactList(fallback.stateChanges, 4),
    entityRelations,
    pleasurePoints:
      Array.isArray(result.pleasurePoints) && result.pleasurePoints.length > 0
        ? result.pleasurePoints.slice(0, 2).map((point) => ({
            type: compactChapterSignal(String(point.type || fallback.pleasurePoints[0].type), 36),
            setup: compactChapterSignal(String(point.setup || fallback.pleasurePoints[0].setup)),
            release: compactChapterSignal(String(point.release || fallback.pleasurePoints[0].release)),
            whyItWorks: compactChapterSignal(String(point.whyItWorks || fallback.pleasurePoints[0].whyItWorks)),
            drivesMainPlot: Boolean(point.drivesMainPlot)
          }))
        : fallback.pleasurePoints.slice(0, 2)
  };
}

function compactChapterSignal(value: string, maxLength = 90) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function cleanCompactList(value: unknown[], limit: number) {
  return value
    .map((item) => compactChapterSignal(String(item), 40))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeRelationEntity(value: string) {
  const normalizedCharacter = normalizeCharacterName(value);

  if (normalizedCharacter) {
    return normalizedCharacter;
  }

  return value
    .replace(/[《》“”"'`【】\[\]（）()]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .slice(0, 24);
}

function sanitizeStoryResult(result: Partial<StoryAnalysisResult>, chapters: AiChapterAnalysisResult[]) {
  const fallback = buildStoryAnalysis(chapters);

  return {
    genre: result.genre?.trim() || fallback.genre,
    protagonistModel: result.protagonistModel?.trim() || fallback.protagonistModel,
    openingModel: result.openingModel?.trim() || fallback.openingModel,
    goldenFingerMechanism:
      result.goldenFingerMechanism?.trim() || fallback.goldenFingerMechanism,
    villainFunction: result.villainFunction?.trim() || fallback.villainFunction,
    supportingRoles: result.supportingRoles?.trim() || fallback.supportingRoles,
    mapProgression: result.mapProgression?.trim() || fallback.mapProgression,
    usablePatterns:
      Array.isArray(result.usablePatterns) && result.usablePatterns.length > 0
        ? result.usablePatterns.map((item) => String(item)).filter(Boolean)
        : fallback.usablePatterns,
    avoidCopying:
      Array.isArray(result.avoidCopying) && result.avoidCopying.length > 0
        ? result.avoidCopying.map((item) => String(item)).filter(Boolean)
        : fallback.avoidCopying,
    openingHook: result.openingHook?.trim() || fallback.openingHook,
    mainLoop: result.mainLoop?.trim() || fallback.mainLoop,
    pacing: result.pacing?.trim() || fallback.pacing,
    topPleasureTypes:
      Array.isArray(result.topPleasureTypes) && result.topPleasureTypes.length > 0
        ? result.topPleasureTypes.map((item) => String(item)).filter(Boolean)
        : fallback.topPleasureTypes,
    formula: result.formula?.trim() || fallback.formula,
    migrationAdvice: result.migrationAdvice?.trim() || fallback.migrationAdvice
  };
}

function trimChapterContentForAnalysis(content: string) {
  const normalized = content.trim();

  if (normalized.length <= 3600) {
    return normalized;
  }

  return [
    normalized.slice(0, 2400),
    "\n\n[中间过长内容已省略，以下为章末]\n\n",
    normalized.slice(-1200)
  ].join("");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI 分析失败";
}

function isAiOutputLengthError(error: unknown) {
  return error instanceof Error && error.message.includes("长度限制截断");
}

async function requestAiJsonWithRetry<T>(
  request: Parameters<typeof requestAiJson<T>>[0],
  retries = 0
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestAiJson<T>(request);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI 分析失败");
}

function hasUsefulLength(value: string, min = 12) {
  return value.trim().replace(/\s/g, "").length >= min;
}

function isWeakChapterResult(result: ChapterAnalysisResult) {
  const usefulTextCount = [
    result.summary,
    result.mainEvent,
    result.conflict,
    result.pressurePoint,
    result.payoff,
    result.cliffhanger,
    result.readerHook
  ].filter((item) => hasUsefulLength(item)).length;
  const hasWeakTemplate = [
    result.summary,
    result.mainEvent,
    result.conflict,
    result.pressurePoint,
    result.payoff,
    result.readerHook,
    ...result.pleasurePoints.map((point) => point.whyItWorks)
  ].some((item) => /本章通过冲突后的状态变化|给读者继续阅读的理由|整体节奏较为|待识别/.test(item));
  const hasUsefulPleasurePoint = result.pleasurePoints.some(
    (point) =>
      hasUsefulLength(point.setup) &&
      hasUsefulLength(point.release) &&
      hasUsefulLength(point.whyItWorks, 18)
  );

  return usefulTextCount < 5 || !hasUsefulPleasurePoint || hasWeakTemplate;
}

function isWeakStoryResult(result: StoryAnalysisResult, fallback: StoryAnalysisResult) {
  const genericFormula = result.formula === fallback.formula;
  const genericLoop = result.mainLoop === fallback.mainLoop;
  const genericAdvice = result.migrationAdvice === fallback.migrationAdvice;

  return (
    !hasUsefulLength(result.openingHook, 12) ||
    !hasUsefulLength(result.mainLoop, 30) ||
    !hasUsefulLength(result.pacing, 30) ||
    !hasUsefulLength(result.formula, 30) ||
    result.usablePatterns.length < 3 ||
    result.topPleasureTypes.length === 0 ||
    (genericFormula && genericLoop && genericAdvice)
  );
}

async function requestChapterAnalysis(
  chapter: StoredChapter,
  options?: { compact?: boolean; maxTokens?: number }
) {
  return requestAiJson<Partial<ChapterAnalysisResult>>({
    messages: buildChapterMessages(chapter, { compact: options?.compact }),
    temperature: 0.2,
    maxTokens: options?.maxTokens ?? 3200
  });
}

export async function analyzeChapterWithAi(
  chapter: StoredChapter
): Promise<AnalysisRunResult<ChapterAnalysisResult>> {
  try {
    let response: Partial<ChapterAnalysisResult>;
    let tokenUsage = undefined;

    try {
      response = await requestChapterAnalysis(chapter);
      tokenUsage = getAiTokenUsage(response);
    } catch (error) {
      if (!isAiOutputLengthError(error)) {
        throw error;
      }

      response = await requestChapterAnalysis(chapter, { compact: true, maxTokens: 4200 });
      tokenUsage = getAiTokenUsage(response);
    }

    let analysis = sanitizeChapterResult(response, chapter);

    if (isWeakChapterResult(analysis)) {
      const retryResponse = await requestChapterAnalysis(chapter, { compact: true, maxTokens: 4200 });
      const retryAnalysis = sanitizeChapterResult(retryResponse, chapter);
      tokenUsage = combineAiTokenUsages([tokenUsage, getAiTokenUsage(retryResponse)]);

      if (!isWeakChapterResult(retryAnalysis)) {
        analysis = retryAnalysis;
      }
    }

    if (isWeakChapterResult(analysis)) {
      return {
        analysis: attachAiTokenUsage(analyzeChapter(chapter), tokenUsage),
        usedAi: false,
        usedFallback: true,
        error: `第 ${chapter.chapterNumber} 章 AI 分析质量不达标`
      };
    }

    return {
      analysis: attachAiTokenUsage(analysis, tokenUsage),
      usedAi: true,
      usedFallback: false
    };
  } catch (error) {
    return {
      analysis: analyzeChapter(chapter),
      usedAi: false,
      usedFallback: true,
      error: errorMessage(error)
    };
  }
}

export async function analyzeStoryWithAi(
  chapterAnalyses: ChapterAnalysisResult[]
): Promise<AnalysisRunResult<StoryAnalysisResult>> {
  try {
    const fallback = buildStoryAnalysis(chapterAnalyses);
    const response = await requestAiJsonWithRetry<Partial<StoryAnalysisResult>>({
      messages: buildStoryMessages(chapterAnalyses),
      temperature: 0.2,
      maxTokens: 3600
    });
    const analysis = sanitizeStoryResult(response, chapterAnalyses);
    const tokenUsage = getAiTokenUsage(response);

    if (isWeakStoryResult(analysis, fallback)) {
      return {
        analysis: attachAiTokenUsage(buildStoryAnalysis(chapterAnalyses), tokenUsage),
        usedAi: false,
        usedFallback: true,
        error: "整书 AI 分析质量不达标"
      };
    }

    return {
      analysis: attachAiTokenUsage(analysis, tokenUsage),
      usedAi: true,
      usedFallback: false
    };
  } catch (error) {
    return {
      analysis: buildStoryAnalysis(chapterAnalyses),
      usedAi: false,
      usedFallback: true,
      error: errorMessage(error)
    };
  }
}
