import { NextResponse, type NextRequest } from "next/server";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { restoreSubscriptionSession } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isDesktopRuntime()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const nextPath = request.nextUrl.searchParams.get("next") || "/";
  const safeNextPath = nextPath.startsWith("/") ? nextPath : "/";
  const result = await restoreSubscriptionSession();

  if (result.user) {
    return NextResponse.redirect(new URL(safeNextPath, request.url));
  }

  const url = new URL("/activate", request.url);
  if (result.reason === "expired") {
    url.searchParams.set("error", result.message || "体验时间已到期。如需继续使用，请联系管理员获取正式授权码。");
  } else if (result.reason === "disabled") {
    url.searchParams.set("error", result.message || "授权已被管理员禁用，请联系管理员");
  } else if (result.reason === "missing") {
    url.searchParams.set("error", result.message || "授权状态已失效，请联系管理员获取正式授权码");
  }

  return NextResponse.redirect(url);
}
