import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import packageJson from "../../package.json";
import { isDesktopRuntime } from "@/lib/app-runtime";

export type AppDownloadKey = "win32X64" | "darwinArm64" | "darwinX64" | "generic";

export type AppUpdateFile = {
  label?: string;
  fileName?: string;
  url?: string;
  sizeBytes?: number;
  sha256?: string;
  platform?: string;
  arch?: string;
};

export type AppUpdateDownloads = {
  win32X64?: string;
  darwinArm64?: string;
  darwinX64?: string;
  generic?: string;
};

const downloadTargets: Record<string, AppDownloadKey> = {
  windows: "win32X64",
  "win-x64": "win32X64",
  "win32-x64": "win32X64",
  "mac-arm64": "darwinArm64",
  "darwin-arm64": "darwinArm64",
  "mac-apple": "darwinArm64",
  "mac-x64": "darwinX64",
  "darwin-x64": "darwinX64",
  "mac-intel": "darwinX64",
  generic: "generic"
};

const downloadKeyPaths: Record<AppDownloadKey, string> = {
  win32X64: "/api/download/windows",
  darwinArm64: "/api/download/mac-arm64",
  darwinX64: "/api/download/mac-x64",
  generic: "/api/download/generic"
};

export type AppUpdateManifest = {
  productName: string;
  version: string;
  notes: string;
  announcement?: string;
  releaseDate: string;
  required: boolean;
  downloads: AppUpdateDownloads;
  files?: {
    win32X64?: AppUpdateFile;
    darwinArm64?: AppUpdateFile;
    darwinX64?: AppUpdateFile;
    generic?: AppUpdateFile;
  };
};

export type AppUpdateCheckResult = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  required: boolean;
  notes: string;
  announcement?: string;
  releaseDate: string;
  downloadUrl: string;
  downloadPageUrl: string;
  file?: AppUpdateFile;
  platform: NodeJS.Platform | string;
  arch: NodeJS.Architecture | string;
  checkedAt: string;
  source: string;
  error?: string;
};

function cleanVersion(value: unknown) {
  return String(value ?? "").trim().replace(/^v/i, "");
}

function envFlag(value: string | undefined) {
  return ["1", "true", "yes", "y", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function normalizeNotes(value: string | undefined) {
  return String(value ?? "").trim();
}

function normalizeUrl(value: string | undefined) {
  const text = String(value ?? "").trim();
  return /^https?:\/\//i.test(text) || text.startsWith("/") ? text : "";
}

function withBaseUrl(pathname: string, baseUrl?: string) {
  const base = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}${pathname}` : pathname;
}

export function getCurrentAppVersion() {
  return cleanVersion(packageJson.version) || "0.0.0";
}

function normalizeSize(value: unknown) {
  const size = Number(value ?? 0);
  return Number.isFinite(size) && size > 0 ? Math.round(size) : undefined;
}

export function compareAppVersions(left: string, right: string) {
  const leftParts = cleanVersion(left).split(/[.-]/).map((item) => Number.parseInt(item, 10));
  const rightParts = cleanVersion(right).split(/[.-]/).map((item) => Number.parseInt(item, 10));
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function normalizeFile(value: unknown): AppUpdateFile | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Record<string, unknown>;

  return {
    label: readString(raw, "label"),
    fileName: readString(raw, "fileName"),
    url: normalizeUrl(readString(raw, "url")),
    sizeBytes: normalizeSize(raw.sizeBytes),
    sha256: readString(raw, "sha256"),
    platform: readString(raw, "platform"),
    arch: readString(raw, "arch")
  };
}

function getEnvUpdateManifest(): AppUpdateManifest {
  const fallbackVersion = getCurrentAppVersion();

  return {
    productName: "AI 网文写作助手",
    version: cleanVersion(process.env.APP_LATEST_VERSION) || fallbackVersion,
    notes: normalizeNotes(process.env.APP_LATEST_RELEASE_NOTES) || "当前暂无新版说明。",
    announcement: normalizeNotes(process.env.APP_RELEASE_ANNOUNCEMENT),
    releaseDate: normalizeNotes(process.env.APP_LATEST_RELEASE_DATE) || new Date().toISOString(),
    required: envFlag(process.env.APP_UPDATE_REQUIRED),
    downloads: {
      win32X64: normalizeUrl(process.env.APP_UPDATE_DOWNLOAD_WIN_URL),
      darwinArm64: normalizeUrl(process.env.APP_UPDATE_DOWNLOAD_MAC_ARM64_URL),
      darwinX64: normalizeUrl(process.env.APP_UPDATE_DOWNLOAD_MAC_X64_URL),
      generic: normalizeUrl(process.env.APP_UPDATE_DOWNLOAD_URL)
    }
  };
}

function readPublishedManifest() {
  const manifestPath = getPublishedManifestPath();

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    return normalizeManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  } catch {
    return null;
  }
}

export function getLocalUpdateManifest(): AppUpdateManifest {
  return readPublishedManifest() ?? getEnvUpdateManifest();
}

export function resolveAppDownloadKey(value: string | undefined | null): AppDownloadKey | null {
  const key = String(value ?? "").trim();

  if (key === "win32X64" || key === "darwinArm64" || key === "darwinX64" || key === "generic") {
    return key;
  }

  return downloadTargets[key.toLowerCase()] ?? null;
}

export function getAppDownloadPath(key: AppDownloadKey) {
  return downloadKeyPaths[key];
}

export function getAppDownloadUrl(key: AppDownloadKey, baseUrl?: string) {
  return withBaseUrl(getAppDownloadPath(key), baseUrl);
}

export function getAppDownloadKeyForPlatform(platform: string, arch: string): AppDownloadKey {
  if (platform === "win32" && arch === "x64") {
    return "win32X64";
  }

  if (platform === "darwin" && arch === "arm64") {
    return "darwinArm64";
  }

  if (platform === "darwin" && arch === "x64") {
    return "darwinX64";
  }

  return "generic";
}

export function getManifestDownloadUrl(manifest: AppUpdateManifest, key: AppDownloadKey) {
  return manifest.downloads[key] || manifest.files?.[key]?.url || manifest.downloads.generic || manifest.files?.generic?.url || "";
}

export function toPublicUpdateManifest(manifest: AppUpdateManifest, baseUrl?: string): AppUpdateManifest {
  const rewriteFile = (key: AppDownloadKey, file?: AppUpdateFile): AppUpdateFile | undefined => {
    if (!file) {
      return undefined;
    }

    return {
      ...file,
      url: getAppDownloadUrl(key, baseUrl)
    };
  };

  return {
    ...manifest,
    downloads: {
      win32X64: getManifestDownloadUrl(manifest, "win32X64") ? getAppDownloadUrl("win32X64", baseUrl) : "",
      darwinArm64: getManifestDownloadUrl(manifest, "darwinArm64") ? getAppDownloadUrl("darwinArm64", baseUrl) : "",
      darwinX64: getManifestDownloadUrl(manifest, "darwinX64") ? getAppDownloadUrl("darwinX64", baseUrl) : "",
      generic: getManifestDownloadUrl(manifest, "generic") ? getAppDownloadUrl("generic", baseUrl) : ""
    },
    files: {
      win32X64: rewriteFile("win32X64", manifest.files?.win32X64),
      darwinArm64: rewriteFile("darwinArm64", manifest.files?.darwinArm64),
      darwinX64: rewriteFile("darwinX64", manifest.files?.darwinX64),
      generic: rewriteFile("generic", manifest.files?.generic)
    }
  };
}

function getPublishedManifestPath() {
  return path.join(process.cwd(), "public", "downloads", "manifest.json");
}

function readString(source: Record<string, unknown>, key: string) {
  return typeof source[key] === "string" ? String(source[key]) : "";
}

function normalizeManifest(value: unknown): AppUpdateManifest {
  if (!value || typeof value !== "object") {
    return getLocalUpdateManifest();
  }

  const raw = value as Record<string, unknown>;
  const rawDownloads = raw.downloads && typeof raw.downloads === "object"
    ? raw.downloads as Record<string, unknown>
    : {};
  const fallback = getEnvUpdateManifest();
  const files = raw.files && typeof raw.files === "object"
    ? raw.files as Record<string, unknown>
    : {};

  return {
    productName: readString(raw, "productName") || fallback.productName,
    version: cleanVersion(raw.version) || fallback.version,
    notes: readString(raw, "notes") || fallback.notes,
    announcement: readString(raw, "announcement") || fallback.announcement,
    releaseDate: readString(raw, "releaseDate") || fallback.releaseDate,
    required: raw.required === true,
    downloads: {
      win32X64: normalizeUrl(readString(rawDownloads, "win32X64")),
      darwinArm64: normalizeUrl(readString(rawDownloads, "darwinArm64")),
      darwinX64: normalizeUrl(readString(rawDownloads, "darwinX64")),
      generic: normalizeUrl(readString(rawDownloads, "generic"))
    },
    files: {
      win32X64: normalizeFile(files.win32X64),
      darwinArm64: normalizeFile(files.darwinArm64),
      darwinX64: normalizeFile(files.darwinX64),
      generic: normalizeFile(files.generic)
    }
  };
}

export function updateLocalUpdateManifest(input: {
  version?: string;
  notes?: string;
  announcement?: string;
  releaseDate?: string;
  required?: boolean;
}) {
  const current = getLocalUpdateManifest();
  const next: AppUpdateManifest = {
    ...current,
    version: cleanVersion(input.version) || current.version,
    notes: normalizeNotes(input.notes) || current.notes,
    announcement: normalizeNotes(input.announcement),
    releaseDate: normalizeNotes(input.releaseDate) || current.releaseDate || new Date().toISOString(),
    required: Boolean(input.required)
  };
  const manifestPath = getPublishedManifestPath();

  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(next, null, 2), "utf8");

  return next;
}

function getRemoteManifestUrl() {
  const configured = normalizeUrl(process.env.APP_UPDATE_MANIFEST_URL);

  if (configured) {
    return configured;
  }

  const licenseServerUrl = String(process.env.LICENSE_SERVER_URL ?? "").trim().replace(/\/+$/, "");
  return licenseServerUrl ? `${licenseServerUrl}/api/app/update/manifest` : "";
}

function getDownloadPageUrl() {
  const configured = normalizeUrl(process.env.APP_DOWNLOAD_PAGE_URL);

  if (configured) {
    return configured;
  }

  const licenseServerUrl = String(process.env.LICENSE_SERVER_URL ?? "").trim().replace(/\/+$/, "");
  return licenseServerUrl ? `${licenseServerUrl}/download` : "/download";
}

function pickDownloadUrl(manifest: AppUpdateManifest, platform: string, arch: string) {
  if (platform === "win32" && arch === "x64") {
    return manifest.downloads.win32X64 || manifest.downloads.generic || "";
  }

  if (platform === "darwin" && arch === "arm64") {
    return manifest.downloads.darwinArm64 || manifest.downloads.generic || "";
  }

  if (platform === "darwin" && arch === "x64") {
    return manifest.downloads.darwinX64 || manifest.downloads.generic || "";
  }

  return manifest.downloads.generic || "";
}

function pickDownloadFile(manifest: AppUpdateManifest, platform: string, arch: string) {
  if (platform === "win32" && arch === "x64") {
    return manifest.files?.win32X64 ?? manifest.files?.generic;
  }

  if (platform === "darwin" && arch === "arm64") {
    return manifest.files?.darwinArm64 ?? manifest.files?.generic;
  }

  if (platform === "darwin" && arch === "x64") {
    return manifest.files?.darwinX64 ?? manifest.files?.generic;
  }

  return manifest.files?.generic;
}

async function fetchRemoteManifest(url: string) {
  const timeoutMs = Number(process.env.APP_UPDATE_CHECK_TIMEOUT_MS ?? process.env.LICENSE_SERVER_TIMEOUT_MS ?? 10000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 10000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`更新服务返回 ${response.status}`);
    }

    return normalizeManifest(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkAppUpdate(input?: { platform?: string; arch?: string }): Promise<AppUpdateCheckResult> {
  const currentVersion = getCurrentAppVersion();
  const platform = input?.platform || process.platform;
  const arch = input?.arch || process.arch;
  const checkedAt = new Date().toISOString();
  const remoteUrl = isDesktopRuntime() ? getRemoteManifestUrl() : "";
  const downloadPageUrl = getDownloadPageUrl();

  try {
    const manifest = remoteUrl ? await fetchRemoteManifest(remoteUrl) : getLocalUpdateManifest();
    const latestVersion = manifest.version || currentVersion;
    const hasUpdate = compareAppVersions(latestVersion, currentVersion) > 0;

    return {
      currentVersion,
      latestVersion,
      hasUpdate,
      required: manifest.required,
      notes: manifest.notes,
      announcement: manifest.announcement,
      releaseDate: manifest.releaseDate,
      downloadUrl: pickDownloadUrl(manifest, platform, arch),
      downloadPageUrl,
      file: pickDownloadFile(manifest, platform, arch),
      platform,
      arch,
      checkedAt,
      source: remoteUrl || "local"
    };
  } catch (error) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      required: false,
      notes: "暂时无法连接更新服务，可以先打开下载中心手动下载最新安装包。",
      releaseDate: "",
      downloadUrl: "",
      downloadPageUrl,
      platform,
      arch,
      checkedAt,
      source: remoteUrl || "local",
      error: error instanceof Error ? error.message : "检查更新失败"
    };
  }
}
