import { previewInspirationPolish } from "@/lib/projects";
import type { InspirationPolishMode, InspirationType } from "@/lib/project-types";

export const runtime = "nodejs";

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value ?? "")
        .split(/\r?\n|，|、/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function typeParam(value: unknown): InspirationType | undefined {
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
    : undefined;
}

function modeParam(value: unknown): InspirationPolishMode {
  return value === "expand_setting" ||
    value === "web_novelize" ||
    value === "selling_point" ||
    value === "pleasure_analysis" ||
    value === "variants" ||
    value === "task_card" ||
    value === "character_draft" ||
    value === "foreshadowing_draft"
    ? value
    : "polish";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const content = String(body.content ?? "").trim();

  if (!content) {
    return Response.json({ error: "请先填写灵感内容" }, { status: 400 });
  }

  try {
    const result = await previewInspirationPolish(
      {
        title: String(body.title ?? ""),
        content,
        type: typeParam(body.type),
        tags: list(body.tags),
        projectId: String(body.projectId ?? "")
      },
      modeParam(body.mode)
    );

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 润色预览失败" },
      { status: 400 }
    );
  }
}
