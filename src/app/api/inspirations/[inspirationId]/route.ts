import { deleteInspiration, getInspiration, updateInspiration } from "@/lib/projects";
import type { InspirationStatus, InspirationType, StoredInspiration } from "@/lib/project-types";

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

function statusParam(value: unknown): InspirationStatus | undefined {
  return value === "raw" || value === "polished" || value === "used" || value === "archived"
    ? value
    : undefined;
}

function linkedEntityTypeParam(value: unknown): StoredInspiration["linkedEntityType"] | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return value === "project" ||
    value === "character" ||
    value === "foreshadowing" ||
    value === "chapter" ||
    value === "task_card" ||
    value === "outline" ||
    value === "bible"
    ? value
    : undefined;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ inspirationId: string }> }
) {
  const { inspirationId } = await context.params;
  const inspiration = await getInspiration(inspirationId);

  if (!inspiration) {
    return Response.json({ error: "灵感不存在" }, { status: 404 });
  }

  return Response.json({ inspiration });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ inspirationId: string }> }
) {
  const { inspirationId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const hasProjectId = Object.prototype.hasOwnProperty.call(body, "projectId");
  const hasLinkedEntityId = Object.prototype.hasOwnProperty.call(body, "linkedEntityId");

  try {
    const inspiration = await updateInspiration(inspirationId, {
      title: typeof body.title === "string" ? body.title : undefined,
      content: typeof body.content === "string" ? body.content : undefined,
      type: typeParam(body.type),
      tags: body.tags === undefined ? undefined : list(body.tags),
      status: statusParam(body.status),
      projectId: hasProjectId
        ? body.projectId == null || body.projectId === "" ? null : String(body.projectId)
        : undefined,
      linkedEntityType: linkedEntityTypeParam(body.linkedEntityType),
      linkedEntityId: hasLinkedEntityId
        ? body.linkedEntityId == null || body.linkedEntityId === "" ? null : String(body.linkedEntityId)
        : undefined
    });

    return Response.json({ inspiration });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "更新灵感失败" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ inspirationId: string }> }
) {
  const { inspirationId } = await context.params;

  try {
    const result = await deleteInspiration(inspirationId);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "删除灵感失败" },
      { status: 400 }
    );
  }
}
