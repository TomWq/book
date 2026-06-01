import {
  generateLicenseCoverImage,
  getLicenseCoverImageSettings
} from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function previewId(value: string) {
  const text = value.trim();
  if (!text) {
    return "";
  }

  return text.length > 12 ? `${text.slice(0, 6)}...${text.slice(-4)}` : text;
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
  const action = String(body.action ?? "status");
  const auth = {
    licenseId: String(body.licenseId ?? ""),
    codeHash: String(body.codeHash ?? ""),
    machineHash: String(body.machineHash ?? ""),
    clientName: String(body.clientName ?? "")
  };
  const startedAt = Date.now();

  console.info("[cover-image][license-api] request", {
    action,
    licenseId: previewId(auth.licenseId),
    codeHash: previewId(auth.codeHash),
    machineHash: previewId(auth.machineHash),
    clientName: auth.clientName,
    title: action === "generate" ? String(body.title ?? "") : undefined
  });

  try {
    if (action === "generate") {
      const result = await generateLicenseCoverImage({
        ...auth,
        title: String(body.title ?? ""),
        authorName: String(body.authorName ?? ""),
        stylePrompt: String(body.stylePrompt ?? ""),
        variationToken: String(body.variationToken ?? "")
      });

      console.info("[cover-image][license-api] success", {
        action,
        elapsedMs: Date.now() - startedAt,
        hasImage: Boolean(result.coverImageUrl),
        quota: result.quota
      });
      return Response.json(result);
    }

    const settings = await getLicenseCoverImageSettings(auth);
    console.info("[cover-image][license-api] success", {
      action,
      elapsedMs: Date.now() - startedAt,
      configured: settings.configured,
      quota: settings.quota
    });
    return Response.json(settings);
  } catch (error) {
    console.error("[cover-image][license-api] failed", {
      action,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error
    });
    return Response.json(
      { error: error instanceof Error ? error.message : "授权中心封面生图失败" },
      { status: 400 }
    );
  }
}
