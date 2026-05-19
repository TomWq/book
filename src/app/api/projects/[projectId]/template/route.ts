import { createTemplateFromProject } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  try {
    const template = await createTemplateFromProject(projectId);
    return Response.json({ template }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存模板失败" },
      { status: 400 }
    );
  }
}
