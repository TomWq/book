export type AiModelPresetGroup = {
  label: string;
  options: Array<{
    value: string;
    label: string;
  }>;
};

export const AI_MODEL_PRESET_GROUPS: AiModelPresetGroup[] = [
  {
    label: "OpenAI / 兼容接口",
    options: [
      { value: "gpt-4.1", label: "gpt-4.1" },
      { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { value: "gpt-4.1-nano", label: "gpt-4.1-nano" },
      { value: "o4-mini", label: "o4-mini" }
    ]
  },
  {
    label: "通用兼容模型",
    options: [
      { value: "qwen-plus", label: "qwen-plus" },
      { value: "qwen-max", label: "qwen-max" },
      { value: "moonshot-v1-8k", label: "moonshot-v1-8k" },
      { value: "moonshot-v1-32k", label: "moonshot-v1-32k" },
      { value: "kimi-k2", label: "kimi-k2" }
    ]
  },
  {
    label: "其他常用模型",
    options: [
      { value: "claude-3-5-sonnet-20241022", label: "claude-3-5-sonnet-20241022" },
      { value: "gemini-2.5-pro", label: "gemini-2.5-pro" }
    ]
  }
];

export const AI_MODEL_PRESET_VALUES = AI_MODEL_PRESET_GROUPS.flatMap((group) =>
  group.options.map((item) => item.value)
);
