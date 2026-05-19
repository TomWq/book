import { importSourceText } from "@/lib/projects";

export const runtime = "nodejs";

function readSourceType(value: unknown) {
  return value === "txt" ? "txt" : "paste";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = await request.json();
  const content = String(body.content ?? "").trim();

  if (!content) {
    return Response.json({ error: "文本不能为空" }, { status: 400 });
  }

  try {
    const result = await importSourceText({
      projectId,
      title: String(body.title ?? ""),
      sourceType: readSourceType(body.sourceType),
      content
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "导入失败" },
      { status: 400 }
    );
  }
}
