import {
  prepareWritingAssistantStream,
  saveWritingAssistantStreamReply
} from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const question = String(body.question ?? "").trim();
  const projectId = String(body.projectId ?? "").trim();
  const threadId = String(body.threadId ?? "").trim();

  try {
    const result = await prepareWritingAssistantStream({
      question,
      projectId: projectId || undefined,
      threadId: threadId || undefined
    });
    const encoder = new TextEncoder();
    let assistantContent = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            assistantContent += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          await saveWritingAssistantStreamReply({
            threadId: result.thread.id,
            ownerUserId: result.ownerUserId,
            content: assistantContent
          });
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "AI 创作顾问暂时不可用";
          const isLengthLimit = message.includes("长度限制截断");
          const errorText = assistantContent.trim() && isLengthLimit
            ? "\n\n（这次回答内容较长，我先停在这里。你可以继续问“接着说”，我会沿着刚才的内容继续展开。）"
            : `\n\n[生成中断] ${message}`;
          assistantContent += errorText;
          controller.enqueue(encoder.encode(errorText));
          await saveWritingAssistantStreamReply({
            threadId: result.thread.id,
            ownerUserId: result.ownerUserId,
            content: assistantContent
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-assistant-thread-id": result.thread.id,
        "x-assistant-thread-title": encodeURIComponent(result.thread.title)
      }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 创作顾问暂时不可用" },
      { status: 400 }
    );
  }
}
