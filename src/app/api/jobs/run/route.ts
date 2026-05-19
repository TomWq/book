import { processAiJob, processPendingAiJobs } from "@/lib/projects";

export const runtime = "nodejs";

function readLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 20) : 5;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const result = body?.jobId
      ? await processAiJob(String(body.jobId))
      : await processPendingAiJobs(readLimit(body?.limit));
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "执行待处理任务失败" },
      { status: 400 }
    );
  }
}
