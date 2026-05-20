import Link from "next/link";
import { ReactNode } from "react";
import { getBillingMode } from "@/lib/billing-mode";
import { getCurrentUserAccess, getCurrentUserAiSetupStatus } from "@/lib/projects";
import { LogoutButton } from "@/components/logout-button";
import { SideNav, type SideNavItem } from "@/components/side-nav";

const navItems: SideNavItem[] = [
  { href: "/", label: "首页" },
  { href: "/projects", label: "项目中心" },
  { href: "/templates", label: "模板库" }
];

export async function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin } = await getCurrentUserAccess();
  const billingMode = getBillingMode();
  const aiSetup = user && !isAdmin && billingMode === "subscription"
    ? await getCurrentUserAiSetupStatus()
    : { configured: true };
  const visibleNavItems = isAdmin ? [{ href: "/admin", label: "管理后台" }] : navItems;
  const brandHref = isAdmin ? "/admin" : "/";

  return (
    <div className={`app-shell ${user ? "app-shell-auth" : "app-shell-public"}`}>
      {user ? (
        <aside className="sidebar">
          <Link href={brandHref} className="brand-link sidebar-brand">
            <div className="brand-mark">书</div>
            <div>
              <div className="brand-title">AI 网文写作助手</div>
              <div className="brand-subtitle">
                {isAdmin ? "运营后台 · 用户与灵石管理" : "爆款拆解 · 模板迁移 · 长篇管理"}
              </div>
            </div>
          </Link>

          <SideNav items={visibleNavItems} />

          {!isAdmin ? (
            <div className="sidebar-actions">
              <Link href="/projects/new" className="button primary">
                新建作品
              </Link>
              <Link href="/projects/new/analysis" className="button">
                新建拆书
              </Link>
            </div>
          ) : null}
        </aside>
      ) : (
        <header className="topbar public-topbar">
          <div className="brand-block">
            <Link href="/" className="brand-link">
              <div className="brand-mark">书</div>
              <div>
                <div className="brand-title">AI 网文写作助手</div>
                <div className="brand-subtitle">爆款拆解 · 模板迁移 · 长篇管理</div>
              </div>
            </Link>
          </div>

          <div className="topbar-meta">
            <span className="row" style={{ alignItems: "center" }}>
              {billingMode === "subscription" ? (
                <Link href="/activate" className="button primary">
                  输入激活码
                </Link>
              ) : (
                <>
                  <Link href="/login" className="button">
                    登录
                  </Link>
                  <Link href="/register" className="button primary">
                    注册
                  </Link>
                </>
              )}
            </span>
          </div>
        </header>
      )}

      <div className="workspace-frame">
        {user ? (
          <header className="workspace-topbar">
            <div>
              <strong>{isAdmin ? "管理后台" : "个人工作台"}</strong>
              <span>
                {isAdmin ? "查看用户、灵石、模型档位和 AI 成本。" : "按项目推进拆书、模板迁移和长篇创作。"}
              </span>
            </div>
            <div className="topbar-meta">
              <span className="row" style={{ alignItems: "center" }}>
                <span className="chip">{user.name}</span>
                {!isAdmin ? (
                  <Link href="/settings/ai" className="button">
                    {billingMode === "subscription" ? "AI 设置" : "AI 模式"}
                  </Link>
                ) : null}
                {!isAdmin && billingMode === "credits" ? (
                  <Link href="/settings/account" className="button">
                    用量
                  </Link>
                ) : null}
                {/* <Link href="/legal" className="button">
                  合规
                </Link> */}
                {billingMode === "credits" ? <LogoutButton redirectTo="/login" /> : null}
              </span>
            </div>
          </header>
        ) : null}

        {user && !isAdmin && billingMode === "subscription" && !aiSetup.configured ? (
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
    </div>
  );
}
