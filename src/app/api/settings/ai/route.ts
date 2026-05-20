import {
  deleteAiProfile,
  getPublicAiSettings,
  switchAiProfile,
  updateAiSettings
} from "@/lib/projects";

export const runtime = "nodejs";

export async function GET() {
  const settings = await getPublicAiSettings();
  return Response.json({ settings });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const settings = await updateAiSettings({
      profileId: String(body.profileId ?? ""),
      profileName: String(body.profileName ?? ""),
      providerName: String(body.providerName ?? ""),
      baseUrl: String(body.baseUrl ?? ""),
      apiKey: String(body.apiKey ?? ""),
      model: String(body.model ?? ""),
      models: Array.isArray(body.models) ? body.models.map(String) : [],
      timeoutMs: Number(body.timeoutMs ?? 60000),
      clearApiKey: body.clearApiKey === true || body.clearApiKey === "true"
    });

    return Response.json({ settings });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存 AI 配置失败" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    if (action === "switch") {
      const settings = await switchAiProfile(String(body.profileId ?? ""));
      return Response.json({ settings });
    }

    if (action === "delete") {
      const settings = await deleteAiProfile(String(body.profileId ?? ""));
      return Response.json({ settings });
    }

    return Response.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "更新 AI 配置失败" },
      { status: 400 }
    );
  }
}
