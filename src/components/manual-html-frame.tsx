"use client";

import { useEffect, useState } from "react";

const themeStorageKey = "ai-novel-workbench-theme";

function readTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(themeStorageKey);
  return stored === "dark" ? "dark" : "light";
}

function themedManualUrl(baseUrl: string, theme: string) {
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}theme=${theme}`;
}

export function ManualHtmlFrame({ src }: { src: string }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const syncTheme = () => setTheme(readTheme());
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    window.addEventListener("storage", syncTheme);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return (
    <iframe
      className="manual-html-frame"
      title="墨澜 · AI 网文写作助手使用手册"
      src={themedManualUrl(src, theme)}
    />
  );
}
