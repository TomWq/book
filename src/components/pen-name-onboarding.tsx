"use client";

import { FormEvent, useState } from "react";

export function PenNameOnboarding({ initialPenName }: { initialPenName?: string }) {
  const [open, setOpen] = useState(!initialPenName);
  const [penName, setPenName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = penName.trim();

    if (!value) {
      setError("请填写作者笔名");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ penName: value })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "保存笔名失败");
      }

      setOpen(false);
      window.location.reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存笔名失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pen-name-overlay" role="dialog" aria-modal="true" aria-labelledby="pen-name-title">
      <form className="pen-name-dialog" onSubmit={submit}>
        <div className="pen-name-badge">作者身份</div>
        <h2 id="pen-name-title">设置你的作者笔名</h2>
        <p>以后控制台会优先显示这个名字。它不影响授权客户名，只用于你的创作工作台。</p>

        <label>
          <span>作者笔名</span>
          <input
            value={penName}
            onChange={(event) => setPenName(event.target.value)}
            maxLength={16}
            autoFocus
            placeholder="请输入你的作者笔名"
          />
        </label>

        {error ? <div className="pen-name-error">{error}</div> : null}

        <button type="submit" className="button primary" disabled={saving || !penName.trim()}>
          {saving ? "正在保存..." : "保存笔名"}
        </button>
      </form>
    </div>
  );
}
