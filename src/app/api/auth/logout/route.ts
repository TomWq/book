import { isDesktopRuntime } from "@/lib/app-runtime";
import { clearLocalLicenseSession, logoutUser } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST() {
  if (isDesktopRuntime()) {
    await clearLocalLicenseSession();
  } else {
    await logoutUser();
  }

  return Response.json({ ok: true });
}
