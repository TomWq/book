import {
  generateNovelCoverImage,
  getPublicCoverImageSettings
} from "@/lib/projects";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getPublicCoverImageSettings();
    return Response.json({
      configured: settings.configured,
      quota: settings.quota,
      model: settings.model
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "获取封面生成状态失败" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const result = await generateNovelCoverImage({
      title: String(body.title ?? ""),
      authorName: String(body.authorName ?? ""),
      stylePrompt: String(body.stylePrompt ?? "")
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "生成封面失败" },
      { status: 400 }
    );
  }
}
