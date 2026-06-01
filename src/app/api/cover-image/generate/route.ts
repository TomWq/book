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
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > 20000) {
    return Response.json(
      { error: "封面生成请求过大" },
      { status: 413 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const startedAt = Date.now();

  try {
    const result = await generateNovelCoverImage({
      title: String(body.title ?? ""),
      authorName: String(body.authorName ?? ""),
      stylePrompt: String(body.stylePrompt ?? ""),
      variationToken: String(body.variationToken ?? "")
    });

    console.info("[cover-image][public-api] success", {
      elapsedMs: Date.now() - startedAt,
      hasImage: Boolean(result.coverImageUrl),
      imageKind: String(result.coverImageUrl ?? "").startsWith("data:") ? "base64" : String(result.coverImageUrl ?? "").startsWith("http") ? "url" : "other",
      imageLength: String(result.coverImageUrl ?? "").length,
      quota: result.quota
    });
    return Response.json(result);
  } catch (error) {
    console.error("[cover-image][public-api] failed", {
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error
    });
    return Response.json(
      { error: error instanceof Error ? error.message : "生成封面失败" },
      { status: 400 }
    );
  }
}
