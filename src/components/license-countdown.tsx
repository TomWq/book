"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LicenseStatusResponse = {
  currentUser?: { id: string } | null;
  activated?: boolean;
  expired?: boolean;
  licenseStatus?: string;
  licenseExpiresAt?: string;
  message?: string;
  serverNow?: string;
};

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days} 天 ${String(hours).padStart(2, "0")} 时 ${String(minutes).padStart(2, "0")} 分`;
  }

  if (hours > 0) {
    return `${hours} 时 ${String(minutes).padStart(2, "0")} 分 ${String(seconds).padStart(2, "0")} 秒`;
  }

  return `${minutes} 分 ${String(seconds).padStart(2, "0")} 秒`;
}

function buildActivateUrl(message: string) {
  return `/activate?error=${encodeURIComponent(message)}`;
}

export function LicenseCountdown({
  expiresAt,
  className = "pill warning"
}: {
  expiresAt: string;
  className?: string;
}) {
  const router = useRouter();
  const expiryMs = useMemo(() => Date.parse(expiresAt), [expiresAt]);
  const [label, setLabel] = useState("计算中...");

  useEffect(() => {
    if (!Number.isFinite(expiryMs)) {
      return;
    }

    let active = true;
    let serverOffsetMs = 0;

    async function syncStatus() {
      try {
        const response = await fetch("/api/license/status", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const status = (await response.json()) as LicenseStatusResponse;

        if (!active) {
          return;
        }

        if (!status.currentUser || status.licenseStatus === "expired" || status.licenseStatus === "disabled" || status.expired) {
          const message = status.message || "体验已到期，请重新激活";
          router.replace(buildActivateUrl(message));
          return;
        }

        if (status.serverNow) {
          const serverNow = Date.parse(status.serverNow);
          if (Number.isFinite(serverNow)) {
            serverOffsetMs = serverNow - Date.now();
          }
        }
      } catch {
        // Keep the current countdown if the status endpoint is briefly unavailable.
      }
    }

    const update = () => {
      const remaining = expiryMs - (Date.now() + serverOffsetMs);
      if (remaining <= 0) {
        router.replace(buildActivateUrl("体验已到期，请重新激活"));
        return;
      }

      setLabel(formatRemaining(remaining));
    };

    void syncStatus().then(() => {
      if (active) {
        update();
      }
    });
    const timer = window.setInterval(update, 1000);
    const refreshTimer = window.setInterval(syncStatus, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(refreshTimer);
    };
  }, [expiryMs, router]);

  if (!Number.isFinite(expiryMs)) {
    return null;
  }

  return <span className={className}>体验剩余 {label}</span>;
}
