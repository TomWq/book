import { createManualChapter, getProjectChapters } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const chapters = await getProjectChapters(projectId);

  return Response.json({ chapters });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = await request.json();

  try {
    const chapter = await createManualChapter(projectId, {
      title: String(body.title ?? ""),
      content: String(body.content ?? "")
    });

    return Response.json({ chapter }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "创建章节失败" },
      { status: 400 }
    );
  }
}
