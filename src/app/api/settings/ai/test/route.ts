import { requestAiJson } from "@/lib/ai/client";
import { assertAiProviderConfigured, getAiProviderConfig } from "@/lib/ai/config";

export const runtime = "nodejs";

export async function POST() {
  try {
    const config = await getAiProviderConfig();
    assertAiProviderConfigured(config);

    const startedAt = Date.now();
    const response = await requestAiJson<{
      status?: string;
      providerName?: string;
      model?: string;
      echo?: string;
    }>({
      messages: [
        {
          role: "system",
          content:
            "你是一个AI连接测试器。请严格输出JSON，不要输出多余内容。"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "connection_test",
              outputSchema: {
                status: "string",
                providerName: "string",
                model: "string",
                echo: "string"
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0,
      maxTokens: 100
    });

    return Response.json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      providerName: config.providerName,
      baseUrl: config.baseUrl,
      model: config.model,
      reply: {
        status: String(response.status ?? "ok"),
        providerName: String(response.providerName ?? config.providerName),
        model: String(response.model ?? config.model),
        echo: String(response.echo ?? "连接成功")
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
