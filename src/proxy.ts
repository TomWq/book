import { NextResponse, type NextRequest } from "next/server";
import { getAdminLoginPath } from "@/lib/admin-login-path";
import { isDesktopRuntime } from "@/lib/app-runtime";

const SESSION_COOKIE = "nw_session";

function nextWithPath(request: NextRequest, pathname = request.nextUrl.pathname) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nw-pathname", pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

function rewriteWithPath(request: NextRequest, pathname: string, headerPath = pathname) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nw-pathname", headerPath);

  const url = request.nextUrl.clone();
  url.pathname = pathname;

  return NextResponse.rewrite(url, {
    request: {
      headers: requestHeaders
    }
  });
}

function rewriteAdminLogin(request: NextRequest, pathname: string, headerPath = pathname) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nw-pathname", headerPath);

  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.searchParams.set("next", "/admin");

  return NextResponse.rewrite(url, {
    request: {
      headers: requestHeaders
    }
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const adminLoginPath = getAdminLoginPath();
  const isAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/downloads/") ||
    pathname.startsWith("/onboarding/") ||
    pathname.startsWith("/update/") ||
    pathname === "/favicon.ico";

  if (isAsset) {
    return nextWithPath(request);
  }

  if (isDesktopRuntime()) {
    const isLicenseExemptPath =
      pathname === "/activate" ||
      pathname === "/download" ||
      pathname === "/downloads" ||
      pathname === "/api/license/activate" ||
      pathname === "/api/license/restore" ||
      pathname === "/api/license/status" ||
      pathname === "/api/license/verify" ||
      pathname === "/api/app/update/manifest" ||
      pathname === "/api/app/update/check" ||
      pathname.startsWith("/api/app/tauri-update/") ||
      pathname.startsWith("/api/download/") ||
      pathname === "/api/health" ||
      pathname === "/api/jobs/worker";

    if (isLicenseExemptPath) {
      return nextWithPath(request);
    }

    if (hasSession) {
      if (pathname === "/login" || pathname === "/register") {
        return NextResponse.redirect(new URL("/", request.url));
      }

      return nextWithPath(request);
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        {
          error: "请先输入激活码"
        },
        { status: 401 }
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/activate";
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  const publicPaths = new Set([
    "/",
    "/activate",
    "/download",
    "/downloads",
    "/legal",
    "/api/health",
    "/api/app/update/manifest",
    "/api/app/update/check",
    "/api/download",
    "/api/jobs/worker",
    "/api/license/activate",
    "/api/license/web-login",
    "/api/license/restore",
    "/api/license/verify"
  ]);
  const isAuthApi = pathname.startsWith("/api/auth");

  if (pathname === "/api/auth/register") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isAuthApi) {
    return nextWithPath(request);
  }

  if (pathname === adminLoginPath) {
    return rewriteAdminLogin(request, "/login", "/login");
  }

  if (hasSession) {
    return nextWithPath(request);
  }

  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(new URL("/activate", request.url));
  }

  if (publicPaths.has(pathname) || pathname.startsWith("/api/download/") || pathname.startsWith("/api/app/tauri-update/")) {
    return nextWithPath(request);
  }

  if (pathname === "/api/debug/persistence" || pathname === "/api/debug/echo") {
    return nextWithPath(request);
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/activate";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
