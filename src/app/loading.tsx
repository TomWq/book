"use client";

import { usePathname } from "next/navigation";

const PUBLIC_PATHS = new Set(["/activate", "/login", "/register", "/legal"]);

export default function Loading() {
  const pathname = usePathname();

  if (PUBLIC_PATHS.has(pathname)) {
    return null;
  }

  return (
    <div className="route-loading-stage" aria-live="polite">
      <div className="route-loading-board">
        <div className="route-loading-head">
          <span className="loading-bookmark" aria-hidden="true">
            <span />
          </span>
          <div>
            <strong>正在打开页面</strong>
            <span>稍等一下，马上就好。</span>
          </div>
        </div>
        <span className="route-loading-progress" aria-hidden="true" />
      </div>
    </div>
  );
}
