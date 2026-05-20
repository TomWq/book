import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "nw_session";

function isSubscriptionMode() {
  const mode = String(process.env.APP_BILLING_MODE ?? "credits").trim().toLowerCase();
  return mode === "subscription" || mode === "self-hosted" || mode === "license";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isAsset) {
    return NextResponse.next();
  }

  if (isSubscriptionMode()) {
    if (hasSession) {
      if (pathname === "/login" || pathname === "/register" || pathname === "/activate") {
        return NextResponse.redirect(new URL("/", request.url));
      }

      return NextResponse.next();
    }

    if (
      pathname === "/activate" ||
      pathname === "/api/license/activate" ||
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
