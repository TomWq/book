import { listAiProviderModels } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const models = await listAiProviderModels({
      baseUrl: String(body.baseUrl ?? ""),
      apiKey: String(body.apiKey ?? "")
    });

    return Response.json({ models });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "获取模型列表失败" },
      { status: 400 }
    );
  }
}
