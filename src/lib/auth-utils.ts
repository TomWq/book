import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { AppStore, StoredUser } from "@/lib/project-types";

export type AuthUserView = {
  id: string;
  email: string;
  name: string;
  penName?: string;
  penNameSetAt?: string;
  role: "user" | "admin";
  plan: "trial" | "creator" | "studio";
  licenseCustomerId?: string;
  licenseActivatedAt?: string;
  licenseExpiresAt?: string;
};

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 64, "sha256").toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = pbkdf2Sync(password, salt, 120000, 64, "sha256").toString("hex");
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function toAuthUser(user: StoredUser): AuthUserView {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    penName: user.penName,
    penNameSetAt: user.penNameSetAt,
    role: user.role,
    plan: user.plan ?? "trial",
    licenseCustomerId: user.licenseCustomerId,
    licenseActivatedAt: user.licenseActivatedAt,
    licenseExpiresAt: user.licenseExpiresAt
  };
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function userDisplayName(email: string, name?: string | null) {
  const trimmedName = String(name ?? "").trim();
  if (trimmedName) {
    return trimmedName;
  }

  const localPart = normalizeEmail(email).split("@")[0] || "用户";
  return localPart || "用户";
}

export function buildPlaceholderPassword() {
  const { salt, hash } = hashPassword(randomUUID());
  return { salt, hash };
}

export function authUserId(user: { id: string }) {
  return String(user.id || "");
}

export function authUserEmail(user: { email?: string | null }) {
  return normalizeEmail(String(user.email ?? ""));
}

export function getAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((item) => normalizeEmail(item))
      .filter(Boolean)
  );
}

export function isAdminUser(store: AppStore, user: StoredUser) {
  if (user.role === "admin") {
    return true;
  }

  if (getAdminEmails().has(normalizeEmail(user.email))) {
    return true;
  }

  return false;
}

export function isAdminAuthUser(user: StoredUser) {
  return user.role === "admin" || getAdminEmails().has(normalizeEmail(user.email));
}
