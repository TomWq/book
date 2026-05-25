"use client";

export type ToastType = "success" | "error" | "info";

export type ToastPayload = {
  type?: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
};

export const appToastEventName = "ai-novel-workbench:toast";

export function showToast(payload: ToastPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ToastPayload>(appToastEventName, { detail: payload }));
}
