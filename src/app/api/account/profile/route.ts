import { updateCurrentUserPenName } from "@/lib/projects";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const penName = String(body.penName ?? "").trim();
  const assistantName = String(body.assistantName ?? "").trim();

  try {
    const result = await updateCurrentUserPenName({ penName, assistantName });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存笔名失败" },
      { status: 400 }
    );
  }
}
