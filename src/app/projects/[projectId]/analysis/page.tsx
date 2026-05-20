import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisJobRunner } from "@/components/analysis-job-runner";
import { ApiButton } from "@/components/api-form";
import { AnalysisRangeForm } from "@/components/analysis-range-form";
import { Panel } from "@/components/panel";
import { getBillingMode } from "@/lib/billing-mode";
import { calculateAiJobProgress, getProject, getProjectAnalysis } from "@/lib/projects";

export default async function ProjectAnalysisPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const billingMode = getBillingMode();
  const [project, analysis] = await Promise.all([
    getProject(projectId),
    getProjectAnalysis(projectId)
  ]);

  if (!project) {
    notFound();
  }
  const chaptersCount = analysis.chapters.length;
  const analyzedCount = analysis.chapterAnalyses.length;
  const latestAnalysisJob = analysis.latestAnalysisJob;
  const latestJobOutput =
    latestAnalysisJob?.output && typeof latestAnalysisJob.output === "object"
      ? (latestAnalysisJob.output as {
          usedAi?: boolean;
          usedFallback?: boolean;
          error?: string;
          phase?: string;
          chapterAnalysisCount?: number;
          totalChapters?: number;
        })
      : null;
  const latestJobInput =
    latestAnalysisJob?.input && typeof latestAnalysisJob.input === "object"
      ? (latestAnalysisJob.input as { chapterCount?: number; fromChapter?: number; toChapter?: number })
      : null;
  const fallbackOnly =
    latestAnalysisJob?.status === "succeeded" &&
    latestJobOutput?.usedFallback === true &&
    latestJobOutput?.usedAi !== true;
  const analysisFailed = latestAnalysisJob?.status === "failed";
  const analysisRunning =
    latestAnalysisJob?.status === "pending" || latestAnalysisJob?.status === "running";
  const analysisProgress = latestAnalysisJob ? calculateAiJobProgress(latestAnalysisJob) : 0;
  const totalJobChapters =
    Number(latestJobOutput?.totalChapters ?? latestJobInput?.chapterCount ?? 0) || 0;
  const analyzedJobChapters = Number(latestJobOutput?.chapterAnalysisCount ?? 0) || 0;
  const currentJobChapter =
    totalJobChapters > 0 ? Math.min(totalJobChapters, analyzedJobChapters + 1) : 0;
  const runningPhase =
    latestJobOutput?.phase === "story"
      ? "正在汇总整书分析"
      : latestAnalysisJob?.status === "pending"
        ? "等待任务开始"
        : totalJobChapters > 0
          ? `已完成 ${analyzedJobChapters} / ${totalJobChapters} 章，正在处理第 ${currentJobChapter} 章`
          : "正在拆解章节";
  const storyAnalysis = fallbackOnly ? null : analysis.storyAnalysis;
  const hasStoryAnalysis = Boolean(storyAnalysis);

  return (
    <div className="grid">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className={`pill ${hasStoryAnalysis ? "success" : "warning"}`}>
              {hasStoryAnalysis ? "AI 精拆已生成" : analysisRunning ? "分析中" : "等待有效分析"}
            </div>
            <h1>整书分析</h1>
            <p>从章节拆解里提炼开局、主循环、爽点节奏、可迁移结构和不可照搬内容。</p>
          </div>
          <div className="hero-actions">
            {analyzedCount > 0 ? (
              <Link className="button" href={`/projects/${projectId}/analysis/graph`}>
                查看拆书图谱
              </Link>
            ) : null}
            {storyAnalysis ? (
              <ApiButton
                endpoint={`/api/projects/${projectId}/template`}
                label="保存为模板"
                redirectPrefix="/templates/"
                redirectDataPath="template.id"
              />
            ) : null}
          </div>
        </div>

        <div className="grid stats">
          <div className="stat-card">
            <strong>{chaptersCount}</strong>
            <span>章节</span>
          </div>
          <div className="stat-card">
            <strong>{analyzedCount}</strong>
            <span>章节拆解</span>
          </div>
          <div className="stat-card">
            <strong>{storyAnalysis?.topPleasureTypes.length ?? 0}</strong>
            <span>高频爽点</span>
          </div>
          <div className="stat-card">
            <strong>{hasStoryAnalysis ? "可保存" : "未生成"}</strong>
            <span>模板状态</span>
          </div>
        </div>
      </section>

      <div className="analysis-layout">
        <div className="analysis-main">
          {fallbackOnly || analysisFailed || analysisRunning ? (
            <div className={`empty-state analysis-alert ${analysisFailed ? "danger" : "warning"}`}>
              <strong>
                {fallbackOnly
                  ? "上次结果是本地兜底，不作为有效拆书结论展示"
                  : analysisFailed
                    ? "上次 AI 分析失败"
                    : "AI 分析正在执行"}
              </strong>
              <span>
                {fallbackOnly
                  ? "系统之前在 AI 失败后保存了规则兜底结果，所以看起来全是套话。现在已改为：AI 精拆失败就不保存兜底结果。"
                  : analysisFailed
                    ? latestAnalysisJob?.error ?? "请减少章节范围后重试。"
                    : "请等待任务完成，完成后这里会刷新为有效分析结论。"}
              </span>
              {analysisRunning ? (
                <div className="analysis-progress-card">
                  <div className="row">
                    <strong>{runningPhase}</strong>
                    <span className="chip">进度 {analysisProgress}%</span>
                  </div>
                  <div className="usage-bar" aria-label={`分析进度 ${analysisProgress}%`}>
                    <span style={{ width: `${analysisProgress}%` }} />
                  </div>
                  <div className="meta-row">
                    {totalJobChapters > 0 ? (
                      <span className="chip">
                        已拆解 {analyzedJobChapters} / {totalJobChapters} 章
                      </span>
                    ) : null}
                    {latestJobInput?.fromChapter && latestJobInput?.toChapter ? (
                      <span className="chip">
                        范围：第 {latestJobInput.fromChapter}-{latestJobInput.toChapter} 章
                      </span>
                    ) : null}
                    <span className="chip">
                      状态：{latestAnalysisJob?.status === "pending" ? "待处理" : "处理中"}
                    </span>
                  </div>
                  {latestAnalysisJob?.id ? (
                    <AnalysisJobRunner
                      jobId={latestAnalysisJob.id}
                      initialDone={analyzedJobChapters}
                      initialTotal={totalJobChapters}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <Panel
            title="整书分析"
            description="节奏、爽点、主循环和模板公式都会沉淀在这里。"
          >
            <div className="list">
              {storyAnalysis ? (
                <>
                  <div className="list-item">
                    <strong>题材类型</strong>
                    <div className="muted">{storyAnalysis.genre ?? "待识别"}</div>
                  </div>
                  <div className="list-item">
                    <strong>主角模型</strong>
                    <div className="muted">{storyAnalysis.protagonistModel ?? "待识别"}</div>
                  </div>
                  <div className="list-item">
                    <strong>开局钩子</strong>
                    <div className="muted">{storyAnalysis.openingHook}</div>
                  </div>
                  <div className="list-item">
                    <strong>开局模型</strong>
                    <div className="muted">{storyAnalysis.openingModel ?? "待识别"}</div>
                  </div>
                  <div className="list-item">
                    <strong>金手指机制</strong>
                    <div className="muted">{storyAnalysis.goldenFingerMechanism ?? "待识别"}</div>
                  </div>
                  <div className="list-item">
                    <strong>主循环</strong>
                    <div className="muted">{storyAnalysis.mainLoop}</div>
                  </div>
                  <div className="list-item">
                    <strong>反派功能</strong>
                    <div className="muted">{storyAnalysis.villainFunction ?? "待识别"}</div>
                  </div>
                  <div className="list-item">
                    <strong>配角功能</strong>
                    <div className="muted">{storyAnalysis.supportingRoles ?? "待识别"}</div>
                  </div>
                  <div className="list-item">
                    <strong>地图推进</strong>
                    <div className="muted">{storyAnalysis.mapProgression ?? "待识别"}</div>
                  </div>
                  <div className="list-item">
                    <strong>节奏判断</strong>
                    <div className="muted">{storyAnalysis.pacing}</div>
                  </div>
                  <div className="list-item">
                    <strong>高频爽点</strong>
                    <div className="meta-row">
                      {storyAnalysis.topPleasureTypes.length > 0 ? (
                        storyAnalysis.topPleasureTypes.map((item) => (
                          <span key={item} className="chip">
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="chip">暂无分析结果</span>
                      )}
                    </div>
                  </div>
                  <div className="list-item">
                    <strong>可迁移结构</strong>
                    <div className="meta-row">
                      {(storyAnalysis.usablePatterns ?? []).map((item) => (
                        <span key={item} className="chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="list-item">
                    <strong>不建议照搬</strong>
                    <div className="meta-row">
                      {(storyAnalysis.avoidCopying ?? []).map((item) => (
                        <span key={item} className="chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact-empty">
                  <strong>还没有分析结果</strong>
                  <span>
                    {chaptersCount === 0
                      ? "先导入文本并完成分章。"
                      : "右侧选择范围后开始分析。"}
                  </span>
                  <Link href={chaptersCount === 0 ? `/projects/${projectId}/import` : `/projects/${projectId}/chapters`} className="button">
                    {chaptersCount === 0 ? "去导入文本" : "检查章节"}
                  </Link>
                </div>
              )}
            </div>
          </Panel>

          <Panel title={`当前项目：${project.name}`} description="用于保存分析结论。">
            <div className="formula-box">
              <div>
                <div className="mini-label">公式</div>
                <div className="quote-box">{storyAnalysis?.formula ?? "等待有效分析"}</div>
              </div>
              <div>
                <div className="mini-label">迁移建议</div>
                <div className="muted">
                  {storyAnalysis?.migrationAdvice ??
                    "这里用于沉淀可迁移的结构公式，避免直接复制原作内容。"}
                </div>
              </div>
              <Link href={`/projects/${projectId}/chapters`} className="button">
                查看章节拆解
              </Link>
            </div>
          </Panel>
        </div>

        <aside className="analysis-side">
          <Panel title="分析范围" description="不用删除章节，可以只分析前 30 章、单章或指定区间。">
            <AnalysisRangeForm
              projectId={projectId}
              chaptersCount={chaptersCount}
              hasStoryAnalysis={hasStoryAnalysis}
              analysisRunning={analysisRunning}
              showCreditEstimate={billingMode === "credits"}
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
