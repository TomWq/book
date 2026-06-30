import {
  applyEditedTextToDraft,
  confirmChapterClosure,
  createChapterLedger,
  decideChapterClosureItem,
  deleteWritingChaptersFrom,
  deleteWritingTaskCard,
  editDraftText,
  enqueueChapterBatchJob,
  enqueueChapterDraftJob,
  enqueueEditSecondDraftJob,
  enqueueRegenerateChapterDraftContentJob,
  enqueueReviewChapterJob,
  enqueueWritingTaskCardJob,
  enqueueLongFormPlanJob,
  generateChapterDraft,
  generateChapterBatch,
  generateLongFormPlan,
  generateWritingTaskCard,
  regenerateChapterDraftContent,
  getProjectWritingState,
  reviewChapterDraft,
  updateWritingTaskCard
} from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const writingState = await getProjectWritingState(projectId);

  if (!writingState) {
    return Response.json({ error: "项目不存在" }, { status: 404 });
  }

  return Response.json(writingState);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");

  try {
    if (action === "generate_task_card") {
      const input = {
        title: String(body.title ?? ""),
        chapterGoal: String(body.chapterGoal ?? ""),
        continuity: String(body.continuity ?? ""),
        mainPlotProgress: String(body.mainPlotProgress ?? ""),
        pleasurePoint: String(body.pleasurePoint ?? ""),
        endingHook: String(body.endingHook ?? ""),
        chapterNumber: Number(body.chapterNumber ?? 0) || undefined,
        relatedInspirationIds: Array.isArray(body.relatedInspirationIds)
          ? (body.relatedInspirationIds as unknown[]).map((item: unknown) => String(item).trim()).filter(Boolean)
          : [],
        useAnalysisContext:
          body.useAnalysisContext === undefined
            ? true
            : body.useAnalysisContext === true ||
              body.useAnalysisContext === "true" ||
              body.useAnalysisContext === "on"
      };

      if (body.defer === true) {
        const job = await enqueueWritingTaskCardJob(projectId, input);
        return Response.json({ job }, { status: 202 });
      }

      const taskCard = await generateWritingTaskCard(projectId, input);

      return Response.json({ taskCard }, { status: 201 });
    }

    if (action === "generate_long_form_plan") {
      if (body.defer === true) {
        const job = await enqueueLongFormPlanJob(projectId, {
          targetTotalWords: Number(body.targetTotalWords ?? 0) || undefined
        });
        return Response.json({ job }, { status: 202 });
      }

      const plan = await generateLongFormPlan(projectId, {
        targetTotalWords: Number(body.targetTotalWords ?? 0) || undefined
      });
      return Response.json({ plan }, { status: 201 });
    }

    if (action === "generate_draft") {
      const targetWordCount = Number(body.targetWordCount ?? 0) || undefined;

      if (body.defer === true) {
        const job = await enqueueChapterDraftJob(projectId, String(body.taskCardId ?? ""), {
          targetWordCount
        });
        return Response.json({ job }, { status: 202 });
      }

      const draft = await generateChapterDraft(projectId, String(body.taskCardId ?? ""), {
        targetWordCount
      });
      return Response.json({ draft }, { status: 201 });
    }

    if (action === "generate_chapter_batch") {
      const startChapterNumber = Number(body.startChapterNumber ?? 0) || undefined;
      const explicitChapterCount = Number(body.chapterCount ?? 0) || undefined;
      const endChapterNumber = Number(body.endChapterNumber ?? 0) || undefined;
      if (startChapterNumber && endChapterNumber && endChapterNumber < startChapterNumber) {
        throw new Error("结束章节不能小于起始章节");
      }
      const chapterCount =
        explicitChapterCount ??
        (startChapterNumber && endChapterNumber && endChapterNumber >= startChapterNumber
          ? endChapterNumber - startChapterNumber + 1
          : undefined);
      const input = {
        startChapterNumber,
        chapterCount,
        targetWordCount: Number(body.targetWordCount ?? 0) || undefined,
        reviewDraft:
          body.reviewDraft === true ||
          body.reviewDraft === "true" ||
          body.reviewDraft === "on",
        replaceExisting:
          body.replaceExisting === true ||
          body.replaceExisting === "true" ||
          body.replaceExisting === "on"
      };

      if (body.defer === false) {
        const result = await generateChapterBatch(projectId, input);
        return Response.json(result, { status: 201 });
      }

      const job = await enqueueChapterBatchJob(projectId, input);
      return Response.json({ job }, { status: 202 });
    }

    if (action === "regenerate_draft_content") {
      const targetWordCount = Number(body.targetWordCount ?? 0) || undefined;

      if (body.defer === true) {
        const job = await enqueueRegenerateChapterDraftContentJob(projectId, String(body.draftId ?? ""), {
          targetWordCount
        });
        return Response.json({ job }, { status: 202 });
      }

      const result = await regenerateChapterDraftContent(projectId, String(body.draftId ?? ""), {
        targetWordCount
      });
      return Response.json(result, { status: 201 });
    }

    if (action === "delete_task_card") {
      const result = await deleteWritingTaskCard(projectId, String(body.taskCardId ?? ""));
      return Response.json(result);
    }

    if (action === "update_task_card") {
      const listFromBody = (value: unknown) =>
        Array.isArray(value)
          ? value.map((item) => String(item).trim()).filter(Boolean)
          : String(value ?? "")
              .split(/\r?\n|；|;/)
              .map((item) => item.trim())
              .filter(Boolean);
      const result = await updateWritingTaskCard(projectId, String(body.taskCardId ?? ""), {
        title: String(body.title ?? ""),
        chapterGoal: String(body.chapterGoal ?? ""),
        continuity: String(body.continuity ?? ""),
        mainPlotProgress: String(body.mainPlotProgress ?? ""),
        requiredCharacters: listFromBody(body.requiredCharacters),
        pleasurePoint: String(body.pleasurePoint ?? ""),
        foreshadowingTasks: listFromBody(body.foreshadowingTasks),
        rulesNotToBreak: listFromBody(body.rulesNotToBreak),
        endingHook: String(body.endingHook ?? "")
      });
      return Response.json(result);
    }

    if (action === "delete_chapters_from") {
      const result = await deleteWritingChaptersFrom(projectId, Number(body.chapterNumber ?? 0));
      return Response.json(result);
    }

    if (action === "create_ledger") {
      const ledger = await createChapterLedger(projectId, String(body.draftId ?? ""));
      return Response.json({ ledger }, { status: 201 });
    }

    if (action === "confirm_chapter_closure") {
      const result = await confirmChapterClosure(projectId, String(body.draftId ?? ""));
      return Response.json(result);
    }

    if (action === "decide_chapter_closure_item") {
      const targetType = String(body.targetType ?? "");
      const decision = String(body.decision ?? "");

      if (targetType !== "character" && targetType !== "foreshadowing") {
        throw new Error("收口目标类型不正确");
      }

      if (decision !== "accepted" && decision !== "ignored") {
        throw new Error("收口决定不正确");
      }

      const result = await decideChapterClosureItem(projectId, {
        draftId: String(body.draftId ?? ""),
        targetType,
        targetId: String(body.targetId ?? ""),
        decision
      });

      return Response.json(result);
    }

    if (action === "review_draft") {
      if (body.defer === true) {
        const job = await enqueueReviewChapterJob(projectId, String(body.draftId ?? ""));
        return Response.json({ job }, { status: 202 });
      }

      const review = await reviewChapterDraft(projectId, String(body.draftId ?? ""));
      return Response.json({ review }, { status: 201 });
    }

    if (action === "edit_text") {
      const input = {
        mode: String(body.mode ?? "网文作者版"),
        text: String(body.text ?? ""),
        draftId: body.draftId ? String(body.draftId) : undefined
      };

      if (body.defer === true) {
        const job = await enqueueEditSecondDraftJob(projectId, input);
        return Response.json({ job }, { status: 202 });
      }

      const editReport = await editDraftText(projectId, input);

      return Response.json({ editReport }, { status: 201 });
    }

    if (action === "apply_edit_to_draft") {
      const result = await applyEditedTextToDraft({
        projectId,
        draftId: String(body.draftId ?? ""),
        revisedText: String(body.revisedText ?? "")
      });

      return Response.json(result);
    }

    return Response.json({ error: "未知写作动作" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "写作动作执行失败" },
      { status: 400 }
    );
  }
}
