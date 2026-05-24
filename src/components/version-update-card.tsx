"use client";

import { useMemo, useState } from "react";

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
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
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

  async function checkUpdate() {
    setChecking(true);

    try {
      const response = await fetch("/api/app/update/check", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as UpdateCheckResult | null;

      if (!response.ok || !payload) {
        throw new Error("检查更新失败");
      }

      setResult(payload);
    } catch (error) {
      setResult({
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        required: false,
        notes: error instanceof Error ? `${error.message}。可以打开下载中心手动下载。` : "检查更新失败，可以打开下载中心手动下载。",
        announcement: "",
        releaseDate: "",
        downloadUrl: "",
        downloadPageUrl: "/download",
        checkedAt: new Date().toISOString(),
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
        {result?.downloadUrl ? (
          <a className="button" href={result.downloadUrl} target="_blank" rel="noreferrer">
            {result.hasUpdate ? "下载新版" : "下载当前版本"}
          </a>
        ) : null}
        <a className="button" href={result?.downloadPageUrl || "/download"} target="_blank" rel="noreferrer">
          下载中心
        </a>
      </div>

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
