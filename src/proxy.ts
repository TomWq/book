import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getSupabasePublishableKey, getSupabaseUrl, shouldUseSupabaseAuth } from "@/lib/supabase/config";

const SESSION_COOKIE = "nw_session";

async function getProxySupabaseAuth(request: NextRequest) {
  if (!shouldUseSupabaseAuth()) {
    return { user: null as { id: string } | null, cookiesToSet: [] as Array<{ name: string; value: string; options: any }> };
  }

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    return { user: null as { id: string } | null, cookiesToSet: [] as Array<{ name: string; value: string; options: any }> };
  }

  const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];
  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookiesToSet.length = 0;
        cookiesToSet.push(...cookies);
      }
    }
  });

  const { data } = await client.auth.getUser();
  return { user: data.user ?? null, cookiesToSet };
}

function applySupabaseCookies(response: NextResponse, cookiesToSet: Array<{ name: string; value: string; options: any }>) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

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
    if (
      pathname === "/activate" ||
      pathname === "/api/license/activate" ||
      pathname === "/api/license/restore" ||
      pathname === "/api/health" ||
      pathname === "/api/jobs/worker"
    ) {
      return NextResponse.next();
    }

    if (hasSession) {
      if (pathname === "/login" || pathname === "/register") {
        return NextResponse.redirect(new URL("/", request.url));
      }

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

  const publicPaths = new Set([
    "/",
    "/login",
    "/register",
    "/legal",
    "/api/health",
    "/api/jobs/worker",
    "/api/license/activate",
    "/api/license/restore"
  ]);
  const isAuthApi = pathname.startsWith("/api/auth");

  if (isAuthApi) {
    return NextResponse.next();
  }

  const { user, cookiesToSet } = await getProxySupabaseAuth(request);

  if (user) {
    if (pathname === "/login" || pathname === "/register") {
      return applySupabaseCookies(NextResponse.redirect(new URL("/", request.url)), cookiesToSet);
    }

    return applySupabaseCookies(NextResponse.next(), cookiesToSet);
  }

  if (hasSession) {
    if (pathname === "/login" || pathname === "/register") {
      return applySupabaseCookies(NextResponse.redirect(new URL("/", request.url)), cookiesToSet);
    }

    return applySupabaseCookies(NextResponse.next(), cookiesToSet);
  }

  if (publicPaths.has(pathname)) {
    return applySupabaseCookies(NextResponse.next(), cookiesToSet);
  }

  if (pathname === "/api/debug/persistence" || pathname === "/api/debug/echo") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return applySupabaseCookies(NextResponse.json({ error: "请先登录" }, { status: 401 }), cookiesToSet);
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return applySupabaseCookies(NextResponse.redirect(url), cookiesToSet);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
