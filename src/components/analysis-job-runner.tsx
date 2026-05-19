"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type JobStatus = "pending" | "running" | "succeeded" | "failed" | "canceled";

type JobResponse = {
  job?: {
    status?: JobStatus;
    error?: string;
    output?: {
      phase?: string;
      chapterAnalysisCount?: number;
      totalChapters?: number;
    };
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readProgress(body: JobResponse, fallbackDone: number, fallbackTotal: number) {
  const output = body.job?.output;
  const done = Number(output?.chapterAnalysisCount ?? fallbackDone) || 0;
  const total = Number(output?.totalChapters ?? fallbackTotal) || fallbackTotal;
  const phase = output?.phase ?? "chapters";

  return { done, total, phase };
}

export function AnalysisJobRunner({
  jobId,
  initialDone,
  initialTotal
}: {
  jobId: string;
  initialDone: number;
  initialTotal: number;
}) {
  const router = useRouter();
  const isRunningRef = useRef(false);
  const [message, setMessage] = useState("正在接管分析任务，关闭页面后重新进入也会继续推进。");
  const [error, setError] = useState("");
  const [done, setDone] = useState(initialDone);
  const [total, setTotal] = useState(initialTotal);
  const [phase, setPhase] = useState("chapters");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (isRunningRef.current) {
        return;
      }

      isRunningRef.current = true;
      setError("");

      try {
        let currentDone = initialDone;
        let currentTotal = initialTotal;

        for (;;) {
          if (cancelled) {
            return;
          }

          const runResponse = await fetch("/api/jobs/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId })
          });

          if (!runResponse.ok) {
            const body = await runResponse.json().catch(() => null);
            throw new Error(body?.error ? String(body.error) : "继续执行分析任务失败");
          }

          const jobResponse = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
          const body = (await jobResponse.json().catch(() => ({}))) as JobResponse;
          const next = readProgress(body, currentDone, currentTotal);
          currentDone = next.done;
          currentTotal = next.total;

          setDone(next.done);
          setTotal(next.total);
          setPhase(next.phase);

          if (body.job?.status === "failed") {
            throw new Error(body.job.error || "分析任务失败");
          }

          if (body.job?.status === "succeeded") {
            setMessage("分析已完成，正在刷新结果。");
            router.refresh();
            return;
          }

          setMessage(
            next.phase === "story"
              ? "章节拆解已完成，正在汇总整书分析。"
              : `已完成 ${next.done} / ${next.total} 章，正在处理第 ${Math.min(next.done + 1, next.total)} 章。`
          );
          router.refresh();
          await sleep(700);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "分析任务已中断");
          router.refresh();
        }
      } finally {
        isRunningRef.current = false;
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [initialDone, initialTotal, jobId, router]);

  const percent = total > 0 ? Math.max(5, Math.min(99, Math.round((done / total) * 100))) : 5;

  return (
    <div className="analysis-resume-runner">
      <div className="row">
        <strong>{phase === "story" ? "正在汇总整书分析" : "自动继续执行分析任务"}</strong>
        <span className="chip">{percent}%</span>
      </div>
      <div className="usage-bar" aria-label={`自动继续执行进度 ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className={error ? "pill danger form-error" : "muted"}>{error || message}</div>
    </div>
  );
}
