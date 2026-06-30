import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton, ApiForm } from "@/components/api-form";
import { AiJobRunner } from "@/components/ai-job-runner";
import { DraftExportActions } from "@/components/draft-export-actions";
import { DraftRevisionEditor } from "@/components/draft-revision-editor";
import { FullBookExportActions } from "@/components/full-book-export-actions";
import { Panel } from "@/components/panel";
import { StreamDraftButton } from "@/components/stream-draft-button";
import type { StoredWritingTaskCard } from "@/lib/project-types";
import { getProjectAnalysis, getProjectInspirations, getProjectWritingState } from "@/lib/projects";
import { formatReviewText } from "@/lib/review-display";

function formatReviewIssueType(type: string) {
  const normalized = type.trim().toLowerCase();
  const issueTypeMap: Record<string, string> = {
    hook: "章末钩子不足",
    cliffhanger: "章末钩子不足",
    continuity: "承接前文不足",
    consistency: "设定一致性问题",
    character: "人物行为风险",
    characters: "人物档案问题",
    pronoun: "人物代词问题",
    gender: "人物性别问题",
    "ai flavor": "AI 味偏重",
    ai_flavor: "AI 味偏重",
    style: "表达风格问题",
    prose: "行文表达问题",
    language: "语言表达问题",
    dialogue: "对话问题",
    logic: "剧情逻辑问题",
    "rule violation": "规则违反",
    rule_violation: "规则违反",
    "constraint violation": "约束违反",
    constraint_violation: "约束违反",
    "consistency issue": "一致性问题",
    consistency_issue: "一致性问题",
    "continuity issue": "承接问题",
    continuity_issue: "承接问题",
    "character issue": "人物问题",
    character_issue: "人物问题",
    "logic issue": "剧情逻辑问题",
    logic_issue: "剧情逻辑问题",
    "style issue": "表达风格问题",
    style_issue: "表达风格问题",
    emotion: "情绪表达问题",
    pacing: "节奏问题",
    payoff: "爽点释放不足",
    foreshadowing: "伏笔处理问题",
    worldbuilding: "世界观设定问题",
    power: "战力体系风险"
  };

  return issueTypeMap[normalized] || formatReviewText(type) || "需要调整";
}

function formatReviewSeverity(severity: string) {
  const normalized = severity.trim().toLowerCase();

  if (normalized === "high") {
    return { label: "高风险", className: "pill danger" };
  }

  if (normalized === "medium") {
    return { label: "中等风险", className: "pill warning" };
  }

  if (normalized === "low") {
    return { label: "轻微问题", className: "pill" };
  }

  return { label: severity || "待确认", className: "pill" };
}

function splitReadableLines(value?: string | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

type LedgerDisplayFields = {
  events: string[];
  newClues: string[];
  payoff: string;
  cliffhanger: string;
  stateChanges: string[];
  carryOverTasks?: string[];
};

function splitLedgerDisplaySegments(value: string) {
  return value
    .split(/[；;]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLedgerDisplayText(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/[，,。！？!?；;：:“”"'‘’（）()【】\[\]《》<>—\-_/\\|、…]/g, "")
    .trim();
}

function isRepeatedLedgerDisplayText(value: string, sources: string[]) {
  const text = normalizeLedgerDisplayText(value);

  if (text.length < 10) {
    return false;
  }

  return sources.some((source) => {
    const sourceText = normalizeLedgerDisplayText(source);

    if (sourceText.length < 10) {
      return false;
    }

    return sourceText.includes(text) || text.includes(sourceText);
  });
}

function uniqueDisplayLines(values: string[], exclude: string[] = []) {
  const result: string[] = [];

  values.flatMap(splitLedgerDisplaySegments).forEach((value) => {
    if (isRepeatedLedgerDisplayText(value, [...exclude, ...result])) {
      return;
    }

    result.push(value);
  });

  return result;
}

function TaskCardEditForm({
  projectId,
  taskCard,
  hasRelatedDraft = false
}: {
  projectId: string;
  taskCard: StoredWritingTaskCard;
  hasRelatedDraft?: boolean;
}) {
  return (
    <details className="writing-context-details writing-form-assist">
      <summary>编辑任务卡</summary>
      <ApiForm
        endpoint={`/api/projects/${projectId}/writing`}
        body={{ action: "update_task_card", taskCardId: taskCard.id }}
        arrayFields={["requiredCharacters", "foreshadowingTasks", "rulesNotToBreak"]}
        successMessage="任务卡已更新"
        pendingTitle="正在更新任务卡"
        pendingDescription="正在保存本章目标、人物、伏笔和章末钩子。"
        className="writing-form-assist-body"
      >
        {hasRelatedDraft ? (
          <div className="quote-box warning-box compact-note">
            这张任务卡已经生成过正文。修改后请用下方“保留任务卡重写正文”重新生成正文；旧台账和旧审稿会清空，避免继续引用过期判断。
          </div>
        ) : null}
        <div className="writing-form-grid">
          <div className="field">
            <div className="field-label">章节标题</div>
            <input name="title" defaultValue={taskCard.title} />
          </div>
          <div className="field">
            <div className="field-label">本章目标</div>
            <textarea name="chapterGoal" defaultValue={taskCard.chapterGoal} rows={3} />
          </div>
          <div className="field">
            <div className="field-label">承接上一章</div>
            <textarea name="continuity" defaultValue={taskCard.continuity} rows={3} />
          </div>
          <div className="field">
            <div className="field-label">主线推进</div>
            <textarea name="mainPlotProgress" defaultValue={taskCard.mainPlotProgress} rows={3} />
          </div>
          <div className="field">
            <div className="field-label">出场人物</div>
            <textarea name="requiredCharacters" defaultValue={taskCard.requiredCharacters.join("\n")} rows={3} />
            <div className="field-hint">一行一个。只填本章必须实际出场或被现场质询、比对、阻拦的人物。</div>
          </div>
          <div className="field">
            <div className="field-label">爽点 / 收益机制</div>
            <textarea name="pleasurePoint" defaultValue={taskCard.pleasurePoint} rows={3} />
          </div>
          <div className="field">
            <div className="field-label">伏笔任务</div>
            <textarea name="foreshadowingTasks" defaultValue={taskCard.foreshadowingTasks.join("\n")} rows={4} />
          </div>
          <div className="field">
            <div className="field-label">禁止违反</div>
            <textarea name="rulesNotToBreak" defaultValue={taskCard.rulesNotToBreak.join("\n")} rows={5} />
          </div>
          <div className="field">
            <div className="field-label">章末钩子</div>
            <textarea name="endingHook" defaultValue={taskCard.endingHook} rows={3} />
          </div>
        </div>
        <div className="hero-actions writing-submit-row">
          <button className="button primary" type="submit">
            保存任务卡修改
          </button>
        </div>
      </ApiForm>
    </details>
  );
}

function ledgerEventsForDisplay(ledger: LedgerDisplayFields) {
  return uniqueDisplayLines(ledger.events);
}

function ledgerStateChangesForDisplay(ledger: LedgerDisplayFields, displayEvents: string[]) {
  return uniqueDisplayLines(ledger.stateChanges, [
    ...displayEvents,
    ...ledger.newClues,
    ledger.payoff,
    ledger.cliffhanger
  ]);
}

function removeStatusPrefix(value: string) {
  return value.replace(/^(作品简介|项目目标|一句话卖点|开局钩子|前100章节奏|爽点分布|核心主角|作品标签)：/, "").trim();
}

function firstReadableText(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const line = splitReadableLines(value)
      .map(removeStatusPrefix)
      .find((item) => item && item !== "基于已生成的新书大纲进入长篇创作。");

    if (line) {
      return line;
    }
  }

  return "";
}

function findLineByPrefix(value: string | undefined, prefix: string) {
  return splitReadableLines(value)
    .find((line) => line.startsWith(prefix))
    ?.replace(prefix, "")
    .trim() ?? "";
}

function formatWanWords(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "未设置";
  }

  return `${Math.round(value / 10000)} 万字`;
}

function formatClosureTime(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function closureDecisionLabel(
  decision?: "accepted" | "ignored"
) {
  if (decision === "accepted") {
    return null;
  }

  if (decision === "ignored") {
    return { text: "已移除", className: "pill danger" };
  }

  return null;
}

function readJobObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default async function ProjectWritingPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [writingState, analysisState, relatedInspirations] = await Promise.all([
    getProjectWritingState(projectId),
    getProjectAnalysis(projectId),
    getProjectInspirations(projectId)
  ]);

  if (!writingState) {
    notFound();
  }

  const latestTaskCard = writingState.taskCards[0];
  const latestTaskCardDraft = latestTaskCard
    ? writingState.drafts.find((draft) => draft.taskCardId === latestTaskCard.id)
    : null;
  const maxChapterNumber = Math.max(
    0,
    ...writingState.taskCards.map((card) => card.chapterNumber),
    ...writingState.drafts.map((draft) => draft.chapterNumber),
    ...writingState.ledgers.map((ledger) => ledger.chapterNumber),
    ...writingState.reviews.map((review) => review.chapterNumber)
  );
  const latestWrittenChapterNumber = Math.max(
    0,
    ...writingState.drafts.map((draft) => draft.chapterNumber)
  );
  const nextChapterNumber = maxChapterNumber + 1;
  const activeTaskCard = latestTaskCard && !latestTaskCardDraft ? latestTaskCard : null;
  const taskCardChapterNumber = activeTaskCard?.chapterNumber ?? nextChapterNumber;
  const activeDraft = activeTaskCard ? null : writingState.drafts[0] ?? null;
  const activeDraftTaskCard = activeDraft
    ? writingState.taskCards.find((card) => card.id === activeDraft.taskCardId) ?? null
    : null;
  const displayTaskCard = activeTaskCard ?? activeDraftTaskCard;
  const activeDisplayChapterNumber = activeDraft?.chapterNumber ?? activeTaskCard?.chapterNumber ?? taskCardChapterNumber;
  const activeLedger = activeDraft
    ? writingState.ledgers.find((ledger) => ledger.draftId === activeDraft.id) ?? null
    : null;
  const activeReview = activeDraft
    ? writingState.reviews.find((review) => review.draftId === activeDraft.id) ?? null
    : null;
  const activeWritingBatchJob =
    writingState.writingBatchJobs.find((job) => job.status === "pending" || job.status === "running") ?? null;
  const activeWritingBatchOutput = activeWritingBatchJob ? readJobObject(activeWritingBatchJob.output) : {};
  const activeWritingBatchInput = activeWritingBatchJob ? readJobObject(activeWritingBatchJob.input) : {};
  const activeWritingBatchReplaceExisting =
    activeWritingBatchOutput.replaceExisting === true || activeWritingBatchInput.replaceExisting === true;
  const activeWritingBatchTitle = activeWritingBatchReplaceExisting ? "正在批量范围重写" : "正在批量连写章节";
  const activeWritingBatchDoneMessage = activeWritingBatchReplaceExisting
    ? "批量范围重写已完成，正在刷新创作工作台。"
    : "批量连写已完成，正在刷新创作工作台。";
  const activeWritingBatchTotal = Number(
    activeWritingBatchOutput.requestedChapters ?? activeWritingBatchInput.chapterCount ?? 0
  );
  const activeWritingBatchCompleted = Number(activeWritingBatchOutput.completedChapters ?? 0);
  const activeWritingBatchCurrentChapter = Number(activeWritingBatchOutput.currentChapterNumber ?? 0);
  const activeWritingBatchStep = String(activeWritingBatchOutput.currentStep ?? "");
  const latestReview = writingState.reviews[0];
  const historicalReview = activeDraft
    ? writingState.reviews.find((review) => review.draftId !== activeDraft.id) ?? null
    : latestReview ?? null;
  const chapterNumbers = Array.from(
    new Set([
      ...writingState.taskCards.map((card) => card.chapterNumber),
      ...writingState.drafts.map((draft) => draft.chapterNumber),
      ...writingState.ledgers.map((ledger) => ledger.chapterNumber),
      ...writingState.reviews.map((review) => review.chapterNumber)
    ])
  );
  const storyAnalysis = analysisState.storyAnalysis;
  const hasAnalysisContext = analysisState.chapterAnalyses.length > 0 || Boolean(storyAnalysis);
  const latestLongFormPlan = writingState.longFormPlans[0] ?? null;
  const protagonistSummary = writingState.characters.length > 0
    ? writingState.characters.slice(0, 3).map((character) => character.name).join("、")
    : firstReadableText(findLineByPrefix(writingState.bible.protagonistDesire, "核心主角：")) || "主角待补充";
  const openingSummary = firstReadableText(
    writingState.plotState.shortTermGoal,
    writingState.plotState.currentStage,
    writingState.bible.immutableSettings
  ) || "先生成第一章任务卡，明确开局压制和第一次反击。";
  const corePleasureSummary = firstReadableText(
    writingState.bible.corePleasure,
    storyAnalysis?.topPleasureTypes.join("、")
  ) || "核心爽点待补充";
  const pacingSummary = firstReadableText(
    findLineByPrefix(writingState.bible.styleGuide, "前100章节奏："),
    storyAnalysis?.pacing
  ) || "暂无章节节奏参考。";
  const contextStats = [
    `人物 ${writingState.characters.length}`,
    `伏笔 ${writingState.foreshadowings.length}`,
    `灵感 ${relatedInspirations.length}`,
    `章节 ${chapterNumbers.length}`,
    latestLongFormPlan ? "已有长篇规划" : "缺少长篇规划",
    hasAnalysisContext ? `拆书 ${analysisState.chapterAnalyses.length}` : "未接入拆书"
  ];
  const activeChapterLabel = `第 ${activeDisplayChapterNumber} 章`;
  const activeLedgerConfirmed = activeLedger?.closureStatus === "confirmed";
  const closureConfirmedAt = formatClosureTime(activeLedger?.closureConfirmedAt);
  const highRiskIssues = activeReview?.issues.filter((issue) => issue.severity === "high") ?? [];
  const mediumRiskIssues = activeReview?.issues.filter((issue) => issue.severity === "medium") ?? [];
  const activeLedgerEvents = activeLedger ? ledgerEventsForDisplay(activeLedger) : [];
  const activeLedgerStateChanges = activeLedger
    ? ledgerStateChangesForDisplay(activeLedger, activeLedgerEvents)
    : [];
  const activeLedgerCarryOver = activeLedger ? uniqueDisplayLines(activeLedger.carryOverTasks ?? []) : [];
  const closureDecisionByTarget = new Map(
    (activeLedger?.closureDecisions ?? []).map((item) => [`${item.targetType}:${item.targetId}`, item.decision] as const)
  );
  const closureCharacters = activeDraft
    ? writingState.characters
        .filter((character) =>
          character.lastAppearance.includes(activeChapterLabel) ||
          character.currentState.includes(activeChapterLabel) ||
          activeLedger?.newCharacters.some((name) => name === character.name)
        )
        .slice(0, 6)
    : [];
  const activeLedgerEvidence = activeLedger
    ? [
        ...activeLedger.events,
        ...activeLedger.newClues,
        ...activeLedger.stateChanges,
        ...(activeLedger.carryOverTasks ?? []),
        activeLedger.payoff,
        activeLedger.cliffhanger
      ]
    : [];
  const closureForeshadowings = activeLedger
    ? writingState.foreshadowings
        .filter((item) =>
          item.plantedChapter.includes(activeChapterLabel) ||
          activeLedgerEvidence.some((entry) => entry.includes(item.name) || item.hiddenInformation.includes(entry))
        )
        .slice(0, 6)
    : [];
  const closureConfirmMessage = highRiskIssues.length > 0
    ? `当前审稿还有 ${highRiskIssues.length} 个高风险问题。确认后系统会把本章台账标记为作者已确认，后续任务卡会继续读取这些状态。确定继续确认吗？`
    : !activeReview
      ? "当前章节还没有一致性审稿。确认后系统会把本章台账标记为作者已确认，后续任务卡会继续读取这些状态。确定继续确认吗？"
      : "确认后系统会把本章自动入库的事件、人物、伏笔和主线变化标记为作者已确认，后续任务卡会继续读取这些状态。";
  const writingStageItems = [
    {
      href: "#writing-prep",
      label: "准备",
      detail: `第 ${taskCardChapterNumber} 章`,
      className: "active"
    },
    {
      href: "#task-card-form",
      label: "任务卡",
      detail: displayTaskCard ? "已生成" : "待生成",
      className: displayTaskCard ? "done" : ""
    },
    {
      href: "#writing-draft",
      label: "正文",
      detail: activeDraft ? "已保存" : "待正文",
      className: activeDraft ? "done" : ""
    },
    {
      href: "#writing-closure",
      label: "收口",
      detail: activeLedgerConfirmed ? "已确认" : activeLedger ? "待确认" : "缺台账",
      className: activeLedgerConfirmed ? "done" : activeLedger ? "warning" : ""
    },
    {
      href: "#writing-review",
      label: "审稿",
      detail: activeReview ? (highRiskIssues.length > 0 ? `${highRiskIssues.length} 高风险` : "已审") : "待审",
      className: activeReview && highRiskIssues.length === 0 ? "done" : highRiskIssues.length > 0 ? "danger" : ""
    }
  ];

  return (
    <div className="grid">
      <nav className="writing-stage-nav" aria-label="创作阶段导航">
        {writingStageItems.map((item) => (
          <a key={item.href} href={item.href} className={`writing-stage-link ${item.className}`}>
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </a>
        ))}
      </nav>

      <div id="writing-prep" className="scroll-anchor" />
      <Panel title="本章准备" description="只展示生成下一章任务卡前需要看的关键信息。">
        <div className="writing-prep-stack">
          <div className="writing-action-strip">
            <div>
              <div className="mini-label">当前步骤</div>
              <strong>{activeTaskCard ? `第 ${taskCardChapterNumber} 章任务卡已生成` : `准备生成第 ${taskCardChapterNumber} 章任务卡`}</strong>
            </div>
            <div className="hero-actions">
              <a className="button primary" href="#task-card-form">
                {activeTaskCard ? "查看任务卡" : `生成第 ${taskCardChapterNumber} 章任务卡`}
              </a>
              <Link className="button" href={`/projects/${projectId}/writing/chapters`}>
                章节目录
              </Link>
              <Link className="button" href={`/projects/${projectId}/state`}>
                完善设定
              </Link>
              {!latestLongFormPlan ? (
                <Link className="button" href={`/projects/${projectId}/state#long-form-plan`}>
                  先做长篇规划
                </Link>
              ) : null}
              {contextStats.map((item) => (
                <span key={item} className="chip">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="writing-context-grid">
            <div className="task-block compact-context-card">
              <div className="task-title">主角</div>
              <div className="muted clamped-text two-lines">{protagonistSummary}</div>
            </div>
            <div className="task-block compact-context-card">
              <div className="task-title">开局目标</div>
              <div className="muted clamped-text three-lines">{openingSummary}</div>
            </div>
            <div className="task-block compact-context-card">
              <div className="task-title">核心爽点</div>
              <div className="muted clamped-text three-lines">{corePleasureSummary}</div>
            </div>
            <div className="task-block compact-context-card">
              <div className="task-title">节奏参考</div>
              <div className="muted clamped-text three-lines">{pacingSummary}</div>
            </div>
          </div>

          <details className="writing-context-details">
            <summary>查看完整状态上下文</summary>
            <div className="writing-context-full">
              <div className="task-block">
                <div className="task-title">故事方向</div>
                <div className="muted">{writingState.plotState.mainGoal || writingState.project.description || "还没有明确故事简介。"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">主角底层欲望</div>
                <div className="muted">{writingState.bible.protagonistDesire || "先补主角想要什么、害怕失去什么。"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">核心爽点</div>
                <div className="muted">{writingState.bible.corePleasure || storyAnalysis?.topPleasureTypes.join("、") || "还没有核心爽点。"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">拆书主循环</div>
                <div className="muted">{storyAnalysis?.mainLoop || "暂无可引用的整书分析。"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">节奏参考</div>
                <div className="muted">{storyAnalysis?.pacing || writingState.bible.styleGuide || "暂无章节节奏参考。"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">当前阶段</div>
                <div className="muted">{writingState.plotState.currentStage || "还没有当前创作阶段。"}</div>
              </div>
            </div>
          </details>

          <div className={hasAnalysisContext ? "quote-box compact-note" : "quote-box warning-box compact-note"}>
            {hasAnalysisContext
              ? `可引用 ${analysisState.chapterAnalyses.length.toLocaleString("zh-CN")} 个章节拆解结果。任务卡只借鉴结构、节奏和爽点功能，不照搬原书内容。`
              : "当前项目还没有有效拆书分析。任务卡会只参考创作圣经、主线状态、人物和伏笔。"}
          </div>
          <div className={latestLongFormPlan ? "quote-box compact-note" : "quote-box warning-box compact-note"}>
            <div className="row">
              <span>
                {latestLongFormPlan
                  ? `长篇规划已接入：${formatWanWords(latestLongFormPlan.targetTotalWords)} · 约 ${latestLongFormPlan.estimatedChapters} 章。`
                  : "建议先生成长篇规划 / 总纲节奏，再生成任务卡。它会按目标字数估算章节数，提前定好全书阶段、成长上限和收益频率。"}
              </span>
              <Link className="button small-button" href={`/projects/${projectId}/state#long-form-plan`}>
                {latestLongFormPlan ? "管理长篇规划" : "先做长篇规划"}
              </Link>
            </div>
          </div>
        </div>
      </Panel>

      <div className="writing-layout writing-layout-full">
        <div className="writing-main">
          <Panel title="批量连写" description="自动按顺序生成任务卡、正文和章节台账；每完成一章就更新项目状态，再继续下一章。">
            <ApiForm
              className="forms writing-form"
              endpoint={`/api/projects/${projectId}/writing`}
              body={{ action: "generate_chapter_batch", defer: true }}
              booleanFields={["reviewDraft"]}
              pendingTitle="正在提交批量连写任务"
              pendingDescription="任务会进入后台队列，页面刷新后会自动追踪执行进度。"
              successMessage="批量连写任务已提交"
            >
              <div className="writing-form-summary">
                <strong>从第 {taskCardChapterNumber} 章开始批量生成</strong>
                <span>适合先跑 3-5 章看节奏；稳定后可以增加到十几章或几十章。</span>
              </div>
              {activeWritingBatchJob && !activeWritingBatchReplaceExisting ? (
                <AiJobRunner
                  jobId={activeWritingBatchJob.id}
                  title={activeWritingBatchTitle}
                  runningMessage={
                    activeWritingBatchCurrentChapter > 0
                      ? `正在处理第 ${activeWritingBatchCurrentChapter} 章${activeWritingBatchStep ? `：${activeWritingBatchStep}` : ""}。已完成 ${activeWritingBatchCompleted}/${activeWritingBatchTotal || "?"} 章。`
                      : "批量任务正在后台执行，页面会自动刷新进度。"
                  }
                  doneMessage={activeWritingBatchDoneMessage}
                />
              ) : null}
              <div className="quote-box compact-note">
                批量不会把几十章一次性丢给 AI。系统会逐章执行：任务卡 → 正文 → 台账 → 下一章；如果某章已有正文，会先停下，避免覆盖既有内容。
              </div>
              <div className="writing-form-grid">
                <div className="field">
                  <div className="field-label">起始章节</div>
                  <input
                    key={`batch-start-${taskCardChapterNumber}`}
                    name="startChapterNumber"
                    type="number"
                    min="1"
                    defaultValue={taskCardChapterNumber}
                  />
                </div>
                <div className="field">
                  <div className="field-label">生成章数</div>
                  <input name="chapterCount" type="number" min="1" max="50" defaultValue="3" />
                  <div className="field-hint">最多一次 50 章；建议先小批量确认节奏。</div>
                </div>
                <div className="field">
                  <div className="field-label">每章目标字数</div>
                  <input name="targetWordCount" type="number" min="800" max="3000" step="100" defaultValue="1600" />
                </div>
                <label className="option-row">
                  <input name="reviewDraft" type="checkbox" />
                  <span>
                    <strong>每章生成后自动审稿</strong>
                    <small>更稳，但会明显增加耗时和 AI 调用次数。</small>
                  </span>
                </label>
              </div>
              <div className="hero-actions writing-submit-row">
                <button className="button primary" type="submit" disabled={Boolean(activeWritingBatchJob)}>
                  {activeWritingBatchJob ? "批量任务进行中" : "开始批量连写"}
                </button>
                <Link className="button" href={`/projects/${projectId}/jobs`}>
                  查看任务中心
                </Link>
              </div>
            </ApiForm>
          </Panel>

          <Panel title="批量范围重写" description="按章节范围重写已有正文；每章保存后自动重建章节台账，并让下一章读取最新台账继续写。">
            <ApiForm
              className="forms writing-form"
              endpoint={`/api/projects/${projectId}/writing`}
              body={{ action: "generate_chapter_batch", defer: true, replaceExisting: true }}
              booleanFields={["reviewDraft"]}
              pendingTitle="正在提交批量范围重写任务"
              pendingDescription="系统会从起始章回滚旧台账状态，再按顺序重写正文并重建台账。"
              successMessage="批量范围重写任务已提交"
            >
              {activeWritingBatchJob && activeWritingBatchReplaceExisting ? (
                <AiJobRunner
                  jobId={activeWritingBatchJob.id}
                  title={activeWritingBatchTitle}
                  runningMessage={
                    activeWritingBatchCurrentChapter > 0
                      ? `正在处理第 ${activeWritingBatchCurrentChapter} 章${activeWritingBatchStep ? `：${activeWritingBatchStep}` : ""}。已完成 ${activeWritingBatchCompleted}/${activeWritingBatchTotal || "?"} 章。`
                      : "批量任务正在后台执行，页面会自动刷新进度。"
                  }
                  doneMessage={activeWritingBatchDoneMessage}
                />
              ) : null}
              <div className="quote-box warning-box compact-note">
                范围重写会替换指定章节已有正文，并从起始章清理旧台账和旧审稿；任务卡会保留，重写后每章自动生成新台账。
              </div>
              <div className="writing-form-grid">
                <div className="field">
                  <div className="field-label">起始章节</div>
                  <input
                    name="startChapterNumber"
                    type="number"
                    min="1"
                    max={latestWrittenChapterNumber || undefined}
                    placeholder="如 4"
                    required
                  />
                </div>
                <div className="field">
                  <div className="field-label">结束章节</div>
                  <input
                    name="endChapterNumber"
                    type="number"
                    min="1"
                    max={latestWrittenChapterNumber || undefined}
                    placeholder="如 11"
                    required
                  />
                  <div className="field-hint">
                    已有正文最高到第 {latestWrittenChapterNumber.toLocaleString("zh-CN")} 章。
                  </div>
                </div>
                <div className="field">
                  <div className="field-label">每章目标字数</div>
                  <input name="targetWordCount" type="number" min="800" max="3000" step="100" defaultValue="1600" />
                </div>
                <label className="option-row">
                  <input name="reviewDraft" type="checkbox" />
                  <span>
                    <strong>每章重写后自动审稿</strong>
                    <small>会额外消耗时间；不勾选也会自动重建章节台账。</small>
                  </span>
                </label>
              </div>
              <div className="hero-actions writing-submit-row">
                <button className="button danger" type="submit" disabled={Boolean(activeWritingBatchJob)}>
                  {activeWritingBatchJob ? "批量任务进行中" : "按范围重写正文"}
                </button>
                <Link className="button" href={`/projects/${projectId}/jobs`}>
                  查看任务中心
                </Link>
              </div>
            </ApiForm>
          </Panel>

          <div id="task-card-form" className="scroll-anchor" />
          <Panel title="生成章节任务卡" description="所有字段都可留空，系统会优先读取当前作品设定；如果本项目有拆书分析，会把拆书结构作为参考。">
            <ApiForm
              className="forms writing-form"
              endpoint={`/api/projects/${projectId}/writing`}
              body={{ action: "generate_task_card", chapterNumber: taskCardChapterNumber }}
              arrayFields={["relatedInspirationIds"]}
              booleanFields={["useAnalysisContext"]}
              resetOnSuccess
              pendingTitle={`正在生成第 ${taskCardChapterNumber} 章任务卡`}
              pendingDescription="正在读取创作圣经、人物状态、伏笔和主线进度。"
            >
              <div className="writing-form-summary">
                <strong>当前准备生成第 {taskCardChapterNumber} 章任务卡</strong>
                <span>不确定怎么填可以直接生成；只在要强制指定本章目标、爽点或章末钩子时填写。</span>
              </div>
              <details className="writing-context-details writing-form-assist">
                <summary>生成参考、收益机制和灵感</summary>
                <div className="writing-form-assist-body">
                  <div className="quote-box compact-note">
                    任务卡会自动校验“收益机制”：本章如果有能力、境界、金钱、资源、地位、权限、情报或关系收益，必须写清收益是什么、来源是什么、触发条件是什么、是否符合关键机制、是否越级。
                  </div>
                  <div className={latestLongFormPlan ? "quote-box compact-note" : "quote-box warning-box compact-note"}>
                    {latestLongFormPlan
                      ? "已接入长篇规划：任务卡会参考总篇幅、预计章节数、当前阶段、成长上限和收益频率。"
                      : "建议先到状态页生成长篇规划；没有规划时可以继续生成任务卡，但无法按预计篇幅约束后续成长、地图、收益和伏笔回收。"}
                  </div>
                  <label className="option-row">
                    <input name="useAnalysisContext" type="checkbox" defaultChecked />
                    <span>
                      <strong>参考拆书结构，不照搬内容</strong>
                      <small>
                        {hasAnalysisContext
                          ? "默认只引用章节拆解、整书公式和爽点节奏的结构信号，生成当前新书自己的剧情任务。"
                          : "当前暂无分析结果，勾选后也只会使用已有创作状态。"}
                      </small>
                    </span>
                  </label>
                  {relatedInspirations.length ? (
                    <div className="writing-inspiration-picker">
                      <div>
                        <div className="field-label">相关灵感</div>
                        <span>勾选后会作为本章任务卡输入，只取结构和创作意图。</span>
                      </div>
                      <div>
                        {relatedInspirations.slice(0, 8).map((inspiration) => (
                          <label key={inspiration.id} className="option-row compact-option-row">
                            <input name="relatedInspirationIds" type="checkbox" value={inspiration.id} />
                            <span>
                              <strong>{inspiration.title}</strong>
                              <small>{inspiration.content || "暂无正文"}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                      <Link className="button small-button" href={`/inspirations?projectId=${projectId}`}>
                        管理项目灵感
                      </Link>
                    </div>
                  ) : (
                    <div className="quote-box compact-note">
                      这个项目还没有关联灵感。可以先去
                      <Link href={`/inspirations?projectId=${projectId}`}> 灵感中心 </Link>
                      记录素材，再回到这里喂给任务卡。
                    </div>
                  )}
                </div>
              </details>
              <div className="writing-form-grid">
                <div className="field">
                  <div className="field-label">章节标题</div>
                  <input name="title" placeholder="留空则自动生成" />
                </div>
                <div className="field">
                  <div className="field-label">本章目标</div>
                  <textarea name="chapterGoal" placeholder="例如：让主角拿到关键线索，同时不提前暴露父亲真相。" />
                </div>
                <div className="field">
                  <div className="field-label">承接上一章</div>
                  <input name="continuity" placeholder="留空则读取上一章台账或当前主线阶段" />
                </div>
                <div className="field">
                  <div className="field-label">主线推进</div>
                  <input name="mainPlotProgress" placeholder="本章必须推动哪条主线？" />
                </div>
                <div className="field">
                  <div className="field-label">要释放的爽点 / 收益机制</div>
                  <input
                    name="pleasurePoint"
                    placeholder="例如：小收益：拿到试用岗位；来源：面试通过；触发：正式入职；符合关键机制：收入提升；越级：否。"
                  />
                  <div className="field-hint">
                    可留空自动生成；如果手动填写，建议包含：收益是什么 / 来源是什么 / 触发条件 / 是否符合关键机制 / 是否越级。
                  </div>
                </div>
                <div className="field">
                  <div className="field-label">章末钩子</div>
                  <input name="endingHook" placeholder="例如：账本最后一页出现主角父亲的名字。" />
                </div>
              </div>
              <div className="hero-actions writing-submit-row">
                <button className="button primary" type="submit">
                  生成第 {taskCardChapterNumber} 章任务卡
                </button>
              </div>
            </ApiForm>
          </Panel>

          <Panel title="当前任务卡" description="确认任务卡后再生成正文；已有正文的章节会进入章节目录。">
            {displayTaskCard ? (
              <div className="list">
                <div className="list-item">
                  <div className="row">
                    <strong>
                      第 {displayTaskCard.chapterNumber} 章 · {displayTaskCard.title}
                    </strong>
                    <span className={activeDraftTaskCard ? "pill success" : "pill warning"}>
                      {activeDraftTaskCard ? "已有正文" : displayTaskCard.status}
                    </span>
                  </div>
                  <div className="muted">{displayTaskCard.chapterGoal}</div>
                </div>
                <div className="task-block">
                  <div className="task-title">承接上一章</div>
                  <div className="muted">{displayTaskCard.continuity}</div>
                </div>
                <div className="task-block">
                  <div className="task-title">主线推进</div>
                  <div className="muted">{displayTaskCard.mainPlotProgress}</div>
                </div>
                <div className="task-block">
                  <div className="task-title">爽点 / 收益机制</div>
                  <div className="muted">{displayTaskCard.pleasurePoint}</div>
                </div>
                <div className="task-block">
                  <div className="task-title">出场人物</div>
                  <div className="meta-row">
                    {displayTaskCard.requiredCharacters.length > 0 ? (
                      displayTaskCard.requiredCharacters.map((character) => (
                        <span key={character} className="chip">
                          {character}
                        </span>
                      ))
                    ) : (
                      <span className="muted">本章未指定必须出场人物</span>
                    )}
                  </div>
                </div>
                <div className="task-block">
                  <div className="task-title">伏笔任务</div>
                  <div className="meta-row">
                    {displayTaskCard.foreshadowingTasks.length > 0 ? (
                      displayTaskCard.foreshadowingTasks.map((task) => (
                        <span key={task} className="chip">
                          {task}
                        </span>
                      ))
                    ) : (
                      <span className="muted">本章未指定伏笔任务</span>
                    )}
                  </div>
                </div>
                <div className="task-block">
                  <div className="task-title">禁止违反</div>
                  <div className="meta-row">
                    {displayTaskCard.rulesNotToBreak.map((rule) => (
                      <span key={rule} className="chip">
                        {rule}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="quote-box">{displayTaskCard.endingHook}</div>
                <TaskCardEditForm
                  key={displayTaskCard.id}
                  projectId={projectId}
                  taskCard={displayTaskCard}
                  hasRelatedDraft={Boolean(activeDraftTaskCard)}
                />
                <div className="list">
                  {activeTaskCard ? (
                    <StreamDraftButton
                      projectId={projectId}
                      taskCardId={activeTaskCard.id}
                      projectName={writingState.project.name}
                      chapterNumber={activeTaskCard.chapterNumber}
                      title={activeTaskCard.title}
                    />
                  ) : activeDraft ? (
                    <a className="button primary" href="#writing-draft">
                      去正文草稿重写
                    </a>
                  ) : null}
                  <ApiButton
                    endpoint={`/api/projects/${projectId}/writing`}
                    body={{ action: "delete_task_card", taskCardId: displayTaskCard.id }}
                    label={activeDraftTaskCard ? "删除本章并重新生成" : "删除任务卡"}
                    className="button danger"
                    confirmMessage={
                      activeDraftTaskCard
                        ? "确定删除这章正文和对应任务卡吗？删除后会回到这一章重新生成任务卡和正文。"
                        : "确定删除这张任务卡吗？如果它已经生成过正文草稿、台账或审稿报告，也会一并删除。"
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>第 {taskCardChapterNumber} 章还没有任务卡</strong>
                <span>请在上方填写或留空表单，然后点击上方生成按钮。</span>
              </div>
            )}
          </Panel>

          <div id="writing-draft" className="scroll-anchor" />
          <Panel title="正文草稿" description="正文支持流式生成，生成完成后会保存为草稿。">
            {activeDraft ? (
              <div className="editor-grid">
                <div className="field">
                  <div className="field-label">标题</div>
                  <input value={activeDraft.title} readOnly />
                </div>
                <DraftRevisionEditor
                  projectId={projectId}
                  draftId={activeDraft.id}
                  initialContent={activeDraft.content}
                  reviewIssues={activeReview?.issues ?? []}
                />
                <div className="task-block">
                  <div className="task-title">保留任务卡重写正文</div>
                  <div className="muted">
                    点击后会清空下方实时正文区域并重新流式生成；保存成功后替换当前正文，任务卡保留，旧台账和旧审稿清空，请重新生成章节台账。
                  </div>
                  <StreamDraftButton
                    projectId={projectId}
                    taskCardId={activeDraft.taskCardId}
                    draftId={activeDraft.id}
                    projectName={writingState.project.name}
                    chapterNumber={activeDraft.chapterNumber}
                    title={activeDraft.title}
                    mode="regenerate"
                    initialContent={activeDraft.content}
                  />
                </div>
                <div className="hero-actions">
                  <Link className="button primary" href={`/projects/${projectId}/writing/${activeDraft.id}`}>
                    全屏阅读
                  </Link>
                  <DraftExportActions
                    content={activeDraft.content}
                    projectName={writingState.project.name}
                    chapterNumber={activeDraft.chapterNumber}
                    title={activeDraft.title}
                  />
                  <FullBookExportActions projectName={writingState.project.name} drafts={writingState.drafts} />
                  <ApiButton
                    endpoint={`/api/projects/${projectId}/writing`}
                    body={{ action: "create_ledger", draftId: activeDraft.id }}
                    label="生成章节台账"
                    pendingTitle="正在生成章节台账"
                    pendingDescription="正在提取本章事件、人物变化、伏笔和章末钩子。"
                  />
                  <ApiButton
                    endpoint={`/api/projects/${projectId}/writing`}
                    body={{ action: "review_draft", draftId: activeDraft.id }}
                    label={activeReview ? "重新审稿并合并建议" : "一致性审稿"}
                    pendingTitle={activeReview ? "正在重新审稿" : "正在一致性审稿"}
                    pendingDescription="正在检查设定、人物状态、章末钩子和 AI 味表达。"
                  />
                  <ApiButton
                    endpoint={`/api/projects/${projectId}/writing`}
                    body={{ action: "delete_task_card", taskCardId: activeDraft.taskCardId }}
                    label="删除本章并重新生成"
                    className="button danger"
                    confirmMessage="确定删除这章正文和对应任务卡吗？删除后会回到这一章重新生成任务卡和正文。"
                  />
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>第 {activeDisplayChapterNumber} 章还没有保存正文</strong>
                <span>如果上方正在流式生成，请等生成完成并保存后，这里会显示第 {activeDisplayChapterNumber} 章正文。</span>
              </div>
            )}
          </Panel>

          <div id="writing-closure" className="scroll-anchor" />
          <Panel title="章节收口" description="审稿无高风险时会自动确认本章状态；只有高风险章节需要人工处理。">
            {activeDraft ? (
              <div className="chapter-closure-stack">
                <div className={activeLedgerConfirmed ? "chapter-closure-head confirmed" : "chapter-closure-head pending"}>
                  <div>
                    <div className="mini-label">收口状态</div>
                    <strong>
                      {activeLedgerConfirmed
                        ? `${activeChapterLabel}状态已确认`
                        : activeLedger
                          ? `${activeChapterLabel}等待确认`
                          : `${activeChapterLabel}缺少章节台账`}
                    </strong>
                    <span>
                      {activeLedgerConfirmed && closureConfirmedAt
                        ? `系统已确认：${closureConfirmedAt}`
                        : activeLedger
                          ? "审稿发现高风险或尚未审稿时会保持待确认；修正后重新审稿即可自动确认。"
                          : "正文已保存，但还没有可确认的长期记忆。"}
                    </span>
                  </div>
                  <div className="hero-actions">
                    {activeLedger ? (
                      <span className={activeLedgerConfirmed ? "pill success" : "pill warning"}>
                        {activeLedgerConfirmed ? "已收口" : "待收口"}
                      </span>
                    ) : (
                      <span className="pill danger">缺台账</span>
                    )}
                    {activeReview ? (
                      <span className={highRiskIssues.length > 0 ? "pill danger" : "pill success"}>
                        审稿 {highRiskIssues.length > 0 ? `${highRiskIssues.length} 高风险` : "无高风险"}
                      </span>
                    ) : (
                      <span className="pill warning">未审稿</span>
                    )}
                  </div>
                </div>

                {activeLedger ? (
                  <>
                    <div className="closure-summary-grid">
                      <div className="task-block">
                        <div className="task-title">本章事件</div>
                        <div className="muted">
                          {activeLedgerEvents.length > 0 ? activeLedgerEvents.slice(0, 4).join("；") : "未抽取到关键事件"}
                        </div>
                      </div>
                      <div className="task-block">
                        <div className="task-title">收益 / 爽点</div>
                        <div className="muted">{activeLedger.payoff || "未抽取到明确收益"}</div>
                      </div>
                      <div className="task-block">
                        <div className="task-title">章末钩子</div>
                        <div className="muted">{activeLedger.cliffhanger || "未抽取到章末钩子"}</div>
                      </div>
                      <div className="task-block">
                        <div className="task-title">主线状态变化</div>
                        <div className="muted">
                          {activeLedgerStateChanges.length > 0
                            ? activeLedgerStateChanges.slice(0, 4).join("；")
                            : "未抽取到主线状态变化"}
                        </div>
                      </div>
                      <div className="task-block">
                        <div className="task-title">滚入下一章</div>
                        <div className="muted">
                          {activeLedgerCarryOver.length > 0
                            ? activeLedgerCarryOver.slice(0, 4).join("；")
                            : "本章没有需要滚入下一章的任务"}
                        </div>
                      </div>
                    </div>

                    <div className="closure-review-grid">
                      <div className="task-block">
                        <div className="task-title">人物记忆变更</div>
                        {closureCharacters.length > 0 ? (
                          <div className="closure-entity-list">
                            {closureCharacters.map((character) => {
                              const decision = closureDecisionByTarget.get(`character:${character.id}`);
                              const decisionLabel = closureDecisionLabel(decision);

                              return (
                                <div key={character.id} className="closure-entity-item">
                                  <div className="closure-entity-head">
                                    <div>
                                      <strong>{character.name}</strong>
                                      <span>{character.currentState || character.knownInformation || "本章后状态待补充"}</span>
                                    </div>
                                    {decisionLabel ? <span className={decisionLabel.className}>{decisionLabel.text}</span> : null}
                                  </div>
                                  <div className="closure-entity-actions">
                                    <ApiButton
                                      endpoint={`/api/projects/${projectId}/writing`}
                                      body={{
                                        action: "decide_chapter_closure_item",
                                        draftId: activeDraft.id,
                                        targetType: "character",
                                        targetId: character.id,
                                        decision: "ignored"
                                      }}
                                      label="从记忆中移除"
                                      className="button small-button closure-danger-action"
                                      confirmMessage={`确定把人物“${character.name}”从本章记忆里移除吗？移除后，后续章节不会继续读取这条人物状态。`}
                                      successMessage="已从记忆中移除"
                                    />
                                  </div>
                                  <details className="closure-inline-editor">
                                    <summary>修改状态</summary>
                                    <ApiForm
                                      className="forms closure-edit-form"
                                      endpoint={`/api/projects/${projectId}/state`}
                                      body={{ action: "update_character", characterId: character.id }}
                                      successMessage="人物状态已保存"
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
                                          <div className="field-label">当前态度</div>
                                          <input name="attitude" defaultValue={character.attitude} />
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
                                      <div className="field">
                                        <div className="field-label">当前状态</div>
                                        <textarea name="currentState" defaultValue={character.currentState} />
                                      </div>
                                      <input name="longTermGoal" type="hidden" value={character.longTermGoal} />
                                      <input name="secret" type="hidden" value={character.secret} />
                                      <input name="relationshipToProtagonist" type="hidden" value={character.relationshipToProtagonist} />
                                      <input name="abilityBoundary" type="hidden" value={character.abilityBoundary} />
                                      <input name="voice" type="hidden" value={character.voice} />
                                      <input name="lastAppearance" type="hidden" value={character.lastAppearance} />
                                      <button className="button primary" type="submit">
                                        保存人物
                                      </button>
                                    </ApiForm>
                                  </details>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="muted">本章没有明显人物状态变更，或需要到状态页手动补充。</div>
                        )}
                      </div>
                      <div className="task-block">
                        <div className="task-title">伏笔 / 线索变更</div>
                        {closureForeshadowings.length > 0 || activeLedger.newClues.length > 0 ? (
                          <div className="closure-entity-list">
                            {closureForeshadowings.map((item) => {
                              const decision = closureDecisionByTarget.get(`foreshadowing:${item.id}`);
                              const decisionLabel = closureDecisionLabel(decision);

                              return (
                                <div key={item.id} className="closure-entity-item">
                                  <div className="closure-entity-head">
                                    <div>
                                      <strong>{item.name}</strong>
                                      <span>
                                        {item.status === "closed" ? "已回收" : item.status === "partial" ? "部分回收" : "未回收"} · {item.hiddenInformation || item.revealMethod}
                                      </span>
                                    </div>
                                    {decisionLabel ? <span className={decisionLabel.className}>{decisionLabel.text}</span> : null}
                                  </div>
                                  <div className="closure-entity-actions">
                                    <ApiButton
                                      endpoint={`/api/projects/${projectId}/writing`}
                                      body={{
                                        action: "decide_chapter_closure_item",
                                        draftId: activeDraft.id,
                                        targetType: "foreshadowing",
                                        targetId: item.id,
                                        decision: "ignored"
                                      }}
                                      label="从记忆中移除"
                                      className="button small-button closure-danger-action"
                                      confirmMessage={`确定把伏笔“${item.name}”从本章记忆里移除吗？移除后，后续章节不会继续读取这条伏笔状态。`}
                                      successMessage="已从记忆中移除"
                                    />
                                  </div>
                                  <details className="closure-inline-editor">
                                    <summary>修改状态</summary>
                                    <ApiForm
                                      className="forms closure-edit-form"
                                      endpoint={`/api/projects/${projectId}/state`}
                                      body={{ action: "update_foreshadowing", foreshadowingId: item.id }}
                                      arrayFields={["relatedCharacters"]}
                                      successMessage="伏笔状态已保存"
                                    >
                                      <div className="split-panels">
                                        <div className="field">
                                          <div className="field-label">伏笔名称</div>
                                          <input name="name" defaultValue={item.name} />
                                        </div>
                                        <div className="field">
                                          <div className="field-label">状态</div>
                                          <select name="status" defaultValue={item.status}>
                                            <option value="open">未回收</option>
                                            <option value="partial">部分回收</option>
                                            <option value="closed">已回收</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div className="split-panels">
                                        <div className="field">
                                          <div className="field-label">埋设章节</div>
                                          <input name="plantedChapter" defaultValue={item.plantedChapter} />
                                        </div>
                                        <div className="field">
                                          <div className="field-label">预计回收章节</div>
                                          <input name="expectedRevealChapter" defaultValue={item.expectedRevealChapter} />
                                        </div>
                                      </div>
                                      <div className="split-panels">
                                        <div className="field">
                                          <div className="field-label">关联人物</div>
                                          <textarea name="relatedCharacters" defaultValue={item.relatedCharacters.join("\n")} />
                                        </div>
                                        <div className="field">
                                          <div className="field-label">关联地点</div>
                                          <input name="relatedLocation" defaultValue={item.relatedLocation} />
                                        </div>
                                      </div>
                                      <div className="field">
                                        <div className="field-label">回收方式</div>
                                        <textarea name="revealMethod" defaultValue={item.revealMethod} />
                                      </div>
                                      <div className="field">
                                        <div className="field-label">不能提前透露的信息</div>
                                        <textarea name="hiddenInformation" defaultValue={item.hiddenInformation} />
                                      </div>
                                      <button className="button primary" type="submit">
                                        保存伏笔
                                      </button>
                                    </ApiForm>
                                  </details>
                                </div>
                              );
                            })}
                            {closureForeshadowings.length === 0
                              ? activeLedger.newClues.slice(0, 4).map((clue) => (
                                  <div key={clue} className="closure-entity-item">
                                    <strong>新线索</strong>
                                    <span>{clue}</span>
                                  </div>
                                ))
                              : null}
                          </div>
                        ) : (
                          <div className="muted">本章没有明显伏笔或线索变更。</div>
                        )}
                      </div>
                    </div>

                    <div className={highRiskIssues.length > 0 ? "quote-box warning-box closure-risk-box" : "quote-box compact-note closure-risk-box"}>
                      <strong>收口检查</strong>
                      <span>
                        {activeReview
                          ? highRiskIssues.length > 0
                            ? `还有 ${highRiskIssues.length} 个高风险和 ${mediumRiskIssues.length} 个中等风险问题。建议先修正文稿或重审后再确认。`
                            : mediumRiskIssues.length > 0
                              ? `没有高风险，系统已自动确认；还有 ${mediumRiskIssues.length} 个中等风险建议，可按需二稿。`
                              : "审稿未发现高风险，系统会自动确认本章状态。"
                          : "当前还没有一致性审稿。可以先审稿，也可以先确认台账，之后仍能重新审稿。"}
                      </span>
                    </div>

                    {activeReview?.stateUpdateSuggestions.length ? (
                      <div className="task-block">
                        <div className="task-title">审稿建议同步到状态</div>
                        <div className="meta-row">
                          {activeReview.stateUpdateSuggestions.slice(0, 5).map((item) => (
                            <span key={item} className="chip">
                              {formatReviewText(item)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="hero-actions">
                      {activeLedgerConfirmed ? (
                        <span className="pill success">已自动确认，无需操作</span>
                      ) : (
                        <ApiButton
                          endpoint={`/api/projects/${projectId}/writing`}
                          body={{ action: "confirm_chapter_closure", draftId: activeDraft.id }}
                          label="手动确认本章状态"
                          className={highRiskIssues.length > 0 ? "button" : "button primary"}
                          confirmMessage={closureConfirmMessage}
                          successMessage="本章状态已确认"
                          pendingTitle="正在确认章节状态"
                          pendingDescription="正在标记本章台账、任务卡和长期记忆确认状态。"
                        />
                      )}
                      <Link className="button" href={`/projects/${projectId}/state`}>
                        去状态页细修
                      </Link>
                      <ApiButton
                        endpoint={`/api/projects/${projectId}/writing`}
                        body={{ action: "review_draft", draftId: activeDraft.id }}
                        label={activeReview ? "重新审稿" : "先做一致性审稿"}
                        pendingTitle={activeReview ? "正在重新审稿" : "正在一致性审稿"}
                        pendingDescription="正在检查设定、人物状态、章末钩子和 AI 味表达。"
                      />
                    </div>
                  </>
                ) : (
                  <div className="empty-state compact-empty">
                    <strong>还没有可确认的章节台账</strong>
                    <span>请先生成章节台账。台账会把本章事件、收益、线索和状态变化沉淀成后续章节的结构化记忆。</span>
                    <ApiButton
                      endpoint={`/api/projects/${projectId}/writing`}
                      body={{ action: "create_ledger", draftId: activeDraft.id }}
                      label="生成章节台账"
                      pendingTitle="正在生成章节台账"
                      pendingDescription="正在提取本章事件、人物变化、伏笔和章末钩子。"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <strong>还没有可收口的正文</strong>
                <span>生成并保存正文后，这里会集中展示本章入库状态、审稿风险和确认动作。</span>
              </div>
            )}
          </Panel>

          <div id="writing-review" className="scroll-anchor" />
          <Panel title="一致性审稿" description="台账摘要已在章节收口里确认，这里只保留正文风险。">
            <div className="list">
              {activeReview ? (
                <div className="list-item">
                  <div className="row">
                    <strong>第 {activeReview.chapterNumber} 章审稿结果</strong>
                    <span className="chip">当前正文</span>
                  </div>
                  <div className="muted">{formatReviewText(activeReview.overall)}</div>
                  {activeReview.issues.length > 0 ? (
                    <details className="writing-context-details review-details">
                      <summary>
                        查看 {activeReview.issues.length} 条审稿问题
                        {highRiskIssues.length > 0 ? ` · ${highRiskIssues.length} 个高风险` : ""}
                      </summary>
                      <div className="timeline review-details-body">
                        {activeReview.issues.map((issue, index) => {
                          const severity = formatReviewSeverity(issue.severity);

                          return (
                          <div key={`${issue.type}-${issue.location}-${index}`} className="timeline-item">
                            <div className="row">
                              <strong>{formatReviewIssueType(issue.type)}</strong>
                              <span className={severity.className}>{severity.label}</span>
                            </div>
                            {issue.problem ? <div className="muted">问题：{formatReviewText(issue.problem)}</div> : null}
                            <div className="muted">位置：{formatReviewText(issue.location) || "正文相关段落"}</div>
                            <div className="quote-box">修改建议：{formatReviewText(issue.suggestion)}</div>
                          </div>
                          );
                        })}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>第 {activeDisplayChapterNumber} 章暂无审稿报告</strong>
                  <span>
                    {activeDraft
                      ? "当前正文还没有做一致性审稿。请点击上方「一致性审稿」，审完后这里才会显示本章结果。"
                      : "生成正文草稿后，可以立即做一致性审稿，检查设定、钩子和 AI 味问题。"}
                  </span>
                  {historicalReview ? (
                    <span className="muted">
                      最近一次历史审稿属于第 {historicalReview.chapterNumber} 章，不再混入当前章节展示。
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
