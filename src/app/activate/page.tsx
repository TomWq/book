import Link from "next/link";
import { redirect } from "next/navigation";
import { LicenseActivationForm } from "@/components/license-activation-form";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getSubscriptionActivationStatus } from "@/lib/projects";

export default async function ActivatePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (!isDesktopRuntime()) {
    redirect("/login");
  }

  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/projects";
  const status = await getSubscriptionActivationStatus();

  if (status.currentUser) {
    redirect(nextPath);
  }

  if (status.activated) {
    redirect(`/api/license/restore?next=${encodeURIComponent(nextPath)}`);
  }

  return (
    <section className="auth-page license-auth-page">
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
          <div className="auth-calligraphy">好故事<br />不止一章<br />更要稳稳写下去</div>
          <div className="auth-slogan-side">
            <strong>Good stories</strong>
            <span>structure first</span>
            <span>write longer</span>
          </div>
        </div>

        <div className="auth-card license-card">
          <div className="auth-card-head">
            <div>
              <h2>授权码激活</h2>
              <p>输入交付给你的授权码，验证后进入写作工作台。</p>
            </div>
            <div className="chip">授权码</div>
          </div>

          <LicenseActivationForm nextPath={nextPath} initialError={params.error} />
        </div>

        <footer className="auth-immersive-footer">© 2026 AI 网文写作助手</footer>
      </div>
    </section>
  );
}
