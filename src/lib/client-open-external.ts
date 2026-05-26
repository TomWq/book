"use client";

export async function openExternalUrl(url: string) {
  const target = new URL(url || "/", window.location.origin).toString();
  const targetUrl = new URL(target);
  const currentUrl = new URL(window.location.href);

  if (targetUrl.origin === currentUrl.origin && targetUrl.pathname === "/download") {
    window.location.assign(target);
    return;
  }

  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(target);
      return;
    } catch {
      window.location.assign(target);
      return;
    }
  }

  const opened = window.open(target, "_blank", "noopener,noreferrer");

  if (!opened) {
    window.location.assign(target);
  }
}
