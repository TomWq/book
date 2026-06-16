import {
  countDraftCharacters,
  isChapterDraftEndingIncomplete,
  maximumDraftCharacters,
  minimumDraftExpansionCharacters,
  minimumSavableDraftCharacters,
  prepareChapterDraftContentForFastSave,
  prepareChapterDraftContentForForcedCompleteSave,
  prepareChapterDraftContentForSave,
  streamChapterDraftClosingTextWithAi,
  streamChapterDraftExpansionTextWithAi,
  streamChapterDraftTextWithAi,
  streamEditDraftTextWithAi
} from "@/lib/ai/writing";
import { combineAiTokenUsages, type AiTokenUsage } from "@/lib/ai/client";
import {
  failStreamedWritingJob,
  prepareChapterDraftStream,
  prepareEditDraftTextStream,
  prepareRegenerateChapterDraftContentStream,
  saveStreamedChapterDraft,
  saveStreamedEditReport,
  saveStreamedRegeneratedChapterDraftContent
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

function listText(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "")).join("\n")
    : String(value ?? "");
}

function taskCardPsychologyRequirementText(
  taskCard: Awaited<ReturnType<typeof prepareChapterDraftStream>>["context"]["taskCard"]
) {
  return [
    taskCard.chapterGoal,
    taskCard.mainPlotProgress,
    taskCard.pleasurePoint,
    listText(taskCard.foreshadowingTasks),
    listText(taskCard.rulesNotToBreak),
    taskCard.endingHook
  ].join("\n");
}

function requiresVisiblePsychologyBeat(
  taskCard: Awaited<ReturnType<typeof prepareChapterDraftStream>>["context"]["taskCard"]
) {
  const requirement = taskCardPsychologyRequirementText(taskCard);

  return /本章必须[^。；\n]*(心理裂缝|心理适应|身体反应|现实记忆|现实回响|现实混淆|梦境真实性|梦太长|醒不过来|被困|害怕|恐惧|反胃|手抖|发抖|迟疑)|必须[^。；\n]*(本章[^。；\n]*)?(心理裂缝|心理适应|身体反应|现实记忆|现实回响|梦境真实性)/.test(requirement);
}

function hasVisiblePsychologyBeat(
  content: string,
  taskCard: Awaited<ReturnType<typeof prepareChapterDraftStream>>["context"]["taskCard"]
) {
  const requirement = taskCardPsychologyRequirementText(taskCard);
  const requiresDreamFear = /心理裂缝|现实记忆|现实回响|现实混淆|梦境真实性|梦太长|醒不过来|被困/.test(requirement);

  if (requiresDreamFear) {
    return /(梦|醒来|醒不过来|现实|格子间|代码|电脑|主管|被困|太长|不确定|分不清)/.test(content) &&
      /(怕|恐惧|冷汗|发冷|手抖|发抖|反胃|心慌|喘不上|呼吸停|喉头发紧|胃里)/.test(content);
  }

  return /(反胃|手抖|发抖|冷汗|害怕|恐惧|迟疑|现实|格子间|代码|电脑|主管|醒来|梦)/.test(content);
}

function missesRequiredPsychologyBeat(
  content: string,
  taskCard: Awaited<ReturnType<typeof prepareChapterDraftStream>>["context"]["taskCard"]
) {
  return requiresVisiblePsychologyBeat(taskCard) && !hasVisiblePsychologyBeat(content, taskCard);
}

function sliceByDraftCharacters(value: string, maxCharacters: number) {
  if (maxCharacters <= 0) {
    return "";
  }

  let count = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (!/\s/.test(value[index])) {
      count += 1;
    }

    if (count > maxCharacters) {
      return value.slice(0, index);
    }
  }

  return value;
}

async function streamGeneratedChapterDraft(input: {
  context: Awaited<ReturnType<typeof prepareChapterDraftStream>>["context"];
  useAi: boolean;
  save: (input: { content: string; usedAi: boolean; tokenUsage?: AiTokenUsage }) => Promise<{ content: string }>;
  enqueue: (chunk: string) => void;
}) {
  let content = "";
  let usedAi = false;
  const tokenUsages: AiTokenUsage[] = [];
  const targetWordCount = input.context.targetWordCount;
  const maxCharacters = targetWordCount ? maximumDraftCharacters(targetWordCount) : undefined;
  const closingReserveCharacters = maxCharacters
    ? Math.min(420, Math.max(220, Math.floor(maxCharacters * 0.18)))
    : 0;
  const mainStreamMaxCharacters = maxCharacters
    ? Math.max(minimumSavableDraftCharacters(targetWordCount), maxCharacters - closingReserveCharacters)
    : undefined;
  let stoppedAtTargetLimit = false;
  let stoppedAtMainLimit = false;
  const appendChunk = (chunk: string, options?: { reserveClosingSpace?: boolean }) => {
    if (!chunk || !maxCharacters) {
      content += chunk;
      input.enqueue(chunk);
      return;
    }

    const limitCharacters = options?.reserveClosingSpace ? (mainStreamMaxCharacters ?? maxCharacters) : maxCharacters;
    const remainingCharacters = limitCharacters - countDraftCharacters(content);

    if (remainingCharacters <= 0) {
      if (options?.reserveClosingSpace) {
        stoppedAtMainLimit = true;
      } else {
        stoppedAtTargetLimit = true;
      }
      return;
    }

    const acceptedChunk = sliceByDraftCharacters(chunk, remainingCharacters);

    if (acceptedChunk) {
      content += acceptedChunk;
      input.enqueue(acceptedChunk);
    }

    if (acceptedChunk.length < chunk.length || countDraftCharacters(content) >= limitCharacters) {
      if (options?.reserveClosingSpace) {
        stoppedAtMainLimit = true;
      } else {
        stoppedAtTargetLimit = true;
      }
    }
  };
  const appendExpansion = async (_message: string) => {
    if (stoppedAtTargetLimit) {
      return;
    }

    for await (const chunk of streamChapterDraftExpansionTextWithAi(
      input.context,
      content,
      (usage) => {
        tokenUsages.push(usage);
      }
    )) {
      appendChunk(chunk);
      if (stoppedAtTargetLimit) {
        break;
      }
    }
  };
  const appendClosing = async (_message: string) => {
    if (stoppedAtTargetLimit) {
      return;
    }

    for await (const chunk of streamChapterDraftClosingTextWithAi(
      input.context,
      content,
      (usage) => {
        tokenUsages.push(usage);
      }
    )) {
      appendChunk(chunk);
      if (stoppedAtTargetLimit) {
        break;
      }
    }
  };

  if (input.useAi) {
    try {
      for await (const chunk of streamChapterDraftTextWithAi(input.context, (usage) => {
        tokenUsages.push(usage);
      })) {
        usedAi = true;
        appendChunk(chunk, { reserveClosingSpace: true });
        if (stoppedAtMainLimit || stoppedAtTargetLimit) {
          break;
        }
      }

      if (stoppedAtMainLimit || stoppedAtTargetLimit) {
        const preparedAtLimit = prepareChapterDraftContentForSave(content, targetWordCount);

        if (
          hasUsableDraftContent(preparedAtLimit, targetWordCount) &&
          !isChapterDraftEndingIncomplete(preparedAtLimit)
        ) {
          content = preparedAtLimit;
        } else if (!stoppedAtTargetLimit) {
          for await (const chunk of streamChapterDraftClosingTextWithAi(
            input.context,
            content,
            (usage) => {
              tokenUsages.push(usage);
            }
          )) {
            appendChunk(chunk);
            if (stoppedAtTargetLimit) {
              break;
            }
          }
        }
      }

      if (
        usedAi &&
        !stoppedAtTargetLimit &&
        !stoppedAtMainLimit &&
        (countDraftCharacters(content) < minimumDraftExpansionCharacters(targetWordCount) ||
          isChapterDraftEndingIncomplete(content))
      ) {
        if (
          hasUsableDraftContent(content, targetWordCount) &&
          !isChapterDraftEndingIncomplete(content)
        ) {
          content = prepareChapterDraftContentForSave(content, targetWordCount);
        } else {
          await appendExpansion(
            `正文需要补足完整结尾，正在续写收束：当前 ${countDraftCharacters(content)} 字，目标参考 ${minimumDraftExpansionCharacters(targetWordCount)} 字`
          );
        }
      }

      if (usedAi && !stoppedAtTargetLimit && !stoppedAtMainLimit && isChapterDraftEndingIncomplete(content)) {
        await appendExpansion("结尾仍未完整，正在二次补尾");
      }

      if (usedAi && !stoppedAtTargetLimit && !hasUsableDraftContent(content, targetWordCount) && missesRequiredPsychologyBeat(content, input.context.taskCard)) {
        await appendExpansion("正文漏掉任务卡心理适应/现实回响硬要求，正在补写这一处");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 流式生成失败";
      const isLengthLimit = message.includes("长度限制") || message.toLowerCase().includes("length");

      if (content.trim()) {
        if (isLengthLimit || isChapterDraftEndingIncomplete(content)) {
          try {
            await appendClosing(`AI 输出被长度限制截断，正在补完整句结尾：当前 ${countDraftCharacters(content)} 字`);

            if (isChapterDraftEndingIncomplete(content)) {
              await appendClosing("补尾后结尾仍不完整，正在最后一次补完整句");
            }
          } catch (expansionError) {
            console.warn("Failed to complete streamed draft ending", expansionError);
          }
        }

        if (isChapterDraftEndingIncomplete(content)) {
          const completedContent = prepareChapterDraftContentForForcedCompleteSave(content, targetWordCount);

          if (
            completedContent &&
            hasUsableDraftContent(completedContent, targetWordCount)
            && !isChapterDraftEndingIncomplete(completedContent)
          ) {
            content = completedContent;
          }
        }

        if (isLengthLimit && hasUsableDraftContent(content, targetWordCount)) {
          const completedContent = prepareChapterDraftContentForForcedCompleteSave(content, targetWordCount);

          if (completedContent && hasUsableDraftContent(completedContent, targetWordCount)) {
            content = completedContent;
          }
        }

        if (!hasUsableDraftContent(content, targetWordCount)) {
          throw new Error(
            `${message}；已生成正文只有 ${countDraftCharacters(content)} 字，低于最低保存要求 ${minimumSavableDraftCharacters(targetWordCount)} 字，未保存为章节草稿。`
          );
        }

      } else {
        throw new Error(`${message}；AI 没有返回正文，未保存为章节草稿。`);
      }
    }
  } else {
    throw new Error("AI 未配置，无法生成章节正文。");
  }

  input.enqueue(`\n\n${streamDraftSavingMarker}\n\n`);
  content = prepareChapterDraftContentForSave(content, targetWordCount);

  if (targetWordCount && countDraftCharacters(content) > maximumDraftCharacters(targetWordCount)) {
    const trimmedContent = prepareChapterDraftContentForFastSave(content, input.context, targetWordCount);

    if (hasUsableDraftContent(trimmedContent, targetWordCount)) {
      content = trimmedContent;
    }
  }

  if (usedAi && isChapterDraftEndingIncomplete(content)) {
    const forcedCompleteContent = prepareChapterDraftContentForForcedCompleteSave(content, targetWordCount);

    if (
      forcedCompleteContent &&
      forcedCompleteContent !== content &&
      hasUsableDraftContent(forcedCompleteContent, targetWordCount) &&
      !isChapterDraftEndingIncomplete(forcedCompleteContent)
    ) {
      content = forcedCompleteContent;
    }
  }

  const draft = await input.save({
    content,
    usedAi,
    tokenUsage: combineAiTokenUsages(tokenUsages)
  });

  input.enqueue(`\n\n${streamDraftFinalMarker}\n${draft.content}`);
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
      try {
        await streamGeneratedChapterDraft({
          context: prepared.context,
          useAi: prepared.useAi,
          enqueue,
          save: ({ content, usedAi, tokenUsage }) => saveStreamedChapterDraft({
            projectId: prepared.projectId,
            taskCardId: prepared.taskCard.id,
            jobId: prepared.jobId,
            content,
            usedAi,
            tokenUsage
          })
        });
      } catch (error) {
        await failStreamedWritingJob({
          projectId: prepared.projectId,
          jobId: prepared.jobId,
          message: error instanceof Error ? error.message : "流式正文生成失败"
        });
        throw error;
      }
    });
  }

  if (action === "regenerate_draft_content") {
    const prepared = await prepareRegenerateChapterDraftContentStream(projectId, String(body.draftId ?? ""), {
      targetWordCount: Number(body.targetWordCount ?? 0) || undefined
    });

    return streamText(async (enqueue) => {
      try {
        await streamGeneratedChapterDraft({
          context: prepared.context,
          useAi: prepared.useAi,
          enqueue,
          save: ({ content, usedAi, tokenUsage }) => saveStreamedRegeneratedChapterDraftContent({
            projectId: prepared.projectId,
            draftId: prepared.draftId,
            jobId: prepared.jobId,
            content,
            usedAi,
            tokenUsage
          })
        });
      } catch (error) {
        await failStreamedWritingJob({
          projectId: prepared.projectId,
          jobId: prepared.jobId,
          message: error instanceof Error ? error.message : "流式正文重写失败"
        });
        throw error;
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
