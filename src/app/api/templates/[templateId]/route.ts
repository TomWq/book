import { getLatestOutlineByTemplate, getTemplate, updateTemplate } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await context.params;
  const [template, latestOutline] = await Promise.all([
    getTemplate(templateId),
    getLatestOutlineByTemplate(templateId)
  ]);

  if (!template) {
    return Response.json({ error: "模板不存在" }, { status: 404 });
  }

  return Response.json({ template, latestOutline });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await context.params;
  const body = await request.json();

  try {
    const template = await updateTemplate(templateId, {
      name: String(body.name ?? ""),
      genre: String(body.genre ?? ""),
      description: String(body.description ?? ""),
      openingHook: String(body.openingHook ?? ""),
      mainLoop: String(body.mainLoop ?? ""),
      chapterPacing: String(body.chapterPacing ?? ""),
      formula: String(body.formula ?? ""),
      migrationAdvice: String(body.migrationAdvice ?? ""),
      protagonistModel: String(body.protagonistModel ?? ""),
      goldenFinger: String(body.goldenFinger ?? ""),
      usablePatterns: Array.isArray(body.usablePatterns)
        ? body.usablePatterns.map((item: unknown) => String(item)).filter(Boolean)
        : [],
      avoidCopying: Array.isArray(body.avoidCopying)
        ? body.avoidCopying.map((item: unknown) => String(item)).filter(Boolean)
        : [],
      tags: Array.isArray(body.tags) ? body.tags.map((item: unknown) => String(item)).filter(Boolean) : []
    });

    return Response.json({ template });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "更新模板失败" },
      { status: 400 }
    );
  }
}
