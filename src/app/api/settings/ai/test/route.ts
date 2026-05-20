import { assertAiProviderConfigured, getAiProviderConfig } from "@/lib/ai/config";

export const runtime = "nodejs";

export async function POST() {
  try {
    const config = await getAiProviderConfig();
    assertAiProviderConfigured(config);

    const startedAt = Date.now();
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      cache: "no-store"
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI 连接失败：${response.status} ${text}`);
    }

    const payload = await response.json().catch(() => null);
    const models = Array.isArray(payload?.data)
      ? payload.data
          .map((item: unknown) =>
            item && typeof item === "object" && "id" in item ? String((item as { id: unknown }).id) : ""
          )
          .filter(Boolean)
      : [];

    return Response.json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      providerName: config.providerName,
      baseUrl: config.baseUrl,
      model: config.model,
      reply: {
        status: "ok",
        providerName: config.providerName,
        model: config.model,
        echo: models.length > 0 ? `连接成功，读取到 ${models.length} 个模型` : "连接成功"
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "AI 连接测试失败"
      },
      { status: 400 }
    );
  }
}
