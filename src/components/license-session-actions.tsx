"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LicenseSessionActions() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState("");
  const isBusy = isClearing || isPending;

  async function clearSession() {
    if (isBusy) {
      return;
    }

    setMessage("");
    setIsClearing(true);

    try {
      const response = await fetch("/api/license/local-session", {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ? String(body.error) : "清除本地授权会话失败");
        return;
      }

      startTransition(() => {
        router.replace("/activate?mode=replace&next=/projects");
        router.refresh();
      });
    } catch {
      setMessage("清除本地授权会话失败，请稍后重试");
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="license-session-actions">
      <Link className="button small-button primary" href="/activate?mode=replace&next=/settings/account">
        更换授权码
      </Link>
      <button className="button small-button" type="button" onClick={clearSession} disabled={isBusy}>
        {isBusy ? "正在处理..." : "重新进入激活页"}
      </button>
      {message ? <p className="form-error">{message}</p> : null}
    </div>
  );
}
