import { previewInspirationTransform } from "@/lib/projects";
import type { InspirationTransformTarget } from "@/lib/project-types";

export const runtime = "nodejs";

function targetParam(value: unknown): InspirationTransformTarget {
  return value === "character" ||
    value === "foreshadowing" ||
    value === "task_card" ||
    value === "bible" ||
    value === "worldbuilding" ||
    value === "short_outline" ||
    value === "variants"
    ? value
    : "task_card";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ inspirationId: string }> }
) {
  const { inspirationId } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await previewInspirationTransform(inspirationId, targetParam(body.target));
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "灵感转化失败" },
      { status: 400 }
    );
  }
}
