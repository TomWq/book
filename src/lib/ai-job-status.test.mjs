import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadStatusModule() {
  const source = await readFile(new URL("./ai-job-status.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  });
  return import(`data:text/javascript,${encodeURIComponent(outputText)}`);
}

test("running batch jobs become runnable at the shared resume threshold", async () => {
  const { aiJobResumeAfterMs, isRunnableAiJob, isActiveAiJob } = await loadStatusModule();
  const job = { status: "running", type: "generate_chapter_batch", updatedAt: "" };
  job.updatedAt = new Date(Date.now() - aiJobResumeAfterMs(job) - 1000).toISOString();

  assert.equal(isRunnableAiJob(job), true);
  assert.equal(isActiveAiJob(job), false);
});

test("recent running batch jobs stay active and are not resumed", async () => {
  const { AI_JOB_RESUME_AFTER_MS, aiJobResumeAfterMs, isRunnableAiJob, isActiveAiJob } = await loadStatusModule();
  const job = { status: "running", type: "generate_chapter_batch", updatedAt: "" };
  job.updatedAt = new Date(Date.now() - AI_JOB_RESUME_AFTER_MS - 1000).toISOString();

  assert.equal(isRunnableAiJob(job), false);
  assert.equal(isActiveAiJob(job), true);

  job.updatedAt = new Date(Date.now() - aiJobResumeAfterMs(job) + 1000).toISOString();
  assert.equal(isRunnableAiJob(job), false);
  assert.equal(isActiveAiJob(job), true);
});

test("failed and succeeded jobs are not runnable", async () => {
  const { isRunnableAiJob, isActiveAiJob } = await loadStatusModule();

  assert.equal(isRunnableAiJob({ status: "failed", type: "generate_chapter_batch", updatedAt: "" }), false);
  assert.equal(isRunnableAiJob({ status: "succeeded", type: "generate_chapter_batch", updatedAt: "" }), false);
  assert.equal(isActiveAiJob({ status: "failed", type: "generate_chapter_batch", updatedAt: "" }), false);
});
