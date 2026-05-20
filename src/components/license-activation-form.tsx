"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MACHINE_ID_KEY = "nw_license_machine_id";

function getMachineId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(MACHINE_ID_KEY);
  if (existing) {
    return existing;
  }

  const id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(MACHINE_ID_KEY, id);
  return id;
}

export function LicenseActivationForm({
  nextPath,
  initialError
}: {
  nextPath: string;
  initialError?: string;
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
      const response = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activationCode: String(formData.get("activationCode") ?? ""),
          machineHash: getMachineId(),
          clientName: window.navigator.userAgent.slice(0, 160)
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ? String(body.error) : "激活失败，请检查激活码");
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
      {error ? <div className="pill danger auth-alert">{error}</div> : null}

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
          {isSubmitting ? "正在连接授权中心..." : isPending ? "正在进入..." : "验证并进入"}
        </button>
        {isSubmitting ? <div className="pill form-status">正在验证授权码，请不要关闭页面。</div> : null}
      </form>

      <div className="auth-switch">
        <span>授权码由服务方提供，请妥善保存。</span>
      </div>
    </>
  );
}
