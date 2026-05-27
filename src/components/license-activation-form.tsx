"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LicenseActivationForm({
  nextPath,
  initialError,
  replaceExisting = false,
  endpoint = "/api/license/activate",
  submitLabel,
  submittingLabel,
  helperText
}: {
  nextPath: string;
  initialError?: string;
  replaceExisting?: boolean;
  endpoint?: string;
  submitLabel?: string;
  submittingLabel?: string;
  helperText?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const isBusy = isSubmitting || isPending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activationCode: String(formData.get("activationCode") ?? ""),
          clientName: window.navigator.userAgent.slice(0, 160),
          replaceExisting
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ? String(body.error) : "授权失败，请检查授权码");
        return;
      }

      startTransition(() => {
        router.push(nextPath);
        router.refresh();
      });
    } catch {
      setError("连接授权中心失败，请检查网络或授权中心地址");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {error ? <div className="auth-alert" role="alert">{error}</div> : null}

      <form className="auth-form" onSubmit={handleSubmit} aria-busy={isBusy}>
        <label className="auth-field">
          <span>授权码</span>
          <input
            name="activationCode"
            autoComplete="off"
            placeholder="请输入授权码"
            required
            disabled={isBusy}
          />
        </label>
        <button className="button auth-submit" type="submit" disabled={isBusy}>
          {isSubmitting ? submittingLabel || "正在连接授权中心..." : isPending ? "正在进入..." : submitLabel || (replaceExisting ? "验证并更换授权" : "验证并进入")}
        </button>
        {isSubmitting ? <div className="pill form-status">正在验证授权码，请不要关闭页面。</div> : null}
      </form>

      <div className="auth-switch">
        <span>{helperText || (replaceExisting ? "更换授权只替换本机授权状态，不会删除本地项目和创作数据。" : "授权码一次性使用，已用过就不能再次激活。")}</span>
      </div>
    </>
  );
}
