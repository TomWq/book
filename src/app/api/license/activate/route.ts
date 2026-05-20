import { activateSubscriptionLicense } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const user = await activateSubscriptionLicense({
      activationCode: String(body.activationCode ?? "")
    });

    return Response.json({ user });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "激活失败" },
      { status: 400 }
    );
  }
}
