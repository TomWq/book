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
  const [error, setError] = useState(initialError ?? "");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
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
  }

  return (
    <>
      {error ? <div className="pill danger auth-alert">{error}</div> : null}

      <form className="auth-form" onSubmit={handleSubmit} aria-busy={isPending}>
        <label className="auth-field">
          <span>授权码</span>
          <input
            name="activationCode"
            autoComplete="off"
            placeholder="请输入授权码"
            required
          />
        </label>
        <button className="button auth-submit" type="submit" disabled={isPending}>
          {isPending ? "验证中..." : "验证并进入"}
        </button>
      </form>

      <div className="auth-switch">
        <span>授权码由服务方提供，请妥善保存。</span>
      </div>
    </>
  );
}
