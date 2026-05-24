import Link from "next/link";
import { redirect } from "next/navigation";
import { LicenseActivationForm } from "@/components/license-activation-form";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getSubscriptionActivationStatus } from "@/lib/desktop-license-status";

function normalizeActivationError(value?: string) {
  const message = String(value ?? "").trim();

  if (!message) {
    return "";
  }

  if (message.includes("请先登录")) {
    return "";
  }

  if (message.includes("返回 401") || message.includes("返回 403")) {
    return "";
  }

  if (message.includes("授权中心") && message.includes("登录")) {
    return "";
  }

  return message;
}

export default async function ActivatePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string; mode?: string }>;
}) {
  if (!isDesktopRuntime()) {
    redirect("/download");
  }

  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/projects";
  const replaceExisting = params.mode === "replace";
  const rawError = params.error ?? "";
  const normalizedError = normalizeActivationError(rawError);
  const status = await getSubscriptionActivationStatus();

  if (!replaceExisting && status.currentUser) {
    redirect(nextPath);
  }

  if (!replaceExisting && status.activated) {
    redirect(`/api/license/restore?next=${encodeURIComponent(nextPath)}`);
  }

  if (rawError && !normalizedError) {
    const cleanUrl = new URL("/activate", "http://localhost");
    if (nextPath !== "/projects") {
      cleanUrl.searchParams.set("next", nextPath);
    }

    redirect(`${cleanUrl.pathname}${cleanUrl.search}`);
  }

  const initialError = normalizedError || status.message || "";

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
              <p>{replaceExisting ? "输入新的授权码，本机作品和设置会继续保留。" : "输入交付给你的一次性授权码，验证后进入写作工作台。"}</p>
            </div>
            <div className="chip">{replaceExisting ? "更换授权" : "授权码"}</div>
          </div>

          <LicenseActivationForm nextPath={nextPath} initialError={initialError} replaceExisting={replaceExisting} />
        </div>

        <footer className="auth-immersive-footer"></footer>
      </div>
    </section>
  );
}
