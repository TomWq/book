import { cookies } from "next/headers";
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

export async function setSessionCookie(token: string) {
  const store = await getCookieStore();
  const cookieSecure =
    process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase() === "true" ||
    (process.env.AUTH_COOKIE_SECURE == null && process.env.NODE_ENV === "production");

  store?.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    secure: cookieSecure
  });
}

export async function clearSessionCookie() {
  const store = await getCookieStore();
  store?.delete(SESSION_COOKIE);
}
