import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIconMark } from "@/components/app-icon-mark";
import { LicenseActivationForm } from "@/components/license-activation-form";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getSubscriptionActivationStatus } from "@/lib/desktop-license-status";
import { getAccessPolicyViaRemoteCenter } from "@/lib/license-service";
import { getCurrentUser } from "@/lib/projects";

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
  const params = await searchParams;
  const forceWebEntry = params.mode === "web";
  const desktopRuntime = isDesktopRuntime() && !forceWebEntry;
  const nextPath = params.next?.startsWith("/") ? params.next : "/";
  const replaceExisting = desktopRuntime && params.mode === "replace";
  const rawError = params.error ?? "";
  const normalizedError = normalizeActivationError(rawError);
  const accessPolicy = desktopRuntime ? await getAccessPolicyViaRemoteCenter() : null;
  const status = desktopRuntime ? await getSubscriptionActivationStatus() : null;
  const currentUser = desktopRuntime ? status?.currentUser : await getCurrentUser();

  if (!replaceExisting && !rawError && currentUser) {
    redirect(nextPath);
  }

  if (desktopRuntime && accessPolicy?.requireActivation === false && !rawError) {
    redirect(`/api/license/restore?next=${encodeURIComponent(nextPath)}`);
  }

  if (desktopRuntime && !replaceExisting && !rawError && status?.activated) {
    redirect(`/api/license/restore?next=${encodeURIComponent(nextPath)}`);
  }

  if (desktopRuntime && !replaceExisting && !rawError) {
    redirect(`/api/license/restore?next=${encodeURIComponent(nextPath)}`);
  }

  if (rawError && !normalizedError) {
    const cleanUrl = new URL("/activate", "http://localhost");
    if (nextPath !== "/") {
      cleanUrl.searchParams.set("next", nextPath);
    }

    redirect(`${cleanUrl.pathname}${cleanUrl.search}`);
  }

  const initialError = normalizedError || status?.message || "";

  return (
    <section className={`auth-page license-auth-page ${forceWebEntry ? "web-auth-page" : ""}`}>
      <div className="auth-immersive">
        <header className="auth-immersive-nav">
          <Link href={forceWebEntry ? "/" : "/activate"} className="auth-immersive-brand">
            <AppIconMark className="auth-brand-icon" />
            <strong>墨澜 · AI 网文写作助手</strong>
          </Link>
          <nav>
            <span>{desktopRuntime ? "授权激活" : "网页授权"}</span>
          </nav>
        </header>

        {forceWebEntry ? (
          <div className="auth-slogan web-auth-copy">
            <span className="auth-kicker">特邀用户入口</span>
            <h1>用授权码进入网页工作台。</h1>
            <p>
              网页端只开放给收到邀请的用户。验证通过后，可以进入工作台查看项目、模板和创作资料。
            </p>
            <div className="web-auth-points" aria-label="网页授权说明">
              <span>网页特邀授权码</span>
              <span>不替代桌面端授权</span>
              <span>验证后进入工作台</span>
            </div>
          </div>
        ) : (
          <div className="auth-slogan">
            <div className="auth-calligraphy">灯下起长卷<br />笔端生云烟<br />胸中藏万象<br />落笔自成篇</div>
            <div className="auth-slogan-side">
              <strong>Good stories</strong>
              <span>structure first</span>
              <span>write longer</span>
            </div>
          </div>
        )}

        <div className="auth-card license-card">
          <div className="auth-card-head">
            <div>
              <h2>{desktopRuntime ? "授权码激活" : "授权码进入工作台"}</h2>
              <p>
                {replaceExisting
                  ? "输入新的授权码，本机作品和设置会继续保留。"
                  : desktopRuntime
                    ? accessPolicy?.requireActivation === false
                      ? "当前为直接可用模式，打开软件会自动进入工作台。"
                      : "首次启动会自动开通体验；体验到期后，输入正式桌面授权码继续使用。"
                    : "输入交付给你的网页特邀授权码，验证后进入网页工作台。"}
              </p>
            </div>
            <div className="chip">{replaceExisting ? "更换授权" : desktopRuntime ? "授权码" : "网页入口"}</div>
          </div>

          <LicenseActivationForm
            nextPath={nextPath}
            initialError={initialError}
            replaceExisting={replaceExisting}
            endpoint={desktopRuntime ? "/api/license/activate" : "/api/license/web-login"}
            submitLabel={desktopRuntime ? undefined : "验证并进入工作台"}
            submittingLabel={desktopRuntime ? undefined : "正在验证授权码..."}
            helperText={desktopRuntime
              ? undefined
              : "网页入口只面向特邀用户。请使用网页特邀授权码，桌面授权码不能在这里使用。"}
          />
        </div>

        <footer className="auth-immersive-footer"></footer>
      </div>
    </section>
  );
}
