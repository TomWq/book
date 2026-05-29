import { polishInspiration } from "@/lib/projects";

export const runtime = "nodejs";

function normalizeMode(value: unknown) {
  return value === "expand_setting" ||
    value === "web_novelize" ||
    value === "selling_point" ||
    value === "pleasure_analysis" ||
    value === "variants" ||
    value === "task_card" ||
    value === "character_draft" ||
    value === "foreshadowing_draft"
    ? value
    : "polish";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ inspirationId: string }> }
) {
  const { inspirationId } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await polishInspiration(inspirationId, normalizeMode(body.mode));
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 润色失败" },
      { status: 400 }
    );
  }
}
