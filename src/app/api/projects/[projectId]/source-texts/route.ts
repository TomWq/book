import { importSourceText } from "@/lib/projects";

export const runtime = "nodejs";

function readSourceType(value: unknown) {
  return value === "txt" ? "txt" : "paste";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const content = String(body.content ?? "").trim();

    if (!content) {
      return Response.json({ error: "文本不能为空" }, { status: 400 });
    }

    const result = await importSourceText({
      projectId,
      title: String(body.title ?? ""),
      sourceType: readSourceType(body.sourceType),
      content
    });

    return Response.json(
      {
        sourceText: {
          id: result.sourceText.id,
          title: result.sourceText.title,
          charCount: result.sourceText.charCount
        },
        chapterCount: result.chapters.length
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "导入失败" },
      { status: 400 }
    );
  }
}
