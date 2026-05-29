import { randomUUID } from "node:crypto";
import { createInspiration } from "@/lib/projects";
import type { InspirationAiOutput, InspirationStatus, InspirationType } from "@/lib/project-types";

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

function statusParam(value: unknown): InspirationStatus {
  return value === "polished" || value === "used" || value === "archived" ? value : "raw";
}

function previewOutput(value: unknown): InspirationAiOutput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<InspirationAiOutput>;
  const mode = raw.mode;

  if (
    mode !== "polish" &&
    mode !== "expand_setting" &&
    mode !== "web_novelize" &&
    mode !== "selling_point" &&
    mode !== "pleasure_analysis" &&
    mode !== "variants" &&
    mode !== "task_card" &&
    mode !== "character_draft" &&
    mode !== "foreshadowing_draft"
  ) {
    return null;
  }

  return {
    id: String(raw.id ?? randomUUID()),
    mode,
    title: String(raw.title ?? "").trim(),
    content: String(raw.content ?? "").trim(),
    changes: Array.isArray(raw.changes)
      ? raw.changes.map((item) => String(item).trim()).filter(Boolean)
      : [],
    suggestions: Array.isArray(raw.suggestions)
      ? raw.suggestions.map((item) => String(item).trim()).filter(Boolean)
      : [],
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((item) => String(item).trim()).filter(Boolean)
      : [],
    usedAi: Boolean(raw.usedAi),
    usedFallback: Boolean(raw.usedFallback),
    createdAt: String(raw.createdAt ?? new Date().toISOString())
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const output = previewOutput(body.output);

  if (!output || !output.content) {
    return Response.json({ error: "请先生成 AI 润色预览" }, { status: 400 });
  }

  try {
    const inspiration = await createInspiration({
      title: output.title || String(body.title ?? ""),
      content: output.content,
      type: typeParam(body.type),
      tags: list(output.tags.length ? output.tags : body.tags),
      projectId: String(body.projectId ?? ""),
      status: statusParam(body.status ?? "polished"),
      aiOutputs: [output]
    });

    return Response.json({ inspiration }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存润色灵感失败" },
      { status: 400 }
    );
  }
}
