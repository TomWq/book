import { NextResponse, type NextRequest } from "next/server";
import { isDesktopRuntime } from "@/lib/app-runtime";

const SESSION_COOKIE = "nw_session";

type DesktopLicenseStatus = {
  currentUser?: { id: string } | null;
  activated?: boolean;
  expired?: boolean;
  message?: string;
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isAsset =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isAsset) {
    return NextResponse.next();
  }

  if (isDesktopRuntime()) {
    const isLicenseExemptPath =
      pathname === "/activate" ||
      pathname === "/api/license/activate" ||
      pathname === "/api/license/restore" ||
      pathname === "/api/license/status" ||
      pathname === "/api/license/verify" ||
      pathname === "/api/health" ||
      pathname === "/api/jobs/worker";

    if (isLicenseExemptPath) {
      return NextResponse.next();
    }

    const statusUrl = new URL("/api/license/status", request.url);
    let status: DesktopLicenseStatus | null = null;

    try {
      const response = await fetch(statusUrl, {
        headers: {
          cookie: request.headers.get("cookie") ?? ""
        },
        cache: "no-store"
      });

      if (response.ok) {
        status = (await response.json().catch(() => null)) as DesktopLicenseStatus | null;
      }
    } catch {
      status = null;
    }

    const currentUser = status?.currentUser ?? null;

    if (currentUser) {
      if (pathname === "/login" || pathname === "/register") {
        return NextResponse.redirect(new URL("/", request.url));
      }

      return NextResponse.next();
    }

    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        {
          error: status?.message || "请先输入激活码"
        },
        { status: 401 }
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/activate";
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    if (status?.message) {
      url.searchParams.set("error", status.message);
    }
    return NextResponse.redirect(url);
  }

  const publicPaths = new Set([
    "/",
    "/login",
    "/register",
    "/legal",
    "/api/health",
    "/api/jobs/worker",
    "/api/license/activate",
    "/api/license/restore",
    "/api/license/verify"
  ]);
  const isAuthApi = pathname.startsWith("/api/auth");

  if (isAuthApi) {
    return NextResponse.next();
  }

  if (hasSession) {
    if (pathname === "/login" || pathname === "/register") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (publicPaths.has(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/api/debug/persistence" || pathname === "/api/debug/echo") {
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
