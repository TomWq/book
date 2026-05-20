"use client";

import { useState } from "react";

export function CopyButton({ value, label = "复制" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="button secondary compact-button" type="button" onClick={handleCopy}>
      {copied ? "已复制" : label}
    </button>
  );
}
