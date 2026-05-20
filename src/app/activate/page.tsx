import Link from "next/link";
import { redirect } from "next/navigation";
import { LicenseActivationForm } from "@/components/license-activation-form";
import { getBillingMode } from "@/lib/billing-mode";
import { getSubscriptionActivationStatus } from "@/lib/projects";

export default async function ActivatePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (getBillingMode() !== "subscription") {
    redirect("/login");
  }

  const params = await searchParams;
  const status = await getSubscriptionActivationStatus();
  const nextPath = params.next?.startsWith("/") ? params.next : "/projects";

  if (status.currentUser) {
    redirect(nextPath);
  }

  return (
    <section className="auth-page">
      <div className="auth-immersive">
        <header className="auth-immersive-nav">
          <Link href="/activate" className="auth-immersive-brand">
            <span>书</span>
            <strong>AI 网文写作助手</strong>
          </Link>
          <nav>
            <span>授权激活</span>
          </nav>
        </header>

        <div className="auth-slogan">
          <div className="auth-calligraphy">授权<br />激活<br />进入工作台</div>
          <div className="auth-slogan-side">
            <strong>License first</strong>
            <span>local workspace</span>
            <span>bring your key</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-head">
            <div>
              <h2>输入激活码</h2>
              <p>激活后会直接进入本地工作台，不需要注册或登录。</p>
            </div>
            <div className="chip">本机授权</div>
          </div>

          {status.activated ? (
            <div className="auth-current-account">
              <span>已激活客户</span>
              <strong>{status.customerId || "本地客户"}</strong>
              <div>当前 session 已过期，请重新输入激活码进入。</div>
            </div>
          ) : null}

          <LicenseActivationForm nextPath={nextPath} initialError={params.error} />
        </div>

        <footer className="auth-immersive-footer">© 2026 AI 网文写作助手</footer>
      </div>
    </section>
  );
}
