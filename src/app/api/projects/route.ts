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

function characterList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const raw = item as { name?: unknown; role?: unknown };
      const name = String(raw.name ?? "").trim();
      const role = String(raw.role ?? "").trim();

      return name ? { name, role } : null;
    })
    .filter((item): item is { name: string; role: string } => Boolean(item));
}

function readWorkLengthType(value: unknown) {
  return value === "short" || value === "medium" || value === "long" || value === "epic" ? value : "medium";
}

function readTargetTotalWords(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 500000;
  }

  return Math.min(5000000, Math.max(50000, Math.round(numberValue)));
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
    authorName: String(body.authorName ?? ""),
    type: readProjectType(body.type),
    genre: String(body.genre ?? ""),
    description: String(body.description ?? ""),
    coverImageUrl: String(body.coverImageUrl ?? ""),
    initialState: {
      targetReader: String(body.targetReader ?? ""),
      tagTaxonomyStyle: body.tagTaxonomyStyle === "qidian" ? "qidian" : "fanqie",
      tags: list(body.tags),
      protagonistNames: list(body.protagonistNames),
      protagonistCharacters: characterList(body.protagonistCharacters),
      workLengthType: readWorkLengthType(body.workLengthType),
      targetTotalWords: readTargetTotalWords(body.targetTotalWords),
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
