import {
  analyzeProject,
  type ChapterAnalysisScope,
  enqueueAnalyzeProjectJob,
  getProjectAnalysis
} from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const analysis = await getProjectAnalysis(projectId);

  return Response.json(analysis);
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = await _request.json().catch(() => ({}));
  const scope =
    body?.scope && typeof body.scope === "object"
      ? (body.scope as ChapterAnalysisScope)
      : ({
          mode: body?.analysisMode,
          startChapter: body?.startChapter,
          endChapter: body?.endChapter,
          limit: body?.chapterLimit
        } satisfies ChapterAnalysisScope);

  try {
    if (body?.defer === true) {
      const job = await enqueueAnalyzeProjectJob(projectId, { scope });
      return Response.json({ job }, { status: 201 });
    }

    const result = await analyzeProject(projectId, { scope });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "分析失败" },
      { status: 400 }
    );
  }
}
