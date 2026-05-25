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

const autoCheckedKey = "ai-novel-workbench:update-auto-checked";

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

function buildTauriPromptState(update: Update): UpdatePromptState {
  const rawJson = update.rawJson ?? {};
  const sizeBytes = typeof rawJson.sizeBytes === "number" ? rawJson.sizeBytes : undefined;
  const label = typeof rawJson.label === "string" ? rawJson.label : "当前设备";

  return {
    currentVersion: update.currentVersion,
    latestVersion: update.version,
    required: Boolean(rawJson.required),
    notes: update.body || "发布新版本。",
    announcement: typeof rawJson.announcement === "string" ? rawJson.announcement : "",
    releaseDate: update.date ?? "",
    downloadPageUrl: typeof rawJson.downloadPageUrl === "string" ? rawJson.downloadPageUrl : "/download",
    file: {
      label,
      sizeBytes
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
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressDownloaded, setProgressDownloaded] = useState(0);
  const fileSize = useMemo(() => formatFileSize(result?.file?.sizeBytes || progressTotal), [result?.file?.sizeBytes, progressTotal]);
  const releaseDate = useMemo(() => formatTime(result?.releaseDate ?? ""), [result?.releaseDate]);
  const progressPercent = progressTotal > 0 ? Math.min(100, Math.round((progressDownloaded / progressTotal) * 100)) : 0;

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
      try {
        if (isTauriRuntime()) {
          const { check } = await import("@tauri-apps/plugin-updater");
          const update = await check({ timeout: 15000 });

          if (update) {
            setResult(buildTauriPromptState(update));
            setVisible(true);
            return;
          }
        }

        const response = await fetch("/api/app/update/check", {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as UpdateCheckResult | null;

        if (!response.ok || !payload?.hasUpdate || payload.error) {
          return;
        }

        setResult(buildManualPromptState(payload));
        setVisible(true);
      } catch {
        // 自动检查失败不打扰用户，设置页仍可手动检查。
      }
    }, 1800);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

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
      setProgressTotal(event.data.contentLength ?? 0);
      setProgressDownloaded(0);
      return;
    }

    if (event.event === "Progress") {
      setProgressDownloaded((current) => current + event.data.chunkLength);
      return;
    }

    if (event.event === "Finished") {
      setProgressDownloaded((current) => progressTotal || current);
    }
  }

  async function installTauriUpdate() {
    if (!result?.tauriUpdate || updating) {
      return;
    }

    setUpdating(true);
    setUpdateFinished(false);
    setProgressTotal(result.file?.sizeBytes ?? 0);
    setProgressDownloaded(0);

    try {
      await result.tauriUpdate.downloadAndInstall(handleDownloadEvent);
      setUpdateFinished(true);
      showToast({ type: "success", title: "新版已安装", message: "重启后即可使用最新版本。" });
    } catch (error) {
      setUpdating(false);
      showToast({
        type: "error",
        title: "自动更新失败",
        message: error instanceof Error ? error.message : "请稍后重试，或打开下载中心手动下载。"
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
        message: error instanceof Error ? error.message : "请手动退出并重新打开应用。"
      });
    }
  }

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
          <div>
            <h2 id="update-prompt-title">AI 网文写作助手 v{result.latestVersion}</h2>
            <p>
              当前版本 v{result.currentVersion}，建议更新到最新版后继续使用。
              {result.required ? " 这个版本属于必须更新。" : ""}
            </p>
          </div>

          <div className="update-prompt-meta" aria-label="新版安装包信息">
            {result.file?.label ? (
              <div>
                <span>适用版本</span>
                <strong>{result.file.label}</strong>
              </div>
            ) : null}
            {fileSize ? (
              <div>
                <span>安装包大小</span>
                <strong>{fileSize}</strong>
              </div>
            ) : null}
            {releaseDate ? (
              <div>
                <span>发布日期</span>
                <strong>{releaseDate}</strong>
              </div>
            ) : null}
          </div>

          {result.announcement || result.notes ? (
            <div className="update-prompt-notes">
              <span>更新说明</span>
              {result.announcement ? <p>{result.announcement}</p> : null}
              {result.notes ? <p>{result.notes}</p> : null}
            </div>
          ) : null}

          {updating ? (
            <div className="update-progress">
              <div>
                <strong>{updateFinished ? "新版已安装" : "正在下载并安装"}</strong>
                <span>{progressTotal > 0 ? `${progressPercent}%` : "正在准备更新包..."}</span>
              </div>
              <div className="update-progress-bar">
                <span style={{ width: progressTotal > 0 ? `${progressPercent}%` : "38%" }} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="update-prompt-actions">
          {!result.required && !updating ? (
            <button type="button" className="button" onClick={dismiss}>
              稍后再说
            </button>
          ) : null}
          {!updating && result.source === "tauri" ? (
            <button type="button" className="button" onClick={() => void openDownloadCenter()}>
              下载中心
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
