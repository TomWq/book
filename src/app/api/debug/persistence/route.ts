import { getPersistenceStatus } from "@/lib/store-persistence";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ ok: true, persistence: await getPersistenceStatus() });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "持久化诊断失败"
      },
      { status: 500 }
    );
  }
}
