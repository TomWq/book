import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton, ApiForm } from "@/components/api-form";
import { AiJobRunner } from "@/components/ai-job-runner";
import { aiJobResumeAfterMs, isStaleRunningAiJob } from "@/lib/ai-job-status";
import { getProjectWritingState } from "@/lib/projects";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const styleOptions = ["快节奏强爽点", "悬疑推进", "轻松爽文", "热血升级", "压迫反转", "细腻情绪"];

function formatWanWords(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "未设置";
  }

  return `${Math.round(value / 10000)} 万字`;
}

function normalizeChapterDash(value: string) {
  return value.replace(/[—–－~～至]/g, "-");
}

function splitPacingIntoChapterStages(value: string, estimatedChapters: number) {
  const normalized = normalizeChapterDash(value.trim());

  if (!normalized) {
    return [];
  }

  const expectedRanges = new Map<number, number>();

  for (let start = 101; start <= estimatedChapters; start += 50) {
    expectedRanges.set(start, Math.min(start + 49, estimatedChapters));
  }

  const pattern = /第\s*(\d+)\s*-\s*(?:第\s*)?(\d+)\s*章/g;
  const matches = Array.from(normalized.matchAll(pattern)).filter((match) => {
    const start = Number(match[1]);
    const end = Number(match[2]);

    return expectedRanges.get(start) === end;
  });

  if (matches.length === 0) {
    return [{ title: "后续阶段", body: normalized }];
  }

  return matches.map((match, index) => {
    const startIndex = match.index ?? 0;
    const nextIndex = matches[index + 1]?.index ?? normalized.length;
    const chunk = normalized.slice(startIndex, nextIndex).trim();
    const title = `第${match[1]}-${match[2]}章`;
    const body = chunk.replace(match[0], "").replace(/^[:：\s]+/, "").trim() || chunk;

    return { title, body };
  });
}

function splitPacingByActualRanges(value: string, fallbackTitle: string) {
  const normalized = normalizeChapterDash(value.trim());

  if (!normalized) {
    return [];
  }

  const pattern = /第\s*(\d+)\s*-\s*(?:第\s*)?(\d+)\s*章/g;
  const matches = Array.from(normalized.matchAll(pattern));

  if (matches.length === 0) {
    return [{ title: fallbackTitle, body: normalized }];
  }

  return matches.map((match, index) => {
    const startIndex = match.index ?? 0;
    const nextIndex = matches[index + 1]?.index ?? normalized.length;
    const chunk = normalized.slice(startIndex, nextIndex).trim();
    const title = `第${match[1]}-${match[2]}章`;
    const body = chunk.replace(match[0], "").replace(/^[:：\s]+/, "").trim() || chunk;

    return { title, body };
  });
}

function extractOpeningChapterNumber(value: string) {
  const normalized = value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
  const match = normalized.match(/第\s*(\d+)\s*章|^(\d+)\s*[.、:：]/);
  const chapterNumber = Number(match?.[1] ?? match?.[2]);

  return Number.isFinite(chapterNumber) ? chapterNumber : 0;
}

function missingOpeningBlueprintChapters(items: string[]) {
  const chapterNumbers = new Set(
    items.map(extractOpeningChapterNumber).filter((chapterNumber) => chapterNumber >= 1 && chapterNumber <= 10)
  );

  return Array.from({ length: 10 }, (_, index) => index + 1).filter(
    (chapterNumber) => !chapterNumbers.has(chapterNumber)
  );
}

function safeList(items?: string[]) {
  return Array.isArray(items) ? items : [];
}

function isSubplotThreadLine(value: string) {
  const text = value.trim();

  return /^(配角弧线|支线|暗线)：/.test(text) && !/为重要配角建立|每条支线必须/.test(text);
}

function subplotField(line: string, label: string) {
  const prefix = `${label}：`;
  const item = line.split(/[｜|]/).map((part) => part.trim()).find((part) => part.startsWith(prefix));

  return item ? item.slice(prefix.length).trim() : "";
}

function parseSubplotThread(line: string) {
  const firstPart = line.split(/[｜|]/)[0]?.trim() ?? "";
  const name = firstPart.replace(/^(配角弧线|支线|暗线)：/, "").trim();

  return {
    name,
    character: subplotField(line, "人物"),
    goal: subplotField(line, "小目标"),
    hidden: subplotField(line, "秘密/误判/亏欠"),
    mainPlotLink: subplotField(line, "回扣主线"),
    nextBeat: subplotField(line, "下次节拍"),
    boundary: subplotField(line, "边界/收束")
  };
}

function objectRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function reviewStepList(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => objectRecord(item))
        .map((item) => ({
          name: String(item.name ?? "").trim(),
          passed: item.passed,
          incomplete: item.incomplete === true
        }))
        .filter((item) => item.name)
    : [];
}

function isAdviceAlreadyStored(advice: string, storedRules: string[]) {
  const normalizedAdvice = advice.replace(/\s+/g, "");

  return storedRules.some((rule) => {
    const normalizedRule = rule.replace(/\s+/g, "");
    return normalizedRule === normalizedAdvice || normalizedRule.includes(normalizedAdvice);
  });
}

function displayReviewText(value: string) {
  return value
    .replace(/This operation was aborted/g, "AI 请求超时或被中止，请重新生成")
    .replace(/AI 响应缺少 message\.content/g, "AI 审查接口返回空内容，请重新审查")
    .replace(/AI JSON 修复响应缺少 message\.content/g, "AI 审查修复接口返回空内容，请重新审查")
    .replace(/AI 输出被长度限制截断，请减少输入内容或提高本次请求的输出长度上限/g, "AI 审查输出被截断，请重新审查当前规划")
    .replace(/\bdoNotRevealEarly\b/g, "禁止提前揭示")
    .replace(/\bopenQuestions\b/g, "待确认点")
    .replace(/\bconfirmedFacts\b/g, "已确定事实")
    .replace(/\bdoNotChange\b/g, "禁止改写")
    .replace(/\btagPromises\b/g, "标签承诺")
    .replace(/\bfirst10Chapters\b/g, "开局任务蓝图")
    .replace(/\bprogressionRules\b/g, "任务卡硬规则")
    .replace(/\bpost100Pacing\b/g, "后续阶段节奏")
    .replace(/\bfirst100Pacing\b/g, "前段阶段节奏");
}

function displayLongFormGenerationError(value: string) {
  return value
    .replace(/This operation was aborted/g, "AI 请求超时或被中止，请重新生成")
    .replace(/AI 响应缺少 message\.content/g, "AI 生成接口返回空内容，请重新生成")
    .replace(/AI JSON 修复响应缺少 message\.content/g, "AI 生成修复接口返回空内容，请重新生成")
    .replace(/AI 输出被长度限制截断，请减少输入内容或提高本次请求的输出长度上限/g, "AI 生成输出被截断，请重新生成；系统会使用分段规划降低截断概率")
    .replace(/\bdoNotRevealEarly\b/g, "禁止提前揭示")
    .replace(/\bopenQuestions\b/g, "待确认点")
    .replace(/\bconfirmedFacts\b/g, "已确定事实")
    .replace(/\bdoNotChange\b/g, "禁止改写")
    .replace(/\btagPromises\b/g, "标签承诺")
    .replace(/\bfirst10Chapters\b/g, "开局任务蓝图")
    .replace(/\bprogressionRules\b/g, "任务卡硬规则")
    .replace(/\bpost100Pacing\b/g, "后续阶段节奏")
    .replace(/\bfirst100Pacing\b/g, "前段阶段节奏");
}

function reviewAdviceMode(items: string[]) {
  const text = items.join(" ");
  const hasOriginalityAdvice = /知名|IP|同人|原创|角色名|势力名|专有设定|版权|替换/.test(text);
  const hasCommitmentAdvice = /感情|归属|开放|待确认|提前|揭示|真相|身份|终局|幕后/.test(text);

  if (hasOriginalityAdvice && hasCommitmentAdvice) {
    return {
      mode: "mark_forbidden" as const,
      label: "采纳为审查规则",
      pendingTitle: "正在写入审查规则",
      successMessage: "已写入审查规则"
    };
  }

  if (hasOriginalityAdvice) {
    return {
      mode: "mark_forbidden" as const,
      label: "采纳为原创化规则",
      pendingTitle: "正在写入原创化规则",
      successMessage: "已写入原创化规则"
    };
  }

  return {
    mode: "mark_no_early_reveal" as const,
    label: "采纳为禁止提前揭示",
    pendingTitle: "正在写入禁止提前揭示",
    successMessage: "已写入禁止提前揭示"
  };
}

function displayJobError(value: string) {
  return displayLongFormGenerationError(value)
    .replace(/AI 请求超时或被中止，请稍后重试；如果这是长篇规划，请适当提高 AI 超时时间。/g, "AI 请求超时或被中止，请重新执行。")
    .replace(/AI JSON 修复未正常结束：length/g, "AI 分段输出仍被截断；请重新生成，系统会继续用更小的分段结构。");
}

function isStaleLongFormJob(job?: { status: string; type: string; updatedAt?: string } | null) {
  if (!job || (job.type !== "generate_long_form_plan" && job.type !== "review_long_form_plan")) {
    return false;
  }

  return isStaleRunningAiJob(job);
}

function formatResumeDelay(job: { type: string }) {
  const seconds = Math.round(aiJobResumeAfterMs(job) / 1000);

  return seconds >= 60 ? `${Math.round(seconds / 60)} 分钟` : `${seconds} 秒`;
}

function isActiveLongFormJob(job?: { status: string; type: string; updatedAt?: string } | null) {
  return Boolean(job && (job.status === "pending" || (job.status === "running" && !isStaleLongFormJob(job))));
}

function isJobNewerThanPlan(job?: { createdAt?: string; updatedAt?: string } | null, plan?: { createdAt?: string; updatedAt?: string } | null) {
  if (!job || !plan) {
    return false;
  }

  const jobTime = Date.parse(String(job.createdAt ?? job.updatedAt ?? ""));
  const planTime = Date.parse(String(plan.updatedAt ?? plan.createdAt ?? ""));

  return Number.isFinite(jobTime) && Number.isFinite(planTime) && jobTime > planTime;
}

export default async function ProjectStatePage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const state = await getProjectWritingState(projectId);

  if (!state) {
    notFound();
  }
  const profileCount = state.characters.length;
  const foreshadowingCount = state.foreshadowings.length;
  const maxChapterNumber = Math.max(
    0,
    ...state.taskCards.map((card) => card.chapterNumber),
    ...state.drafts.map((draft) => draft.chapterNumber),
    ...state.ledgers.map((ledger) => ledger.chapterNumber),
    ...state.reviews.map((review) => review.chapterNumber)
  );
  const draftTaskCardIds = new Set(state.drafts.map((draft) => draft.taskCardId));
  const hasUnwrittenTaskCard = state.taskCards.some((card) => !draftTaskCardIds.has(card.id));
  const writingButtonText =
    maxChapterNumber === 0
      ? "去创作第一章"
      : hasUnwrittenTaskCard
        ? `继续写第 ${maxChapterNumber} 章`
        : `继续创作第 ${maxChapterNumber + 1} 章`;
  const openForeshadowingCount = state.foreshadowings.filter((item) => item.status !== "closed").length;
  const latestLongFormPlan = state.longFormPlans[0] ?? null;
  const hasOldLongFormPlans = state.longFormPlans.length > 1;
  const confirmedFacts = safeList(latestLongFormPlan?.confirmedFacts);
  const openQuestions = safeList(latestLongFormPlan?.openQuestions);
  const doNotChange = safeList(latestLongFormPlan?.doNotChange);
  const doNotRevealEarly = safeList(latestLongFormPlan?.doNotRevealEarly);
  const tagPromises = safeList(latestLongFormPlan?.tagPromises);
  const latestLongFormPlanJob =
    state.longFormPlanJobs.find(isActiveLongFormJob) ??
    state.longFormPlanJobs.find((job) => job.status === "pending" || isStaleLongFormJob(job)) ??
    state.longFormPlanJobs[0] ??
    null;
  const latestGenerateLongFormPlanJob =
    state.longFormPlanJobs.find((job) => job.type === "generate_long_form_plan") ?? null;
  const latestReviewLongFormPlanJob =
    state.longFormPlanJobs.find((job) => {
      if (job.type !== "review_long_form_plan") {
        return false;
      }
      if (!latestLongFormPlan) {
        return true;
      }
      return String(objectRecord(job.input).longFormPlanId ?? "") === latestLongFormPlan.id;
    }) ?? null;
  const hasActiveLongFormPlanJob = isActiveLongFormJob(latestLongFormPlanJob);
  const hasRunnableLongFormPlanJob =
    latestLongFormPlanJob?.status === "pending" || isStaleLongFormJob(latestLongFormPlanJob);
  const shouldRunLongFormPlanJob =
    latestLongFormPlanJob?.status === "pending" ||
    latestLongFormPlanJob?.status === "running" ||
    isStaleLongFormJob(latestLongFormPlanJob);
  const hasStaleLongFormPlanJob = isStaleLongFormJob(latestLongFormPlanJob);
  const isReviewingLongFormPlan =
    latestLongFormPlanJob?.type === "review_long_form_plan" &&
    shouldRunLongFormPlanJob;
  const isGeneratingLongFormPlan =
    latestLongFormPlanJob?.type === "generate_long_form_plan" &&
    (
      latestLongFormPlanJob.status === "pending" ||
      latestLongFormPlanJob.status === "running" ||
      isStaleLongFormJob(latestLongFormPlanJob)
    );
  const latestFailedGenerateLongFormPlanJob =
    latestGenerateLongFormPlanJob?.status === "failed" ? latestGenerateLongFormPlanJob : null;
  const latestFailedReviewLongFormPlanJob =
    latestReviewLongFormPlanJob?.status === "failed" ? latestReviewLongFormPlanJob : null;
  const failedGenerateAfterCurrentPlan = isJobNewerThanPlan(latestFailedGenerateLongFormPlanJob, latestLongFormPlan);
  const reviewOutput = objectRecord(latestReviewLongFormPlanJob?.output);
  const reviewResult = objectRecord(reviewOutput.review);
  const reviewIssues = textList(reviewResult.issues);
  const unresolvedCommitmentIssues = textList(reviewResult.unresolvedCommitmentIssues);
  const repairInstructions = textList(reviewResult.repairInstructions);
  const reviewSteps = reviewStepList(reviewResult.reviewSteps);
  const storedReviewRules = [...confirmedFacts, ...doNotChange, ...doNotRevealEarly];
  const unresolvedRepairInstructions = repairInstructions.filter(
    (item) => !isAdviceAlreadyStored(item, storedReviewRules)
  );
  const reviewAdviceAction = reviewAdviceMode(unresolvedRepairInstructions);
  const reviewResolvedByRules = repairInstructions.length > 0 && unresolvedRepairInstructions.length === 0;
  const hasReviewResult = latestReviewLongFormPlanJob?.status === "succeeded" && "passed" in reviewResult;
  const reviewResolvedByUser =
    reviewResult.resolvedByUser === true ||
    reviewResult.status === "resolved" ||
    reviewResolvedByRules;
  const reviewIncomplete =
    !reviewResolvedByUser &&
    (
      Boolean(latestFailedReviewLongFormPlanJob) ||
      reviewResult.reviewError === true ||
      reviewResult.status === "incomplete"
    );
  const reviewPassed = hasReviewResult && (reviewResult.passed === true || reviewResolvedByUser);
  const reviewHasProblem =
    !reviewIncomplete &&
    hasReviewResult &&
    !reviewPassed;
  const keySettingCount = [
    state.bible.corePleasure,
    state.bible.protagonistDesire,
    state.bible.worldRules,
    state.bible.goldenFingerRules,
    state.bible.immutableSettings,
    state.plotState.mainGoal,
    state.plotState.nextStageGoal
  ].filter((item) => item.trim()).length;
  const post100Stages = latestLongFormPlan
    ? splitPacingIntoChapterStages(latestLongFormPlan.post100Pacing, latestLongFormPlan.estimatedChapters)
    : [];
  const frontStageLabel = latestLongFormPlan
    ? `第1-${Math.min(100, latestLongFormPlan.estimatedChapters)}章阶段`
    : "前段阶段";
  const frontStages = latestLongFormPlan
    ? splitPacingByActualRanges(latestLongFormPlan.first100Pacing, frontStageLabel)
    : [];
  const allLongFormStages = [...frontStages, ...post100Stages];
  const needsPost100Stages = Boolean(latestLongFormPlan && latestLongFormPlan.estimatedChapters > 100);
  const missingOpeningChapters = latestLongFormPlan
    ? missingOpeningBlueprintChapters(latestLongFormPlan.first10Chapters)
    : [];
  const subplotThreads = state.plotState.openThreads.filter(isSubplotThreadLine);

  return (
    <div className="grid state-page">
      <section className="hero state-hero">
        <div className="hero-top">
          <div>
            <h1>创作圣经、人物、伏笔和主线状态统一维护</h1>
            <p>这里是长篇不跑偏的核心。写作时不是喂全文，而是读取这些结构化状态。</p>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href={`/projects/${projectId}/writing`}>
              {writingButtonText}
            </Link>
            <Link className="button" href={`/projects/${projectId}/state/graph`}>
              查看关系图谱
            </Link>
            <ApiButton
              endpoint={`/api/projects/${projectId}/state`}
              body={{ action: "cleanup_state" }}
              label="清理自动状态"
              confirmMessage="确定清理自动生成的脏状态吗？会移除明显误识别的人物和重复伏笔，并压缩主线状态。"
            />
            <span className="chip">人物 {profileCount}</span>
            <span className="chip">伏笔 {foreshadowingCount}</span>
            <span className="chip">主线 {state.plotState.currentVolume || "未分卷"}</span>
          </div>
        </div>
        <div className="state-health-strip">
          <div>
            <span>已推进</span>
            <strong>{maxChapterNumber > 0 ? `第 ${maxChapterNumber} 章` : "尚未开写"}</strong>
          </div>
          <div>
            <span>设定完整度</span>
            <strong>{keySettingCount}/7</strong>
          </div>
          <div>
            <span>人物档案</span>
            <strong>{profileCount} 人</strong>
          </div>
          <div>
            <span>未回收伏笔</span>
            <strong>{openForeshadowingCount} 条</strong>
          </div>
        </div>
      </section>

      <section className="state-command-strip" aria-label="页面维护重点">
        <div className="state-guide">
          <div className={latestLongFormPlan ? "state-guide-primary done" : "state-guide-primary"}>
            <strong>0. 先做总纲</strong>
            <span>开写前建议先生成长篇规划，系统会按目标字数估算章节数，再自动分段安排全书节奏。</span>
          </div>
          <div>
            <strong>1. 定规则</strong>
            <span>创作圣经保存稳定设定：爽点、金手指、世界规则、禁区。</span>
          </div>
          <div>
            <strong>2. 记进度</strong>
            <span>主线状态告诉 AI 当前写到哪、下一步必须推进什么。</span>
          </div>
          <div>
            <strong>3. 管人物</strong>
            <span>人物档案记录目标、秘密、已知/未知信息，避免角色乱知道。</span>
          </div>
          <div>
            <strong>4. 控伏笔</strong>
            <span>伏笔表记录埋设、回收和不能提前透露的信息。</span>
          </div>
        </div>
      </section>

      <div className="state-layout">
        <div className="state-main">
      <details id="long-form-plan" className="state-editor-section" open={!latestLongFormPlan}>
        <summary>
          <span>
            <strong>长篇规划 / 总纲节奏</strong>
            <small>按目标字数估算章节数，规划全书卷纲、成长上限、收益频率和阶段节奏。</small>
          </span>
          <span className="state-section-tag">
            {failedGenerateAfterCurrentPlan
              ? "生成失败 · 显示旧规划"
              : latestLongFormPlan
              ? `${formatWanWords(latestLongFormPlan.targetTotalWords)} · 约 ${latestLongFormPlan.estimatedChapters} 章`
              : hasActiveLongFormPlanJob
                ? "正在生成"
              : "未生成"}
          </span>
        </summary>
        <div className="list long-form-plan-body">
          {latestLongFormPlan && isGeneratingLongFormPlan ? (
            <div className="empty-state long-form-regenerating">
              <strong>正在生成新版长篇规划</strong>
              <span>旧规划已暂存，不再作为当前展示内容。新版生成完成后会自动替换这些阶段卡片和事实一致性审查。</span>
              {latestLongFormPlanJob ? (
                <AiJobRunner
                  jobId={latestLongFormPlanJob.id}
                  title="正在重新生成长篇规划 / 总纲节奏"
                  runningMessage="正在读取作品简介、体量、创作圣经和主线状态，生成新版全书阶段节奏。"
                  doneMessage="长篇规划已重新生成，正在刷新结果。"
                />
              ) : null}
            </div>
          ) : latestLongFormPlan ? (
            <>
              <div className="list-item">
                <div className="row">
                  <strong>
                    目标 {formatWanWords(latestLongFormPlan.targetTotalWords)} · 约 {latestLongFormPlan.estimatedChapters} 章
                  </strong>
                  <span className={failedGenerateAfterCurrentPlan ? "pill warning" : "pill success"}>
                    {failedGenerateAfterCurrentPlan ? "显示旧规划" : "任务卡已接入"}
                  </span>
                </div>
                <div className="muted">{latestLongFormPlan.corePromise || latestLongFormPlan.planningBasis}</div>
              </div>
              {failedGenerateAfterCurrentPlan ? (
                <div className="quote-box warning-box compact-note">
                  <strong>刚才那次重新生成没有保存成功。</strong>
                  <span>当前下面展示的仍是上一次成功保存的长篇规划，不是最新生成结果。失败原因在本区底部提示；修复后重新生成成功才会替换这里的规划。</span>
                </div>
              ) : null}
              <div className={reviewHasProblem || reviewIncomplete ? "quote-box warning-box compact-note long-form-review-note" : "quote-box compact-note long-form-review-note"}>
                <div className="long-form-review-head">
                  <strong>事实一致性审查</strong>
                  <span className={reviewPassed ? "pill success" : reviewHasProblem ? "pill danger" : reviewIncomplete ? "pill warning" : "pill"}>
                    {isReviewingLongFormPlan
                      ? "审查中"
                      : reviewPassed
                        ? reviewResolvedByUser ? "已处理" : "已通过"
                        : reviewIncomplete
                          ? "审查未完成"
                        : reviewHasProblem
                          ? "需处理"
                          : "待审查"}
                  </span>
                </div>
                {isReviewingLongFormPlan ? (
                  <div className="muted">规划已保存，正在单独检查是否改写简介、创作圣经、人物状态或待确认点。</div>
                ) : reviewPassed ? (
                  <div className="muted">
                    {reviewResolvedByUser
                      ? "已采纳审查建议并写入硬规则。后续任务卡和正文会继续读取项目事实锁、待确认点和硬规则。"
                      : "审查已通过。后续任务卡和正文会继续读取项目事实锁、待确认点和硬规则。"}
                  </div>
                ) : latestFailedReviewLongFormPlanJob ? (
                  <div className="muted">规划已生成，但上次 AI 审查没有拿到完整结果：{displayReviewText(latestFailedReviewLongFormPlanJob.error || "AI 返回内容异常，请重新审查。")}</div>
                ) : reviewIncomplete ? (
                  <div className="long-form-review-body">
                    {reviewIssues.slice(0, 3).map((item) => (
                      <div key={item}>- {displayReviewText(item)}</div>
                    ))}
                    <div className="muted">这是 AI 审查执行异常，不是让你缩短小说简介，也不代表规划内容不通过。请重新审查当前规划。</div>
                  </div>
                ) : hasReviewResult && !reviewPassed ? (
                  <div className="long-form-review-body">
                    {[...reviewIssues, ...unresolvedCommitmentIssues].slice(0, 4).map((item) => (
                      <div key={item}>- {displayReviewText(item)}</div>
                    ))}
                    {reviewSteps.length > 0 ? (
                      <div className="long-form-review-steps" aria-label="审查步骤">
                        {reviewSteps.map((step) => (
                          <span
                            key={step.name}
                            className={step.incomplete ? "pill warning" : step.passed === false ? "pill danger" : "pill success"}
                          >
                            {step.name}：{step.incomplete ? "未完成" : step.passed === false ? "有问题" : "通过"}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {unresolvedRepairInstructions.length > 0 ? (
                      <div className="muted">建议：{unresolvedRepairInstructions.slice(0, 2).map(displayReviewText).join("；")}</div>
                    ) : null}
                    <div className="muted">
                      你不需要手工改正文。可以先采纳为规则，防止后续任务卡继续写死；如果想修正当前总纲里的阶段文字，再重新生成长篇规划。
                    </div>
                    {unresolvedRepairInstructions.length > 0 ? (
                      <ApiForm
                        className="long-form-review-form"
                        endpoint={`/api/projects/${projectId}/state`}
                        body={{
                          action: "resolve_long_form_open_question",
                          question: unresolvedRepairInstructions[0],
                          resolution: unresolvedRepairInstructions.join("；"),
                          mode: reviewAdviceAction.mode,
                          source: "review_advice"
                        }}
                        pendingTitle={reviewAdviceAction.pendingTitle}
                        pendingDescription="正在把审查建议同步到长篇规划事实锁。"
                        successMessage={reviewAdviceAction.successMessage}
                      >
                        <button className="button tiny primary" type="submit">
                          {unresolvedRepairInstructions.length > 1 ? "采纳这些建议" : reviewAdviceAction.label}
                        </button>
                      </ApiForm>
                    ) : null}
                  </div>
                ) : (
                  <div className="muted">建议先跑一次审查，专门检查规划是否和作品简介、创作圣经、主线状态冲突。</div>
                )}
                {!hasActiveLongFormPlanJob ? (
                  <ApiForm
                    className="long-form-review-form"
                    endpoint={`/api/projects/${projectId}/state`}
                    body={{
                      action: "review_long_form_plan",
                      longFormPlanId: latestLongFormPlan.id
                    }}
                    pendingTitle="正在创建长篇规划审查任务"
                    pendingDescription="正在排队执行第二步事实一致性审查。"
                    successMessage="审查任务已创建"
                  >
                    <button className="button tiny ghost" type="submit">
                      {hasReviewResult || latestFailedReviewLongFormPlanJob ? "重新审查当前规划" : "审查当前规划"}
                    </button>
                  </ApiForm>
                ) : null}
              </div>
              <div className="plan-summary-grid">
                <div className="task-block compact-context-card">
                  <div className="task-title">卷 / 阶段规划</div>
                  <div className="muted clamped-text three-lines">
                    {latestLongFormPlan.volumePlan.slice(0, 3).join("；") || "暂无阶段规划"}
                  </div>
                </div>
                <div className="task-block compact-context-card">
                  <div className="task-title">成长节奏</div>
                  <div className="muted clamped-text three-lines">
                    {latestLongFormPlan.progressionPacing.slice(0, 3).join("；") || "暂无成长节奏"}
                  </div>
                </div>
                <div className="task-block compact-context-card">
                  <div className="task-title">收益频率</div>
                  <div className="muted clamped-text three-lines">
                    {latestLongFormPlan.rewardPacing.slice(0, 3).join("；") || "暂无收益频率"}
                  </div>
                </div>
              </div>
              <div className="plan-stage-grid">
                {allLongFormStages.length > 0 ? (
                  allLongFormStages.map((stage) => (
                    <div key={stage.title} className="task-block compact-context-card">
                      <div className="task-title">{stage.title}</div>
                      <div className="muted clamped-text three-lines">{stage.body}</div>
                    </div>
                  ))
                ) : needsPost100Stages ? (
                  <div className="task-block compact-context-card">
                    <div className="task-title">后续阶段</div>
                    <div className="muted clamped-text three-lines">暂无第101章后规划</div>
                  </div>
                ) : null}
              </div>
              <details className="writing-context-details">
                <summary>编辑当前规划</summary>
                <ApiForm
                  className="forms writing-form long-form-plan-form long-form-plan-edit-form"
                  endpoint={`/api/projects/${projectId}/state`}
                  body={{ action: "update_long_form_plan" }}
                  lineArrayFields={[
                    "volumePlan",
                    "progressionPacing",
                    "rewardPacing",
                    "confirmedFacts",
                    "openQuestions",
                    "doNotChange",
                    "doNotRevealEarly",
                    "tagPromises",
                    "first10Chapters",
                    "progressionRules"
                  ]}
                  pendingTitle="正在保存长篇规划"
                  pendingDescription="正在更新总纲节奏、开局蓝图和任务卡硬规则。"
                  successMessage="长篇规划已更新，请重新审查当前规划"
                >
                  <div className="quote-box warning-box compact-note">
                    修改这里会影响后续任务卡和正文生成。保存后旧审查会失效，建议重新点击“审查当前规划”。
                  </div>
                  <div className="writing-form-grid">
                    <div className="field">
                      <div className="field-label">规划依据</div>
                      <textarea name="planningBasis" defaultValue={latestLongFormPlan.planningBasis} rows={3} />
                    </div>
                    <div className="field">
                      <div className="field-label">核心承诺</div>
                      <textarea name="corePromise" defaultValue={latestLongFormPlan.corePromise} rows={3} />
                    </div>
                    <div className="field">
                      <div className="field-label">卷 / 阶段规划</div>
                      <textarea name="volumePlan" defaultValue={latestLongFormPlan.volumePlan.join("\n")} rows={5} />
                      <div className="field-hint">一行一条。</div>
                    </div>
                    <div className="field">
                      <div className="field-label">成长节奏</div>
                      <textarea name="progressionPacing" defaultValue={latestLongFormPlan.progressionPacing.join("\n")} rows={5} />
                    </div>
                    <div className="field">
                      <div className="field-label">收益频率</div>
                      <textarea name="rewardPacing" defaultValue={latestLongFormPlan.rewardPacing.join("\n")} rows={5} />
                    </div>
                    <div className="field">
                      <div className="field-label">已确定事实</div>
                      <textarea name="confirmedFacts" defaultValue={confirmedFacts.join("\n")} rows={5} />
                    </div>
                    <div className="field">
                      <div className="field-label">待确认点</div>
                      <textarea name="openQuestions" defaultValue={openQuestions.join("\n")} rows={5} />
                    </div>
                    <div className="field">
                      <div className="field-label">禁止改写</div>
                      <textarea name="doNotChange" defaultValue={doNotChange.join("\n")} rows={5} />
                    </div>
                    <div className="field">
                      <div className="field-label">禁止提前揭示</div>
                      <textarea name="doNotRevealEarly" defaultValue={doNotRevealEarly.join("\n")} rows={5} />
                    </div>
                    <div className="field">
                      <div className="field-label">标签承诺</div>
                      <textarea name="tagPromises" defaultValue={tagPromises.join("\n")} rows={4} />
                    </div>
                    <div className="field">
                      <div className="field-label">开局任务蓝图</div>
                      <textarea name="first10Chapters" defaultValue={latestLongFormPlan.first10Chapters.join("\n")} rows={10} />
                      <div className="field-hint">这是任务队列，不是一章一条的死板编号；任务拆分后可以写“顺延”。</div>
                    </div>
                    <div className="field">
                      <div className="field-label">任务卡硬规则</div>
                      <textarea name="progressionRules" defaultValue={latestLongFormPlan.progressionRules.join("\n")} rows={8} />
                    </div>
                    <div className="field">
                      <div className="field-label">前段阶段节奏</div>
                      <textarea name="first100Pacing" defaultValue={latestLongFormPlan.first100Pacing} rows={6} />
                    </div>
                    <div className="field">
                      <div className="field-label">后续阶段节奏</div>
                      <textarea name="post100Pacing" defaultValue={latestLongFormPlan.post100Pacing} rows={6} />
                    </div>
                  </div>
                  <div className="state-form-actions">
                    <button className="button primary" type="submit">
                      保存当前规划
                    </button>
                  </div>
                </ApiForm>
              </details>
              <details className="writing-context-details">
                <summary>查看规划硬约束</summary>
                <div className="writing-context-full">
                  <div className="task-block full-width-context plan-rule-panel">
                    <div className="task-title">项目事实锁</div>
                    <div className="muted plan-rule-hint">后续任务卡、正文和审稿都会读取；项目事实源没定死或互相有张力的地方只能保留为待确认，不能由 AI 擅自写死。</div>
                    <div className="fact-lock-metrics">
                      <span>已确定 {confirmedFacts.length}</span>
                      <span>待确认 {openQuestions.length}</span>
                      <span>禁止改写 {doNotChange.length}</span>
                      <span>揭示限制 / 标签 {doNotRevealEarly.length + tagPromises.length}</span>
                    </div>
                    <div className="fact-lock-grid">
                      <div>
                        <strong>已确定事实</strong>
                        <ul className="plan-rule-list compact no-counter">
                          {confirmedFacts.length > 0 ? (
                            confirmedFacts.map((item) => <li key={item}>{item}</li>)
                          ) : (
                            <li>暂无明确事实锁</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <strong>待确认点</strong>
                        <div className="open-question-actions">
                          {openQuestions.length > 0 ? (
                            openQuestions.map((item) => (
                              <details key={item} className="open-question-item">
                                <summary>
                                  <span>{item}</span>
                                  <em>处理</em>
                                </summary>
                                <div className="open-question-editor">
                                  <ApiForm
                                    className="open-question-form"
                                    endpoint={`/api/projects/${projectId}/state`}
                                    body={{
                                      action: "resolve_long_form_open_question",
                                      question: item
                                    }}
                                    pendingTitle="正在处理待确认点"
                                    pendingDescription="正在同步长篇规划和创作圣经。"
                                    successMessage="待确认点已处理"
                                  >
                                    <input
                                      name="resolution"
                                      placeholder="填写作者决定；留空则使用原待确认点"
                                    />
                                    <div className="open-question-buttons">
                                      <button className="button tiny primary" type="submit" name="mode" value="confirm_fact">
                                        确认为事实
                                      </button>
                                      <button className="button tiny" type="submit" name="mode" value="mark_forbidden">
                                        加入禁止改写
                                      </button>
                                      <button className="button tiny ghost" type="submit" name="mode" value="dismiss">
                                        暂不处理
                                      </button>
                                    </div>
                                  </ApiForm>
                                </div>
                              </details>
                            ))
                          ) : (
                            <div className="muted empty-inline">暂无待确认点</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <strong>禁止改写</strong>
                        <ul className="plan-rule-list compact no-counter">
                          {doNotChange.length > 0 ? (
                            doNotChange.map((item) => <li key={item}>{item}</li>)
                          ) : (
                            <li>暂无禁止改写项</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <strong>禁止提前揭示 / 标签承诺</strong>
                        <ul className="plan-rule-list compact no-counter">
                          {[...doNotRevealEarly, ...tagPromises].length > 0 ? (
                            [...doNotRevealEarly, ...tagPromises].map((item) => (
                              <li key={item}>{item}</li>
                            ))
                          ) : (
                            <li>暂无前期揭示限制或标签承诺</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="task-block plan-rule-panel">
                    <div className="task-title">开局任务蓝图</div>
                    <div className="muted plan-rule-hint">生成第1-10章任务卡时，用来约束每章必须完成的剧情功能。</div>
                    {missingOpeningChapters.length > 0 ? (
                      <div className="quote-box warning-box compact-note plan-warning-note">
                        这份前10章蓝图不完整，缺少第{missingOpeningChapters.join("、")}章。建议重新生成长篇规划。
                      </div>
                    ) : null}
                    <ul className="plan-rule-list compact no-counter">
                      {latestLongFormPlan.first10Chapters.length > 0 ? (
                        latestLongFormPlan.first10Chapters.map((item) => (
                          <li key={item}>{item}</li>
                        ))
                      ) : (
                        <li>暂无前10章规划</li>
                      )}
                    </ul>
                  </div>
                  <div className="task-block plan-rule-panel">
                    <div className="task-title">任务卡硬规则</div>
                    <div className="muted plan-rule-hint">所有章节任务卡都会读取，用来限制升级、收益、地图和伏笔推进。</div>
                    <ol className="plan-rule-list">
                      {latestLongFormPlan.progressionRules.length > 0 ? (
                        latestLongFormPlan.progressionRules.map((item) => (
                          <li key={item}>{item}</li>
                        ))
                      ) : (
                        <li>暂无硬规则</li>
                      )}
                    </ol>
                  </div>
                  <div className="task-block full-width-context">
                    <div className="task-title">全书阶段节奏</div>
                    <div className="long-form-stage-list">
                      {allLongFormStages.length > 0 ? (
                        allLongFormStages.map((stage) => (
                          <div key={stage.title} className="long-form-stage-item">
                            <strong>{stage.title}</strong>
                            <p>{stage.body}</p>
                          </div>
                        ))
                      ) : needsPost100Stages ? (
                        <div className="muted long-form-plan-text">暂无第101章至终章规划</div>
                      ) : (
                        <div className="muted long-form-plan-text">预计不超过100章时，前段阶段已覆盖全书节奏和结尾收束。</div>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            </>
          ) : (
            <div className="empty-state">
              <strong>{hasActiveLongFormPlanJob ? "长篇规划正在生成" : "还没有长篇规划"}</strong>
              <span>
                {hasActiveLongFormPlanJob
                  ? "创建作品后已自动排队生成总纲。页面会自动执行并刷新结果；如果生成失败，可以在这里重新生成。"
                  : "建议正式生成任务卡和正文前先做这一步。它相当于开书总控台，会按目标字数估算章节数，再定全书阶段、成长上限和收益频率。"}
              </span>
              {shouldRunLongFormPlanJob && latestLongFormPlanJob ? (
                <AiJobRunner
                  jobId={latestLongFormPlanJob.id}
                  title={isReviewingLongFormPlan ? "正在审查长篇规划 / 总纲节奏" : "正在生成长篇规划 / 总纲节奏"}
                  runningMessage={
                    isReviewingLongFormPlan
                      ? "规划草稿已生成，正在单独审查事实一致性和待确认项。"
                      : "正在读取作品简介、体量、创作圣经和主线状态，生成全书阶段节奏。"
                  }
                  doneMessage={isReviewingLongFormPlan ? "长篇规划审查已完成，正在刷新结果。" : "长篇规划已生成，正在刷新结果。"}
                />
              ) : null}
            </div>
          )}

          {latestLongFormPlan && shouldRunLongFormPlanJob && latestLongFormPlanJob && !isGeneratingLongFormPlan ? (
            <AiJobRunner
              jobId={latestLongFormPlanJob.id}
              title={isReviewingLongFormPlan ? "正在审查长篇规划 / 总纲节奏" : "正在重新生成长篇规划 / 总纲节奏"}
              runningMessage={
                isReviewingLongFormPlan
                  ? "新规划已保存，正在单独审查事实一致性和待确认项。"
                  : "正在生成新的长篇规划草稿。"
              }
              doneMessage={isReviewingLongFormPlan ? "长篇规划审查已完成，正在刷新结果。" : "长篇规划已重新生成，正在刷新结果。"}
            />
          ) : null}
          {hasStaleLongFormPlanJob ? (
            <div className="quote-box warning-box compact-note long-form-stale-note">
              <strong>这个长篇规划任务已经超过 {latestLongFormPlanJob ? formatResumeDelay(latestLongFormPlanJob) : "一段时间"} 没有更新。</strong>
              <span>如果页面一直停在进行中，可以先解除卡住状态，再由页面或任务中心重新接管执行。</span>
              <ApiForm
                className="long-form-review-form"
                endpoint={`/api/projects/${projectId}/state`}
                body={{ action: "release_stale_long_form_plan_jobs" }}
                pendingTitle="正在解除卡住任务"
                pendingDescription="正在把超时未更新的长篇规划任务恢复为待处理。"
                successMessage="已解除卡住任务，请稍后刷新或等待自动接管"
              >
                <button className="button tiny" type="submit">
                  解除卡住并重新接管
                </button>
              </ApiForm>
            </div>
          ) : null}
          {latestFailedGenerateLongFormPlanJob ? (
            <div className="quote-box warning-box compact-note">
              长篇规划生成失败，当前规划未被覆盖：{displayJobError(latestFailedGenerateLongFormPlanJob.error || "AI 返回内容异常，请重新生成。")}
            </div>
          ) : null}
          {hasOldLongFormPlans ? (
            <div className="quote-box compact-note long-form-stale-note">
              <strong>检测到旧版长篇规划</strong>
              <span>旧版规划和旧审查记录可能会误导判断。可以只保留当前最新版本，后续任务卡也只读取最新规划。</span>
              <ApiForm
                className="long-form-review-form"
                endpoint={`/api/projects/${projectId}/state`}
                body={{ action: "prune_old_long_form_plans" }}
                pendingTitle="正在清理旧版规划"
                pendingDescription="正在只保留当前最新长篇规划和对应审查记录。"
                successMessage="旧版长篇规划已清理"
              >
                <button className="button tiny" type="submit">
                  只保留当前规划
                </button>
              </ApiForm>
            </div>
          ) : null}

          <ApiForm
            className="forms writing-form long-form-plan-form"
            endpoint={`/api/projects/${projectId}/writing`}
            body={{ action: "generate_long_form_plan", defer: true }}
            resetOnSuccess
            pendingTitle="正在创建长篇规划任务"
            pendingDescription="正在排队生成长篇规划，稍后会自动执行并刷新结果。"
            successMessage="长篇规划任务已创建"
          >
            {!latestLongFormPlan ? (
              <div className="quote-box compact-note long-form-priority-note">
                建议先完成这一步再去创作页生成任务卡；否则任务卡只能保守推进，无法按预计篇幅约束成长、地图、收益和伏笔回收。
              </div>
            ) : null}
            <div className="writing-form-grid">
              <div className="field">
                <div className="field-label">目标总字数</div>
                <input
                  name="targetTotalWords"
                  inputMode="numeric"
                  disabled={hasActiveLongFormPlanJob}
                  placeholder={latestLongFormPlan ? String(latestLongFormPlan.targetTotalWords) : "例如：300000"}
                />
                <div className="field-hint">可留空，系统会从创作圣经/作品体量里推断；30 万字就填 300000。</div>
              </div>
            </div>
            <div className="state-form-actions">
              <button className="button primary" type="submit" disabled={hasActiveLongFormPlanJob}>
                {hasActiveLongFormPlanJob
                  ? "正在生成中"
                  : latestLongFormPlan
                    ? "重新生成长篇规划"
                    : "生成长篇规划"}
              </button>
            </div>
          </ApiForm>
        </div>
      </details>

      <details id="project-info" className="state-editor-section">
        <summary>
          <span>
            <strong>作品信息</strong>
            <small>真正要创作的小说名称、题材和一句话设想。</small>
          </span>
          <span className="state-section-tag">{state.project.genre || "未填写题材"}</span>
        </summary>
        <ApiForm
          className="forms"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "update_project" }}
        >
          <div className="split-panels">
            <div className="field">
              <div className="field-label">作品名称</div>
              <div className="locked-setting">
                <strong>{state.project.name}</strong>
                <span>创建后锁定，避免章节上下文和项目识别混乱。</span>
              </div>
            </div>
            <div className="field">
              <div className="field-label">题材类型</div>
              <div className="locked-setting">
                <strong>{state.project.genre || "未填写题材"}</strong>
                <span>创建后锁定，避免后续创作方向跑偏。</span>
              </div>
            </div>
          </div>
          <div className="field">
            <div className="field-label">故事简介 / 创作设想</div>
            <textarea
              name="description"
              defaultValue={state.project.description}
              placeholder="一句话说明这本新书要写什么，不是原书复述。"
            />
          </div>
          <div className="state-form-actions">
            <button className="button primary" type="submit">
              保存作品信息
            </button>
          </div>
        </ApiForm>
      </details>

      <details id="bible" className="state-editor-section">
        <summary>
          <span>
            <strong>创作圣经</strong>
            <small>稳定设定写在这里，生成任务卡时会读取。</small>
          </span>
          <span className="state-section-tag">规则与禁区</span>
        </summary>
        <ApiForm
          className="forms"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "update_bible" }}
        >
          <div className="split-panels">
            <div className="field">
              <div className="field-label">作品类型</div>
              <div className="locked-setting">
                <strong>{state.bible.workType || "未填写作品类型"}</strong>
                <span>来自新建作品时的体量规划。</span>
              </div>
            </div>
            <div className="field">
              <div className="field-label">目标读者</div>
              <div className="locked-setting">
                <strong>{state.bible.targetReader || "网文读者"}</strong>
                <span>创建后锁定，保持小说读者定位稳定。</span>
              </div>
            </div>
          </div>
          <div className="field">
            <div className="field-label">核心爽点</div>
            <textarea name="corePleasure" defaultValue={state.bible.corePleasure} />
          </div>
          <div className="field">
            <div className="field-label">主角底层欲望</div>
            <textarea name="protagonistDesire" defaultValue={state.bible.protagonistDesire} />
          </div>
          <div className="field">
            <div className="field-label">世界规则</div>
            <textarea name="worldRules" defaultValue={state.bible.worldRules} />
          </div>
          <div className="field">
            <div className="field-label">金手指规则</div>
            <textarea name="goldenFingerRules" defaultValue={state.bible.goldenFingerRules} />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">战力 / 能力体系</div>
              <textarea name="powerSystem" defaultValue={state.bible.powerSystem} />
            </div>
            <div className="field">
              <div className="field-label">整体风格</div>
              <textarea
                name="styleGuide"
                defaultValue={state.bible.styleGuide}
                placeholder={`可写风格要求，常用：${styleOptions.join(" / ")}`}
              />
            </div>
          </div>
          <div className="field">
            <div className="field-label">叙事禁区</div>
            <textarea name="narrativeTaboos" defaultValue={state.bible.narrativeTaboos} />
          </div>
          <div className="field">
            <div className="field-label">不能违反的设定</div>
            <textarea name="immutableSettings" defaultValue={state.bible.immutableSettings} />
          </div>
          <div className="state-form-actions">
            <button className="button primary" type="submit">
              保存创作圣经
            </button>
          </div>
        </ApiForm>
      </details>

      <details id="plot-state" className="state-editor-section" open>
        <summary>
          <span>
            <strong>主线状态</strong>
            <small>告诉 AI 当前写到哪里，下一步必须推进什么。</small>
          </span>
          <span className="state-section-tag">{state.plotState.currentVolume || "未分卷"}</span>
        </summary>
        <ApiForm
          className="forms state-plot-form"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "update_plot_state" }}
          lineArrayFields={[
            "unresolvedQuestions",
            "openThreads",
            "resolvedThreads",
            "nextMilestones",
            "relationshipChanges"
          ]}
        >
          <div className="split-panels">
            <div className="field">
              <div className="field-label">当前分卷 / 阶段</div>
              <input
                name="currentVolume"
                defaultValue={state.plotState.currentVolume}
                placeholder="不分卷可留空；例如：第一卷 青石镇风波 / 开局篇"
              />
              <div className="field-hint">只有你明确设计分卷时再填写；系统不会强行判断第几卷。</div>
            </div>
            <div className="field">
              <div className="field-label">当前地图</div>
              <input
                name="currentMap"
                defaultValue={state.plotState.currentMap}
                placeholder="不确定可留空；例如：青石镇 / 临江市 / 白塔学院"
              />
              <div className="field-hint">地图来自正文台账和你的手动维护，不再使用固定模板下拉。</div>
            </div>
          </div>
          <div className="field">
            <div className="field-label">当前主线目标</div>
            <textarea name="mainGoal" defaultValue={state.plotState.mainGoal} />
          </div>
          <div className="field">
            <div className="field-label">短期目标</div>
            <textarea name="shortTermGoal" defaultValue={state.plotState.shortTermGoal} />
          </div>
          <div className="field">
            <div className="field-label">当前阶段</div>
            <textarea name="currentStage" defaultValue={state.plotState.currentStage} />
          </div>
          <div className="field">
            <div className="field-label">当前敌人 / 压力源</div>
            <input name="currentEnemy" defaultValue={state.plotState.currentEnemy} />
          </div>
          <div className="field">
            <div className="field-label">未解决悬念</div>
            <textarea
              name="unresolvedQuestions"
              defaultValue={state.plotState.unresolvedQuestions.join("\n")}
            />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">开放线索</div>
              <textarea name="openThreads" defaultValue={state.plotState.openThreads.join("\n")} />
            </div>
            <div className="field">
              <div className="field-label">已回收线索</div>
              <textarea name="resolvedThreads" defaultValue={state.plotState.resolvedThreads.join("\n")} />
            </div>
          </div>
          <div className="field">
            <div className="field-label">下一批里程碑</div>
            <textarea name="nextMilestones" defaultValue={state.plotState.nextMilestones.join("\n")} />
          </div>
          <div className="field">
            <div className="field-label">下一阶段目标</div>
            <textarea name="nextStageGoal" defaultValue={state.plotState.nextStageGoal} />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">战力状态</div>
              <textarea
                name="powerSystemState"
                defaultValue={state.plotState.powerSystemState}
                placeholder="没有明确战力体系可以留空；只写境界、能力边界、升级条件和代价。"
              />
            </div>
            <div className="field">
              <div className="field-label">地图与势力</div>
              <textarea
                name="mapAndForces"
                defaultValue={state.plotState.mapAndForces}
                placeholder="只写顶层地点、势力、组织和阵营；没有变化可以留空。"
              />
            </div>
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">资源状态</div>
              <textarea
                name="resourceState"
                defaultValue={state.plotState.resourceState}
                placeholder="只写真实获得/失去的资源、道具、线索和身份收益。"
              />
            </div>
            <div className="field">
              <div className="field-label">关系变化</div>
              <textarea name="relationshipChanges" defaultValue={state.plotState.relationshipChanges.join("\n")} />
            </div>
          </div>
          <div className="state-form-actions">
            <button className="button primary" type="submit">
              保存主线状态
            </button>
          </div>
        </ApiForm>
      </details>

      <details id="subplot-threads" className="state-editor-section" open>
        <summary>
          <span>
            <strong>支线 / 配角弧线池</strong>
            <small>维护配角小目标、秘密、误判、亏欠和回扣主线的方式。</small>
          </span>
          <span className="state-section-tag">{subplotThreads.length} 条</span>
        </summary>
        <details className="state-inline-form">
          <summary>添加支线 / 配角弧线</summary>
          <ApiForm
            className="forms"
            endpoint={`/api/projects/${projectId}/state`}
            body={{ action: "create_subplot_thread" }}
            resetOnSuccess
            successMessage="已加入支线池"
          >
            <div className="split-panels">
              <div className="field">
                <div className="field-label">支线名称</div>
                <input name="name" placeholder="误判主角的同僚线 / 旧账本暗线" />
              </div>
              <div className="field">
                <div className="field-label">关联人物</div>
                <input name="character" placeholder="可填一个或多个人物名" />
              </div>
            </div>
            <div className="field">
              <div className="field-label">当前小目标</div>
              <textarea name="goal" placeholder="这个配角此刻想要什么，或这条暗线下一步要推动什么。" />
            </div>
            <div className="field">
              <div className="field-label">秘密 / 误判 / 亏欠</div>
              <textarea name="hidden" placeholder="让配角不只是工具人的隐藏信息、误解、欠债、立场摇摆或代价。" />
            </div>
            <div className="field">
              <div className="field-label">如何回扣主线</div>
              <textarea name="mainPlotLink" placeholder="说明它给主线提供线索、阻力、情绪补偿、资源代价或伏笔作用。" />
            </div>
            <div className="split-panels">
              <div className="field">
                <div className="field-label">下次节拍</div>
                <input name="nextBeat" placeholder="例如：3-5 章内给一次选择或小高光" />
              </div>
              <div className="field">
                <div className="field-label">边界 / 收束</div>
                <input name="boundary" placeholder="例如：不能替代主线；在本案结束前给出阶段回应" />
              </div>
            </div>
            <div className="state-form-actions">
              <button className="button primary" type="submit">
                加入支线池
              </button>
            </div>
          </ApiForm>
        </details>

        <div className="list">
          {subplotThreads.length === 0 ? (
            <div className="section-card">
              还没有可轮换的支线或配角弧线。这里不是要求每章都写支线，而是给任务卡生成时提供可选择的配角节拍。
            </div>
          ) : (
            subplotThreads.map((line) => {
              const thread = parseSubplotThread(line);

              return (
                <div key={line} className="list-item">
                  <div className="row">
                    <strong>{thread.name || "未命名支线"}</strong>
                    <span className="chip">{thread.character || "未关联人物"}</span>
                  </div>
                  <div className="muted">小目标：{thread.goal || "未填写"}</div>
                  <div className="muted">隐藏驱动：{thread.hidden || "未填写"}</div>
                  <div className="muted">回扣主线：{thread.mainPlotLink || "未填写"}</div>
                  <details className="chapter-content-editor">
                    <summary>编辑支线</summary>
                    <ApiForm
                      className="forms"
                      endpoint={`/api/projects/${projectId}/state`}
                      body={{ action: "update_subplot_thread", previousLine: line }}
                      successMessage="支线已保存"
                    >
                      <div className="split-panels">
                        <div className="field">
                          <div className="field-label">支线名称</div>
                          <input name="name" defaultValue={thread.name} />
                        </div>
                        <div className="field">
                          <div className="field-label">关联人物</div>
                          <input name="character" defaultValue={thread.character} />
                        </div>
                      </div>
                      <div className="field">
                        <div className="field-label">当前小目标</div>
                        <textarea name="goal" defaultValue={thread.goal} />
                      </div>
                      <div className="field">
                        <div className="field-label">秘密 / 误判 / 亏欠</div>
                        <textarea name="hidden" defaultValue={thread.hidden} />
                      </div>
                      <div className="field">
                        <div className="field-label">如何回扣主线</div>
                        <textarea name="mainPlotLink" defaultValue={thread.mainPlotLink} />
                      </div>
                      <div className="split-panels">
                        <div className="field">
                          <div className="field-label">下次节拍</div>
                          <input name="nextBeat" defaultValue={thread.nextBeat} />
                        </div>
                        <div className="field">
                          <div className="field-label">边界 / 收束</div>
                          <input name="boundary" defaultValue={thread.boundary} />
                        </div>
                      </div>
                      <div className="state-form-actions">
                        <button className="button primary" type="submit">
                          保存支线
                        </button>
                        <ApiButton
                          endpoint={`/api/projects/${projectId}/state`}
                          body={{ action: "delete_subplot_thread", previousLine: line }}
                          label="删除支线"
                          className="button danger"
                          confirmMessage={`确定删除“${thread.name || "这条支线"}”吗？这只会从支线池移除，不会改动已经生成的正文。`}
                          successMessage="支线已删除"
                        />
                      </div>
                    </ApiForm>
                  </details>
                </div>
              );
            })
          )}
        </div>
      </details>

      <details id="characters" className="state-editor-section" open>
        <summary>
          <span>
            <strong>人物档案</strong>
            <small>重点记录人物知道什么、不知道什么。</small>
          </span>
          <span className="state-section-tag">{profileCount} 人</span>
        </summary>
        <details className="state-inline-form">
          <summary>添加人物</summary>
        <ApiForm
          className="forms"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "create_character" }}
          resetOnSuccess
        >
          <div className="split-panels">
            <div className="field">
              <div className="field-label">姓名</div>
              <input name="name" placeholder="秦掌柜" />
            </div>
            <div className="field">
              <div className="field-label">身份</div>
              <input name="identity" placeholder="药铺掌柜 / 旧案知情人" />
            </div>
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">当前目标</div>
              <input name="currentGoal" />
            </div>
            <div className="field">
              <div className="field-label">长期目标</div>
              <input name="longTermGoal" />
            </div>
          </div>
          <div className="field">
            <div className="field-label">秘密</div>
            <textarea name="secret" />
          </div>
          <div className="field">
            <div className="field-label">与主角关系 / 当前态度</div>
            <input name="relationshipToProtagonist" placeholder="关系" />
            <input name="attitude" placeholder="态度" />
          </div>
          <div className="field">
            <div className="field-label">能力边界 / 说话习惯</div>
            <input name="abilityBoundary" placeholder="能力边界" />
            <input name="voice" placeholder="说话习惯" />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">已知信息</div>
              <textarea name="knownInformation" />
            </div>
            <div className="field">
              <div className="field-label">不知道的信息</div>
              <textarea name="unknownInformation" />
            </div>
          </div>
          <div className="field">
            <div className="field-label">最近出场 / 当前状态</div>
            <input name="lastAppearance" placeholder="第几章出场" />
            <input name="currentState" placeholder="当前状态" />
          </div>
          <div className="state-form-actions">
            <button className="button primary" type="submit">
              添加人物
            </button>
          </div>
        </ApiForm>
        </details>

        <div className="list">
          {state.characters.length === 0 ? (
            <div className="section-card">暂无人物档案。</div>
          ) : (
            state.characters.map((character) => (
              <div key={character.id} className="list-item">
                <div className="row">
                  <strong>{character.name}</strong>
                  <span className="chip">{character.identity || "未填写身份"}</span>
                </div>
                <div className="muted">已知：{character.knownInformation || "未填写"}</div>
                <div className="muted">未知：{character.unknownInformation || "未填写"}</div>
                <div className="muted">状态：{character.currentState || "未填写"}</div>
                <details className="chapter-content-editor">
                  <summary>编辑人物</summary>
                  <ApiForm
                    className="forms"
                    endpoint={`/api/projects/${projectId}/state`}
                    body={{ action: "update_character", characterId: character.id }}
                  >
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">姓名</div>
                        <input name="name" defaultValue={character.name} />
                      </div>
                      <div className="field">
                        <div className="field-label">身份</div>
                        <input name="identity" defaultValue={character.identity} />
                      </div>
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">当前目标</div>
                        <input name="currentGoal" defaultValue={character.currentGoal} />
                      </div>
                      <div className="field">
                        <div className="field-label">长期目标</div>
                        <input name="longTermGoal" defaultValue={character.longTermGoal} />
                      </div>
                    </div>
                    <div className="field">
                      <div className="field-label">秘密</div>
                      <textarea name="secret" defaultValue={character.secret} />
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">与主角关系</div>
                        <input
                          name="relationshipToProtagonist"
                          defaultValue={character.relationshipToProtagonist}
                        />
                      </div>
                      <div className="field">
                        <div className="field-label">当前态度</div>
                        <input name="attitude" defaultValue={character.attitude} />
                      </div>
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">能力边界</div>
                        <input name="abilityBoundary" defaultValue={character.abilityBoundary} />
                      </div>
                      <div className="field">
                        <div className="field-label">说话习惯</div>
                        <input name="voice" defaultValue={character.voice} />
                      </div>
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">已知信息</div>
                        <textarea name="knownInformation" defaultValue={character.knownInformation} />
                      </div>
                      <div className="field">
                        <div className="field-label">不知道的信息</div>
                        <textarea name="unknownInformation" defaultValue={character.unknownInformation} />
                      </div>
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">最近出场</div>
                        <input name="lastAppearance" defaultValue={character.lastAppearance} />
                      </div>
                      <div className="field">
                        <div className="field-label">当前状态</div>
                        <input name="currentState" defaultValue={character.currentState} />
                      </div>
                    </div>
                    <div className="state-form-actions">
                      <button className="button primary" type="submit">
                        保存人物
                      </button>
                      <ApiButton
                        endpoint={`/api/projects/${projectId}/state`}
                        body={{ action: "delete_character", characterId: character.id }}
                        label="删除人物"
                        className="button danger"
                        confirmMessage={`确定删除人物“${character.name}”吗？删除后不会影响已经生成的章节正文。`}
                      />
                    </div>
                  </ApiForm>
                </details>
              </div>
            ))
          )}
        </div>
      </details>

      <details id="foreshadowings" className="state-editor-section" open>
        <summary>
          <span>
            <strong>伏笔表</strong>
            <small>伏笔独立管理，避免提前爆雷或忘记回收。</small>
          </span>
          <span className="state-section-tag">未回收 {openForeshadowingCount}</span>
        </summary>
        <details className="state-inline-form">
          <summary>添加伏笔</summary>
        <ApiForm
          className="forms"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "create_foreshadowing" }}
          arrayFields={["relatedCharacters"]}
          resetOnSuccess
        >
          <div className="field">
            <div className="field-label">伏笔名称</div>
            <input name="name" placeholder="父亲失踪" />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">埋设章节</div>
              <input name="plantedChapter" placeholder="第 3 章" />
            </div>
            <div className="field">
              <div className="field-label">当前状态</div>
              <select name="status" defaultValue="open">
                <option value="open">未回收</option>
                <option value="partial">部分回收</option>
                <option value="closed">已回收</option>
              </select>
            </div>
          </div>
          <div className="field">
            <div className="field-label">关联人物</div>
            <input name="relatedCharacters" placeholder="主角、秦掌柜" />
          </div>
          <div className="field">
            <div className="field-label">关联地点</div>
            <input name="relatedLocation" />
          </div>
          <div className="field">
            <div className="field-label">预计回收章节 / 回收方式</div>
            <input name="expectedRevealChapter" placeholder="45-50" />
            <input name="revealMethod" placeholder="通过账本、证人或旧物回收" />
          </div>
          <div className="field">
            <div className="field-label">不能提前透露的信息</div>
            <textarea name="hiddenInformation" />
          </div>
          <div className="state-form-actions">
            <button className="button primary" type="submit">
              添加伏笔
            </button>
          </div>
        </ApiForm>
        </details>

        <div className="timeline">
          {state.foreshadowings.length === 0 ? (
            <div className="section-card">暂无伏笔。</div>
          ) : (
            state.foreshadowings.map((item) => (
              <div key={item.id} className="timeline-item">
                <div className="row">
                  <strong>{item.name}</strong>
                  <span className={`pill ${item.status === "closed" ? "success" : "warning"}`}>
                    {item.status === "closed" ? "已回收" : item.status === "partial" ? "部分回收" : "未回收"}
                  </span>
                </div>
                <div className="muted">埋设：{item.plantedChapter || "未填写"}；预计回收：{item.expectedRevealChapter || "未填写"}</div>
                <div className="muted">不能提前透露：{item.hiddenInformation || "未填写"}</div>
              </div>
            ))
          )}
        </div>
      </details>

        </div>

        <aside className="state-side">
          <nav className="state-jump-nav" aria-label="状态维护导航">
            <a href="#project-info">作品</a>
            <a href="#bible">圣经</a>
            <a href="#plot-state">主线</a>
            <a href="#subplot-threads">支线</a>
            <a href="#characters">人物</a>
            <a href="#foreshadowings">伏笔</a>
          </nav>
        </aside>
    </div>
    </div>
  );
}
