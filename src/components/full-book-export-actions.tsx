"use client";

import { useMemo, useState } from "react";
import { ActionLoadingOverlay } from "@/components/api-form";
import { showToast } from "@/lib/client-toast";

type ExportDraft = {
  chapterNumber: number;
  title: string;
  content: string;
};

type FullBookExportActionsProps = {
  projectName: string;
  drafts: ExportDraft[];
  compact?: boolean;
};

function safeFilenamePart(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || "未命名作品").slice(0, 80);
}

function timestampForFolder() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
}

function chapterHeading(draft: ExportDraft) {
  const title = draft.title.trim();

  return title ? `第 ${draft.chapterNumber} 章 · ${title}` : `第 ${draft.chapterNumber} 章`;
}

function chapterExportText(projectName: string, draft: ExportDraft) {
  const content = draft.content.trim();
  const heading = chapterHeading(draft);
  const firstLine = content.split(/\r?\n/, 1)[0]?.replace(/^#\s*/, "").trim() ?? "";
  const shouldAddHeading = firstLine !== heading && !firstLine.includes(heading);

  return [projectName.trim(), shouldAddHeading ? heading : "", content].filter(Boolean).join("\n\n") + "\n";
}

function chapterFilename(draft: ExportDraft) {
  const number = String(draft.chapterNumber).padStart(4, "0");
  return `${number}-第${draft.chapterNumber}章-${safeFilenamePart(draft.title || "章节正文")}.txt`;
}

function combinedBookText(projectName: string, drafts: ExportDraft[]) {
  return drafts.map((draft) => chapterExportText(projectName, draft)).join("\n\n");
}

function isTauriUnavailableError(error: unknown) {
  return error instanceof Error && /Failed to resolve module specifier|__TAURI__|not.*tauri/i.test(error.message);
}

export function FullBookExportActions({ projectName, drafts, compact = false }: FullBookExportActionsProps) {
  const [status, setStatus] = useState<"idle" | "exporting" | "done">("idle");
  const sortedDrafts = useMemo(
    () => [...drafts].sort((a, b) => a.chapterNumber - b.chapterNumber),
    [drafts]
  );
  const exportableDrafts = sortedDrafts.filter((draft) => draft.content.trim().length > 0);
  const buttonClassName = compact ? "button small-button" : "button";

  async function exportFullBook() {
    if (exportableDrafts.length === 0 || status === "exporting") {
      return;
    }

    setStatus("exporting");

    try {
      const [{ open }, { mkdir, writeTextFile }, pathApi] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
        import("@tauri-apps/api/path")
      ]);
      const selectedDirectory = await open({
        title: "选择全本导出文件夹",
        directory: true,
        multiple: false,
        recursive: true,
        canCreateDirectories: true
      });

      if (!selectedDirectory || Array.isArray(selectedDirectory)) {
        setStatus("idle");
        return;
      }

      const folderName = `${safeFilenamePart(projectName)}-全本导出-${timestampForFolder()}`;
      const exportDir = await pathApi.join(selectedDirectory, folderName);

      await mkdir(exportDir, { recursive: true });

      await Promise.all(
        exportableDrafts.map(async (draft) => {
          const chapterPath = await pathApi.join(exportDir, chapterFilename(draft));
          await writeTextFile(chapterPath, chapterExportText(projectName, draft));
        })
      );

      const combinedFilename = `${safeFilenamePart(projectName)}-全本合集.txt`;
      const combinedPath = await pathApi.join(exportDir, combinedFilename);
      await writeTextFile(combinedPath, combinedBookText(projectName, exportableDrafts));

      setStatus("done");
      showToast({
        type: "success",
        title: "全本导出完成",
        message: `已导出 ${exportableDrafts.length} 章到：${exportDir}`
      });
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch (error) {
      setStatus("idle");
      showToast({
        type: "error",
        title: "全本导出失败",
        message: isTauriUnavailableError(error)
          ? "当前运行环境不支持选择本机文件夹，请在桌面客户端中使用。"
          : error instanceof Error
            ? error.message
            : "写入文件夹失败，请换一个目录再试。"
      });
    }
  }

  return (
    <>
      {status === "exporting" ? (
        <ActionLoadingOverlay
          title="正在导出全本章节"
          description={`正在写入 ${exportableDrafts.length.toLocaleString("zh-CN")} 章 TXT 到你选择的文件夹。`}
        />
      ) : null}
      <button
        className={buttonClassName}
        type="button"
        onClick={exportFullBook}
        disabled={exportableDrafts.length === 0 || status === "exporting"}
      >
        {status === "done" ? "全本已导出" : "导出全本 TXT"}
      </button>
    </>
  );
}
