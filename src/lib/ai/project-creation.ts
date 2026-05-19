import {
  attachAiTokenUsage,
  getAiTokenUsage,
  requestAiJson
} from "@/lib/ai/client";

export type ProjectCreationAssistAction = "titles" | "protagonists" | "description";

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
  const actionPrompt = {
    titles:
      "生成 6 个中文网文新书名。风格参考当前平台常见长标题：标题本身要带出人物处境、金手指、反差或爽点，例如“我都准备躺平了，同学们怎么才开挂”。不要照搬任何现有作品名。标题可长一些，建议 12-36 个中文字符，最多 60 字。",
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
              description: input.description
            },
            styleRules: [
              "书名优先给长标题、强冲突、强卖点、强反差，但不要标题党到看不懂。",
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
