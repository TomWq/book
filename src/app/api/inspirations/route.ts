import { createInspiration, getInspirations } from "@/lib/projects";
import type { InspirationStatus, InspirationType } from "@/lib/project-types";

export const runtime = "nodejs";

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value ?? "")
        .split(/\r?\n|，|、/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function typeParam(value: string | null): InspirationType | "" {
  return value === "plot" ||
    value === "character" ||
    value === "worldbuilding" ||
    value === "pleasure_point" ||
    value === "foreshadowing" ||
    value === "setting" ||
    value === "line" ||
    value === "topic" ||
    value === "title" ||
    value === "other"
    ? value
    : "";
}

function statusParam(value: string | null): InspirationStatus | "" {
  return value === "raw" || value === "polished" || value === "used" || value === "archived"
    ? value
    : "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const inspirations = await getInspirations({
    query: url.searchParams.get("q") ?? "",
    type: typeParam(url.searchParams.get("type")),
    status: statusParam(url.searchParams.get("status")),
    projectId: url.searchParams.get("projectId") ?? ""
  });

  return Response.json({ inspirations });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const content = String(body.content ?? "").trim();

  if (!content) {
    return Response.json({ error: "灵感内容不能为空" }, { status: 400 });
  }

  try {
    const inspiration = await createInspiration({
      title: String(body.title ?? ""),
      content,
      type: typeParam(String(body.type ?? "")) || undefined,
      tags: list(body.tags),
      projectId: String(body.projectId ?? "")
    });

    return Response.json({ inspiration }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存灵感失败" },
      { status: 400 }
    );
  }
}
