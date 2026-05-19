import { getAiJob, retryAiJob } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const job = await getAiJob(jobId);

  if (!job) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }

  return Response.json({ job });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;

  try {
    const result = await retryAiJob(jobId);
    return Response.json({ result }, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "任务重试失败" },
      { status: 400 }
    );
  }
}
