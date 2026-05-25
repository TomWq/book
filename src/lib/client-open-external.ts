"use client";

export async function openExternalUrl(url: string) {
  const target = new URL(url || "/", window.location.origin).toString();

  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(target);
      return;
    } catch {
      // Fall through to browser fallback so the action still has a visible result.
    }
  }

  window.open(target, "_blank", "noopener,noreferrer");
}
