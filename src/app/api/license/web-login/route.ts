import { activateWebLicenseSession } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const clientMeta = [
    String(body.clientName ?? ""),
    forwardedFor ? `IP ${forwardedFor}` : "",
    "网页授权入口"
  ].filter(Boolean).join(" | ");

  try {
    const user = await activateWebLicenseSession({
      activationCode: String(body.activationCode ?? ""),
      clientName: clientMeta
    });

    return Response.json({ user });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "授权登录失败" },
      { status: 400 }
    );
  }
}
