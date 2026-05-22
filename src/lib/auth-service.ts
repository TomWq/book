import { randomUUID } from "node:crypto";
import {
  hashPassword,
  isAdminAuthUser,
  normalizeEmail,
  toAuthUser,
  verifyPassword
} from "@/lib/auth-utils";
import {
  clearSessionCookie,
  getSessionTokenFromCookies,
  sessionExpiresAt,
  setSessionCookie
} from "@/lib/auth-session";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { readStore, writeStore } from "@/lib/project-store";
import type { AppStore, StoredUser } from "@/lib/project-types";

export type AuthServiceHooks = {
  claimLegacyWorkspace: (store: AppStore, userId: string) => void;
};

function now() {
  return new Date().toISOString();
}

function claimLegacyWorkspaceIfNeeded(store: AppStore, userId: string, hooks: AuthServiceHooks) {
  if (store.projects.every((item) => !item.ownerUserId)) {
    hooks.claimLegacyWorkspace(store, userId);
    return true;
  }

  return false;
}

export async function registerUserWithAuthService(
  input: { email: string; password: string; name: string },
  hooks: AuthServiceHooks
) {
  if (isDesktopRuntime()) {
    throw new Error("当前为授权模式，请使用激活码进入");
  }

  const store = await readStore();
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const password = input.password.trim();

  if (!email || !password || !name) {
    throw new Error("请完整填写邮箱、用户名和密码");
  }

  if (store.users.some((item) => item.email === email)) {
    throw new Error("该邮箱已注册，请直接登录");
  }

  const timestamp = now();
  const { salt, hash } = hashPassword(password);
  const user: StoredUser = {
    id: randomUUID(),
    email,
    name,
    passwordSalt: salt,
    passwordHash: hash,
    role: isAdminAuthUser({ email, role: "user" } as StoredUser) ? "admin" : "user",
    plan: "trial",
    creditsBalance: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.users.push(user);
  claimLegacyWorkspaceIfNeeded(store, user.id, hooks);

  const token = randomUUID();
  store.sessions.push({
    id: randomUUID(),
    userId: user.id,
    token,
    createdAt: timestamp,
    expiresAt: sessionExpiresAt(),
    lastSeenAt: timestamp
  });

  await writeStore(store);
  await setSessionCookie(token);
  return toAuthUser(user);
}

export async function loginUserWithAuthService(input: { email: string; password: string }, hooks: AuthServiceHooks) {
  if (isDesktopRuntime()) {
    throw new Error("当前为授权模式，请使用激活码进入");
  }

  const store = await readStore();
  const email = normalizeEmail(input.email);
  const password = input.password.trim();

  if (!email || !password) {
    throw new Error("请填写邮箱和密码");
  }

  const user = store.users.find((item) => item.email === email);

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    throw new Error("邮箱或密码错误");
  }

  const timestamp = now();
  const token = randomUUID();
  store.sessions = store.sessions.filter((item) => item.userId !== user.id || item.expiresAt > timestamp);
  store.sessions.push({
    id: randomUUID(),
    userId: user.id,
    token,
    createdAt: timestamp,
    expiresAt: sessionExpiresAt(),
    lastSeenAt: timestamp
  });

  claimLegacyWorkspaceIfNeeded(store, user.id, hooks);

  user.role = isAdminAuthUser(user) ? "admin" : user.role;
  user.plan = user.plan ?? "trial";
  if (user.creditsBalance == null) {
    user.creditsBalance = 0;
  }
  user.updatedAt = timestamp;
  await writeStore(store);
  await setSessionCookie(token);
  return toAuthUser(user);
}

export async function logoutUserWithAuthService() {
  const store = await readStore();
  const token = await getSessionTokenFromCookies();

  if (token) {
    store.sessions = store.sessions.filter((item) => item.token !== token);
    await writeStore(store);
  }

  await clearSessionCookie();
}
