"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/components/confirm-dialog-provider";

export function DeleteProjectButton({
  projectId,
  projectName
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    if (!(await confirm({
      title: "删除项目",
      message: `确定删除「${projectName}」吗？删除后不能从页面恢复。`,
      detail: "会删除本项目下的原文、章节、章节分析、整书分析、写作状态、草稿、台账、审稿、二稿和任务记录。已保存到模板库的模板会保留。",
      confirmLabel: "确认删除",
      tone: "danger"
    }))) {
      return;
    }

    setError("");
    setIsDeleting(true);
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ? String(body.error) : "删除项目失败");
      setIsDeleting(false);
      return;
    }

    startTransition(() => {
      router.push("/projects");
      router.refresh();
    });
  }

  return (
    <>
      <button className="button danger" type="button" onClick={handleDelete} disabled={isDeleting || isPending}>
        {isDeleting || isPending ? "删除中..." : "删除项目"}
      </button>
      {error ? <div className="pill danger form-error">{error}</div> : null}
    </>
  );
}
