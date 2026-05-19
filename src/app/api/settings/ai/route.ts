import { getPublicAiSettings, updateAiSettings } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET() {
  const settings = await getPublicAiSettings();
  return Response.json({ settings });
}

export async function PUT(request: Request) {
  const body = await request.json();

  const settings = await updateAiSettings({
    providerName: String(body.providerName ?? ""),
    baseUrl: String(body.baseUrl ?? ""),
    apiKey: String(body.apiKey ?? ""),
    model: String(body.model ?? ""),
    timeoutMs: Number(body.timeoutMs ?? 60000),
    clearApiKey: body.clearApiKey === true
  });

  return Response.json({
    settings: {
      providerName: settings.providerName,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: settings.timeoutMs,
      hasApiKey: settings.apiKey.length > 0,
      apiKeyPreview: settings.apiKey ? `...${settings.apiKey.slice(-4)}` : "",
      updatedAt: settings.updatedAt
    }
  });
}
