import { createHash, randomBytes, randomUUID } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { SocksProxyAgent } from "socks-proxy-agent";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { readStore, writeStore } from "@/lib/project-store";
import type {
  AdminLicenseCenterSummary,
  AppStore,
  StoredLicenseActivationLog,
  StoredLicenseCode,
  StoredUser
} from "@/lib/project-types";

export type DesktopLicenseState = {
  status: "active" | "expired" | "disabled" | "missing" | "inactive";
  expiresAt?: string;
  message?: string;
  changed: boolean;
};

export type LicenseActivationInput = {
  activationCode: string;
  machineHash?: string;
  clientName?: string;
};

export type LicenseVerificationInput = {
  licenseId?: string;
  codeHash?: string;
  machineHash?: string;
  clientName?: string;
};

export type LicenseActivationResult = {
  licenseId: string;
  customerId: string;
  codePreview: string;
  status: string;
  activatedAt: string;
  expiresAt?: string;
  isTrial: boolean;
  customerName?: string;
  customerContact?: string;
};

function now() {
  return new Date().toISOString();
}

function getLicenseStatusRefreshIntervalMs() {
  const configured = Number(process.env.LICENSE_STATUS_REFRESH_INTERVAL_MS ?? "");
  return Number.isFinite(configured) && configured >= 0 ? configured : 60_000;
}

export function normalizeActivationCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function hashActivationCode(value: string) {
  return createHash("sha256").update(normalizeActivationCode(value)).digest("hex");
}

export function normalizeMachineHash(value?: string) {
  return String(value ?? "").trim().slice(0, 160);
}

export function normalizeLicenseText(value?: string) {
  return String(value ?? "").trim().slice(0, 240);
}

export function createActivationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `NW-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}`;
}

export function previewActivationCode(code: string) {
  const normalized = normalizeActivationCode(code);
  return normalized.length > 8 ? `${normalized.slice(0, 3)}...${normalized.slice(-4)}` : normalized;
}

export function normalizeLicenseStatus(status: unknown): StoredLicenseCode["status"] {
  return status === "used" || status === "disabled" || status === "expired" ? status : "unused";
}

export function toUsedStatus(status: unknown): StoredLicenseCode["status"] {
  return status === "disabled" || status === "expired" ? (status as StoredLicenseCode["status"]) : "used";
}

export function syncLegacyConfiguredCodes(store: AppStore) {
  const timestamp = now();
  const existing = new Set(store.licenseCodes.map((item) => item.codeHash));

  for (const code of getConfiguredActivationCodes()) {
    const codeHash = hashActivationCode(code);
    if (existing.has(codeHash)) {
      continue;
    }
    store.licenseCodes.push({
      id: randomUUID(),
      codeHash,
      codePreview: previewActivationCode(code),
      customerName: "本地演示授权",
      customerContact: "",
      status: "unused",
      maxActivations: 1,
      activationCount: 0,
      notes: "由 APP_ACTIVATION_CODES 自动导入",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    existing.add(codeHash);
  }

  for (const codeHash of getConfiguredActivationCodeHashes()) {
    if (existing.has(codeHash)) {
      continue;
    }
    store.licenseCodes.push({
      id: randomUUID(),
      codeHash,
      codePreview: `${codeHash.slice(0, 6)}...`,
      customerName: "本地演示授权",
      customerContact: "",
      status: "unused",
      maxActivations: 1,
      activationCount: 0,
      notes: "由 APP_ACTIVATION_CODE_HASHES 自动导入",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    existing.add(codeHash);
  }
}

function getConfiguredActivationCodes() {
  return String(process.env.APP_ACTIVATION_CODES ?? process.env.APP_ACTIVATION_CODE ?? "")
    .split(/[\n,，]/)
    .map(normalizeActivationCode)
    .filter(Boolean);
}

function getConfiguredActivationCodeHashes() {
  return String(process.env.APP_ACTIVATION_CODE_HASHES ?? "")
    .split(/[\n,，]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const ROUTINE_LICENSE_CHECK_CLIENT = "本地客户端状态校验";
const ROUTINE_LICENSE_LOG_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_OFFLINE_GRACE_DAYS = 7;

function isRoutineLicenseCheck(clientName?: string) {
  return normalizeLicenseText(clientName) === ROUTINE_LICENSE_CHECK_CLIENT;
}

function sameLicenseLogScope(
  log: StoredLicenseActivationLog,
  input: {
    licenseCodeId?: string;
    codeHash: string;
    machineHash: string;
    result: StoredLicenseActivationLog["result"];
    reason: string;
    clientName?: string;
  }
) {
  return (
    log.licenseCodeId === input.licenseCodeId &&
    log.codeHash === input.codeHash &&
    (log.machineHash ?? "") === input.machineHash &&
    log.result === input.result &&
    log.reason === input.reason &&
    normalizeLicenseText(log.clientName) === normalizeLicenseText(input.clientName)
  );
}

function shouldAppendLicenseLog(
  logs: StoredLicenseActivationLog[],
  input: {
    licenseCodeId?: string;
    codeHash: string;
    machineHash: string;
    result: StoredLicenseActivationLog["result"];
    reason: string;
    clientName?: string;
    createdAt: string;
  }
) {
  if (!isRoutineLicenseCheck(input.clientName)) {
    return true;
  }

  const latestSameLog = logs.find((log) => sameLicenseLogScope(log, input));
  const latestTime = latestSameLog?.createdAt ? Date.parse(latestSameLog.createdAt) : NaN;
  const currentTime = Date.parse(input.createdAt);

  if (!Number.isFinite(latestTime) || !Number.isFinite(currentTime)) {
    return true;
  }

  return currentTime - latestTime > ROUTINE_LICENSE_LOG_WINDOW_MS;
}

function compactRoutineLicenseLogs(logs: StoredLicenseActivationLog[]) {
  const seen = new Set<string>();
  const compacted: StoredLicenseActivationLog[] = [];

  for (const log of logs) {
    if (!isRoutineLicenseCheck(log.clientName)) {
      compacted.push(log);
      continue;
    }

    const key = [
      log.licenseCodeId ?? "",
      log.codeHash,
      log.machineHash ?? "",
      log.result,
      log.reason,
      normalizeLicenseText(log.clientName)
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    compacted.push(log);
  }

  return compacted;
}

function getOfflineGraceMs() {
  const days = Number(process.env.LICENSE_OFFLINE_GRACE_DAYS ?? DEFAULT_OFFLINE_GRACE_DAYS);
  const safeDays = Number.isFinite(days) ? Math.max(0, Math.min(30, days)) : DEFAULT_OFFLINE_GRACE_DAYS;
  return safeDays * 24 * 60 * 60 * 1000;
}

function isTransientLicenseCenterError(message: string) {
  return [
    "无法连接授权中心",
    "连接授权中心超时",
    "fetch failed",
    "ECONN",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "socket hang up"
  ].some((keyword) => message.includes(keyword));
}

function resolveOfflineGraceState(
  store: AppStore,
  user: StoredUser,
  fallbackState: DesktopLicenseState,
  message: string
): DesktopLicenseState | null {
  if (fallbackState.status !== "active" || !isTransientLicenseCenterError(message)) {
    return null;
  }

  const license = user.licenseCodeHash
    ? store.licenseCodes.find((item) => item.codeHash === user.licenseCodeHash)
    : null;
  const verifiedAt = license?.lastVerifiedAt ?? user.licenseActivatedAt ?? license?.activatedAt ?? "";
  const verifiedTime = verifiedAt ? Date.parse(verifiedAt) : NaN;
  const graceMs = getOfflineGraceMs();

  if (!Number.isFinite(verifiedTime) || graceMs <= 0 || Date.now() - verifiedTime > graceMs) {
    return null;
  }

  return {
    ...fallbackState,
    status: "active",
    message: `暂时无法连接授权中心，已进入离线宽限期。上次校验：${new Date(verifiedAt).toLocaleString("zh-CN")}`,
    changed: false
  };
}

export function isValidActivationCode(code: string) {
  const normalized = normalizeActivationCode(code);
  const codeHash = hashActivationCode(normalized);
  const plainCodes = getConfiguredActivationCodes();
  const hashedCodes = getConfiguredActivationCodeHashes();

  if (plainCodes.length === 0 && hashedCodes.length === 0) {
    throw new Error("未配置激活码，请先设置 APP_ACTIVATION_CODES");
  }

  return plainCodes.includes(normalized) || hashedCodes.includes(codeHash);
}

export function activationEmail(customerId: string) {
  const safeId = customerId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "customer";
  return `${safeId}@license.local`;
}

export function getLicenseServerUrl() {
  return String(process.env.LICENSE_SERVER_URL ?? "").trim().replace(/\/+$/, "");
}

function getLicenseServerProxyAgent() {
  const proxyUrl = String(process.env.LICENSE_SERVER_PROXY ?? "").trim();

  if (!proxyUrl) {
    return null;
  }

  return new SocksProxyAgent(proxyUrl);
}

function postJsonWithSocksProxy(input: {
  url: string;
  payload: Record<string, unknown>;
  timeoutMs: number;
  agent: SocksProxyAgent;
}) {
  const target = new URL(input.url);
  const body = JSON.stringify(input.payload);

  return new Promise<{ ok: boolean; status: number; body: unknown }>((resolve, reject) => {
    const request = httpsRequest(
      target,
      {
        method: "POST",
        agent: input.agent,
        timeout: input.timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          let parsed: unknown = null;

          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }

          resolve({ ok: status >= 200 && status < 300, status, body: parsed });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function readRemoteLicenseErrorMessage(body: unknown) {
  if (body && typeof body === "object" && "error" in body) {
    return String((body as { error: unknown }).error);
  }

  if (typeof body === "string" && body.trim()) {
    return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
  }

  return "授权中心验证失败";
}

export async function activateLicenseViaRemoteCenter(input: LicenseActivationInput) {
  const serverUrl = getLicenseServerUrl();

  if (!serverUrl) {
    return null;
  }

  const timeoutMs = Number(process.env.LICENSE_SERVER_TIMEOUT_MS ?? 30000);
  const url = serverUrl + "/api/license/activate";
  const payload = {
    activationCode: input.activationCode,
    machineHash: input.machineHash,
    clientName: input.clientName,
    centerOnly: true
  };
  const proxyAgent = getLicenseServerProxyAgent();
  let result: { ok: boolean; status: number; body: unknown };

  try {
    if (proxyAgent) {
      result = await postJsonWithSocksProxy({ url, payload, timeoutMs, agent: proxyAgent });
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
          signal: controller.signal
        });
        const raw = await response.text();
        let body: unknown = null;

        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = raw;
        }

        result = {
          ok: response.ok,
          status: response.status,
          body
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    const isTimeout = error instanceof Error && (error.name === "AbortError" || message === "timeout");
    const proxyHint = proxyAgent ? "，当前代理：" + process.env.LICENSE_SERVER_PROXY : "";
    throw new Error(isTimeout ? "连接授权中心超时：" + serverUrl + proxyHint : "无法连接授权中心：" + serverUrl + proxyHint + "，" + message);
  }

  if (!result.ok) {
    throw new Error(readRemoteLicenseErrorMessage(result.body));
  }

  return (result.body as { license?: LicenseActivationResult } | null)?.license as LicenseActivationResult;
}

export async function verifyLicenseViaRemoteCenter(input: LicenseVerificationInput) {
  const serverUrl = getLicenseServerUrl();

  if (!serverUrl) {
    return null;
  }

  const timeoutMs = Number(process.env.LICENSE_SERVER_TIMEOUT_MS ?? 30000);
  const url = serverUrl + "/api/license/verify";
  const payload = {
    licenseId: input.licenseId,
    codeHash: input.codeHash,
    machineHash: input.machineHash,
    clientName: input.clientName
  };
  const proxyAgent = getLicenseServerProxyAgent();
  let result: { ok: boolean; status: number; body: unknown };

  try {
    if (proxyAgent) {
      result = await postJsonWithSocksProxy({ url, payload, timeoutMs, agent: proxyAgent });
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
          signal: controller.signal
        });
        const raw = await response.text();
        let body: unknown = null;

        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = raw;
        }

        result = {
          ok: response.ok,
          status: response.status,
          body
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    const isTimeout = error instanceof Error && (error.name === "AbortError" || message === "timeout");
    const proxyHint = proxyAgent ? "，当前代理：" + process.env.LICENSE_SERVER_PROXY : "";
    throw new Error(isTimeout ? "连接授权中心超时：" + serverUrl + proxyHint : "无法连接授权中心：" + serverUrl + proxyHint + "，" + message);
  }

  if (!result.ok) {
    throw new Error(readRemoteLicenseErrorMessage(result.body));
  }

  return (result.body as { license?: LicenseActivationResult } | null)?.license as LicenseActivationResult;
}

export function getDesktopLicenseCandidate(store: AppStore) {
  const candidates = store.users
    .filter((item) => Boolean(item.licenseCustomerId || item.licenseCodeHash))
    .filter((item) => !item.licenseSignedOutAt)
    .slice()
    .sort((a, b) => {
      const left = a.licenseActivatedAt ?? a.updatedAt ?? a.createdAt;
      const right = b.licenseActivatedAt ?? b.updatedAt ?? b.createdAt;
      return right.localeCompare(left);
    });

  let firstState: DesktopLicenseState | null = null;
  let changed = false;

  for (const candidate of candidates) {
    const state = resolveDesktopLicenseState(store, candidate);
    if (state.changed) {
      changed = true;
    }

    if (!firstState) {
      firstState = state;
    }

    if (state.status === "active") {
      return { user: candidate, state, changed };
    }
  }

  return {
    user: candidates[0] ?? null,
    state: firstState ?? { status: "inactive", changed: false },
    changed
  };
}

export function resolveDesktopLicenseState(store: AppStore, user: StoredUser): DesktopLicenseState {
  const timestamp = now();

  if (user.licenseSignedOutAt) {
    return {
      status: "inactive",
      message: "已退出本机授权，请重新输入激活码",
      changed: false
    };
  }

  const codeHash = user.licenseCodeHash?.trim() ?? "";

  if (!codeHash) {
    const expiresAt = user.licenseExpiresAt?.trim();
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      return {
        status: "expired",
        expiresAt,
        message: "体验已到期",
        changed: false
      };
    }

    return {
      status: "active",
      expiresAt,
      changed: false
    };
  }

  const license = store.licenseCodes.find((item) => item.codeHash === codeHash) ?? null;

  if (!license) {
    return {
      status: "missing",
      message: "授权信息不存在，请联系管理员重新下发",
      changed: false
    };
  }

  const resolvedExpiresAt = license.expiresAt ?? user.licenseExpiresAt;

  if (license.status === "disabled") {
    return {
      status: "disabled",
      expiresAt: resolvedExpiresAt,
      message: "授权已被管理员禁用",
      changed: false
    };
  }

  if (license.status === "expired" || (resolvedExpiresAt && Date.parse(resolvedExpiresAt) <= Date.now())) {
    if (license.status !== "expired") {
      license.status = "expired";
      license.updatedAt = timestamp;
    }

    if (resolvedExpiresAt && user.licenseExpiresAt !== resolvedExpiresAt) {
      user.licenseExpiresAt = resolvedExpiresAt;
      user.updatedAt = timestamp;
    }

    return {
      status: "expired",
      expiresAt: resolvedExpiresAt,
      message: "体验已到期",
      changed: true
    };
  }

  let changed = false;

  if (resolvedExpiresAt && user.licenseExpiresAt !== resolvedExpiresAt) {
    user.licenseExpiresAt = resolvedExpiresAt;
    user.updatedAt = timestamp;
    changed = true;
  }

  return {
    status: "active",
    expiresAt: resolvedExpiresAt,
    changed
  };
}

export async function refreshDesktopLicenseStateFromRemoteCenter(
  store: AppStore,
  user: StoredUser,
  fallbackState: DesktopLicenseState
): Promise<DesktopLicenseState> {
  if (!isDesktopRuntime() || !getLicenseServerUrl() || (!user.licenseCustomerId && !user.licenseCodeHash)) {
    return fallbackState;
  }

  if (fallbackState.status === "active") {
    const license = user.licenseCodeHash
      ? store.licenseCodes.find((item) => item.codeHash === user.licenseCodeHash)
      : null;
    const lastVerifiedAt = license?.lastVerifiedAt ?? user.licenseActivatedAt ?? "";
    const lastVerifiedTime = lastVerifiedAt ? Date.parse(lastVerifiedAt) : NaN;
    const refreshIntervalMs = getLicenseStatusRefreshIntervalMs();

    if (refreshIntervalMs > 0 && Number.isFinite(lastVerifiedTime) && Date.now() - lastVerifiedTime < refreshIntervalMs) {
      return fallbackState;
    }
  }

  try {
    const license = await verifyLicenseViaRemoteCenter({
      licenseId: user.licenseCustomerId,
      codeHash: user.licenseCodeHash,
      machineHash: user.licenseMachineHash,
      clientName: "本地客户端状态校验"
    });

    if (!license) {
      return fallbackState;
    }

    const timestamp = now();

    if (user.licenseCodeHash) {
      syncLocalLicenseSnapshot(store, {
        license,
        codeHash: user.licenseCodeHash,
        machineHash: user.licenseMachineHash
      });
    }

    user.licenseCustomerId = user.licenseCustomerId || license.customerId;
    user.licenseActivatedAt = user.licenseActivatedAt || license.activatedAt || timestamp;
    user.licenseExpiresAt = license.expiresAt || undefined;
    user.updatedAt = timestamp;

    return {
      ...resolveDesktopLicenseState(store, user),
      changed: true
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "授权中心状态校验失败";
    const graceState = resolveOfflineGraceState(store, user, fallbackState, message);

    if (graceState) {
      return graceState;
    }

    const status: DesktopLicenseState["status"] =
      message.includes("禁用")
        ? "disabled"
        : message.includes("到期") || message.includes("过期")
          ? "expired"
          : "missing";

    if (user.licenseCodeHash) {
      const license = store.licenseCodes.find((item) => item.codeHash === user.licenseCodeHash);
      if (license && (status === "disabled" || status === "expired")) {
        license.status = status;
        license.updatedAt = now();
        return {
          status,
          expiresAt: license.expiresAt ?? user.licenseExpiresAt,
          message,
          changed: true
        };
      }
    }

    return {
      status,
      expiresAt: user.licenseExpiresAt,
      message,
      changed: false
    };
  }
}

export function syncLocalLicenseSnapshot(
  store: AppStore,
  input: {
    license: LicenseActivationResult;
    codeHash: string;
    machineHash?: string;
  }
) {
  const timestamp = now();
  const licenseId = input.license.licenseId || input.license.customerId || randomUUID();
  let record = store.licenseCodes.find(
    (item) => item.id === licenseId || item.codeHash === input.codeHash
  );

  if (!record) {
    record = {
      id: licenseId,
      codeHash: input.codeHash,
      codePreview: input.license.codePreview || `${input.codeHash.slice(0, 6)}...`,
      customerName: input.license.customerName,
      customerContact: input.license.customerContact,
      status: toUsedStatus(input.license.status),
      maxActivations: 1,
      activationCount: 1,
      machineHash: input.machineHash,
      activatedAt: input.license.activatedAt || timestamp,
      lastVerifiedAt: timestamp,
      expiresAt: input.license.expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.licenseCodes.push(record);
    return;
  }

  record.status = toUsedStatus(input.license.status);
  record.codePreview = input.license.codePreview || record.codePreview;
  record.customerName = input.license.customerName ?? record.customerName;
  record.customerContact = input.license.customerContact ?? record.customerContact;
  record.activationCount = Math.max(record.activationCount, 1);
  record.machineHash = input.machineHash || record.machineHash;
  record.activatedAt = record.activatedAt ?? input.license.activatedAt ?? timestamp;
  record.lastVerifiedAt = timestamp;
  record.expiresAt = input.license.expiresAt;
  record.updatedAt = timestamp;
}

export async function activateLicenseWithCenter(input: LicenseActivationInput): Promise<LicenseActivationResult> {
  const normalizedCode = normalizeActivationCode(input.activationCode);
  const machineHash = normalizeMachineHash(input.machineHash);

  if (!normalizedCode) {
    throw new Error("请填写授权码");
  }

  if (!machineHash) {
    throw new Error("缺少本机安装标识，请刷新后重试");
  }

  const codeHash = hashActivationCode(normalizedCode);
  const clientName = normalizeLicenseText(input.clientName);

  const store = await readStore();
  syncLegacyConfiguredCodes(store);

  const timestamp = now();
  const license = store.licenseCodes.find((item) => item.codeHash === codeHash);

  function log(result: StoredLicenseActivationLog["result"], reason: string) {
    const entry = {
      id: randomUUID(),
      licenseCodeId: license?.id,
      codeHash,
      machineHash,
      result,
      reason,
      clientName,
      createdAt: timestamp
    };

    if (!shouldAppendLicenseLog(store.licenseActivationLogs, entry)) {
      return;
    }

    store.licenseActivationLogs.unshift(entry);
    store.licenseActivationLogs = store.licenseActivationLogs.slice(0, 300);
  }

  if (!license) {
    log("failed", "not_found");
    await writeStore(store);
    throw new Error("授权码不存在，请检查后重试");
  }

  if (license.status === "disabled") {
    log("failed", "disabled");
    await writeStore(store);
    throw new Error("该授权码已被禁用");
  }

  if (license.expiresAt && Date.parse(license.expiresAt) <= Date.now()) {
    license.status = "expired";
    license.updatedAt = timestamp;
    log("failed", "expired");
    await writeStore(store);
    throw new Error("授权码已过期");
  }

  if (license.status !== "unused" || license.activationCount > 0) {
    if (license.status === "used" && license.machineHash && license.machineHash === machineHash) {
      license.lastVerifiedAt = timestamp;
      license.updatedAt = timestamp;
      log("success", "verified");
      await writeStore(store);

      return {
        licenseId: license.id,
        customerId: license.id,
        codePreview: license.codePreview,
        status: license.status,
        activatedAt: license.activatedAt ?? timestamp,
        expiresAt: license.expiresAt,
        isTrial: Boolean(license.expiresAt),
        customerName: license.customerName,
        customerContact: license.customerContact
      };
    }

    if (license.status === "used" && license.machineHash && license.machineHash !== machineHash) {
      log("failed", "already_bound_other_machine");
      await writeStore(store);
      throw new Error("该授权已绑定其他设备，请联系管理员解绑后再激活");
    }

    if (license.status === "used" && !license.machineHash) {
      license.machineHash = machineHash;
      license.activationCount = 1;
      license.activatedAt = license.activatedAt ?? timestamp;
      license.lastVerifiedAt = timestamp;
      license.updatedAt = timestamp;
      log("success", "activated");
      await writeStore(store);

      return {
        licenseId: license.id,
        customerId: license.id,
        codePreview: license.codePreview,
        status: license.status,
        activatedAt: license.activatedAt,
        expiresAt: license.expiresAt,
        isTrial: Boolean(license.expiresAt),
        customerName: license.customerName,
        customerContact: license.customerContact
      };
    }

    log("failed", "already_used");
    await writeStore(store);
    throw new Error("该授权码已绑定设备，请联系管理员解绑后再激活");
  }

  license.status = "used";
  license.activationCount = 1;
  license.machineHash = machineHash;
  license.activatedAt = license.activatedAt ?? timestamp;
  license.lastVerifiedAt = timestamp;
  license.updatedAt = timestamp;
  log("success", "activated");
  await writeStore(store);

  return {
    licenseId: license.id,
    customerId: license.id,
    codePreview: license.codePreview,
    status: license.status,
    activatedAt: license.activatedAt,
    expiresAt: license.expiresAt,
    isTrial: Boolean(license.expiresAt),
    customerName: license.customerName,
    customerContact: license.customerContact
  };
}

export async function verifyLicenseWithCenter(input: LicenseVerificationInput): Promise<LicenseActivationResult> {
  const licenseId = String(input.licenseId ?? "").trim();
  const codeHash = String(input.codeHash ?? "").trim().toLowerCase();
  const machineHash = normalizeMachineHash(input.machineHash);
  const clientName = normalizeLicenseText(input.clientName);

  if (!licenseId && !codeHash) {
    throw new Error("缺少授权状态标识");
  }

  const store = await readStore();
  const timestamp = now();
  const license = store.licenseCodes.find(
    (item) => (licenseId && item.id === licenseId) || (codeHash && item.codeHash === codeHash)
  );

  function log(result: StoredLicenseActivationLog["result"], reason: string) {
    const entry = {
      id: randomUUID(),
      licenseCodeId: license?.id,
      codeHash: license?.codeHash ?? codeHash,
      machineHash,
      result,
      reason,
      clientName,
      createdAt: timestamp
    };

    if (!shouldAppendLicenseLog(store.licenseActivationLogs, entry)) {
      return;
    }

    store.licenseActivationLogs.unshift(entry);
    store.licenseActivationLogs = store.licenseActivationLogs.slice(0, 300);
  }

  if (!license) {
    log("failed", "not_found");
    await writeStore(store);
    throw new Error("授权状态已失效，请重新激活");
  }

  if (license.status === "disabled") {
    log("failed", "disabled");
    await writeStore(store);
    throw new Error("授权已被管理员禁用");
  }

  if (license.expiresAt && Date.parse(license.expiresAt) <= Date.now()) {
    license.status = "expired";
    license.updatedAt = timestamp;
    log("failed", "expired");
    await writeStore(store);
    throw new Error("体验已到期");
  }

  if (license.status !== "used") {
    log("failed", "not_activated");
    await writeStore(store);
    throw new Error("授权状态已失效，请重新激活");
  }

  if (license.machineHash && machineHash && license.machineHash !== machineHash) {
    log("failed", "already_bound_other_machine");
    await writeStore(store);
    throw new Error("该授权已绑定其他设备");
  }

  if (!license.machineHash && machineHash) {
    license.machineHash = machineHash;
  }

  license.lastVerifiedAt = timestamp;
  license.updatedAt = timestamp;
  await writeStore(store);

  return {
    licenseId: license.id,
    customerId: license.id,
    codePreview: license.codePreview,
    status: license.status,
    activatedAt: license.activatedAt ?? timestamp,
    expiresAt: license.expiresAt,
    isTrial: Boolean(license.expiresAt),
    customerName: license.customerName,
    customerContact: license.customerContact
  };
}

export function buildAdminLicenseCenter(
  store: AppStore,
  options?: { recentLogLimit?: number; recentLogOffset?: number }
): AdminLicenseCenterSummary {
  syncLegacyConfiguredCodes(store);
  const nowTime = Date.now();
  const recentLogLimit = Math.max(1, Math.min(200, Math.floor(Number(options?.recentLogLimit ?? 20)) || 20));
  const recentLogOffset = Math.max(0, Math.floor(Number(options?.recentLogOffset ?? 0)) || 0);

  store.licenseCodes.forEach((license) => {
    if (license.status !== "disabled" && license.expiresAt && Date.parse(license.expiresAt) <= nowTime) {
      license.status = "expired";
    }
  });

  const allLogs = compactRoutineLicenseLogs(store.licenseActivationLogs.filter((log) => log.reason !== "verified"));
  const recentLogCount = allLogs.length;
  const recentLogs = allLogs.slice(recentLogOffset, recentLogOffset + recentLogLimit);
  const licenses = store.licenseCodes
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((license) => ({
      id: license.id,
      plainCode: license.plainCode,
      codePreview: license.codePreview,
      customerName: license.customerName ?? "",
      customerContact: license.customerContact ?? "",
      status: normalizeLicenseStatus(license.status),
      maxActivations: license.maxActivations,
      activationCount: license.activationCount,
      machineHash: license.machineHash,
      activatedAt: license.activatedAt,
      lastVerifiedAt: license.lastVerifiedAt,
      expiresAt: license.expiresAt,
      disabledAt: license.disabledAt,
      notes: license.notes,
      createdAt: license.createdAt,
      updatedAt: license.updatedAt,
      recentLogs: allLogs
        .filter((log) => log.licenseCodeId === license.id)
        .slice(0, 3)
    }));

  return {
    total: store.licenseCodes.length,
    unused: store.licenseCodes.filter((item) => item.status === "unused").length,
    active: store.licenseCodes.filter((item) => item.status === "used").length,
    disabled: store.licenseCodes.filter((item) => item.status === "disabled").length,
    expired: store.licenseCodes.filter((item) => item.status === "expired").length,
    recentLogCount,
    recentLogs,
    licenses
  };
}
