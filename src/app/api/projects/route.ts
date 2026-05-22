import { createProject, getProjects } from "@/lib/projects";

export const runtime = "nodejs";

function readProjectType(value: unknown) {
  return value === "writing" ? "writing" : "analysis";
}

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value ?? "")
        .split(/\r?\n|，|、/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export async function GET() {
  const projects = await getProjects();
  return Response.json({ projects });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();

  if (!name) {
    return Response.json({ error: "项目名称不能为空" }, { status: 400 });
  }

  const project = await createProject({
    name,
    type: readProjectType(body.type),
    genre: String(body.genre ?? ""),
    description: String(body.description ?? ""),
    coverImageUrl: String(body.coverImageUrl ?? ""),
    initialState: {
      targetReader: String(body.targetReader ?? ""),
      tags: list(body.tags),
      protagonistNames: list(body.protagonistNames),
      coreSellingPoint: String(body.coreSellingPoint ?? ""),
      openingHook: String(body.openingHook ?? ""),
      goldenFinger: String(body.goldenFinger ?? ""),
      writingGoal: String(body.writingGoal ?? ""),
      outlineId: String(body.outlineId ?? ""),
      outlineLogline: String(body.outlineLogline ?? ""),
      worldSetting: String(body.worldSetting ?? ""),
      outlineChapters: list(body.outlineChapters),
      first100Pacing: String(body.first100Pacing ?? ""),
      foreshadowingPlan: list(body.foreshadowingPlan),
      pleasureDistribution: String(body.pleasureDistribution ?? "")
    }
  });

  return Response.json({ project }, { status: 201 });
}
