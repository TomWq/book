import { notFound } from "next/navigation";
import { ApiButton } from "@/components/api-form";
import { Panel } from "@/components/panel";
import { calculateAiJobProgress, formatAiJobType, getProject, getProjectAiJobs } from "@/lib/projects";

const PAGE_SIZE = 20;

type JobTokenUsage = {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  promptCacheHitTokens?: number;
  promptCacheMissTokens?: number;
  reasoningTokens?: number;
};

type JobOutputView = {
  usedAi?: boolean;
  usedFallback?: boolean;
  tokenUsage?: JobTokenUsage;
  chapterAnalysisCount?: number;
  totalChapters?: number;
  chapterNumber?: number;
  taskCardId?: string;
  draftId?: string;
  reviewReportId?: string;
  editReportId?: string;
  outlineId?: string;
  issues?: number;
  aiFlavorSentences?: number;
};

type ProjectJobView = {
  type: string;
  status: string;
  input?: unknown;
  output?: unknown;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatNumber(value: unknown) {
  return Math.round(numberValue(value)).toLocaleString("zh-CN");
}

function numberParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function readJobOutput(job: { output?: unknown }) {
  return job.output && typeof job.output === "object" ? (job.output as JobOutputView) : undefined;
}

function readJobInput(job: { input?: unknown }) {
  return job.input && typeof job.input === "object" ? (job.input as Record<string, unknown>) : undefined;
}

function getJobUnitCount(job: ProjectJobView, output?: JobOutputView) {
  const input = readJobInput(job);

  switch (job.type) {
    case "analyze_chapters":
      return Math.max(
        1,
        numberValue(output?.chapterAnalysisCount) ||
          numberValue(output?.totalChapters) ||
          numberValue(input?.chapterCount)
      );
    case "generate_task_card":
    case "generate_chapter":
    case "review_chapter":
    case "edit_second_draft":
    case "generate_outline":
      return 1;
    default:
      return 1;
  }
}

function getUnitLabel(type: string) {
  switch (type) {
    case "analyze_chapters":
      return "章";
    case "generate_chapter":
      return "章正文";
    case "generate_task_card":
      return "任务卡";
    case "review_chapter":
      return "审稿";
    case "edit_second_draft":
      return "二稿";
    case "generate_outline":
      return "大纲";
    default:
      return "次";
  }
}

function buildUsageStats(jobs: ProjectJobView[]) {
  const rows = jobs.map((job) => {
    const output = readJobOutput(job);
    const tokenUsage = output?.tokenUsage;
    const unitCount = getJobUnitCount(job, output);

    return {
      type: job.type,
      status: job.status,
      usedAi: output?.usedAi === true,
      usedFallback: output?.usedFallback === true,
      unitCount,
      totalTokens: numberValue(tokenUsage?.totalTokens),
      promptTokens: numberValue(tokenUsage?.promptTokens),
      completionTokens: numberValue(tokenUsage?.completionTokens),
      cacheHitTokens: numberValue(tokenUsage?.promptCacheHitTokens),
      cacheMissTokens: numberValue(tokenUsage?.promptCacheMissTokens),
      reasoningTokens: numberValue(tokenUsage?.reasoningTokens)
    };
  });
  const total = rows.reduce(
    (sum, row) => ({
      jobs: sum.jobs + 1,
      aiJobs: sum.aiJobs + (row.usedAi ? 1 : 0),
      fallbackJobs: sum.fallbackJobs + (row.usedFallback ? 1 : 0),
      units: sum.units + row.unitCount,
      totalTokens: sum.totalTokens + row.totalTokens,
      promptTokens: sum.promptTokens + row.promptTokens,
      completionTokens: sum.completionTokens + row.completionTokens,
      cacheHitTokens: sum.cacheHitTokens + row.cacheHitTokens,
      cacheMissTokens: sum.cacheMissTokens + row.cacheMissTokens,
      reasoningTokens: sum.reasoningTokens + row.reasoningTokens
    }),
    {
      jobs: 0,
      aiJobs: 0,
      fallbackJobs: 0,
      units: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      reasoningTokens: 0
    }
  );
  const byType = Array.from(
    rows.reduce((map, row) => {
      const current = map.get(row.type) ?? {
        type: row.type,
        jobs: 0,
        units: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        fallbackJobs: 0
      };
      current.jobs += 1;
      current.units += row.unitCount;
      current.totalTokens += row.totalTokens;
      current.promptTokens += row.promptTokens;
      current.completionTokens += row.completionTokens;
      current.reasoningTokens += row.reasoningTokens;
      current.fallbackJobs += row.usedFallback ? 1 : 0;
      map.set(row.type, current);
      return map;
    }, new Map<string, { type: string; jobs: number; units: number; totalTokens: number; promptTokens: number; completionTokens: number; reasoningTokens: number; fallbackJobs: number }>())
      .values()
  ).sort((a, b) => b.totalTokens - a.totalTokens);

  return { rows, total, byType };
}

function formatJobStatus(status: string) {
  switch (status) {
    case "succeeded":
      return "完成";
    case "running":
      return "处理中";
    case "failed":
      return "失败";
    case "canceled":
      return "已取消";
    default:
      return "待处理";
  }
}

function summarizeJobInput(job: {
  type: string;
  input?: unknown;
}) {
  const input = job.input as Record<string, unknown> | undefined;

  if (!input || typeof input !== "object") {
    return "无输入摘要";
  }

  switch (job.type) {
    case "analyze_chapters":
      return input.fromChapter && input.toChapter
        ? `章节：第 ${String(input.fromChapter)}-${String(input.toChapter)} 章，共 ${String(input.chapterCount ?? "未知")} 章`
        : `章节数：${String(input.chapterCount ?? "未知")}`;
    case "generate_task_card":
      return `章节：第 ${String(input.chapterNumber ?? "未知")} 章`;
    case "generate_chapter":
      return `任务卡：${String(input.taskCardId ?? "未知")}`;
    case "review_chapter":
      return `草稿：${String(input.draftId ?? "未知")}`;
    case "edit_second_draft":
      return `模式：${String(input.mode ?? "未知")}`;
    case "generate_outline":
      return `模板：${String(input.templateId ?? "未知")}`;
    default:
      return "已记录输入参数";
  }
}

function summarizeJobOutput(job: {
  type: string;
  output?: unknown;
}) {
  const output = readJobOutput(job);

  if (!output || typeof output !== "object") {
    return "无输出摘要";
  }

  switch (job.type) {
    case "analyze_chapters":
      return `章节分析 ${String(output.chapterAnalysisCount ?? "未知")} 项，故事分析已更新`;
    case "generate_task_card":
      return `任务卡 ${String(output.taskCardId ?? "未知")}，章节 ${String(output.chapterNumber ?? "未知")}`;
    case "generate_chapter":
      return `草稿 ${String(output.draftId ?? "未知")}，章节 ${String(output.chapterNumber ?? "未知")}`;
    case "review_chapter":
      return `审稿报告 ${String(output.reviewReportId ?? "未知")}，问题 ${String(output.issues ?? "0")} 项`;
    case "edit_second_draft":
      return `二稿报告 ${String(output.editReportId ?? "未知")}，AI 味句子 ${String(output.aiFlavorSentences ?? "0")} 句`;
    case "generate_outline":
      return `大纲 ${String(output.outlineId ?? "未知")}`;
    default:
      return "任务结果已保存";
  }
}

export default async function ProjectJobsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const [project, jobs] = await Promise.all([getProject(projectId), getProjectAiJobs(projectId)]);

  if (!project) {
    notFound();
  }
  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const currentPage = Math.min(totalPages, numberParam(query.page));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageJobs = jobs.slice(pageStart, pageStart + PAGE_SIZE);
  const pendingCount = jobs.filter((job) => job.status === "pending").length;
  const runningCount = jobs.filter((job) => job.status === "running").length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const usageStats = buildUsageStats(jobs);

  return (
    <div className="grid two-col">
      <Panel
        title="任务队列"
        description="这里记录这个项目里所有 AI 任务的执行状态。"
        action={
          <ApiButton endpoint="/api/jobs/run" body={{ limit: 10 }} label="执行待处理任务" />
        }
      >
        <div className="usage-summary">
          <div className="stat-card">
            <strong>{formatNumber(usageStats.total.totalTokens)}</strong>
            <span>总算力</span>
          </div>
          <div className="stat-card">
            <strong>自带 Key</strong>
            <span>AI 模式</span>
          </div>
          <div className="stat-card">
            <strong>
              {usageStats.total.units > 0
                ? formatNumber(usageStats.total.totalTokens / usageStats.total.units)
                : "0"}
            </strong>
            <span>平均每单位算力</span>
          </div>
          <div className="stat-card">
            <strong>{formatNumber(usageStats.total.fallbackJobs)}</strong>
            <span>兜底任务</span>
          </div>
        </div>
        {usageStats.byType.length > 0 ? (
          <div className="usage-table">
            <div className="usage-table-row usage-table-head">
              <span>任务类型</span>
              <span>任务数</span>
              <span>单位</span>
              <span>算力</span>
              <span>均值</span>
            </div>
            {usageStats.byType.map((item) => (
              <div key={item.type} className="usage-table-row">
                <strong>{formatAiJobType(item.type)}</strong>
                <span>{formatNumber(item.jobs)}</span>
                <span>{formatNumber(item.units)} {getUnitLabel(item.type)}</span>
                <span>{formatNumber(item.totalTokens)}</span>
                <span>
                  {item.units > 0 ? formatNumber(item.totalTokens / item.units) : "0"} / {getUnitLabel(item.type)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="meta-row" style={{ marginBottom: 14 }}>
          <span className="chip">待处理 {pendingCount}</span>
          <span className="chip">处理中 {runningCount}</span>
          <span className="chip">失败 {failedCount}</span>
          <span className="chip">
            第 {currentPage} / {totalPages} 页
          </span>
        </div>
        <div className="list">
          {jobs.length === 0 ? (
            <div className="empty-state">
              <strong>还没有 AI 任务</strong>
              <span>生成任务卡、正文、审稿或二稿后，这里会记录每次执行结果。</span>
              <a href={`/projects/${projectId}/writing`} className="button">
                去创作工作台
              </a>
            </div>
          ) : (
            pageJobs.map((job) => {
              const output = readJobOutput(job);
              const canRetry = job.status === "failed" || output?.usedFallback === true;
              const progressPercent = calculateAiJobProgress(job);
              const unitCount = getJobUnitCount(job, output);
              const tokenUsage = output?.tokenUsage;
              const avgTokens = unitCount > 0 ? numberValue(tokenUsage?.totalTokens) / unitCount : 0;

              return (
                <div key={job.id} className="list-item">
                  <div className="row">
                    <strong>{formatAiJobType(job.type)}</strong>
                    <span className={`pill ${job.status === "failed" ? "danger" : job.status === "succeeded" ? "success" : "warning"}`}>
                      {formatJobStatus(job.status)}
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="chip">尝试 {job.attempts}</span>
                    <span className="chip">{new Date(job.createdAt).toLocaleString("zh-CN")}</span>
                    <span className="chip">{output?.usedAi ? "AI 结果" : output?.usedFallback ? "本地兜底" : "任务记录"}</span>
                    <span className="chip">进度 {progressPercent}%</span>
                    {output?.tokenUsage ? (
                      <span className="chip">
                        算力 {Number(output.tokenUsage.totalTokens ?? 0).toLocaleString("zh-CN")}
                      </span>
                    ) : null}
                    {output?.tokenUsage ? (
                      <span className="chip">
                        均值 {formatNumber(avgTokens)} / {getUnitLabel(job.type)}
                      </span>
                    ) : null}
                  </div>
                  {tokenUsage ? (
                    <div className="token-grid">
                      <span>输入消耗 {formatNumber(tokenUsage.promptTokens)}</span>
                      <span>输出消耗 {formatNumber(tokenUsage.completionTokens)}</span>
                      <span>缓存命中 {formatNumber(tokenUsage.promptCacheHitTokens)}</span>
                      <span>缓存未命中 {formatNumber(tokenUsage.promptCacheMissTokens)}</span>
                      <span>思考消耗 {formatNumber(tokenUsage.reasoningTokens)}</span>
                    </div>
                  ) : null}
                  <div className="usage-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${progressPercent}%`,
                        background:
                          job.status === "failed"
                            ? "var(--danger)"
                            : job.status === "succeeded"
                              ? "var(--success)"
                              : "var(--accent)"
                      }}
                    />
                  </div>
                  <div className="muted">{summarizeJobInput(job)}</div>
                  <div className="muted">{summarizeJobOutput(job)}</div>
                  <div className="muted">{job.error || "任务执行信息已记录。"}</div>
                  {canRetry ? (
                    <div style={{ marginTop: 10 }}>
                      <ApiButton endpoint={`/api/jobs/${job.id}`} label="重新执行" />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          {jobs.length > PAGE_SIZE ? (
            <div className="hero-actions">
              {currentPage > 1 ? (
                <a className="button" href={`/projects/${projectId}/jobs?page=${currentPage - 1}`}>
                  上一页
                </a>
              ) : null}
              <span className="chip">
                共 {jobs.length.toLocaleString("zh-CN")} 条，每页 {PAGE_SIZE} 条
              </span>
              {currentPage < totalPages ? (
                <a className="button" href={`/projects/${projectId}/jobs?page=${currentPage + 1}`}>
                  下一页
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title="队列说明" description="任务页是创作工作台的操作回声。">
        <div className="quote-box">
          任务记录的核心不是给用户看热闹，而是能回溯每次章节任务、正文生成、审稿和二稿是否使用了 AI，是否走了兜底。
        </div>
        <div style={{ height: 12 }} />
        <div className="footer-note">
          后续如果某次 AI 失败，就在这里补失败原因、重试入口和重新执行记录。
        </div>
        <div style={{ height: 12 }} />
        <div className="section-card">
          <strong>建议操作顺序</strong>
          <div className="muted">先生成任务卡，再生成正文草稿，再做台账和审稿，最后把异常任务重试掉。</div>
        </div>
      </Panel>
    </div>
  );
}
