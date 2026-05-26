"use client";

import { useMemo, useState } from "react";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { openExternalUrl } from "@/lib/client-open-external";

type UpdateCheckResult = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  required: boolean;
  notes: string;
  announcement?: string;
  releaseDate: string;
  downloadUrl: string;
  downloadPageUrl: string;
  file?: {
    label?: string;
    fileName?: string;
    sizeBytes?: number;
    sha256?: string;
  };
  checkedAt: string;
  error?: string;
};

type UpdateCheckState = UpdateCheckResult & {
  source?: "tauri" | "manual";
  tauriUpdate?: Update;
};

type UpdateProgressPhase = "idle" | "preparing" | "downloading" | "installing" | "installed";

type TauriPlatformMeta = {
  label?: string;
  sizeBytes?: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  try {
    const text = JSON.stringify(error);
    return text && text !== "{}" ? text : fallback;
  } catch {
    return fallback;
  }
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function readNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function pickTauriPlatformMeta(rawJson: Record<string, unknown>): TauriPlatformMeta {
  const topLevel = {
    label: typeof rawJson.label === "string" ? rawJson.label : undefined,
    sizeBytes: readNumber(rawJson.sizeBytes)
  };
  const platforms = rawJson.platforms && typeof rawJson.platforms === "object"
    ? rawJson.platforms as Record<string, unknown>
    : {};
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
  const candidates = userAgent.includes("windows")
    ? ["windows-x86_64-nsis", "windows-x86_64", "windows-x64"]
    : userAgent.includes("mac")
      ? ["darwin-aarch64-app", "darwin-aarch64", "darwin-arm64-app", "darwin-arm64", "darwin-x86_64-app", "darwin-x86_64", "darwin-x64-app", "darwin-x64"]
      : Object.keys(platforms);

  for (const key of candidates) {
    const value = platforms[key];

    if (!value || typeof value !== "object") {
      continue;
    }

    const platform = value as Record<string, unknown>;
    return {
      label: typeof platform.label === "string" ? platform.label : topLevel.label,
      sizeBytes: readNumber(platform.sizeBytes) ?? topLevel.sizeBytes
    };
  }

  return topLevel;
}

function formatTime(value: string) {
  if (!value) {
    return "";
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(value).toLocaleString("zh-CN") : value;
}

function formatFileSize(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function shortHash(value?: string) {
  const text = String(value ?? "").trim();
  return text ? `${text.slice(0, 8)}...${text.slice(-6)}` : "";
}

export function VersionUpdateCard({ currentVersion }: { currentVersion: string }) {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateFinished, setUpdateFinished] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [progressPhase, setProgressPhase] = useState<UpdateProgressPhase>("idle");
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressDownloaded, setProgressDownloaded] = useState(0);
  const [result, setResult] = useState<UpdateCheckState | null>(null);
  const progressPercent = updateFinished
    ? 100
    : progressTotal > 0
      ? Math.min(99, Math.round((progressDownloaded / progressTotal) * 100))
      : 0;
  const progressText = updateFinished
    ? "新版已安装，重启应用后生效。"
    : updateError
      ? `应用内更新失败：${updateError}`
    : progressPhase === "installing"
      ? "正在安装更新包..."
      : progressPhase === "preparing"
        ? "准备下载，0%"
        : `正在应用内下载并安装，${progressPercent}%`;
  const statusText = useMemo(() => {
    if (!result) {
      return "点击检查是否有新版本。";
    }

    if (result.error) {
      return result.notes || "检查更新失败，请稍后再试。";
    }

    if (result.hasUpdate) {
      return result.required ? "发现必须更新版本，建议先升级后继续使用。" : "发现新版本，可以下载安装。";
    }

    return "当前已经是最新版本。";
  }, [result]);

  function handleDownloadEvent(event: DownloadEvent) {
    if (event.event === "Started") {
      setProgressPhase("downloading");
      setProgressTotal(event.data.contentLength ?? 0);
      setProgressDownloaded(0);
      return;
    }

    if (event.event === "Progress") {
      setProgressPhase("downloading");
      setProgressDownloaded((current) => current + event.data.chunkLength);
      return;
    }

    if (event.event === "Finished") {
      setProgressPhase("installing");
      setProgressDownloaded((current) => progressTotal || current);
    }
  }

  async function installTauriUpdate(update: Update) {
    setUpdating(true);
    setUpdateFinished(false);
    setUpdateError("");
    setProgressPhase("preparing");
    setProgressTotal(0);
    setProgressDownloaded(0);

    try {
      await update.downloadAndInstall(handleDownloadEvent);
      setProgressPhase("installed");
      setUpdateFinished(true);
    } catch (error) {
      setProgressPhase("idle");
      const message = getErrorMessage(error, "应用内更新失败，请稍后重试。");
      setUpdateError(message);
      setResult((current) => current
        ? {
          ...current,
          error: "更新失败",
          notes: `应用内更新失败：${message}`
        }
        : current);
    } finally {
      setUpdating(false);
    }
  }

  async function restartApp() {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  }

  async function checkUpdate() {
    setChecking(true);
    setUpdateFinished(false);
    setUpdateError("");
    setProgressPhase("idle");
    setProgressTotal(0);
    setProgressDownloaded(0);

    try {
      if (isTauriRuntime()) {
        try {
          const { check } = await import("@tauri-apps/plugin-updater");
          const update = await check({ timeout: 15000 });

          if (update) {
            const rawJson = update.rawJson ?? {};
            const platformMeta = pickTauriPlatformMeta(rawJson);

            setResult({
              currentVersion: update.currentVersion,
              latestVersion: update.version,
              hasUpdate: true,
              required: Boolean(rawJson.required),
              notes: update.body || "发布新版本。",
              announcement: typeof rawJson.announcement === "string" ? rawJson.announcement : "",
              releaseDate: update.date ?? "",
              downloadUrl: "",
              downloadPageUrl: typeof rawJson.downloadPageUrl === "string" ? rawJson.downloadPageUrl : "/download",
              file: {
                label: platformMeta.label || "当前设备",
                sizeBytes: platformMeta.sizeBytes
              },
              checkedAt: new Date().toISOString(),
              source: "tauri",
              tauriUpdate: update
            });
            return;
          }
        } catch (error) {
          // Fall back to the server-side check so the user still gets clear
          // update information if native updater metadata is invalid.
          const nativeError = error instanceof Error ? error.message : String(error);
          const response = await fetch("/api/app/update/check", { cache: "no-store" });
          const payload = await response.json().catch(() => null) as UpdateCheckResult | null;

          if (!response.ok || !payload) {
            throw new Error(nativeError || "检查更新失败");
          }

          setResult({
            ...payload,
            source: "manual",
            notes: `${payload.notes}\n\n应用内更新暂不可用：${nativeError}`
          });
          return;
        }
      }

      const response = await fetch("/api/app/update/check", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as UpdateCheckResult | null;

      if (!response.ok || !payload) {
        throw new Error("检查更新失败");
      }

      setResult({ ...payload, source: "manual" });
    } catch (error) {
      setResult({
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        required: false,
        notes: `${getErrorMessage(error, "检查更新失败")}。可以打开下载中心手动下载。`,
        announcement: "",
        releaseDate: "",
        downloadUrl: "",
        downloadPageUrl: "/download",
        checkedAt: new Date().toISOString(),
        source: "manual",
        error: "检查更新失败"
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="version-update-card" id="version-update">
      <div className="version-update-main">
        <span className="muted">当前版本</span>
        <strong>v{result?.currentVersion || currentVersion}</strong>
        <p>{statusText}</p>
        {result ? (
          <div className="version-update-meta">
            <span>最新版本：v{result.latestVersion}</span>
            {result.releaseDate ? <span>发布时间：{formatTime(result.releaseDate)}</span> : null}
            <span>检查时间：{formatTime(result.checkedAt)}</span>
            {result.file?.label ? <span>适配版本：{result.file.label}</span> : null}
            {result.file?.sizeBytes ? <span>安装包：{formatFileSize(result.file.sizeBytes)}</span> : null}
            {result.file?.sha256 ? <span>校验码：{shortHash(result.file.sha256)}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="version-update-actions">
        <button className="button primary" type="button" disabled={checking} onClick={() => void checkUpdate()}>
          {checking ? "正在检查..." : "检查更新"}
        </button>
        {result?.tauriUpdate ? (
          updateFinished ? (
            <button className="button primary" type="button" onClick={() => void restartApp()}>
              重启应用
            </button>
          ) : (
            <button className="button" type="button" disabled={updating} onClick={() => void installTauriUpdate(result.tauriUpdate!)}>
              {updating ? "更新中..." : "应用内更新"}
            </button>
          )
        ) : result?.downloadUrl ? (
          <button className="button" type="button" onClick={() => void openExternalUrl(result.downloadUrl)}>
            {result.hasUpdate ? "下载新版" : "下载当前版本"}
          </button>
        ) : null}
        <button className="button" type="button" onClick={() => void openExternalUrl(result?.downloadPageUrl || "/download")}>
          下载中心
        </button>
      </div>

      {updating || updateFinished || updateError ? (
        <div className="version-update-notes active">
          {progressText}
        </div>
      ) : null}

      {result?.announcement ? (
        <div className={`version-update-notes${result.error ? " danger" : " active"}`}>
          {result.announcement}
        </div>
      ) : null}

      {result?.notes ? (
        <div className={`version-update-notes${result.error ? " danger" : result.hasUpdate ? " active" : ""}`}>
          {result.notes}
        </div>
      ) : null}
    </div>
  );
}
