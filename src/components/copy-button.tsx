"use client";

import { useState } from "react";

export function CopyButton({ value, label = "复制" }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Some HTTP deployments expose the API but reject writes; fall through to the legacy path.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const ok = document.execCommand("copy");
      if (!ok) {
        throw new Error("copy failed");
      }
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async function handleCopy() {
    try {
      await copyText(value);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("failed");
      window.setTimeout(() => setState("idle"), 2200);
    }
  }

  return (
    <button className="button secondary compact-button" type="button" onClick={handleCopy}>
      {state === "copied" ? "已复制" : state === "failed" ? "复制失败" : label}
    </button>
  );
}
