"use client";

import { useEffect, useState } from "react";
import { appToastEventName, type ToastPayload, type ToastType } from "@/lib/client-toast";

type ToastItem = Required<Pick<ToastPayload, "type" | "title">> & {
  id: string;
  message: string;
};

function toastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeType(type?: ToastType): ToastType {
  return type === "error" || type === "info" || type === "success" ? type : "info";
}

export function AppToaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      const item: ToastItem = {
        id: toastId(),
        type: normalizeType(detail?.type),
        title: String(detail?.title ?? "").trim() || "操作已完成",
        message: String(detail?.message ?? "").trim()
      };
      const duration = Math.max(1800, Math.min(8000, Number(detail?.durationMs ?? 3200) || 3200));

      setItems((current) => [...current.slice(-3), item]);
      window.setTimeout(() => {
        setItems((current) => current.filter((toast) => toast.id !== item.id));
      }, duration);
    }

    window.addEventListener(appToastEventName, onToast);
    return () => window.removeEventListener(appToastEventName, onToast);
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="app-toast-stack" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <div className={`app-toast ${item.type}`} key={item.id}>
          <strong>{item.title}</strong>
          {item.message ? <span>{item.message}</span> : null}
        </div>
      ))}
    </div>
  );
}
