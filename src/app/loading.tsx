"use client";

import { usePathname } from "next/navigation";

const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/legal"]);

export default function Loading() {
  const pathname = usePathname();

  if (PUBLIC_PATHS.has(pathname)) {
    return null;
  }

  return (
    <div className="route-loading-stage" aria-live="polite">
      <div className="route-loading-board">
        <div className="route-loading-head">
          <span className="loading-bookmark" aria-hidden="true">书</span>
          <div>
            <strong>正在整理创作状态</strong>
            <span>同步项目、模板、人物和伏笔。</span>
          </div>
          <span className="loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>

        <div className="route-loading-grid" aria-hidden="true">
          <div className="route-loading-panel route-loading-panel-primary">
            <span className="loading-label">项目</span>
            <span className="loading-line loading-line-long" />
            <span className="loading-line loading-line-medium" />
            <span className="loading-line loading-line-short" />
          </div>

          <div className="route-loading-panel">
            <span className="loading-label">模板</span>
            <span className="loading-line loading-line-long" />
            <span className="loading-line loading-line-medium" />
            <span className="loading-line loading-line-short" />
          </div>

          <div className="route-loading-panel">
            <span className="loading-label">章节</span>
            <span className="loading-line loading-line-long" />
            <span className="loading-line loading-line-medium" />
            <span className="loading-line loading-line-short" />
          </div>
        </div>
      </div>
    </div>
  );
}
