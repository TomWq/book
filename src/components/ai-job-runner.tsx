"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type JobStatus = "pending" | "running" | "succeeded" | "failed" | "canceled";

type JobResponse = {
  job?: {
    type?: string;
    status?: JobStatus;
    error?: string;
    updatedAt?: string;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_POLL_ATTEMPTS = 240;
const RUN_REQUEST_TIMEOUT_MS = 300000;
const STALE_LONG_FORM_JOB_MS = 90 * 1000;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isResumableRunningJob(job: NonNullable<JobResponse["job"]>) {
  if (job.status !== "running") {
    return false;
  }

  if (job.type !== "generate_long_form_plan" && job.type !== "review_long_form_plan") {
    return false;
  }

  const updatedAt = Date.parse(String(job.updatedAt ?? ""));
  return !Number.isFinite(updatedAt) || Date.now() - updatedAt > STALE_LONG_FORM_JOB_MS;
}

export function AiJobRunner({
  jobId,
  title,
  runningMessage,
  doneMessage
}: {
  jobId: string;
  title: string;
  runningMessage: string;
  doneMessage: string;
}) {
  const router = useRouter();
  const isRunningRef = useRef(false);
  const [message, setMessage] = useState(runningMessage);
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function readJob() {
      const jobResponse = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      return (await jobResponse.json().catch(() => ({}))) as JobResponse;
    }

    async function run() {
      if (isRunningRef.current) {
        return;
      }

      isRunningRef.current = true;
      setError("");
      setTimedOut(false);

      try {
        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && !cancelled; attempt += 1) {
          const current = await readJob();
          const status = current.job?.status;

          console.info("[ai-job-runner] job poll", { jobId, status, attempt });

          if (status === "failed") {
            throw new Error(current.job?.error || "AI 任务失败");
          }

          if (status === "succeeded") {
            setMessage(doneMessage);
            router.refresh();
            window.setTimeout(() => router.refresh(), 500);
            return;
          }

          if (status === "pending" || (current.job && isResumableRunningJob(current.job))) {
            console.info("[ai-job-runner] run job", { jobId, title });
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), RUN_REQUEST_TIMEOUT_MS);
            let runResponse: Response;

            try {
              runResponse = await fetch("/api/jobs/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId }),
                signal: controller.signal
              });
            } finally {
              window.clearTimeout(timeout);
            }

            console.info("[ai-job-runner] run response", { jobId, ok: runResponse.ok, status: runResponse.status });

            if (!runResponse.ok) {
              const body = await runResponse.json().catch(() => null);
              throw new Error(body?.error ? String(body.error) : "执行 AI 任务失败");
            }
          }

          setMessage(status === "running" ? runningMessage : "任务已提交，正在等待执行结果。");
          await sleep(status === "running" ? 2500 : 800);
        }

        setTimedOut(true);
        setMessage("这一步等待较久，任务可能仍在后台执行；页面会继续自动刷新当前任务状态。");
        router.refresh();
      } catch (caught) {
        if (!cancelled) {
          if (isAbortError(caught)) {
            console.warn("[ai-job-runner] run timeout", { jobId, title });
            setTimedOut(true);
            setMessage("这一步超过 5 分钟还没返回，已停止本次前端等待。任务可能仍在后台执行；页面会继续显示最新任务状态。");
            for (let index = 0; index < 3; index += 1) {
              await sleep(1200);
              const body = await readJob();

              if (body.job?.status === "succeeded") {
                setTimedOut(false);
                setMessage(doneMessage);
                router.refresh();
                return;
              }

              if (body.job?.status === "failed") {
                throw new Error(body.job.error || "AI 任务失败");
              }
            }
          } else {
            setError(caught instanceof Error ? caught.message : "AI 任务已中断");
          }
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
  }, [doneMessage, jobId, router]);

  return (
    <div className="analysis-resume-runner">
      <div className="row">
        <strong>{title}</strong>
        <span className="chip">{error ? "失败" : timedOut ? "等待过久" : "进行中"}</span>
      </div>
      <div className="usage-bar" aria-label={title}>
        <span style={{ width: error ? "100%" : timedOut ? "92%" : "68%" }} />
      </div>
      <div className={error ? "pill danger form-error" : timedOut ? "pill warning form-status" : "muted"}>
        {error || message}
      </div>
    </div>
  );
}
