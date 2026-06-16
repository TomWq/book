"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/client-toast";

type AccessPolicyValue = {
  requireActivation: boolean;
  updatedAt?: string;
};

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error ? String(body.error) : "保存访问模式失败";
}

export function ActivationModeSettingsForm({ accessPolicy }: { accessPolicy: AccessPolicyValue }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [requireActivation, setRequireActivation] = useState(accessPolicy.requireActivation);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const busy = isPending || isSaving;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/access-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireActivation })
      });

      if (!response.ok) {
        const nextError = await readError(response);
        setError(nextError);
        showToast({ type: "error", title: "保存失败", message: nextError });
        return;
      }

      const message = requireActivation ? "已切换为激活码模式" : "已切换为直接可用模式";
      setSuccess(message);
      showToast({ type: "success", title: message });
      startTransition(() => router.refresh());
    } catch {
      const nextError = "网络请求失败，请稍后重试";
      setError(nextError);
      showToast({ type: "error", title: "保存失败", message: nextError });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="release-settings-form" onSubmit={handleSubmit} aria-busy={busy}>
      <div className="admin-control-grid activation-mode-grid">
        <label className={`activation-mode-option ${requireActivation ? "selected" : ""}`}>
          <input
            type="radio"
            name="activationMode"
            checked={requireActivation}
            onChange={() => setRequireActivation(true)}
            disabled={busy}
          />
          <span>
            <strong>需要激活码</strong>
            <small>用户打开客户端后必须完成授权码激活；已有免激活用户会重新进入激活流程。</small>
          </span>
        </label>
        <label className={`activation-mode-option ${!requireActivation ? "selected" : ""}`}>
          <input
            type="radio"
            name="activationMode"
            checked={!requireActivation}
            onChange={() => setRequireActivation(false)}
            disabled={busy}
          />
          <span>
            <strong>直接可用</strong>
            <small>体验期用户打开客户端会自动进入工作台，不需要输入授权码，也不受 1 天体验限制。</small>
          </span>
        </label>
      </div>

      <div className="release-settings-actions">
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "保存中..." : "保存访问模式"}
        </button>
        <span className={`pill ${requireActivation ? "warning" : "success"}`}>
          当前选择：{requireActivation ? "需要激活码" : "直接可用"}
        </span>
        {accessPolicy.updatedAt ? (
          <span className="muted">上次更新 {new Date(accessPolicy.updatedAt).toLocaleString("zh-CN")}</span>
        ) : null}
        {success ? <span className="pill success">{success}</span> : null}
        {error ? <span className="pill danger">{error}</span> : null}
      </div>
    </form>
  );
}
