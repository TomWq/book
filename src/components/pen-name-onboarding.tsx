"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const defaultAssistantName = "墨澜";
const maxPenNameLength = 20;
const maxAssistantNameLength = 5;

export function PenNameOnboarding({ initialPenName }: { initialPenName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(!initialPenName);
  const [penName, setPenName] = useState("");
  const [assistantName, setAssistantName] = useState(defaultAssistantName);
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

    const helperName = assistantName.trim();

    if (helperName.length > maxAssistantNameLength) {
      setError("小助手名称最多 5 个字");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ penName: value, assistantName: helperName })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "保存笔名失败");
      }

      setOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存笔名失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pen-name-overlay" role="dialog" aria-modal="true" aria-labelledby="pen-name-title">
      <form className="pen-name-dialog" onSubmit={submit}>
        <img className="pen-name-hero-art" src="/onboarding/pen-hero.png" alt="" aria-hidden="true" />

        <div className="pen-name-title-row">
          <span className="pen-name-avatar" aria-hidden="true">
            <img src="/onboarding/avatar-badge.png" alt="" />
          </span>
          <h2 id="pen-name-title">设置你的作者笔名</h2>
        </div>
        <p>以后控制台会优先显示这个名字，它不影响授权客户名，<br />只用于你的创作工作台。</p>

        <label>
          <span>作者笔名</span>
          <div className="pen-name-field">
            <img src="/onboarding/feather-icon.png" alt="" aria-hidden="true" />
            <input
              value={penName}
              onChange={(event) => setPenName(event.target.value)}
              maxLength={maxPenNameLength}
              autoFocus
              placeholder="请输入你的作者笔名"
            />
            <em>{penName.length}/{maxPenNameLength}</em>
          </div>
        </label>

        <label>
          <span>
            小助手名称
            <small title="不填时默认使用墨澜">?</small>
            <em>可选，默认墨澜(最多 5 个字)</em>
          </span>
          <div className="pen-name-field">
            <img src="/onboarding/robot-icon.png" alt="" aria-hidden="true" />
            <input
              value={assistantName}
              onChange={(event) => setAssistantName(event.target.value)}
              maxLength={maxAssistantNameLength}
              placeholder={defaultAssistantName}
            />
            {assistantName ? (
              <button type="button" aria-label="清空小助手名称" onClick={() => setAssistantName("")}>
                ×
              </button>
            ) : null}
          </div>
        </label>

        {error ? <div className="pen-name-error">{error}</div> : null}

        <button type="submit" className="button primary" disabled={saving || !penName.trim()}>
          {saving ? "正在保存..." : "保存笔名"}
        </button>

        <div className="pen-name-privacy">
          <img src="/onboarding/lock-icon.png" alt="" aria-hidden="true" />
          你的笔名仅对你可见，不会公开展示
        </div>
      </form>
    </div>
  );
}
