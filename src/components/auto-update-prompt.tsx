"use client";

import { useEffect, useMemo, useState } from "react";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { showToast } from "@/lib/client-toast";
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

type UpdatePromptState = {
  currentVersion: string;
  latestVersion: string;
  required: boolean;
  notes: string;
  announcement?: string;
  releaseDate: string;
  downloadPageUrl: string;
  file?: UpdateCheckResult["file"];
  source: "tauri" | "manual";
  tauriUpdate?: Update;
};

type UpdateProgressPhase = "idle" | "preparing" | "downloading" | "installing" | "installed" | "failed";

type TauriPlatformMeta = {
  label?: string;
  sizeBytes?: number;
};

const autoCheckedKey = "ai-novel-workbench:update-auto-checked";

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

function formatTime(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(value).toLocaleDateString("zh-CN") : "";
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

function canUseStorage(storage: Storage) {
  try {
    const key = "__update_storage_test__";
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
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
      ? ["darwin-aarch64-app", "darwin-aarch64", "darwin-arm64-app", "darwin-arm64"]
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

function buildTauriPromptState(update: Update): UpdatePromptState {
  const rawJson = update.rawJson ?? {};
  const platformMeta = pickTauriPlatformMeta(rawJson);

  return {
    currentVersion: update.currentVersion,
    latestVersion: update.version,
    required: Boolean(rawJson.required),
    notes: update.body || "发布新版本。",
    announcement: typeof rawJson.announcement === "string" ? rawJson.announcement : "",
    releaseDate: update.date ?? "",
    downloadPageUrl: typeof rawJson.downloadPageUrl === "string" ? rawJson.downloadPageUrl : "/download",
    file: {
      label: platformMeta.label || "当前设备",
      sizeBytes: platformMeta.sizeBytes
    },
    source: "tauri",
    tauriUpdate: update
  };
}

function buildManualPromptState(payload: UpdateCheckResult): UpdatePromptState {
  return {
    currentVersion: payload.currentVersion,
    latestVersion: payload.latestVersion,
    required: payload.required,
    notes: payload.notes,
    announcement: payload.announcement,
    releaseDate: payload.releaseDate,
    downloadPageUrl: payload.downloadPageUrl || "/download",
    file: payload.file,
    source: "manual"
  };
}

export function AutoUpdatePrompt() {
  const [result, setResult] = useState<UpdatePromptState | null>(null);
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateFinished, setUpdateFinished] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [progressPhase, setProgressPhase] = useState<UpdateProgressPhase>("idle");
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressDownloaded, setProgressDownloaded] = useState(0);
  const fileSize = useMemo(() => formatFileSize(result?.file?.sizeBytes || progressTotal), [result?.file?.sizeBytes, progressTotal]);
  const releaseDate = useMemo(() => formatTime(result?.releaseDate ?? ""), [result?.releaseDate]);
  const progressPercent = updateFinished
    ? 100
    : progressTotal > 0
      ? Math.min(99, Math.round((progressDownloaded / progressTotal) * 100))
      : 0;
  const progressTitle = updateFinished
    ? "新版已安装"
    : progressPhase === "failed"
      ? "更新失败"
    : progressPhase === "installing"
      ? "正在安装"
      : progressPhase === "preparing"
        ? "准备下载"
        : "正在下载";

  useEffect(() => {
    if (typeof window === "undefined" || !canUseStorage(window.sessionStorage)) {
      return;
    }

    if (window.sessionStorage.getItem(autoCheckedKey) === "1") {
      return;
    }

    window.sessionStorage.setItem(autoCheckedKey, "1");
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      async function checkManualUpdate(nativeError = "") {
        const response = await fetch("/api/app/update/check", {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as UpdateCheckResult | null;

        if (!response.ok || !payload?.hasUpdate || payload.error) {
          return;
        }

        const manualState = buildManualPromptState(payload);
        setResult(nativeError
          ? {
            ...manualState,
            notes: `${manualState.notes}\n\n应用内更新暂不可用：${nativeError}`
          }
          : manualState);
        setVisible(true);
      }

      try {
        let nativeError = "";

        if (isTauriRuntime()) {
          try {
            const { check } = await import("@tauri-apps/plugin-updater");
            const update = await check({ timeout: 15000 });

            if (update) {
              setResult(buildTauriPromptState(update));
              setVisible(true);
              return;
            }
          } catch (error) {
            nativeError = error instanceof Error ? error.message : String(error);
            // Fall back to the app update API below. The settings page uses the
            // same endpoint, so users still see the prompt when native updater
            // metadata is temporarily invalid during release testing.
          }
        }

        await checkManualUpdate(nativeError);
      } catch {
        // 自动检查失败不打扰用户，设置页仍可手动检查。
      }
    }, 1800);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.classList.toggle("update-prompt-open", visible);

    return () => {
      document.body.classList.remove("update-prompt-open");
    };
  }, [visible]);

  if (!visible || !result) {
    return null;
  }

  function dismiss() {
    if (updating) {
      return;
    }

    setVisible(false);
  }

  async function openDownloadCenter() {
    await openExternalUrl(result?.downloadPageUrl || "/download");
  }

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

  async function installTauriUpdate() {
    if (!result?.tauriUpdate || updating) {
      return;
    }

    setUpdating(true);
    setUpdateFinished(false);
    setUpdateError("");
    setProgressPhase("preparing");
    setProgressTotal(0);
    setProgressDownloaded(0);

    try {
      await result.tauriUpdate.downloadAndInstall(handleDownloadEvent);
      setProgressPhase("installed");
      setUpdateFinished(true);
      setUpdating(false);
      showToast({ type: "success", title: "新版已安装", message: "重启后即可使用最新版本。" });
    } catch (error) {
      setUpdating(false);
      const message = getErrorMessage(error, "请稍后重试，或打开下载中心手动下载。");
      setUpdateError(message);
      setProgressPhase("failed");
      showToast({
        type: "error",
        title: "自动更新失败",
        message
      });
    }
  }

  async function restartApp() {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      showToast({
        type: "error",
        title: "重启失败",
        message: getErrorMessage(error, "请手动退出并重新打开应用。")
      });
    }
  }

  const metaItems = [
    {
      key: "platform",
      label: "适用平台",
      value: result.file?.label || "当前设备"
    },
    {
      key: "size",
      label: "安装包大小",
      value: fileSize || "获取中"
    },
    {
      key: "date",
      label: "发布日期",
      value: releaseDate || "刚刚发布"
    }
  ];

  return (
    <div className="update-prompt-backdrop" role="presentation">
      <section className="update-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="update-prompt-title">
        <div className="update-prompt-head">
          <span>发现新版本</span>
          {!result.required || updateFinished ? (
            <button type="button" aria-label="稍后再说" onClick={dismiss} disabled={updating && !updateFinished}>
              ×
            </button>
          ) : null}
        </div>

        <div className="update-prompt-main">
          <div className="update-prompt-title-block">
            <h2 id="update-prompt-title">墨澜 · AI 网文写作助手 v{result.latestVersion}</h2>
            <p>
              当前版本 v{result.currentVersion}，建议更新到最新版以获得更好的体验。
              {result.required ? " 这个版本属于必须更新。" : ""}
            </p>
          </div>

          <div className="update-prompt-meta" aria-label="新版安装包信息">
            {metaItems.map((item) => (
              <div className="update-prompt-meta-card" key={item.key}>
                <span className={`update-prompt-meta-icon ${item.key}`} aria-hidden="true" />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          {result.announcement || result.notes ? (
            <div className="update-prompt-notes">
              <div className="update-prompt-notes-copy">
                <span>更新说明</span>
                {result.announcement ? <p>{result.announcement}</p> : null}
                {result.notes ? <p>{result.notes}</p> : null}
                {/* <button type="button" onClick={() => void openDownloadCenter()}>
                  查看更新详情
                </button> */}
              </div>
              <img className="update-prompt-rocket" src="/update/rocket-launch.webp" alt="" aria-hidden="true" />
            </div>
          ) : null}

          {updating || updateFinished || updateError ? (
            <div className="update-progress">
              <div>
                <strong>{progressTitle}</strong>
                <span>{progressTotal > 0 || updateFinished ? `${progressPercent}%` : "0%"}</span>
              </div>
              <div className="update-progress-bar">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              {updateError ? <p className="update-progress-error">应用内更新失败：{updateError}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="update-prompt-actions">
          <div className="update-prompt-safe">
            <span aria-hidden="true" />
            安全更新，放心升级
          </div>
          {!result.required && !updating ? (
            <button type="button" className="button" onClick={dismiss}>
              稍后再说
            </button>
          ) : null}
          {result.source === "tauri" ? (
            updateFinished ? (
              <button type="button" className="button primary" onClick={() => void restartApp()}>
                重启应用
              </button>
            ) : (
              <button type="button" className="button primary" onClick={() => void installTauriUpdate()} disabled={updating}>
                {updating ? "更新中..." : "立即更新"}
              </button>
            )
          ) : (
            <button type="button" className="button primary" onClick={() => void openDownloadCenter()}>
              打开下载中心
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
