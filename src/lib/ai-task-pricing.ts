export type AiTaskPricingDefinition = {
  type: string;
  label: string;
  unitLabel: string;
  baseCredits: number;
  unitCredits: number;
  multiplier: number;
};

export type AiTaskPricingOverride = {
  baseCredits?: number;
  unitCredits?: number;
  multiplier?: number;
};

export type AiTaskPricingOverrides = Record<string, AiTaskPricingOverride>;

export type ResolvedAiTaskPricing = AiTaskPricingDefinition & {
  isCustom: boolean;
};

export const AI_TASK_PRICING_DEFINITIONS: AiTaskPricingDefinition[] = [
  {
    type: "analyze_chapters",
    label: "章节分析",
    unitLabel: "章",
    baseCredits: 0,
    unitCredits: 20,
    multiplier: 1
  },
  {
    type: "generate_outline",
    label: "生成大纲",
    unitLabel: "次",
    baseCredits: 800,
    unitCredits: 0,
    multiplier: 1
  },
  {
    type: "generate_task_card",
    label: "生成任务卡",
    unitLabel: "次",
    baseCredits: 120,
    unitCredits: 0,
    multiplier: 1
  },
  {
    type: "generate_long_form_plan",
    label: "生成长篇规划",
    unitLabel: "次",
    baseCredits: 300,
    unitCredits: 0,
    multiplier: 1
  },
  {
    type: "project_creation_assist",
    label: "建书辅助",
    unitLabel: "次",
    baseCredits: 60,
    unitCredits: 0,
    multiplier: 1
  },
  {
    type: "generate_chapter",
    label: "创作正文",
    unitLabel: "章",
    baseCredits: 900,
    unitCredits: 0,
    multiplier: 1
  },
  {
    type: "update_chapter_state",
    label: "更新状态",
    unitLabel: "次",
    baseCredits: 160,
    unitCredits: 0,
    multiplier: 1
  },
  {
    type: "review_chapter",
    label: "章节审稿",
    unitLabel: "次",
    baseCredits: 240,
    unitCredits: 0,
    multiplier: 1
  },
  {
    type: "edit_second_draft",
    label: "二稿编辑",
    unitLabel: "千字",
    baseCredits: 180,
    unitCredits: 80,
    multiplier: 1
  }
];

export function getAiTaskPricingDefinition(type: string) {
  return AI_TASK_PRICING_DEFINITIONS.find((item) => item.type === type);
}

function inputObject(payload?: unknown) {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

function nonNegativeNumber(value: unknown, fallback: number) {
  if (value === "" || value == null) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function hasCustomValue(value: unknown) {
  return value !== "" && value != null && Number.isFinite(Number(value));
}

export function normalizeAiTaskPricingOverrides(raw: unknown): AiTaskPricingOverrides {
  const source = inputObject(raw);
  const overrides: AiTaskPricingOverrides = {};

  for (const definition of AI_TASK_PRICING_DEFINITIONS) {
    const rawOverride = inputObject(source[definition.type]);
    const override: AiTaskPricingOverride = {};

    if (hasCustomValue(rawOverride.baseCredits)) {
      override.baseCredits = Math.round(nonNegativeNumber(rawOverride.baseCredits, definition.baseCredits));
    }

    if (hasCustomValue(rawOverride.unitCredits)) {
      override.unitCredits = Math.round(nonNegativeNumber(rawOverride.unitCredits, definition.unitCredits));
    }

    if (hasCustomValue(rawOverride.multiplier)) {
      override.multiplier = Math.round(nonNegativeNumber(rawOverride.multiplier, definition.multiplier) * 100) / 100;
    }

    const hasMeaningfulOverride =
      (override.baseCredits != null && override.baseCredits !== definition.baseCredits) ||
      (override.unitCredits != null && override.unitCredits !== definition.unitCredits) ||
      (override.multiplier != null && override.multiplier !== definition.multiplier);

    if (hasMeaningfulOverride) {
      overrides[definition.type] = override;
    }
  }

  return overrides;
}

export function resolveAiTaskPricing(
  type: string,
  overrides?: AiTaskPricingOverrides | null
): ResolvedAiTaskPricing {
  const definition =
    getAiTaskPricingDefinition(type) ??
    ({
      type,
      label: "AI 任务",
      unitLabel: "次",
      baseCredits: 100,
      unitCredits: 0,
      multiplier: 1
    } satisfies AiTaskPricingDefinition);
  const override = overrides?.[type] ?? {};
  const isCustom = Object.keys(override).length > 0;

  return {
    ...definition,
    baseCredits: nonNegativeNumber(override.baseCredits, definition.baseCredits),
    unitCredits: nonNegativeNumber(override.unitCredits, definition.unitCredits),
    multiplier: nonNegativeNumber(override.multiplier, definition.multiplier),
    isCustom
  };
}

export function getAiTaskUnitCount(type: string, payload?: unknown) {
  const input = inputObject(payload);
  const variables = inputObject(input.variables);

  switch (type) {
    case "analyze_chapters":
      return Math.max(1, Math.floor(nonNegativeNumber(input.chapterCount, 1)));
    case "edit_second_draft": {
      const text = String(input.originalText ?? input.text ?? variables.originalText ?? "");
      return Math.max(1, Math.ceil(text.length / 1000));
    }
    default:
      return 1;
  }
}

export function estimateAiTaskCredits(
  type: string,
  payload?: unknown,
  overrides?: AiTaskPricingOverrides | null
) {
  const pricing = resolveAiTaskPricing(type, overrides);
  const units = getAiTaskUnitCount(type, payload);
  const rawCredits = (pricing.baseCredits + pricing.unitCredits * units) * pricing.multiplier;

  return Math.max(0, Math.ceil(rawCredits));
}
