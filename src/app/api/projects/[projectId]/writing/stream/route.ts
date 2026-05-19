import {
  countDraftCharacters,
  isChapterDraftEndingIncomplete,
  minimumDraftCharacters,
  streamChapterDraftExpansionTextWithAi,
  streamChapterDraftTextWithAi,
  streamEditDraftTextWithAi
} from "@/lib/ai/writing";
import { combineAiTokenUsages, type AiTokenUsage } from "@/lib/ai/client";
import {
  prepareChapterDraftStream,
  prepareEditDraftTextStream,
  saveStreamedChapterDraft,
  saveStreamedEditReport
} from "@/lib/projects";

export const runtime = "nodejs";

function streamText(
  handler: (enqueue: (chunk: string) => void) => Promise<void>
) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

        try {
          await handler(enqueue);
        } catch (error) {
          enqueue(`\n\n[生成失败] ${error instanceof Error ? error.message : "流式任务失败"}`);
        } finally {
          controller.close();
        }
      }
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no"
      }
    }
  );
}

async function streamFallbackText(text: string, enqueue: (chunk: string) => void) {
  const paragraphs = text.split(/(\n+)/);

  for (const paragraph of paragraphs) {
    if (paragraph) {
      enqueue(paragraph);
    }
  }
}

function hasUsableDraftContent(content: string, targetWordCount?: number) {
  return countDraftCharacters(content) >= minimumDraftCharacters(targetWordCount);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = await request.json();
  const action = String(body.action ?? "");

  if (action === "generate_draft") {
    const prepared = await prepareChapterDraftStream(projectId, String(body.taskCardId ?? ""), {
      targetWordCount: Number(body.targetWordCount ?? 0) || undefined
    });

    return streamText(async (enqueue) => {
      let content = "";
      let usedAi = false;
      const tokenUsages: AiTokenUsage[] = [];
      const targetWordCount = prepared.context.targetWordCount;

      if (prepared.useAi) {
        try {
          for await (const chunk of streamChapterDraftTextWithAi(prepared.context, (usage) => {
            tokenUsages.push(usage);
          })) {
            usedAi = true;
            content += chunk;
            enqueue(chunk);
          }

          if (
            usedAi &&
            (countDraftCharacters(content) < minimumDraftCharacters(targetWordCount) ||
              isChapterDraftEndingIncomplete(content))
          ) {
            enqueue(
              `\n\n[正文需要补足，正在续写完整结尾：当前 ${countDraftCharacters(content)} 字，最低参考 ${minimumDraftCharacters(targetWordCount)} 字]\n\n`
            );

            for await (const chunk of streamChapterDraftExpansionTextWithAi(
              prepared.context,
              content,
              (usage) => {
                tokenUsages.push(usage);
              }
            )) {
              content += chunk;
              enqueue(chunk);
            }
          }

          if (usedAi && isChapterDraftEndingIncomplete(content)) {
            enqueue("\n\n[结尾仍疑似被截断，正在二次补尾]\n\n");

            for await (const chunk of streamChapterDraftExpansionTextWithAi(
              prepared.context,
              content,
              (usage) => {
                tokenUsages.push(usage);
              }
            )) {
              content += chunk;
              enqueue(chunk);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "AI 流式生成失败";

          if (content.trim()) {
            if (!hasUsableDraftContent(content, targetWordCount)) {
              throw new Error(
                `${message}；已生成正文只有 ${countDraftCharacters(content)} 字，低于最低要求 ${minimumDraftCharacters(targetWordCount)} 字，未保存为章节草稿。`
              );
            }

            enqueue(`\n\n[AI 流式生成提前结束，已保留并保存前面生成的正文：${message}]\n\n`);
          } else {
            throw new Error(`${message}；AI 没有返回正文，未保存为章节草稿。`);
          }
        }
      } else {
        throw new Error("AI 未配置，无法生成章节正文。");
      }

      await saveStreamedChapterDraft({
        projectId: prepared.projectId,
        taskCardId: prepared.taskCard.id,
        jobId: prepared.jobId,
        content,
        usedAi,
        tokenUsage: combineAiTokenUsages(tokenUsages)
      });
    });
  }

  if (action === "edit_text") {
    const prepared = await prepareEditDraftTextStream(projectId, {
      mode: String(body.mode ?? "网文作者版"),
      text: String(body.text ?? ""),
      draftId: body.draftId ? String(body.draftId) : undefined
    });

    return streamText(async (enqueue) => {
      let revisedText = "";
      let usedAi = false;
      let tokenUsage: AiTokenUsage | undefined;

      if (prepared.useAi) {
        try {
          for await (const chunk of streamEditDraftTextWithAi({
            mode: prepared.mode,
            originalText: prepared.originalText
          }, (usage) => {
            tokenUsage = usage;
          })) {
            usedAi = true;
            revisedText += chunk;
            enqueue(chunk);
          }
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : "AI 流式改写失败");
        }
      } else {
        throw new Error("AI 未配置，无法生成二稿。");
      }

      await saveStreamedEditReport({
        projectId: prepared.projectId,
        jobId: prepared.jobId,
        mode: prepared.mode,
        originalText: prepared.originalText,
        draftId: prepared.draftId,
        revisedText,
        usedAi,
        tokenUsage
      });
    });
  }

  return Response.json({ error: "未知流式写作动作" }, { status: 400 });
}
