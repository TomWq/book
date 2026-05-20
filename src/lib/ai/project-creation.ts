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
  const titleTask = titleNamingStyle === "qidian"
    ? "生成 6 个中文网文新书名。风格偏起点：更短、更传统、更有类型辨识度和意象感，优先 2-8 个中文字符，最多 12 字。可以使用职业身份、世界观概念、核心意象、命运主题来命名，例如偏《诡秘之主》《大奉打更人》《夜的命名术》《灵境行者》《赤心巡天》这类气质，但严禁照搬任何现有作品名。避免番茄式长句、第一人称设问、逗号标题、强行解释剧情的标题。"
    : "生成 6 个中文网文新书名。风格偏番茄小说：标题本身要直接带出人物处境、金手指、反差或爽点，常见形式可以是第一人称、设问、强反差、开局处境，例如“我都准备躺平了，同学们怎么才开挂”。不要照搬任何现有作品名。标题可长一些，建议 12-36 个中文字符，最多 60 字。";
  const actionPrompt = {
    titles: titleTask,
    protagonists:
      "生成 8 个适合该题材的主角名。名字要像中文网文主角，易读、好记、有辨识度；避免生僻字堆砌，避免像真实公众人物。",
    description:
      "根据已有设想润色或扩写作品简介。简介要符合当前网文平台口味：开头可用【标签+标签+卖点】概括，随后交代主角处境、危机、金手指/关键机制、第一轮爽点和追读钩子。控制在 180-420 字，不能低俗、血腥、违法，不能照搬已有作品。"
  } satisfies Record<ProjectCreationAssistAction, string>;

  const response = await requestAiJson<Partial<ProjectCreationAssistResult>>({
    messages: [
      {
        role: "system",
        content:
          "你是中文网文平台的新书立项编辑，擅长番茄、起点、七猫等平台常见的书名、简介和主角命名包装。请严格输出 JSON，不要输出解释。你的目标是帮作者生成原创方案，不能复制已有作品名、简介、角色和专有设定。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: actionPrompt[input.action],
            currentProject: {
              name: input.name,
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
            styleRules: [
              titleNamingStyle === "qidian"
                ? "书名优先短、稳、耐看，有类型气质和记忆点；不要把完整剧情塞进标题，不要使用“我都……怎么……”这类番茄长标题句式。"
                : "书名优先给长标题、强冲突、强卖点、强反差，但不要标题党到看不懂。",
              "简介要先让读者知道主角是谁、被什么压住、靠什么翻盘、后面有什么更大期待。",
              "如果用户已经输入内容，请保留核心意思并增强网文吸引力。",
              "所有输出必须服务当前题材和标签，不要生成泛泛模板话。"
            ],
            outputSchema: {
              titles: "string[]",
              protagonistNames: "string[]",
              description: "string"
            }
          },
          null,
          2
        )
      }
    ],
    temperature: input.action === "description" ? 0.65 : 0.85,
    maxTokens: input.action === "description" ? 1200 : 900
  });

  return normalizeResult(response);
}
