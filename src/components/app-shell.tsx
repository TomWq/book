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
import { FirstUseGuideModal } from "@/components/first-use-guide-modal";

const navItems: SideNavItem[] = [
  { href: "/", label: "首页" },
  { href: "/projects", label: "项目中心" },
  { href: "/inspirations", label: "灵感中心" },
  { href: "/assistant", label: "墨澜" },
  { href: "/templates", label: "模板库" }
];

const standaloneAuthPaths = new Set(["/activate", "/login", "/register", "/download", "/downloads"]);
const publicContentPaths = new Set(["/", "/manual", "/legal"]);
const defaultAssistantName = "墨澜";

function displayAssistantName(value?: string) {
  return String(value ?? "").trim() || defaultAssistantName;
}

export async function AppShell({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-nw-pathname") ?? "";
  const adminLoginPath = getAdminLoginPath();
  const desktopRuntime = isDesktopRuntime();
  const isPublicLanding = pathname === "/" && !desktopRuntime;

  if (standaloneAuthPaths.has(pathname)) {
    return <>{children}</>;
  }

  const { user, isAdmin } = await getCurrentUserAccess();
  const desktopClient = desktopRuntime && user?.licenseCodePurpose !== "web";

  if (!user && desktopRuntime) {
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    redirect(`/activate${next}`);
  }

  if (!user && !desktopRuntime && !publicContentPaths.has(pathname)) {
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    redirect(`/activate${next}`);
  }

  const isAdminMode = isAdmin && !desktopClient;
  const assistantName = displayAssistantName(user?.assistantName);
  const aiSetup = user && !isAdminMode && !isPublicLanding
    ? await getCurrentUserAiSetupStatus()
    : { configured: true };
  const workspaceHomeHref = desktopRuntime ? "/" : "/workspace";
  const shellNavItems = navItems.map((item) => item.href === "/" ? { ...item, href: workspaceHomeHref } : item);
  const visibleNavItems = isAdminMode
    ? [{ href: "/admin", label: "管理后台" }]
    : shellNavItems.map((item) => item.href === "/assistant" ? { ...item, label: assistantName } : item);
  const brandHref = isAdminMode ? "/admin" : workspaceHomeHref;

  return (
    <div className={`app-shell ${user && !isPublicLanding ? "app-shell-auth" : "app-shell-public"}`}>
      {!user || isPublicLanding ? (
        <header className="topbar public-topbar">
          <div className="brand-block">
            <Link href="/" className="brand-link">
              <AppIconMark />
              <div>
                <div className="brand-title">墨澜 · AI 网文写作助手</div>
                <div className="brand-subtitle">智能创作 · 章节生成 · 一致性审稿</div>
              </div>
            </Link>
          </div>

          <div className="topbar-meta">
            <span className="row" style={{ alignItems: "center" }}>
              {user ? (
                <a href={isAdminMode ? "/admin" : "/workspace"} className="button primary">
                  进入工作台
                </a>
              ) : desktopRuntime ? (
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
        {user && !isPublicLanding ? (
          <header className="workspace-topbar">
            <Link href={brandHref} className="brand-link workspace-brand">
              <AppIconMark />
              <div>
                <div className="brand-title">墨澜 · AI 网文写作助手</div>
                <div className="brand-subtitle">
                  {isAdminMode ? "授权中心 · 客户与版本管理" : "智能创作 · 章节生成 · 一致性审稿"}
                </div>
              </div>
            </Link>

            <div className="workspace-nav">
              <SideNav items={visibleNavItems} />
            </div>

            <WorkspaceActions
              desktopRuntime={desktopClient}
              isAdminMode={isAdminMode}
              userName={user.name}
              penName={user.penName}
              licenseExpiresAt={user.licenseExpiresAt}
              licenseCodePurpose={user.licenseCodePurpose}
              adminLoginPath={adminLoginPath}
            />
          </header>
        ) : null}

        {user && !isAdminMode && !isPublicLanding && !aiSetup.configured ? (
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

      {user && !isAdminMode && !isPublicLanding ? <FloatingWritingAssistant authorName={user.penName || user.name} assistantName={assistantName} /> : null}
      {user && !isAdminMode && !isPublicLanding ? <PenNameOnboarding initialPenName={user.penName} /> : null}
      {user && !isAdminMode && !isPublicLanding && user.penName ? (
        <FirstUseGuideModal penName={user.penName} assistantName={assistantName} />
      ) : null}
      {user && !isAdminMode && !isPublicLanding && desktopClient ? <AutoUpdatePrompt /> : null}
    </div>
  );
}
