import { updateUserAiControls } from "@/lib/projects";
import { AI_TASK_PRICING_DEFINITIONS } from "@/lib/ai-task-pricing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const aiTaskPricingOverrides = Object.fromEntries(
    AI_TASK_PRICING_DEFINITIONS.map((definition) => [
      definition.type,
      {
        baseCredits: body[`pricing.${definition.type}.baseCredits`],
        unitCredits: body[`pricing.${definition.type}.unitCredits`],
        multiplier: body[`pricing.${definition.type}.multiplier`]
      }
    ])
  );

  try {
    await updateUserAiControls({
      userId: String(body.userId ?? "").trim(),
      model: String(body.model ?? "").trim(),
      aiBillingMarkup: Number(body.aiBillingMarkup ?? 0),
      aiBillingMinimum: Number(body.aiBillingMinimum ?? 0),
      aiTaskPricingOverrides
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "更新用户 AI 控制失败" },
      { status: 400 }
    );
  }
}
