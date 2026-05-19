import { deleteProject, getProject } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const project = await getProject(projectId);

  if (!project) {
    return Response.json({ error: "项目不存在" }, { status: 404 });
  }

  return Response.json({ project });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  try {
    const result = await deleteProject(projectId);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "删除项目失败" },
      { status: 400 }
    );
  }
}
