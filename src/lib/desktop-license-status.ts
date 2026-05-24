import { isDesktopRuntime } from "@/lib/app-runtime";
import { getActiveSession } from "@/lib/auth-session";
import { toAuthUser } from "@/lib/auth-utils";
import { getBillingMode } from "@/lib/billing-mode";
import {
  getDesktopLicenseCandidate,
  refreshDesktopLicenseStateFromRemoteCenter,
  resolveDesktopLicenseState,
  type DesktopLicenseState
} from "@/lib/license-service";
import { readStore, writeStore } from "@/lib/project-store";
import type { AppStore } from "@/lib/project-types";

type SubscriptionActivationStatus = {
  billingMode: ReturnType<typeof getBillingMode>;
  activated: boolean;
  expired: boolean;
  licenseStatus: DesktopLicenseState["status"];
  licenseExpiresAt?: string;
  licenseActivatedAt: string;
  message: string;
  currentUser: ReturnType<typeof toAuthUser> | null;
  customerId: string;
  serverNow: string;
};

type DesktopActivationStatusCache = {
  expiresAtMs: number;
  value: SubscriptionActivationStatus;
} | null;

const DESKTOP_STATUS_CACHE_KEY = "__aiNovelDesktopActivationStatusCache";

function getGlobalStatusCache() {
  return (globalThis as typeof globalThis & { [DESKTOP_STATUS_CACHE_KEY]?: DesktopActivationStatusCache })[
    DESKTOP_STATUS_CACHE_KEY
  ] ?? null;
}

function setGlobalStatusCache(value: DesktopActivationStatusCache) {
  (globalThis as typeof globalThis & { [DESKTOP_STATUS_CACHE_KEY]?: DesktopActivationStatusCache })[
    DESKTOP_STATUS_CACHE_KEY
  ] = value;
}

function now() {
  return new Date().toISOString();
}

function getDesktopActivationStatusCacheMs() {
  const configured = Number(process.env.DESKTOP_LICENSE_STATUS_CACHE_MS ?? "");
  return Number.isFinite(configured) && configured >= 0 ? configured : 2_000;
}

export function clearDesktopActivationStatusCache() {
  setGlobalStatusCache(null);
}

async function getCurrentUserFromStore(store: AppStore) {
  const session = await getActiveSession(store);

  if (!session) {
    return null;
  }

  const user = store.users.find((item) => item.id === session.userId);

  if (!user) {
    return null;
  }

  const licenseState = resolveDesktopLicenseState(store, user);

  if (licenseState.changed) {
    await writeStore(store);
  }

  if (licenseState.status !== "active") {
    store.sessions = store.sessions.filter((item) => item.userId !== user.id);
    await writeStore(store);
    return null;
  }

  session.lastSeenAt = now();
  return user;
}

export async function getSubscriptionActivationStatus() {
  const cacheMs = getDesktopActivationStatusCacheMs();
  const cachedStatus = getGlobalStatusCache();

  if (isDesktopRuntime() && cacheMs > 0 && cachedStatus && Date.now() < cachedStatus.expiresAtMs) {
    return {
      ...cachedStatus.value,
      serverNow: now()
    };
  }

  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);
  const candidate = currentUser
    ? { user: currentUser, state: resolveDesktopLicenseState(store, currentUser), changed: false }
    : getDesktopLicenseCandidate(store);
  const candidateUser = candidate.user;
  const licenseState: DesktopLicenseState = candidateUser
    ? await refreshDesktopLicenseStateFromRemoteCenter(store, candidateUser, candidate.state)
    : candidate.state;

  if (candidate.changed || licenseState.changed) {
    await writeStore(store);
  }

  const status: SubscriptionActivationStatus = {
    billingMode: getBillingMode(),
    activated: licenseState.status === "active",
    expired: licenseState.status === "expired" || licenseState.status === "disabled",
    licenseStatus: licenseState.status,
    licenseExpiresAt: licenseState.expiresAt,
    licenseActivatedAt: candidateUser?.licenseActivatedAt ?? "",
    message: licenseState.message ?? "",
    currentUser: currentUser ? toAuthUser(currentUser) : null,
    customerId: currentUser?.licenseCustomerId ?? candidateUser?.licenseCustomerId ?? "",
    serverNow: now()
  };

  if (isDesktopRuntime() && cacheMs > 0) {
    setGlobalStatusCache({
      expiresAtMs: Date.now() + cacheMs,
      value: status
    });
  }

  return status;
}
