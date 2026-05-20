import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton, ApiForm } from "@/components/api-form";
import { DraftExportActions } from "@/components/draft-export-actions";
import { Panel } from "@/components/panel";
import { StreamDraftButton } from "@/components/stream-draft-button";
import { getProjectAnalysis, getProjectWritingState } from "@/lib/projects";

function formatReviewIssueType(type: string) {
  const normalized = type.trim().toLowerCase();
  const issueTypeMap: Record<string, string> = {
    hook: "章末钩子不足",
    cliffhanger: "章末钩子不足",
    continuity: "承接前文不足",
    consistency: "设定一致性问题",
    character: "人物行为风险",
    "ai flavor": "AI 味偏重",
    ai_flavor: "AI 味偏重",
    pacing: "节奏问题",
    payoff: "爽点释放不足",
    foreshadowing: "伏笔处理问题",
    worldbuilding: "世界观设定问题",
    power: "战力体系风险"
  };

  return issueTypeMap[normalized] || type || "需要调整";
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

export default async function ProjectWritingPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [writingState, analysisState] = await Promise.all([
    getProjectWritingState(projectId),
    getProjectAnalysis(projectId)
  ]);

  if (!writingState) {
    notFound();
  }

  const latestTaskCard = writingState.taskCards[0];
  const latestDraft = writingState.drafts[0];
  const latestLedger = writingState.ledgers[0];
  const latestReview = writingState.reviews[0];
  const currentDraftReview = latestDraft
    ? writingState.reviews.find((review) => review.draftId === latestDraft.id) ?? null
    : null;
  const historicalReview = latestDraft
    ? writingState.reviews.find((review) => review.draftId !== latestDraft.id) ?? null
    : latestReview ?? null;
  const draftTaskCardIds = new Set(writingState.drafts.map((draft) => draft.taskCardId));
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
  const nextChapterNumber = maxChapterNumber + 1;
  const activeChapterNumber =
    latestTaskCard && !latestTaskCardDraft ? latestTaskCard.chapterNumber : nextChapterNumber;
  const activeTaskCard =
    writingState.taskCards.find(
      (card) => card.chapterNumber === activeChapterNumber && !draftTaskCardIds.has(card.id)
    ) ?? null;
  const chapterDirectoryAll = Array.from(
    new Set([
      ...writingState.taskCards.map((card) => card.chapterNumber),
      ...writingState.drafts.map((draft) => draft.chapterNumber),
      ...writingState.ledgers.map((ledger) => ledger.chapterNumber),
      ...writingState.reviews.map((review) => review.chapterNumber)
    ])
  )
    .sort((a, b) => a - b)
    .map((chapterNumber) => ({
      chapterNumber,
      taskCard: writingState.taskCards.find((card) => card.chapterNumber === chapterNumber),
      draft: writingState.drafts.find((draft) => draft.chapterNumber === chapterNumber),
      ledger: writingState.ledgers.find((ledger) => ledger.chapterNumber === chapterNumber),
      review: writingState.reviews.find((review) => review.chapterNumber === chapterNumber)
    }));
  const chapterDirectory = chapterDirectoryAll.slice(-8);
  const activeCharacters = writingState.characters.slice(0, 4);
  const openForeshadowings = writingState.foreshadowings
    .filter((item) => item.status !== "closed")
    .slice(0, 4);
  const storyAnalysis = analysisState.storyAnalysis;
  const hasAnalysisContext = analysisState.chapterAnalyses.length > 0 || Boolean(storyAnalysis);
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
    `章节 ${chapterDirectoryAll.length}`,
    hasAnalysisContext ? `拆书 ${analysisState.chapterAnalyses.length}` : "未接入拆书"
  ];

  return (
    <div className="grid">
      <Panel title="本章准备" description="只展示生成下一章任务卡前需要看的关键信息。">
        <div className="writing-prep-stack">
          <div className="writing-action-strip">
            <div>
              <div className="mini-label">当前步骤</div>
              <strong>{activeTaskCard ? `第 ${activeChapterNumber} 章任务卡已生成` : `准备生成第 ${activeChapterNumber} 章任务卡`}</strong>
            </div>
            <div className="hero-actions">
              <a className="button primary" href="#task-card-form">
                {activeTaskCard ? "查看任务卡" : `生成第 ${activeChapterNumber} 章任务卡`}
              </a>
              <Link className="button" href={`/projects/${projectId}/state`}>
                完善设定
              </Link>
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
        </div>
      </Panel>

      <div className="writing-layout">
        <div className="writing-main">
          <Panel title="生成章节任务卡" description="所有字段都可留空，系统会优先读取当前作品设定；如果本项目有拆书分析，会把拆书结构作为参考。">
            <div id="task-card-form" />
            <ApiForm
              className="forms writing-form"
              endpoint={`/api/projects/${projectId}/writing`}
              body={{ action: "generate_task_card", chapterNumber: activeChapterNumber }}
              booleanFields={["useAnalysisContext"]}
              resetOnSuccess
            >
              <div className="quote-box">
                当前准备生成第 {activeChapterNumber} 章任务卡。不确定怎么填时可以直接点生成；只在你想强制指定本章目标、爽点或章末钩子时再填写对应项。
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
                  <div className="field-label">要释放的爽点</div>
                  <input name="pleasurePoint" placeholder="例如：主角用信息差反压对手。" />
                </div>
                <div className="field">
                  <div className="field-label">章末钩子</div>
                  <input name="endingHook" placeholder="例如：账本最后一页出现主角父亲的名字。" />
                </div>
              </div>
              <div className="hero-actions writing-submit-row">
                <button className="button primary" type="submit">
                  生成第 {activeChapterNumber} 章任务卡
                </button>
              </div>
            </ApiForm>
          </Panel>

          <Panel title="当前任务卡" description="确认任务卡后再生成正文；已有正文的章节会进入章节目录。">
            {activeTaskCard ? (
              <div className="list">
                <div className="list-item">
                  <div className="row">
                    <strong>
                      第 {activeTaskCard.chapterNumber} 章 · {activeTaskCard.title}
                    </strong>
                    <span className="pill warning">{activeTaskCard.status}</span>
                  </div>
                  <div className="muted">{activeTaskCard.chapterGoal}</div>
                </div>
                <div className="task-block">
                  <div className="task-title">承接上一章</div>
                  <div className="muted">{activeTaskCard.continuity}</div>
                </div>
                <div className="task-block">
                  <div className="task-title">主线推进</div>
                  <div className="muted">{activeTaskCard.mainPlotProgress}</div>
                </div>
                <div className="task-block">
                  <div className="task-title">禁止违反</div>
                  <div className="meta-row">
                    {activeTaskCard.rulesNotToBreak.map((rule) => (
                      <span key={rule} className="chip">
                        {rule}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="quote-box">{activeTaskCard.endingHook}</div>
                <div className="list">
                  <StreamDraftButton
                    projectId={projectId}
                    taskCardId={activeTaskCard.id}
                    projectName={writingState.project.name}
                    chapterNumber={activeTaskCard.chapterNumber}
                    title={activeTaskCard.title}
                  />
                  <ApiButton
                    endpoint={`/api/projects/${projectId}/writing`}
                    body={{ action: "delete_task_card", taskCardId: activeTaskCard.id }}
                    label="删除任务卡"
                    className="button danger"
                    confirmMessage="确定删除这张任务卡吗？如果它已经生成过正文草稿、台账或审稿报告，也会一并删除。"
                  />
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>第 {activeChapterNumber} 章还没有任务卡</strong>
                <span>
                  {maxChapterNumber > 0
                    ? "上一章已经生成正文后，就从这里继续生成下一章任务卡。生成后再写正文。"
                    : "先在上面生成第一章任务卡。"}
                </span>
                <a className="button primary" href="#task-card-form">
                  生成第 {activeChapterNumber} 章任务卡
                </a>
              </div>
            )}
          </Panel>

          <Panel title="正文草稿" description="正文支持流式生成，生成完成后会保存为草稿。">
            {latestDraft ? (
              <div className="editor-grid">
                <div className="field">
                  <div className="field-label">标题</div>
                  <input value={latestDraft.title} readOnly />
                </div>
                <div className="field">
                  <div className="field-label">
                    正文（{latestDraft.content.replace(/\s/g, "").length.toLocaleString("zh-CN")} 字）
                  </div>
                  <textarea className="saved-draft-textarea" value={latestDraft.content} readOnly />
                </div>
                <div className="hero-actions">
                  <Link className="button primary" href={`/projects/${projectId}/writing/${latestDraft.id}`}>
                    全屏阅读
                  </Link>
                  <DraftExportActions
                    content={latestDraft.content}
                    projectName={writingState.project.name}
                    chapterNumber={latestDraft.chapterNumber}
                    title={latestDraft.title}
                  />
                  <ApiButton
                    endpoint={`/api/projects/${projectId}/writing`}
                    body={{ action: "create_ledger", draftId: latestDraft.id }}
                    label="生成章节台账"
                  />
                  <ApiButton
                    endpoint={`/api/projects/${projectId}/writing`}
                    body={{ action: "review_draft", draftId: latestDraft.id }}
                    label="一致性审稿"
                  />
                  <ApiButton
                    endpoint={`/api/projects/${projectId}/writing`}
                    body={{ action: "delete_task_card", taskCardId: latestDraft.taskCardId }}
                    label="删除本章并重新生成"
                    className="button danger"
                    confirmMessage="确定删除这章正文和对应任务卡吗？删除后会回到这一章重新生成任务卡和正文。"
                  />
                </div>
              </div>
            ) : (
              <div className="section-card">任务卡确认后，可以在这里生成正文草稿。</div>
            )}
          </Panel>

          <Panel title="台账与审稿" description="每章写完后沉淀成长期记忆。">
            <div className="list">
              {latestLedger ? (
                <div className="list-item">
                  <strong>
                    第 {latestLedger.chapterNumber} 章台账 · {latestLedger.title}
                  </strong>
                  <div className="muted">事件：{latestLedger.events.join("；")}</div>
                  <div className="muted">收益：{latestLedger.payoff}</div>
                  <div className="quote-box">{latestLedger.cliffhanger}</div>
                </div>
              ) : (
                <div className="empty-state">
                  <strong>还没有生成章节台账</strong>
                  <span>台账会记录本章事件、人物变化、伏笔和章末钩子，后续生成新章节时会作为长期记忆使用。</span>
                  {latestDraft ? (
                    <ApiButton
                      endpoint={`/api/projects/${projectId}/writing`}
                      body={{ action: "create_ledger", draftId: latestDraft.id }}
                      label="生成章节台账"
                    />
                  ) : null}
                </div>
              )}

              {currentDraftReview ? (
                <div className="list-item">
                  <div className="row">
                    <strong>第 {currentDraftReview.chapterNumber} 章审稿结果</strong>
                    <span className="chip">当前正文</span>
                  </div>
                  <div className="muted">{currentDraftReview.overall}</div>
                  {currentDraftReview.issues.length > 0 ? (
                    <div className="timeline">
                      {currentDraftReview.issues.map((issue, index) => {
                        const severity = formatReviewSeverity(issue.severity);

                        return (
                        <div key={`${issue.type}-${issue.location}-${index}`} className="timeline-item">
                          <div className="row">
                            <strong>{formatReviewIssueType(issue.type)}</strong>
                            <span className={severity.className}>{severity.label}</span>
                          </div>
                          {issue.problem ? <div className="muted">问题：{issue.problem}</div> : null}
                          <div className="muted">位置：{issue.location || "正文相关段落"}</div>
                          <div className="quote-box">修改建议：{issue.suggestion}</div>
                        </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>{latestDraft ? `第 ${latestDraft.chapterNumber} 章暂无审稿报告` : "暂无审稿报告"}</strong>
                  <span>
                    {latestDraft
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

        <aside className="writing-side">
          <Panel title="章节目录" description="只看最近几章，完整列表可进入章节总目录。">
            {chapterDirectory.length > 0 ? (
              <div className="list chapter-mini-list">
                {chapterDirectory.map((chapter) => (
                  <div key={chapter.chapterNumber} className="task-block writing-chapter-card">
                    <div className="chapter-card-head">
                      <div className="chapter-card-title">
                        <strong>第 {chapter.chapterNumber} 章</strong>
                        <span>{chapter.draft?.title || chapter.taskCard?.title || "尚未生成任务卡"}</span>
                      </div>
                      <span className={chapter.draft ? "pill success" : "pill warning"}>
                        {chapter.draft ? "已有正文" : "待写正文"}
                      </span>
                    </div>
                    <div className="meta-row">
                      {chapter.taskCard ? <span className="chip">任务卡</span> : null}
                      {chapter.draft ? <span className="chip">草稿</span> : null}
                      {chapter.ledger ? <span className="chip">台账</span> : null}
                      {chapter.review ? <span className="chip">审稿</span> : null}
                    </div>
                    <div className="chapter-card-actions">
                      {chapter.draft ? (
                        <Link className="button small-button" href={`/projects/${projectId}/writing/${chapter.draft.id}`}>
                          阅读正文
                        </Link>
                      ) : null}
                      {chapter.draft ? (
                        <DraftExportActions
                          content={chapter.draft.content}
                          projectName={writingState.project.name}
                          chapterNumber={chapter.draft.chapterNumber}
                          title={chapter.draft.title}
                          compact
                        />
                      ) : null}
                      <ApiButton
                        endpoint={`/api/projects/${projectId}/writing`}
                        body={{ action: "delete_chapters_from", chapterNumber: chapter.chapterNumber }}
                        label="从本章起重写"
                        className="button danger small-button"
                        confirmMessage={`确定从第 ${chapter.chapterNumber} 章开始重写吗？会删除第 ${chapter.chapterNumber} 章及后续所有任务卡、正文、台账和审稿。`}
                      />
                    </div>
                  </div>
                ))}
                <a className="button primary" href="#task-card-form">
                  继续生成第 {activeChapterNumber} 章
                </a>
                {chapterDirectoryAll.length > chapterDirectory.length ? (
                  <Link className="button" href={`/projects/${projectId}/writing/chapters`}>
                    查看完整章节目录
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="empty-state">
                <strong>暂无章节</strong>
                <span>生成第一章任务卡和正文后，这里会出现章节目录。</span>
              </div>
            )}
          </Panel>

          <Panel title="状态索引" description="生成正文时会读取这些结构化记忆，而不是把全文塞给 AI。">
            <div className="list">
              <div className="task-block">
                <div className="task-title">当前主线</div>
                <div className="muted">{writingState.plotState.mainGoal || "先到状态管理页补充主线目标。"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">地图与敌人</div>
                <div className="muted">
                  {writingState.plotState.currentMap || "未记录地图"} · {writingState.plotState.currentEnemy || "未记录压力源"}
                </div>
              </div>
              <div className="task-block">
                <div className="task-title">战力 / 资源</div>
                <div className="muted">{writingState.plotState.powerSystemState || writingState.bible.powerSystem}</div>
                <div className="muted">{writingState.plotState.resourceState || "暂无资源状态"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">核心爽点</div>
                <div className="muted">{writingState.bible.corePleasure || "先到状态管理页补充核心爽点。"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">相关人物</div>
                <div className="meta-row">
                  {activeCharacters.length > 0 ? (
                    activeCharacters.map((character) => (
                      <span key={character.id} className="chip">
                        {character.name}
                      </span>
                    ))
                  ) : (
                    <span className="chip">暂无人物卡</span>
                  )}
                </div>
              </div>
              <div className="task-block">
                <div className="task-title">未回收伏笔</div>
                <div className="meta-row">
                  {openForeshadowings.length > 0 ? (
                    openForeshadowings.map((item) => (
                      <span key={item.id} className="chip">
                        {item.name}
                      </span>
                    ))
                  ) : (
                    <span className="chip">暂无未回收伏笔</span>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
