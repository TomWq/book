import { NextResponse, type NextRequest } from "next/server";
import { getAdminLoginPath } from "@/lib/admin-login-path";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { clearLocalLicenseSession, logoutUser } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (isDesktopRuntime()) {
    await clearLocalLicenseSession();
  } else {
    await logoutUser();
  }

  return NextResponse.redirect(
    new URL(isDesktopRuntime() ? "/activate" : getAdminLoginPath(), request.url)
  );
}
