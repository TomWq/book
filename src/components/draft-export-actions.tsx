"use client";

import { useState } from "react";
import { showToast } from "@/lib/client-toast";

type DraftExportActionsProps = {
  content: string;
  projectName?: string;
  chapterNumber?: number;
  title?: string;
  compact?: boolean;
  className?: string;
};

function safeFilenamePart(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || "章节正文").slice(0, 80);
}

function chapterHeading(chapterNumber?: number, title?: string) {
  const normalizedTitle = title?.trim();

  if (chapterNumber && normalizedTitle) {
    return `第 ${chapterNumber} 章 · ${normalizedTitle}`;
  }

  if (chapterNumber) {
    return `第 ${chapterNumber} 章`;
  }

  return normalizedTitle || "章节正文";
}

function buildExportText({
  content,
  projectName,
  chapterNumber,
  title
}: Pick<DraftExportActionsProps, "content" | "projectName" | "chapterNumber" | "title">) {
  const trimmedContent = content.trim();
  const heading = chapterHeading(chapterNumber, title);
  const firstLine = trimmedContent.split(/\r?\n/, 1)[0]?.replace(/^#\s*/, "").trim() ?? "";
  const shouldAddHeading = heading && firstLine !== heading && !firstLine.includes(heading);
  const parts = [projectName?.trim(), shouldAddHeading ? heading : "", trimmedContent].filter(Boolean);

  return `${parts.join("\n\n")}\n`;
}

function buildFilename(projectName?: string, chapterNumber?: number, title?: string) {
  const prefix = projectName ? `${safeFilenamePart(projectName)}-` : "";
  const chapter = chapterNumber ? `第${chapterNumber}章-` : "";

  return `${prefix}${chapter}${safeFilenamePart(title || "章节正文")}.txt`;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function DraftExportActions({
  content,
  projectName,
  chapterNumber,
  title,
  compact = false,
  className = ""
}: DraftExportActionsProps) {
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const hasContent = content.trim().length > 0;
  const buttonClassName = compact ? "button small-button" : "button";

  async function handleCopy() {
    if (!hasContent) {
      return;
    }

    try {
      await copyText(content.trim());
      setCopied(true);
      showToast({ type: "success", title: "复制成功", message: "正文已经复制到剪贴板。" });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      showToast({ type: "error", title: "复制失败", message: "系统没有允许写入剪贴板，请手动复制正文。" });
    }
  }

  function handleExport() {
    if (!hasContent) {
      return;
    }

    const exportText = buildExportText({ content, projectName, chapterNumber, title });
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const filename = buildFilename(projectName, chapterNumber, title);
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
    showToast({
      type: "success",
      title: "TXT 已开始导出",
      message: `${filename} 通常会保存到系统下载目录。`
    });
    window.setTimeout(() => setExported(false), 1600);
  }

  return (
    <div className={`draft-actions ${compact ? "compact-draft-actions" : ""} ${className}`.trim()}>
      <button className={buttonClassName} type="button" onClick={handleCopy} disabled={!hasContent}>
        {copied ? "已复制" : "复制正文"}
      </button>
      <button className={buttonClassName} type="button" onClick={handleExport} disabled={!hasContent}>
        {exported ? "已开始导出" : "导出 TXT"}
      </button>
    </div>
  );
}
