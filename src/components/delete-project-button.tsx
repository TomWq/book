"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteProjectButton({
  projectId,
  projectName
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
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
      <button className="button danger" type="button" onClick={() => setOpen(true)}>
        删除项目
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
            <div className="confirm-dialog-head">
              <div>
                <div className="pill danger">危险操作</div>
                <h2 id="delete-project-title">删除项目</h2>
              </div>
              <button className="icon-button" type="button" aria-label="关闭" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <div className="confirm-dialog-body">
              <p>
                确定删除「<strong>{projectName}</strong>」吗？删除后不能从页面恢复。
              </p>
              <div className="list compact-list">
                <div className="list-item">
                  会删除本项目下的原文、章节、章节分析、整书分析、写作状态、草稿、台账、审稿、二稿和任务记录。
                </div>
                <div className="list-item">已保存到模板库的模板会保留。</div>
              </div>
              {error ? <div className="pill danger form-error">{error}</div> : null}
            </div>

            <div className="confirm-dialog-actions">
              <button className="button" type="button" onClick={() => setOpen(false)} disabled={isDeleting || isPending}>
                取消
              </button>
              <button className="button danger" type="button" onClick={handleDelete} disabled={isDeleting || isPending}>
                {isDeleting || isPending ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
