import {
  attachAiTokenUsage,
  getAiTokenUsage,
  requestAiJson
} from "@/lib/ai/client";

export type ProjectCreationAssistAction = "titles" | "protagonists" | "description";
export type TitleNamingStyle = "fanqie" | "qidian";

export type ProjectCreationAssistInput = {
  action: ProjectCreationAssistAction;
  name?: string;
  titleConcept?: string;
  genre?: string;
  targetReader?: string;
  tags?: string[];
  protagonistNames?: string[];
  coreSellingPoint?: string;
  goldenFinger?: string;
  openingHook?: string;
  description?: string;
  titleNamingStyle?: TitleNamingStyle;
};

export type ProjectCreationAssistResult = {
  titles: string[];
  protagonistNames: string[];
  description: string;
};

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function normalizeResult(value: Partial<ProjectCreationAssistResult>) {
  return attachAiTokenUsage({
    titles: list(value.titles).slice(0, 8),
    protagonistNames: list(value.protagonistNames).slice(0, 8),
    description: String(value.description ?? "").trim()
  }, getAiTokenUsage(value));
}

export async function generateProjectCreationAssistWithAi(input: ProjectCreationAssistInput) {
  const titleNamingStyle = input.titleNamingStyle === "qidian" ? "qidian" : "fanqie";
  const actionConfig: Record<
    ProjectCreationAssistAction,
    {
      task: string;
      outputSchema: Record<string, string>;
      temperature: number;
      maxTokens: number;
    }
  > = {
    titles: {
      task:
        titleNamingStyle === "qidian"
          ? "只生成 6 个中文网文新书名。风格偏起点：更短、更传统、更有类型辨识度和意象感，优先 2-8 个中文字符，最多 12 字。可以使用职业身份、世界观概念、核心意象、命运主题来命名，但严禁照搬任何现有作品名、角色名、专有名词。避免番茄式长句、第一人称设问、逗号标题、强行解释剧情的标题。"
          : "只生成 6 个中文网文新书名。风格偏番茄小说：标题本身要直接带出人物处境、题材、标签、金手指、反差或爽点。不要把构思原句压缩成标题，不要照搬任何现有作品名、角色名、专有名词。标题可长一些，建议 12-32 个中文字符，最多 46 字。",
      outputSchema: {
        titles: "string[]"
      },
      temperature: 0.85,
      maxTokens: 1200
    },
    protagonists: {
      task:
        "只生成 8 个适合该题材的主角名。名字要像中文网文主角，易读、好记、有辨识度；避免生僻字堆砌，避免像真实公众人物。",
      outputSchema: {
        protagonistNames: "string[]"
      },
      temperature: 0.8,
      maxTokens: 350
    },
    description: {
      task:
        "根据已有设想润色或扩写作品简介。简介要符合当前网文平台口味：开头可用【标签+标签+卖点】概括，随后交代主角处境、危机、金手指/关键机制、第一轮爽点和追读钩子。控制在 180-420 字，不能低俗、血腥、违法，不能照搬已有作品。只返回 description 字段，不要额外字段。",
      outputSchema: {
        description: "string"
      },
      temperature: 0.65,
      maxTokens: 1000
    }
  };
  const currentTask = actionConfig[input.action];
  const titleSeedName = input.action === "titles" && input.titleConcept?.trim() ? "" : (input.name ?? "").trim();
  const styleRules = [
    titleNamingStyle === "qidian"
      ? "书名优先短、稳、耐看，有类型气质和记忆点；不要把完整剧情塞进标题，不要使用“我都……怎么……”这类番茄长标题句式。"
      : "书名优先给长标题、强冲突、强卖点、强反差，但不要标题党到看不懂。",
    input.action === "titles" && input.titleConcept?.trim()
      ? "如果提供了起名构思 titleConcept，优先依据它来命名；不要把它原句压缩成标题，也不要让上一轮生成出的 title 反过来主导这一轮。"
      : null,
    input.action === "titles"
      ? "必须同时参考 genre、targetReader 和 tags，不要只围绕 titleConcept 做字面简化；至少体现其中 2 个标签或气质。"
      : null,
    input.action === "titles" && input.titleConcept?.trim()
      ? "如果构思里出现现成作品名、角色名或专有名词，不要直接照搬进书名，要转成原创意象、身份或冲突。"
      : null,
    input.action === "description"
      ? "简介要先让读者知道主角是谁、被什么压住、靠什么翻盘、后面有什么更大期待。"
      : "本次只处理当前任务，不要顺手补充其他字段。",
    "如果用户已经输入内容，请保留核心意思并增强网文吸引力。",
    "所有输出必须服务当前题材和标签，不要生成泛泛模板话。"
  ].filter((item): item is string => Boolean(item));

  const buildMessages = (compact = false) => [
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
              titleConcept: input.titleConcept,
              genre: input.genre,
              targetReader: input.targetReader,
              tags: input.tags ?? [],
              protagonistNames: input.protagonistNames ?? [],
              coreSellingPoint: input.coreSellingPoint,
              goldenFinger: input.goldenFinger,
              openingHook: input.openingHook,
              description: input.description,
              titleNamingStyle
            },
            styleRules,
            retryMode: compact ? "compact_title_retry" : "standard",
            compactRetryRules: compact
              ? [
                  "只返回 titles 数组，不要返回其他字段。",
                  "每个标题控制在 10-28 个中文字符。",
                  "不要复述 titleConcept 的原句，不要使用现成作品或角色名。",
                  "优先生成有悬疑灵异气质、人物身份反差和追读钩子的标题。"
                ]
              : [],
            outputSchema: currentTask.outputSchema
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

    return normalizeResult(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (input.action === "titles" && message.includes("长度限制")) {
      const response = await requestAiJson<Partial<ProjectCreationAssistResult>>({
        messages: buildMessages(true),
        temperature: 0.65,
        maxTokens: 900
      });

      return normalizeResult(response);
    }

    throw error;
  }
}
