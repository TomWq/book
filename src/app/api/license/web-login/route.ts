import { createHash, randomUUID } from "node:crypto";
import { activateWebLicenseSession } from "@/lib/projects";
import { shouldUseSecureCookie } from "@/lib/auth-session";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const WEB_DEVICE_COOKIE = "nw_web_device";

function getWebDeviceHash(deviceId: string) {
  return createHash("sha256")
    .update("ai-novel-workbench-web-device")
    .update(":")
    .update(deviceId.trim())
    .digest("hex");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const cookieStore = await cookies();
  const existingDeviceId = cookieStore.get(WEB_DEVICE_COOKIE)?.value?.trim() ?? "";
  const deviceId = existingDeviceId || randomUUID();
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const clientMeta = [
    String(body.clientName ?? ""),
    forwardedFor ? `IP ${forwardedFor}` : "",
    "网页授权入口"
  ].filter(Boolean).join(" | ");

  try {
    const user = await activateWebLicenseSession({
      activationCode: String(body.activationCode ?? ""),
      machineHash: getWebDeviceHash(deviceId),
      clientName: clientMeta
    });

    if (!existingDeviceId) {
      cookieStore.set(WEB_DEVICE_COOKIE, deviceId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 400 * 24 * 60 * 60,
        secure: await shouldUseSecureCookie()
      });
    }

    return Response.json({ user });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "授权登录失败" },
      { status: 400 }
    );
  }
}
