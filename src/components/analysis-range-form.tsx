"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { estimateAiTaskCredits } from "@/lib/ai-task-pricing";

type AnalysisMode = "first" | "range" | "single" | "all";
const MAX_ANALYSIS_CHAPTERS = 30;

function clampPositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function AnalysisRangeForm({
  projectId,
  chaptersCount,
  hasStoryAnalysis,
  analysisRunning = false
}: {
  projectId: string;
  chaptersCount: number;
  hasStoryAnalysis: boolean;
  analysisRunning?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AnalysisMode>("first");
  const [limit, setLimit] = useState(30);
  const [startChapter, setStartChapter] = useState(1);
  const [endChapter, setEndChapter] = useState(Math.min(30, Math.max(1, chaptersCount)));
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedCount = useMemo(() => {
    if (chaptersCount <= 0) {
      return 0;
    }

    if (mode === "all") {
      return Math.min(chaptersCount, MAX_ANALYSIS_CHAPTERS);
    }

    if (mode === "first") {
      return Math.min(chaptersCount, MAX_ANALYSIS_CHAPTERS, clampPositive(limit, 30));
    }

    if (mode === "single") {
      return startChapter <= chaptersCount ? 1 : 0;
    }

    const from = Math.min(startChapter, endChapter);
    const to = Math.max(startChapter, endChapter);
    return Math.min(MAX_ANALYSIS_CHAPTERS, Math.max(0, Math.min(chaptersCount, to) - Math.max(1, from) + 1));
  }, [chaptersCount, endChapter, limit, mode, startChapter]);
  const estimatedCredits =
    selectedCount > 0 ? estimateAiTaskCredits("analyze_chapters", { chapterCount: selectedCount }) : 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("正在创建分析任务。");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defer: true,
          scope: {
            mode,
            limit,
            startChapter,
            endChapter
          }
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ? String(body.error) : "分析失败");
        setStatus("");
        return;
      }

      const body = await response.json().catch(() => null);
      const jobId = body?.job?.id ? String(body.job.id) : "";

      if (!jobId) {
        setError("分析任务创建失败");
        setStatus("");
        return;
      }

      setStatus("分析任务已创建，正在刷新进度面板。");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "分析失败");
      setStatus("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="forms" onSubmit={handleSubmit} aria-busy={isSubmitting || isPending}>
      <div className="field">
        <div className="field-label">分析范围</div>
        <select value={mode} onChange={(event) => setMode(event.target.value as AnalysisMode)}>
          <option value="first">前 N 章</option>
          <option value="range">指定区间</option>
          <option value="single">单章</option>
          <option value="all">全部章节（最多 30 章）</option>
        </select>
      </div>

      {mode === "first" ? (
        <div className="field">
          <div className="field-label">分析前多少章</div>
          <input
            type="number"
            min={1}
            max={Math.min(MAX_ANALYSIS_CHAPTERS, Math.max(1, chaptersCount))}
            value={limit}
            onChange={(event) => setLimit(clampPositive(Number(event.target.value), 30))}
          />
        </div>
      ) : null}

      {mode === "range" ? (
        <div className="split-panels">
          <div className="field">
            <div className="field-label">起始章节</div>
            <input
              type="number"
              min={1}
              max={Math.max(1, chaptersCount)}
              value={startChapter}
              onChange={(event) => setStartChapter(clampPositive(Number(event.target.value), 1))}
            />
          </div>
          <div className="field">
            <div className="field-label">结束章节</div>
            <input
              type="number"
              min={1}
              max={Math.max(1, chaptersCount)}
              value={endChapter}
              onChange={(event) => setEndChapter(clampPositive(Number(event.target.value), 1))}
            />
          </div>
        </div>
      ) : null}

      {mode === "single" ? (
        <div className="field">
          <div className="field-label">章节序号</div>
          <input
            type="number"
            min={1}
            max={Math.max(1, chaptersCount)}
            value={startChapter}
            onChange={(event) => setStartChapter(clampPositive(Number(event.target.value), 1))}
          />
        </div>
      ) : null}

      <div className="section-card subtle-card">
        <div className="row">
          <strong>将分析 {selectedCount.toLocaleString("zh-CN")} 章</strong>
          <span className="chip">预计 {estimatedCredits.toLocaleString("zh-CN")} 灵石</span>
        </div>
        <div className="muted">
          项目共 {chaptersCount.toLocaleString("zh-CN")} 章。第一版单次最多分析 {MAX_ANALYSIS_CHAPTERS} 章，会按章节逐步执行，最后汇总整书结论。
        </div>
      </div>

      <button
        className="button"
        type="submit"
        disabled={analysisRunning || chaptersCount === 0 || selectedCount === 0 || isSubmitting || isPending}
      >
        {analysisRunning
          ? "已有分析在执行"
          : isSubmitting || isPending
            ? "分析中..."
            : hasStoryAnalysis
              ? "按范围重新分析"
              : "开始分析"}
      </button>
      {analysisRunning ? (
        <div className="muted form-status">当前已有章节分析任务在执行，完成或失败后才能重新开始。</div>
      ) : null}
      {status ? <div className="muted form-status">{status}</div> : null}
      {error ? <div className="pill danger form-error">{error}</div> : null}
    </form>
  );
}
