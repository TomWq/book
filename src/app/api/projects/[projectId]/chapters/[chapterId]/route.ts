import {
  deleteProjectChapter,
  moveProjectChapter,
  updateProjectChapter
} from "@/lib/projects";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; chapterId: string }> }
) {
  const { projectId, chapterId } = await context.params;
  const body = await request.json();
  const action = String(body.action ?? "");

  try {
    if (action === "move") {
      const chapter = await moveProjectChapter(
        projectId,
        chapterId,
        body.direction === "down" ? "down" : "up"
      );

      return Response.json({ chapter });
    }

    const chapter = await updateProjectChapter(projectId, chapterId, {
      title: String(body.title ?? ""),
      content: String(body.content ?? "")
    });

    return Response.json({ chapter });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "更新章节失败" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; chapterId: string }> }
) {
  const { projectId, chapterId } = await context.params;

  try {
    await deleteProjectChapter(projectId, chapterId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "删除章节失败" },
      { status: 400 }
    );
  }
}
