"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ImportSourceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const sourceType = formData.get("sourceType") === "txt" ? "txt" : "paste";
    const file = formData.get("file");
    const pastedContent = String(formData.get("content") ?? "").trim();
    let content = pastedContent;

    if (sourceType === "txt" && file instanceof File && file.size > 0) {
      content = (await file.text()).trim();
    }

    if (!content) {
      setError(sourceType === "txt" ? "请先上传 TXT 文件或粘贴文本" : "请先粘贴小说文本");
      return;
    }

    const response = await fetch(`/api/projects/${projectId}/source-texts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(formData.get("title") ?? ""),
        sourceType,
        content
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ? String(body.error) : "导入失败");
      return;
    }

    startTransition(() => {
      router.push(`/projects/${projectId}/chapters`);
      router.refresh();
    });
  }

  return (
    <form className="forms" onSubmit={handleSubmit} aria-busy={isPending}>
      <div className="split-panels">
        <div className="field">
          <div className="field-label">导入来源</div>
          <select name="sourceType" defaultValue="txt">
            <option value="txt">TXT 文件</option>
            <option value="paste">直接粘贴</option>
          </select>
        </div>
        <div className="field">
          <div className="field-label">文本标题</div>
          <input name="title" placeholder="例如：前 30 章分析文本" />
        </div>
      </div>
      <div className="field">
        <div className="field-label">TXT 文件</div>
        <input name="file" type="file" accept=".txt,text/plain" />
      </div>
      <div className="field">
        <div className="field-label">长文本</div>
        <textarea
          name="content"
          placeholder="把小说文本贴到这里，系统会先保存原文，再自动分章并写入章节列表。"
        />
      </div>
      <div className="hero-actions">
        <button className="button" type="submit" disabled={isPending}>
          {isPending ? "分章中..." : "开始分章"}
        </button>
      </div>
      {error ? <div className="pill danger form-error">{error}</div> : null}
    </form>
  );
}
