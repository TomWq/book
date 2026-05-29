import { confirmInspirationTransform } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ inspirationId: string }> }
) {
  const { inspirationId } = await context.params;
  const body = await request.json().catch(() => ({}));

  if (!body.draft || typeof body.draft !== "object") {
    return Response.json({ error: "请先生成并确认转化草稿" }, { status: 400 });
  }

  try {
    const result = await confirmInspirationTransform(inspirationId, body.draft);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "写入项目资产失败" },
      { status: 400 }
    );
  }
}
