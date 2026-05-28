import { activateLicenseWithCenter, activateSubscriptionLicense } from "@/lib/projects";
import { isCloudRuntime } from "@/lib/app-runtime";
import { getDesktopMachineHash } from "@/lib/desktop-machine-id";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const geoParts = [
    request.headers.get("x-vercel-ip-country"),
    request.headers.get("x-vercel-ip-country-region"),
    request.headers.get("x-vercel-ip-city")
  ].filter(Boolean);
  const clientMeta = [
    String(body.clientName ?? ""),
    forwardedFor ? `IP ${forwardedFor}` : "",
    geoParts.length > 0 ? `位置 ${geoParts.join(" / ")}` : ""
  ].filter(Boolean).join(" | ");
  const machineHash = isCloudRuntime() || body.centerOnly
    ? String(body.machineHash ?? "")
    : getDesktopMachineHash();

  try {
    if (isCloudRuntime() || body.centerOnly) {
      const license = await activateLicenseWithCenter({
        activationCode: String(body.activationCode ?? ""),
        machineHash,
        clientName: clientMeta,
        purpose: "desktop"
      });

      return Response.json({ license });
    }

    const user = await activateSubscriptionLicense({
      activationCode: String(body.activationCode ?? ""),
      machineHash,
      clientName: clientMeta
    }, {
      replaceExisting: Boolean(body.replaceExisting)
    });

    return Response.json({ user });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "激活失败" },
      { status: 400 }
    );
  }
}
