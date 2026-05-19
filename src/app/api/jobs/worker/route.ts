import { processPendingAiJobsAsWorker } from "@/lib/projects";

export const runtime = "nodejs";

function readLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 50) : 10;
}

function assertWorkerToken(request: Request) {
  const expected = process.env.JOB_WORKER_TOKEN?.trim();

  if (!expected) {
    throw new Error("未配置后台 Worker 密钥，后台 Worker 入口未启用");
  }

  const provided = request.headers.get("x-worker-token")?.trim();

  if (provided !== expected) {
    throw new Error("Worker 密钥无效");
  }
}

export async function POST(request: Request) {
  try {
    assertWorkerToken(request);
    const body = await request.json().catch(() => ({}));
    const result = await processPendingAiJobsAsWorker(readLimit(body?.limit));

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "后台 Worker 执行失败" },
      { status: 401 }
    );
  }
}
