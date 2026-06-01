import {
  getAdminCoverImageSettings,
  updateAdminCoverImageSettings
} from "@/lib/projects";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getAdminCoverImageSettings();
    return Response.json({ settings });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "获取封面生图配置失败" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const settings = await updateAdminCoverImageSettings({
      providerName: String(body.providerName ?? ""),
      baseUrl: String(body.baseUrl ?? ""),
      apiKey: String(body.apiKey ?? ""),
      model: String(body.model ?? ""),
      timeoutMs: Number(body.timeoutMs ?? 300000),
      dailyLimit: Number(body.dailyLimit ?? 3),
      clearApiKey: body.clearApiKey === true || body.clearApiKey === "true"
    });

    return Response.json({ settings });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存封面生图配置失败" },
      { status: 400 }
    );
  }
}
