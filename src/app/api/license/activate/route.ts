import { activateLicenseWithCenter, activateSubscriptionLicense } from "@/lib/projects";
import { isCloudRuntime } from "@/lib/app-runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    if (isCloudRuntime() || body.centerOnly) {
      const license = await activateLicenseWithCenter({
        activationCode: String(body.activationCode ?? ""),
        machineHash: String(body.machineHash ?? ""),
        clientName: String(body.clientName ?? "")
      });

      return Response.json({ license });
    }

    const user = await activateSubscriptionLicense({
      activationCode: String(body.activationCode ?? ""),
      machineHash: String(body.machineHash ?? ""),
      clientName: String(body.clientName ?? "")
    });

    return Response.json({ user });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "激活失败" },
      { status: 400 }
    );
  }
}
