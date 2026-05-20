"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
        activationCode: String(formData.get("activationCode") ?? "")
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
          <span>激活码</span>
          <input
            name="activationCode"
            autoComplete="off"
            placeholder="输入你收到的一次性授权码"
            required
          />
        </label>
        <button className="button auth-submit" type="submit" disabled={isPending}>
          {isPending ? "激活中..." : "激活并进入工作台"}
        </button>
      </form>

      <div className="auth-switch">
        <span>激活码就是本机客户身份。</span>
      </div>
    </>
  );
}
