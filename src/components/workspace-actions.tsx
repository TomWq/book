"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LicenseCountdown } from "@/components/license-countdown";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function WorkspaceActions({
  desktopRuntime,
  isAdminMode,
  userName,
  penName,
  licenseExpiresAt,
  adminLoginPath = "/license-center-admin"
}: {
  desktopRuntime: boolean;
  isAdminMode: boolean;
  userName: string;
  penName?: string;
  licenseExpiresAt?: string;
  adminLoginPath?: string;
}) {
  const [openMenu, setOpenMenu] = useState<"" | "create" | "settings">("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="workspace-actions" ref={rootRef}>
      {desktopRuntime && !isAdminMode && licenseExpiresAt ? (
        <LicenseCountdown expiresAt={licenseExpiresAt} className="pill warning license-countdown" />
      ) : null}
      <span className="workspace-pen-name">{penName || userName}</span>

      {!isAdminMode ? (
        <div className={`workspace-menu create-menu ${openMenu === "create" ? "open" : ""}`}>
          <button
            type="button"
            className="workspace-menu-trigger primary"
            aria-expanded={openMenu === "create"}
            onClick={() => setOpenMenu((current) => (current === "create" ? "" : "create"))}
          >
            新建
          </button>
          {openMenu === "create" ? (
            <div className="workspace-menu-popover">
              <Link href="/projects/new" onClick={() => setOpenMenu("")}>
                创作项目
              </Link>
              <Link href="/projects/new/analysis" onClick={() => setOpenMenu("")}>
                拆书项目
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isAdminMode ? (
        <div className={`workspace-menu settings-menu ${openMenu === "settings" ? "open" : ""}`}>
          <button
            type="button"
            className="workspace-menu-trigger"
            aria-expanded={openMenu === "settings"}
            onClick={() => setOpenMenu((current) => (current === "settings" ? "" : "settings"))}
          >
            设置
          </button>
          {openMenu === "settings" ? (
            <div className="workspace-menu-popover settings-popover">
              <Link href="/settings/ai" onClick={() => setOpenMenu("")}>
                AI 设置
              </Link>
              <Link href="/settings/account" onClick={() => setOpenMenu("")}>
                数据与授权
              </Link>
              <Link href="/settings/account#version-update" onClick={() => setOpenMenu("")}>
                检查更新
              </Link>
              <Link href="/manual" onClick={() => setOpenMenu("")}>
                使用手册
              </Link>
              <ThemeToggle />
              {desktopRuntime ? null : <LogoutButton redirectTo={adminLoginPath} />}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <ThemeToggle />
          {desktopRuntime ? null : <LogoutButton redirectTo={adminLoginPath} />}
        </>
      )}
    </div>
  );
}
