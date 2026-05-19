import { grantCreditsToUser } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    await grantCreditsToUser({
      userId: String(body.userId ?? "").trim(),
      amount: Number(body.amount ?? 0),
      reason: String(body.reason ?? "").trim()
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "充值灵石失败" },
      { status: 400 }
    );
  }
}
