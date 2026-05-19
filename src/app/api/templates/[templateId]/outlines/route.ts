import { enqueueGenerateOutlineJob, generateOutline } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await context.params;
  const body = await request.json();

  try {
    const variables = {
      genre: String(body.genre ?? ""),
      protagonist: String(body.protagonist ?? ""),
      goldenFinger: String(body.goldenFinger ?? ""),
      worldBackground: String(body.worldBackground ?? ""),
      pleasureDensity: String(body.pleasureDensity ?? ""),
      romanceStrength: String(body.romanceStrength ?? ""),
      darknessLevel: String(body.darknessLevel ?? ""),
      targetReader: String(body.targetReader ?? ""),
      estimatedLength: String(body.estimatedLength ?? "")
    };

    if (body.defer === true) {
      const job = await enqueueGenerateOutlineJob(templateId, variables);
      return Response.json({ job }, { status: 201 });
    }

    const outline = await generateOutline(templateId, variables);

    return Response.json({ outline }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "生成大纲失败" },
      { status: 400 }
    );
  }
}
