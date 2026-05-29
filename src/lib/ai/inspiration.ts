import { attachAiTokenUsage, getAiTokenUsage, requestAiJson } from "@/lib/ai/client";
import type {
  InspirationPolishMode,
  InspirationTransformDraft,
  InspirationTransformTarget,
  StoredCharacterProfile,
  StoredForeshadowing,
  StoredInspiration,
  StoredProject
} from "@/lib/project-types";

export type InspirationProjectContext = {
  project?: StoredProject | null;
  bible?: {
    corePleasure?: string;
    worldRules?: string;
    goldenFingerRules?: string;
    immutableSettings?: string;
    styleGuide?: string;
  } | null;
  plotState?: {
    mainGoal?: string;
    shortTermGoal?: string;
    currentStage?: string;
    openThreads?: string[];
  } | null;
  characters?: StoredCharacterProfile[];
  foreshadowings?: StoredForeshadowing[];
};

export type InspirationPolishResult = {
  title: string;
  content: string;
  changes: string[];
  suggestions: string[];
  tags: string[];
  usedAi: boolean;
  usedFallback: boolean;
};

const modeLabels: Record<InspirationPolishMode, string> = {
  polish: "润色表达",
  expand_setting: "扩写设定",
  web_novelize: "改成更网文化",
  selling_point: "提炼一句卖点",
  pleasure_analysis: "分析爽点潜力",
  variants: "生成多个变体",
  task_card: "生成章节任务",
  character_draft: "转人物卡草稿",
  foreshadowing_draft: "转伏笔草稿"
};

const modeInstructions: Record<InspirationPolishMode, string> = {
  polish:
    "不要只改标题或轻微换词。请把原始碎片重写成可直接放进设定库/大纲备注的完整表达，至少补足规则名称、核心规则、使用场景或边界。短句也要明显扩写。",
  expand_setting:
    "把一句灵感扩成完整设定条目，包含规则、限制、可产生的冲突、后续延展。不要只复述原文。",
  web_novelize:
    "把灵感改成更网文化的剧情表达，强化压制、反差、期待感和章末可接钩子。",
  selling_point:
    "提炼成能打动读者/作者继续写的一句话卖点，并补充为什么有商业吸引力。",
  pleasure_analysis:
    "按压制、释放、有效原因、是否推动主线来分析爽点潜力。",
  variants:
    "给出多个明显不同的改写方向，每个方向都要有不同的冲突入口或设定侧重。",
  task_card:
    "把灵感整理成一张章节任务卡草稿，至少补足本章目标、承接上一章、主线推进、要释放的爽点、要埋设或回收的伏笔、不能违反的设定和章末钩子。",
  character_draft:
    "把灵感整理成人物档案草稿，至少补足姓名、身份、当前目标、长期目标、秘密、与主角关系、当前态度、能力边界、说话习惯、已知信息和不知道的信息。",
  foreshadowing_draft:
    "把灵感整理成伏笔草稿，至少补足伏笔名称、埋设章节、关联人物、关联地点、预计回收章节、回收方式和不能提前透露的信息。"
};

export function formatInspirationPolishMode(mode: InspirationPolishMode) {
  return modeLabels[mode] ?? "润色表达";
}

function compact(value?: string, limit = 700) {
  const text = String(value ?? "").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function fallbackPolish(inspiration: StoredInspiration, mode: InspirationPolishMode): InspirationPolishResult {
  const title = inspiration.title || "未命名灵感";
  const content = inspiration.content.trim();
  const tagLine = inspiration.tags.length ? `\n\n标签：${inspiration.tags.join("、")}` : "";

  if (mode === "selling_point") {
    return {
      title: `卖点：${title}`,
      content: `一句话卖点：${content.slice(0, 80)}${content.length > 80 ? "..." : ""}`,
      changes: ["提炼成一句话卖点", "保留原始灵感核心", "指出后续需要补足的商业要素"],
      suggestions: ["补充主角处境", "补充压制来源", "补充反击收益"],
      tags: inspiration.tags,
      usedAi: false,
      usedFallback: true
    };
  }

  if (mode === "pleasure_analysis") {
    return {
      title: `爽点潜力：${title}`,
      content: [
        `压制：${content || "需要补充主角被轻视、被剥夺或被误判的具体场景。"}`,
        "释放：建议安排一个明确动作，让主角用信息差、能力或资源完成反击。",
        "有效原因：读者先看到不公平，再看到反击兑现，情绪补偿会更直接。",
        "主线价值：需要让这次爽点带来新资源、新敌人或新目标。"
      ].join("\n"),
      changes: ["拆成压制、释放、有效原因、主线价值", "把模糊灵感改成可判断的爽点结构"],
      suggestions: ["明确反派功能", "给反击设置旁观者", "让收益推动下一段主线"],
      tags: Array.from(new Set([...inspiration.tags, "爽点"])),
      usedAi: false,
      usedFallback: true
    };
  }

  if (mode === "variants") {
    return {
      title: `变体：${title}`,
      content: [
        `版本一：保留原设定，强化冲突入口。${content}`,
        `版本二：把压力改成身份误判，让主角先隐忍再兑现。${content}`,
        `版本三：把收益延后半章，用章末钩子吊住期待。${content}`
      ].join("\n\n"),
      changes: ["生成三个不同方向", "分别强化冲突入口、身份误判和章末钩子"],
      suggestions: ["选一个最贴近当前主线的版本", "避免同时塞入太多设定", "优先保留能产生后续冲突的版本"],
      tags: inspiration.tags,
      usedAi: false,
      usedFallback: true
    };
  }

  return {
    title: `${formatInspirationPolishMode(mode)}：${title}`,
    content: content
      ? [
          `设定核心：${content.replace(/\s+/g, "，")}`,
          "使用方式：可以作为人物战力、资源门槛或社会等级的衡量规则。",
          "延展方向：后续可补充晋升条件、等级边界和例外情况。"
        ].join("\n")
      : "这条灵感还缺少正文内容，可以先补充场景、人物、冲突和预期爽点。",
    changes: ["把碎片句整理成设定条目", "补充了使用方式", "补充了可继续扩写的边界"],
    suggestions: ["补充冲突对象", "补充读者期待", "补充后续可接入的章节位置"],
    tags: inspiration.tags,
    usedAi: false,
    usedFallback: true
  };
}

function buildContext(context?: InspirationProjectContext) {
  if (!context?.project) {
    return "这条灵感未绑定项目。只做通用网文创作整理，不写入任何项目状态。";
  }

  return JSON.stringify({
    project: {
      name: context.project.name,
      type: context.project.type,
      genre: context.project.genre,
      description: compact(context.project.description, 400)
    },
    bible: context.bible
      ? {
          corePleasure: compact(context.bible.corePleasure),
          worldRules: compact(context.bible.worldRules),
          goldenFingerRules: compact(context.bible.goldenFingerRules),
          immutableSettings: compact(context.bible.immutableSettings),
          styleGuide: compact(context.bible.styleGuide)
        }
      : null,
    plotState: context.plotState
      ? {
          mainGoal: compact(context.plotState.mainGoal),
          shortTermGoal: compact(context.plotState.shortTermGoal),
          currentStage: compact(context.plotState.currentStage),
          openThreads: context.plotState.openThreads?.slice(0, 8) ?? []
        }
      : null,
    characters: context.characters?.slice(0, 8).map((character: StoredCharacterProfile) => ({
      name: character.name,
      identity: compact(character.identity, 120),
      currentGoal: compact(character.currentGoal, 120),
      longTermGoal: compact(character.longTermGoal, 120),
      secret: compact(character.secret, 120),
      relationshipToProtagonist: compact(character.relationshipToProtagonist, 120),
      attitude: compact(character.attitude, 120),
      abilityBoundary: compact(character.abilityBoundary, 120),
      voice: compact(character.voice, 120),
      knownInformation: compact(character.knownInformation, 120),
      unknownInformation: compact(character.unknownInformation, 120),
      currentState: compact(character.currentState, 120)
    })) ?? null,
    foreshadowings: context.foreshadowings?.slice(0, 8).map((item: StoredForeshadowing) => ({
      name: item.name,
      plantedChapter: compact(item.plantedChapter, 40),
      relatedCharacters: item.relatedCharacters.slice(0, 6),
      relatedLocation: compact(item.relatedLocation, 80),
      status: item.status,
      expectedRevealChapter: compact(item.expectedRevealChapter, 40),
      revealMethod: compact(item.revealMethod, 120),
      hiddenInformation: compact(item.hiddenInformation, 120)
    })) ?? null
  }, null, 2);
}

function buildTransformFallback(inspiration: StoredInspiration, target: InspirationTransformTarget): InspirationTransformDraft {
  const content = inspiration.content.trim();
  const title = inspiration.title?.trim() || "未命名灵感";
  const baseSummary = content || "需要补充更具体的灵感内容。";

  if (target === "character") {
    return {
      target,
      title: `人物草稿：${title}`,
      summary: baseSummary,
      character: {
        name: title.replace(/^人物草稿[：:]/, "").slice(0, 12) || "未命名人物",
        identity: content.slice(0, 80) || "待补充身份",
        currentGoal: "推动当前局势并争取自己的利益",
        longTermGoal: "围绕主线完成个人目标",
        secret: "暂未补充",
        relationshipToProtagonist: "待补充",
        attitude: "待补充",
        abilityBoundary: "待补充",
        voice: "待补充",
        knownInformation: content.slice(0, 120) || "待补充",
        unknownInformation: "待补充",
        lastAppearance: "",
        currentState: "待补充"
      },
      notes: ["已整理成人物草稿", "后续可继续补充人物状态"],
      warnings: ["需要补齐人物知道什么和不知道什么"],
      usedAi: false,
      usedFallback: true
    };
  }

  if (target === "foreshadowing") {
    return {
      target,
      title: `伏笔草稿：${title}`,
      summary: baseSummary,
      foreshadowing: {
        name: title.slice(0, 24) || "未命名伏笔",
        plantedChapter: "待补充",
        relatedCharacters: [],
        relatedLocation: "",
        status: "open",
        expectedRevealChapter: "待补充",
        revealMethod: "待补充",
        hiddenInformation: content.slice(0, 120) || "待补充"
      },
      notes: ["已整理成伏笔草稿", "后续可补埋设章节和回收方式"],
      warnings: ["需要补齐不能提前透露的信息"],
      usedAi: false,
      usedFallback: true
    };
  }

  if (target === "task_card") {
    return {
      target,
      title: `任务卡草稿：${title}`,
      summary: baseSummary,
      taskCard: {
        chapterNumber: undefined,
        title: `第 1 章 ${title}`.slice(0, 30),
        chapterGoal: content || "推动主线并释放一次明确压力。",
        continuity: "承接当前主线状态",
        mainPlotProgress: "让主角推进一步并带出新信息",
        requiredCharacters: [],
        pleasurePoint: "设计一个明确的情绪回报点",
        foreshadowingTasks: ["埋下一条可回收的线索"],
        rulesNotToBreak: ["不要偏离当前设定"],
        endingHook: "留出一个能继续往下读的钩子"
      },
      notes: ["已整理成章节任务卡草稿"],
      warnings: ["需要结合项目状态补齐人物与伏笔"],
      usedAi: false,
      usedFallback: true
    };
  }

  if (target === "short_outline") {
    return {
      target,
      title: `短大纲：${title}`,
      summary: baseSummary,
      shortOutline: {
        logline: content.slice(0, 120) || "待补充一句话大纲",
        coreConflict: "围绕当前灵感提炼主冲突，让主角在压力中推进主线。",
        firstChapters: ["第1章：建立压力和目标", "第2章：引出反击机会", "第3章：第一次兑现收益"],
        pacing: "前几章先压制再释放，保持连续钩子和小收益。",
        foreshadowingPlan: ["埋下一条后续能回收的线索"]
      },
      notes: ["已整理成短大纲草稿"],
      warnings: ["需要结合项目主线和人物状态进一步落地"],
      usedAi: false,
      usedFallback: true
    };
  }

  if (target === "variants") {
    return {
      target,
      title: `桥段变体：${title}`,
      summary: baseSummary,
      variants: [
        {
          title: `${title} · 压制反击版`,
          direction: "先压制主角，再用一次明显反击收回情绪。",
          conflict: "让主角在误判中先吃亏，再用信息差反杀。",
          payoff: "反击后拿到资源或身份变化。",
          nextHook: "结尾抛出更高层的压力源。"
        },
        {
          title: `${title} · 身份曝光版`,
          direction: "把原灵感改成身份/关系突然曝光的版本。",
          conflict: "让周围人先误判，再被真相打脸。",
          payoff: "制造众人震惊和地位提升。",
          nextHook: "曝光之后立刻引出后续代价。"
        }
      ],
      notes: ["已生成多个桥段方向"],
      warnings: ["建议只保留一个最贴合当前项目的版本"],
      usedAi: false,
      usedFallback: true
    };
  }

  return {
    target,
    title: `设定草稿：${title}`,
    summary: baseSummary,
    biblePatch: {
      corePleasure: content.slice(0, 160) || "待补充",
      worldRules: "",
      goldenFingerRules: "",
      narrativeTaboos: "",
      immutableSettings: "",
      styleGuide: ""
    },
    notes: ["已整理成设定草稿"],
    warnings: [],
    usedAi: false,
    usedFallback: true
  };
}

export async function polishInspirationWithAi(
  inspiration: StoredInspiration,
  mode: InspirationPolishMode,
  context?: InspirationProjectContext
): Promise<InspirationPolishResult> {
  try {
    const response = await requestAiJson<Partial<InspirationPolishResult>>({
      messages: [
        {
          role: "system",
          content:
            "你是网文作者的灵感整理助手。请严格输出 JSON，不要输出多余说明。你只整理用户灵感，不覆盖原文，不鼓励洗稿，不照搬已有作品专有设定。润色必须让用户明显看出变化：要重组表达、补足缺口、强化用途或冲突，不要只换标题。"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              mode,
              modeName: formatInspirationPolishMode(mode),
              modeInstruction: modeInstructions[mode],
              inspiration: {
                title: inspiration.title,
                content: inspiration.content,
                type: inspiration.type,
                tags: inspiration.tags
              },
              projectContext: buildContext(context),
              outputSchema: {
                title: "string，给 AI 整理结果起一个简短标题",
                content: "string，整理后的内容，按模式输出，保留原意但必须明显重写；短灵感要扩成可用设定/剧情条目",
                changes: "string[]，用 2-4 条说明这次相对原文具体改了什么，例如：补足规则边界、改成设定条目、强化冲突入口",
                suggestions: "string[]，下一步可补充或使用建议",
                tags: "string[]，建议标签"
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0.45,
      maxTokens: 1600
    });
    const fallback = fallbackPolish(inspiration, mode);

    return attachAiTokenUsage({
      title: response.title?.trim() || fallback.title,
      content: response.content?.trim() || fallback.content,
      changes: Array.isArray(response.changes) ? response.changes.map(String).filter(Boolean) : fallback.changes,
      suggestions: Array.isArray(response.suggestions) ? response.suggestions.map(String).filter(Boolean) : fallback.suggestions,
      tags: Array.isArray(response.tags) ? response.tags.map(String).filter(Boolean) : fallback.tags,
      usedAi: true,
      usedFallback: false
    }, getAiTokenUsage(response));
  } catch {
    return fallbackPolish(inspiration, mode);
  }
}

export async function transformInspirationWithAi(
  inspiration: StoredInspiration,
  target: InspirationTransformTarget,
  context?: InspirationProjectContext
): Promise<InspirationTransformDraft> {
  try {
    const response = await requestAiJson<Partial<InspirationTransformDraft>>({
      messages: [
        {
          role: "system",
          content:
            "你是网文作者的灵感转化助手。请严格输出 JSON，不要输出多余说明。你只做结构化转化，不要照搬原文，不要制造和项目冲突的新设定。"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              target,
              targetName:
                target === "character"
                  ? "人物草稿"
                  : target === "foreshadowing"
                    ? "伏笔草稿"
                    : target === "task_card"
                      ? "章节任务卡草稿"
                      : target === "short_outline"
                        ? "短大纲草稿"
                        : target === "variants"
                          ? "桥段变体草稿"
                          : "设定草稿",
              inspiration: {
                title: inspiration.title,
                content: inspiration.content,
                type: inspiration.type,
                tags: inspiration.tags
              },
              projectContext: buildContext(context),
              outputSchema: {
                target: "string，转化目标，必须回填",
                title: "string，草稿标题",
                summary: "string，简述这条灵感转化后的核心",
                character: "人物草稿时返回人物字段，否则返回 null",
                foreshadowing: "伏笔草稿时返回伏笔字段，否则返回 null",
                taskCard: "任务卡草稿时返回任务卡字段，否则返回 null",
                biblePatch: "设定草稿时返回创作圣经补充字段，否则返回 null",
                shortOutline: "短大纲时返回短大纲字段，否则返回 null",
                variants: "桥段变体时返回多个变体，否则返回 null",
                notes: "string[]，转化时保留的关键要点",
                warnings: "string[]，需要用户后续补充或注意的点"
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0.35,
      maxTokens: 1800
    });

    const fallback = buildTransformFallback(inspiration, target);

    return attachAiTokenUsage(
      {
        target,
        title: response.title?.trim() || fallback.title,
        summary: response.summary?.trim() || fallback.summary,
        character: response.character && typeof response.character === "object"
          ? {
              name: String((response.character as Record<string, unknown>).name ?? fallback.character?.name ?? ""),
              identity: String((response.character as Record<string, unknown>).identity ?? fallback.character?.identity ?? ""),
              currentGoal: String((response.character as Record<string, unknown>).currentGoal ?? fallback.character?.currentGoal ?? ""),
              longTermGoal: String((response.character as Record<string, unknown>).longTermGoal ?? fallback.character?.longTermGoal ?? ""),
              secret: String((response.character as Record<string, unknown>).secret ?? fallback.character?.secret ?? ""),
              relationshipToProtagonist: String((response.character as Record<string, unknown>).relationshipToProtagonist ?? fallback.character?.relationshipToProtagonist ?? ""),
              attitude: String((response.character as Record<string, unknown>).attitude ?? fallback.character?.attitude ?? ""),
              abilityBoundary: String((response.character as Record<string, unknown>).abilityBoundary ?? fallback.character?.abilityBoundary ?? ""),
              voice: String((response.character as Record<string, unknown>).voice ?? fallback.character?.voice ?? ""),
              knownInformation: String((response.character as Record<string, unknown>).knownInformation ?? fallback.character?.knownInformation ?? ""),
              unknownInformation: String((response.character as Record<string, unknown>).unknownInformation ?? fallback.character?.unknownInformation ?? ""),
              lastAppearance: String((response.character as Record<string, unknown>).lastAppearance ?? fallback.character?.lastAppearance ?? ""),
              currentState: String((response.character as Record<string, unknown>).currentState ?? fallback.character?.currentState ?? "")
            }
          : fallback.character,
        foreshadowing:
          response.foreshadowing && typeof response.foreshadowing === "object"
            ? {
                name: String((response.foreshadowing as Record<string, unknown>).name ?? fallback.foreshadowing?.name ?? ""),
                plantedChapter: String((response.foreshadowing as Record<string, unknown>).plantedChapter ?? fallback.foreshadowing?.plantedChapter ?? ""),
                relatedCharacters: Array.isArray((response.foreshadowing as Record<string, unknown>).relatedCharacters)
                  ? ((response.foreshadowing as Record<string, unknown>).relatedCharacters as unknown[]).map((item) => String(item)).filter(Boolean)
                  : fallback.foreshadowing?.relatedCharacters ?? [],
                relatedLocation: String((response.foreshadowing as Record<string, unknown>).relatedLocation ?? fallback.foreshadowing?.relatedLocation ?? ""),
                status:
                  (response.foreshadowing as Record<string, unknown>).status === "partial" ||
                  (response.foreshadowing as Record<string, unknown>).status === "closed"
                    ? ((response.foreshadowing as Record<string, unknown>).status as "open" | "partial" | "closed")
                    : "open",
                expectedRevealChapter: String((response.foreshadowing as Record<string, unknown>).expectedRevealChapter ?? fallback.foreshadowing?.expectedRevealChapter ?? ""),
                revealMethod: String((response.foreshadowing as Record<string, unknown>).revealMethod ?? fallback.foreshadowing?.revealMethod ?? ""),
                hiddenInformation: String((response.foreshadowing as Record<string, unknown>).hiddenInformation ?? fallback.foreshadowing?.hiddenInformation ?? "")
              }
            : fallback.foreshadowing,
        taskCard:
          response.taskCard && typeof response.taskCard === "object"
            ? {
                chapterNumber:
                  Number.isFinite(Number((response.taskCard as Record<string, unknown>).chapterNumber))
                    ? Math.floor(Number((response.taskCard as Record<string, unknown>).chapterNumber))
                    : fallback.taskCard?.chapterNumber,
                title: String((response.taskCard as Record<string, unknown>).title ?? fallback.taskCard?.title ?? ""),
                chapterGoal: String((response.taskCard as Record<string, unknown>).chapterGoal ?? fallback.taskCard?.chapterGoal ?? ""),
                continuity: String((response.taskCard as Record<string, unknown>).continuity ?? fallback.taskCard?.continuity ?? ""),
                mainPlotProgress: String((response.taskCard as Record<string, unknown>).mainPlotProgress ?? fallback.taskCard?.mainPlotProgress ?? ""),
                requiredCharacters: Array.isArray((response.taskCard as Record<string, unknown>).requiredCharacters)
                  ? ((response.taskCard as Record<string, unknown>).requiredCharacters as unknown[]).map((item) => String(item)).filter(Boolean)
                  : fallback.taskCard?.requiredCharacters ?? [],
                pleasurePoint: String((response.taskCard as Record<string, unknown>).pleasurePoint ?? fallback.taskCard?.pleasurePoint ?? ""),
                foreshadowingTasks: Array.isArray((response.taskCard as Record<string, unknown>).foreshadowingTasks)
                  ? ((response.taskCard as Record<string, unknown>).foreshadowingTasks as unknown[]).map((item) => String(item)).filter(Boolean)
                  : fallback.taskCard?.foreshadowingTasks ?? [],
                rulesNotToBreak: Array.isArray((response.taskCard as Record<string, unknown>).rulesNotToBreak)
                  ? ((response.taskCard as Record<string, unknown>).rulesNotToBreak as unknown[]).map((item) => String(item)).filter(Boolean)
                  : fallback.taskCard?.rulesNotToBreak ?? [],
                endingHook: String((response.taskCard as Record<string, unknown>).endingHook ?? fallback.taskCard?.endingHook ?? "")
              }
            : fallback.taskCard,
        biblePatch:
          response.biblePatch && typeof response.biblePatch === "object"
            ? {
                corePleasure: String((response.biblePatch as Record<string, unknown>).corePleasure ?? fallback.biblePatch?.corePleasure ?? ""),
                worldRules: String((response.biblePatch as Record<string, unknown>).worldRules ?? fallback.biblePatch?.worldRules ?? ""),
                goldenFingerRules: String((response.biblePatch as Record<string, unknown>).goldenFingerRules ?? fallback.biblePatch?.goldenFingerRules ?? ""),
                narrativeTaboos: String((response.biblePatch as Record<string, unknown>).narrativeTaboos ?? fallback.biblePatch?.narrativeTaboos ?? ""),
                immutableSettings: String((response.biblePatch as Record<string, unknown>).immutableSettings ?? fallback.biblePatch?.immutableSettings ?? ""),
                styleGuide: String((response.biblePatch as Record<string, unknown>).styleGuide ?? fallback.biblePatch?.styleGuide ?? "")
            }
            : fallback.biblePatch,
        shortOutline:
          response.shortOutline && typeof response.shortOutline === "object"
            ? {
                logline: String((response.shortOutline as Record<string, unknown>).logline ?? fallback.shortOutline?.logline ?? ""),
                coreConflict: String((response.shortOutline as Record<string, unknown>).coreConflict ?? fallback.shortOutline?.coreConflict ?? ""),
                firstChapters: Array.isArray((response.shortOutline as Record<string, unknown>).firstChapters)
                  ? ((response.shortOutline as Record<string, unknown>).firstChapters as unknown[]).map((item) => String(item)).filter(Boolean)
                  : fallback.shortOutline?.firstChapters ?? [],
                pacing: String((response.shortOutline as Record<string, unknown>).pacing ?? fallback.shortOutline?.pacing ?? ""),
                foreshadowingPlan: Array.isArray((response.shortOutline as Record<string, unknown>).foreshadowingPlan)
                  ? ((response.shortOutline as Record<string, unknown>).foreshadowingPlan as unknown[]).map((item) => String(item)).filter(Boolean)
                  : fallback.shortOutline?.foreshadowingPlan ?? []
              }
            : fallback.shortOutline,
        variants:
          Array.isArray(response.variants) && response.variants.length > 0
            ? response.variants
                .map((item) => {
                  if (!item || typeof item !== "object") {
                    return null;
                  }

                  const variant = item as Record<string, unknown>;
                  return {
                    title: String(variant.title ?? "").trim(),
                    direction: String(variant.direction ?? "").trim(),
                    conflict: String(variant.conflict ?? "").trim(),
                    payoff: String(variant.payoff ?? "").trim(),
                    nextHook: String(variant.nextHook ?? "").trim()
                  };
                })
                .filter((item): item is NonNullable<typeof item> => Boolean(item && item.title))
            : fallback.variants,
        notes: Array.isArray(response.notes) ? response.notes.map(String).filter(Boolean) : fallback.notes,
        warnings: Array.isArray(response.warnings) ? response.warnings.map(String).filter(Boolean) : fallback.warnings,
        usedAi: true,
        usedFallback: false
      },
      getAiTokenUsage(response)
    );
  } catch {
    return buildTransformFallback(inspiration, target);
  }
}
