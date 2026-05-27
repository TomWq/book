import Link from "next/link";
import { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminLoginPath } from "@/lib/admin-login-path";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getCurrentUserAccess, getCurrentUserAiSetupStatus } from "@/lib/projects";
import { SideNav, type SideNavItem } from "@/components/side-nav";
import { FloatingWritingAssistant } from "@/components/floating-writing-assistant";
import { WorkspaceActions } from "@/components/workspace-actions";
import { AppIconMark } from "@/components/app-icon-mark";
import { PenNameOnboarding } from "@/components/pen-name-onboarding";
import { AutoUpdatePrompt } from "@/components/auto-update-prompt";

const navItems: SideNavItem[] = [
  { href: "/", label: "首页" },
  { href: "/projects", label: "项目中心" },
  { href: "/templates", label: "模板库" },
  { href: "/assistant", label: "墨澜" }
];

const standaloneAuthPaths = new Set(["/activate", "/login", "/register", "/download", "/downloads"]);
const defaultAssistantName = "墨澜";

function displayAssistantName(value?: string) {
  return String(value ?? "").trim() || defaultAssistantName;
}

export async function AppShell({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-nw-pathname") ?? "";
  const adminLoginPath = getAdminLoginPath();

  if (standaloneAuthPaths.has(pathname)) {
    return <>{children}</>;
  }

  const { user, isAdmin } = await getCurrentUserAccess();
  const desktopRuntime = isDesktopRuntime();

  if (!user && desktopRuntime) {
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    redirect(`/activate${next}`);
  }

  const isAdminMode = isAdmin && !desktopRuntime;
  const assistantName = displayAssistantName(user?.assistantName);
  const aiSetup = user && !isAdminMode
    ? await getCurrentUserAiSetupStatus()
    : { configured: true };
  const visibleNavItems = isAdminMode
    ? [{ href: "/admin", label: "管理后台" }]
    : navItems.map((item) => item.href === "/assistant" ? { ...item, label: assistantName } : item);
  const brandHref = isAdminMode ? "/admin" : "/";

  return (
    <div className={`app-shell ${user ? "app-shell-auth" : "app-shell-public"}`}>
      {!user ? (
        <header className="topbar public-topbar">
          <div className="brand-block">
            <Link href="/" className="brand-link">
              <AppIconMark />
              <div>
                <div className="brand-title">AI 网文写作助手</div>
                <div className="brand-subtitle">智能创作 · 章节生成 · 一致性审稿</div>
              </div>
            </Link>
          </div>

          <div className="topbar-meta">
            <span className="row" style={{ alignItems: "center" }}>
              {desktopRuntime ? (
                <Link href="/activate" className="button primary">
                  输入激活码
                </Link>
              ) : (
                <Link href="/activate" className="button primary">
                  输入授权码
                </Link>
              )}
            </span>
          </div>
        </header>
      ) : null}

      <div className="workspace-frame">
        {user ? (
          <header className="workspace-topbar">
            <Link href={brandHref} className="brand-link workspace-brand">
              <AppIconMark />
              <div>
                <div className="brand-title">AI 网文写作助手</div>
                <div className="brand-subtitle">
                  {isAdminMode ? "授权中心 · 客户与版本管理" : "智能创作 · 章节生成 · 一致性审稿"}
                </div>
              </div>
            </Link>

            <div className="workspace-nav">
              <SideNav items={visibleNavItems} />
            </div>

            <WorkspaceActions
              desktopRuntime={desktopRuntime}
              isAdminMode={isAdminMode}
              userName={user.name}
              penName={user.penName}
              licenseExpiresAt={user.licenseExpiresAt}
              adminLoginPath={adminLoginPath}
            />
          </header>
        ) : null}

        {user && !isAdminMode && !aiSetup.configured ? (
          <div className="setup-alert">
            <div>
              <strong>请先配置 AI 模型</strong>
              <span>当前是授权版，本地不会内置模型服务。请填写请求地址、API Key，并选择一个模型后再开始拆书或创作。</span>
            </div>
            <Link href="/settings/ai" className="button primary">
              去配置 AI
            </Link>
          </div>
        ) : null}

        <main className="app-main">{children}</main>
      </div>

      {user && !isAdminMode ? <FloatingWritingAssistant authorName={user.penName || user.name} assistantName={assistantName} /> : null}
      {user && !isAdminMode ? <PenNameOnboarding initialPenName={user.penName} /> : null}
      {user && !isAdminMode && desktopRuntime ? <AutoUpdatePrompt /> : null}
    </div>
  );
}
