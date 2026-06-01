import { activateSubscriptionTrial } from "@/lib/projects";
import { requestTrialLicenseWithCenter } from "@/lib/license-service";
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
    geoParts.length > 0 ? `位置 ${geoParts.join(" / ")}` : "",
    "客户端自动体验"
  ].filter(Boolean).join(" | ");
  const machineHash = isCloudRuntime() || body.centerOnly
    ? String(body.machineHash ?? "")
    : getDesktopMachineHash();

  try {
    if (isCloudRuntime() || body.centerOnly) {
      const license = await requestTrialLicenseWithCenter({
        machineHash,
        clientName: clientMeta
      });

      return Response.json({ license });
    }

    const user = await activateSubscriptionTrial({
      machineHash,
      clientName: clientMeta
    });

    return Response.json({ user });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "自动开通体验失败" },
      { status: 400 }
    );
  }
}
