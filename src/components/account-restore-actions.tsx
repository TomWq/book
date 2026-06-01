"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/components/confirm-dialog-provider";
import { showToast } from "@/lib/client-toast";

type RestoreResult = {
  backupPath?: string;
  counts?: {
    projects?: number;
    templates?: number;
    chapters?: number;
    drafts?: number;
    writingBibles?: number;
    characterProfiles?: number;
    foreshadowings?: number;
    plotStates?: number;
    longFormPlans?: number;
    customRelationGraphs?: number;
    writingTaskCards?: number;
    chapterLedgers?: number;
  };
  warnings?: string[];
};

export function AccountRestoreActions() {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isBusy = isUploading || isPending;

  async function restoreBackup(file: File) {
    setMessage("");
    setError("");
    setIsUploading(true);
    setMessage(`正在恢复：${file.name}`);

    try {
      const formData = new FormData();
      formData.set("backup", file);

      const response = await fetch("/api/account/restore", {
        method: "POST",
        body: formData
      });
      const body = (await response.json().catch(() => null)) as RestoreResult & { error?: string } | null;

      if (!response.ok) {
        const nextError = body?.error ? String(body.error) : "恢复数据失败";
        setMessage("");
        setError(nextError);
        showToast({ type: "error", title: "恢复失败", message: nextError });
        return;
      }

      const counts = body?.counts;
      const nextMessage = [
        `已恢复 ${counts?.projects ?? 0} 个项目、${counts?.drafts ?? 0} 篇正文`,
        `主线 ${counts?.plotStates ?? 0}`,
        `人物 ${counts?.characterProfiles ?? 0}`,
        `伏笔 ${counts?.foreshadowings ?? 0}`,
        `图谱 ${counts?.customRelationGraphs ?? 0}`
      ].join("，") + "。";
      setMessage(nextMessage);
      showToast({
        type: body?.warnings?.length ? "info" : "success",
        title: "恢复完成",
        message: body?.warnings?.length ? `${nextMessage}${body.warnings[0]}` : nextMessage
      });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      const nextError = "恢复数据失败，请确认文件是本工具导出的 JSON 备份。";
      setMessage("");
      setError(nextError);
      showToast({ type: "error", title: "恢复失败", message: nextError });
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="account-restore-actions">
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = event.currentTarget.files?.[0];

          if (!file) {
            return;
          }

          const confirmed = await confirm({
            title: "恢复账号数据",
            message: "恢复会替换当前账号的项目、模板、草稿和 AI 设置。",
            detail: "系统会先自动备份当前数据，确认后再继续恢复。",
            confirmLabel: "确认恢复",
            tone: "danger"
          });

          if (!confirmed) {
            input.value = "";
            return;
          }

          void restoreBackup(file);
        }}
      />
      <button className="button small-button" type="button" disabled={isBusy} onClick={() => inputRef.current?.click()}>
        {isBusy ? "正在恢复..." : "恢复数据"}
      </button>
      {message ? <p className="form-status">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
