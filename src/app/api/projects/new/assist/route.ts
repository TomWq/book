import { assistProjectCreation } from "@/lib/projects";

export const runtime = "nodejs";

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value ?? "")
        .split(/\r?\n|，|、/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rawAction = String(body.action ?? "");
  const action =
    rawAction === "protagonists" || rawAction === "description" || rawAction === "titles"
      ? rawAction
      : "titles";

  try {
    const result = await assistProjectCreation({
      action,
      name: String(body.name ?? ""),
      genre: String(body.genre ?? ""),
      targetReader: String(body.targetReader ?? ""),
      tags: list(body.tags),
      protagonistNames: list(body.protagonistNames),
      coreSellingPoint: String(body.coreSellingPoint ?? ""),
      goldenFinger: String(body.goldenFinger ?? ""),
      openingHook: String(body.openingHook ?? ""),
      description: String(body.description ?? "")
    });

    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 辅助生成失败" },
      { status: 400 }
    );
  }
}
