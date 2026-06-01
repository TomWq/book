import { cookies, headers } from "next/headers";
import type { AppStore } from "@/lib/project-types";

const SESSION_COOKIE = "nw_session";
const SESSION_TTL_DAYS = 30;

export async function getCookieStore() {
  try {
    return await cookies();
  } catch {
    return null;
  }
}

export async function getSessionTokenFromCookies() {
  const store = await getCookieStore();
  return store?.get(SESSION_COOKIE)?.value ?? "";
}

export async function getActiveSession(store: AppStore) {
  const token = await getSessionTokenFromCookies();

  if (!token) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const session = store.sessions.find(
    (item) => item.token === token && item.expiresAt > timestamp
  );

  if (!session) {
    return null;
  }

  return session;
}

export function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function isLocalHttpRequest() {
  const headerStore = await headers().catch(() => null);
  const proto = headerStore?.get("x-forwarded-proto") ?? "";
  const host = (headerStore?.get("host") ?? "").split(":")[0].toLowerCase();

  return proto !== "https" && (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

export async function shouldUseSecureCookie() {
  const configured = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();

  if (configured === "true") {
    return true;
  }

  if (configured === "false") {
    return false;
  }

  if (await isLocalHttpRequest()) {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(token: string) {
  const store = await getCookieStore();

  store?.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    secure: await shouldUseSecureCookie()
  });
}

export async function clearSessionCookie() {
  const store = await getCookieStore();
  store?.delete(SESSION_COOKIE);
}
