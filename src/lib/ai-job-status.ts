export const AI_JOB_RESUME_AFTER_MS = 90 * 1000;
export const LONG_AI_JOB_RESUME_AFTER_MS = 10 * 60 * 1000;

export const resumableAiJobTypes = new Set([
  "analyze_chapters",
  "generate_task_card",
  "generate_chapter",
  "review_chapter",
  "generate_chapter_batch",
  "generate_long_form_plan",
  "review_long_form_plan",
  "edit_second_draft",
  "project_creation_assist"
]);

export type AiJobStatusView = {
  status: string;
  type: string;
  updatedAt?: string;
};

export function aiJobResumeAfterMs(job: Pick<AiJobStatusView, "type">) {
  return job.type === "analyze_chapters" || job.type === "generate_chapter_batch"
    ? LONG_AI_JOB_RESUME_AFTER_MS
    : AI_JOB_RESUME_AFTER_MS;
}

export function isStaleRunningAiJob(job: AiJobStatusView) {
  if (job.status !== "running" || !resumableAiJobTypes.has(job.type)) {
    return false;
  }

  const updatedAt = Date.parse(String(job.updatedAt ?? ""));
  return !Number.isFinite(updatedAt) || Date.now() - updatedAt > aiJobResumeAfterMs(job);
}

export function isRunnableAiJob(job: AiJobStatusView) {
  return job.status === "pending" || isStaleRunningAiJob(job);
}

export function isActiveAiJob(job: AiJobStatusView) {
  return job.status === "pending" || (job.status === "running" && !isStaleRunningAiJob(job));
}
