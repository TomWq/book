"use client";

import { useState } from "react";
import { showToast } from "@/lib/client-toast";

type ExportFileResult = {
  ok?: boolean;
  filename?: string;
  path?: string;
  error?: string;
};

function filenameFromDisposition(disposition: string | null) {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || `ai-novel-workbench-export-${new Date().toISOString().slice(0, 10)}.json`;
}

async function downloadBackupInBrowser() {
  const response = await fetch("/api/account/export");

  if (!response.ok) {
    throw new Error("导出备份失败");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filenameFromDisposition(response.headers.get("content-disposition"));
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AccountBackupActions() {
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function exportBackup() {
    setMessage("");
    setError("");
    setIsExporting(true);

    try {
      const response = await fetch("/api/account/export-file", {
        method: "POST"
      });
      const body = (await response.json().catch(() => null)) as ExportFileResult | null;

      if (response.ok && body?.path) {
        const text = `已保存到：${body.path}`;
        setMessage(text);
        showToast({ type: "success", title: "备份导出成功", message: text, durationMs: 5200 });
        return;
      }

      await downloadBackupInBrowser();
      setMessage("已开始下载 JSON 备份文件。");
      showToast({ type: "success", title: "备份已开始下载", message: "JSON 文件通常会保存到系统下载目录。" });
    } catch (exportError) {
      const nextError = exportError instanceof Error ? exportError.message : "导出备份失败";
      setError(nextError);
      showToast({ type: "error", title: "备份导出失败", message: nextError });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="account-backup-actions">
      <button className="button primary" type="button" onClick={exportBackup} disabled={isExporting}>
        {isExporting ? "正在导出..." : "导出备份"}
      </button>
      {message ? <p className="form-status">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
