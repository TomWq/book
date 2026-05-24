import {
  chatWithWritingAssistant,
  deleteWritingAssistantThread,
  getWritingAssistantThread,
  listWritingAssistantThreads,
  updateWritingAssistantThreadTitle
} from "@/lib/projects";

export const runtime = "nodejs";

function textParam(value: FormDataEntryValue | null) {
  return value == null ? "" : String(value).trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId")?.trim();
  const projectId = url.searchParams.get("projectId")?.trim();

  try {
    if (threadId) {
      const result = await getWritingAssistantThread(threadId);
      return Response.json(result);
    }

    const threads = await listWritingAssistantThreads(projectId || undefined);
    return Response.json({ threads });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 创作顾问暂时不可用" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("multipart/form-data")
    ? await request.formData().catch(() => new FormData())
    : await request.json().catch(() => ({}));
  const question = body instanceof FormData ? textParam(body.get("question")) : String(body.question ?? "").trim();
  const projectId = body instanceof FormData ? textParam(body.get("projectId")) : String(body.projectId ?? "").trim();
  const threadId = body instanceof FormData ? textParam(body.get("threadId")) : String(body.threadId ?? "").trim();

  try {
    const result = await chatWithWritingAssistant({
      question,
      projectId: projectId || undefined,
      threadId: threadId || undefined
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 创作顾问暂时不可用" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId")?.trim();

  if (!threadId) {
    return Response.json({ error: "缺少对话 ID" }, { status: 400 });
  }

  try {
    const result = await deleteWritingAssistantThread(threadId);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 创作顾问暂时不可用" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const threadId = String(body.threadId ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!threadId) {
    return Response.json({ error: "缺少对话 ID" }, { status: 400 });
  }

  try {
    const result = await updateWritingAssistantThreadTitle({ threadId, title });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 创作顾问暂时不可用" },
      { status: 400 }
    );
  }
}
