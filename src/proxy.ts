import { NextResponse, type NextRequest } from "next/server";
import { isDesktopRuntime } from "@/lib/app-runtime";

const SESSION_COOKIE = "nw_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isAsset) {
    return NextResponse.next();
  }

  if (isDesktopRuntime()) {
    if (hasSession) {
      if (pathname === "/login" || pathname === "/register" || pathname === "/activate") {
        return NextResponse.redirect(new URL("/", request.url));
      }

      return NextResponse.next();
    }

    if (
      pathname === "/activate" ||
      pathname === "/api/license/activate" ||
      pathname === "/api/license/restore" ||
      pathname === "/api/health" ||
      pathname === "/api/jobs/worker"
    ) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "请先输入激活码" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/activate";
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/legal" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/license/activate" ||
    pathname === "/api/health" ||
    pathname === "/api/jobs/worker"
  ) {
    return NextResponse.next();
  }

  if (hasSession) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
