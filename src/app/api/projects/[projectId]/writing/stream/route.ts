import {
  countDraftCharacters,
  isChapterDraftEndingIncomplete,
  minimumDraftExpansionCharacters,
  minimumSavableDraftCharacters,
  prepareChapterDraftContentForSave,
  streamChapterDraftClosingTextWithAi,
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

const streamDraftSavingMarker = "[[AI_NOVEL_WORKBENCH:STREAM_DRAFT_SAVING]]";
const streamDraftFinalMarker = "[[AI_NOVEL_WORKBENCH:STREAM_DRAFT_FINAL]]";

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
  return countDraftCharacters(content) >= minimumSavableDraftCharacters(targetWordCount);
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
      const appendExpansion = async (message: string) => {
        enqueue(`\n\n[${message}]\n\n`);

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
      };
      const appendClosing = async (message: string) => {
        enqueue(`\n\n[${message}]\n\n`);

        for await (const chunk of streamChapterDraftClosingTextWithAi(
          prepared.context,
          content,
          (usage) => {
            tokenUsages.push(usage);
          }
        )) {
          content += chunk;
          enqueue(chunk);
        }
      };

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
            (countDraftCharacters(content) < minimumDraftExpansionCharacters(targetWordCount) ||
              isChapterDraftEndingIncomplete(content))
          ) {
            await appendExpansion(
              `正文需要补足，正在续写完整结尾：当前 ${countDraftCharacters(content)} 字，目标参考 ${minimumDraftExpansionCharacters(targetWordCount)} 字`
            );
          }

          if (usedAi && isChapterDraftEndingIncomplete(content)) {
            await appendExpansion("结尾仍疑似被截断，正在二次补尾");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "AI 流式生成失败";
          const isLengthLimit = message.includes("长度限制") || message.toLowerCase().includes("length");

          if (content.trim()) {
            let closingErrorMessage = "";

            if (isLengthLimit || isChapterDraftEndingIncomplete(content)) {
              try {
                await appendClosing(`AI 输出被长度限制截断，正在补完整句结尾：当前 ${countDraftCharacters(content)} 字`);

                if (isChapterDraftEndingIncomplete(content)) {
                  await appendClosing("补尾后结尾仍不完整，正在最后一次补完整句");
                }
              } catch (expansionError) {
                closingErrorMessage = expansionError instanceof Error ? expansionError.message : "补写失败";
              }
            }

            if (isChapterDraftEndingIncomplete(content)) {
              const completedContent = prepareChapterDraftContentForSave(content, targetWordCount);

              if (
                completedContent &&
                hasUsableDraftContent(completedContent, targetWordCount) &&
                !isChapterDraftEndingIncomplete(completedContent)
              ) {
                const trimmedForSave = completedContent !== content;
                content = completedContent;
                if (trimmedForSave) {
                  enqueue("\n\n[补尾仍不稳定，已保留到最后一个完整句保存]\n\n");
                }
              } else {
                throw new Error(
                  closingErrorMessage
                    ? `${message}；尝试补写结尾失败：${closingErrorMessage}，正文结尾仍然不完整，未保存为章节草稿。`
                    : `${message}；正文结尾仍然不完整，未保存为章节草稿。`
                );
              }
            }

            if (!hasUsableDraftContent(content, targetWordCount)) {
              throw new Error(
                `${message}；已生成正文只有 ${countDraftCharacters(content)} 字，低于最低保存要求 ${minimumSavableDraftCharacters(targetWordCount)} 字，未保存为章节草稿。`
              );
            }

            if (!isLengthLimit) {
              enqueue(`\n\n[AI 流式生成提前结束，已保存已经完整的正文：${message}]\n\n`);
            }
          } else {
            throw new Error(`${message}；AI 没有返回正文，未保存为章节草稿。`);
          }
        }
      } else {
        throw new Error("AI 未配置，无法生成章节正文。");
      }

      enqueue(`\n\n${streamDraftSavingMarker}\n\n`);

      const draft = await saveStreamedChapterDraft({
        projectId: prepared.projectId,
        taskCardId: prepared.taskCard.id,
        jobId: prepared.jobId,
        content,
        usedAi,
        tokenUsage: combineAiTokenUsages(tokenUsages)
      });

      if (draft.content.trim() !== content.trim()) {
        enqueue(`\n\n${streamDraftFinalMarker}\n${draft.content}`);
      }
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
