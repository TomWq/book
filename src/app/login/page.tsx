import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/projects";
import Link from "next/link";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/";

  return (
    <section className="auth-page">
      <div className="auth-immersive">
        <header className="auth-immersive-nav">
          <Link href="/" className="auth-immersive-brand">
            <span>书</span>
            <strong>AI 网文写作助手</strong>
            {/* <em>作者专区</em> */}
          </Link>
          <nav>
            <Link href="/">首页</Link>
            {/* <Link href="/projects/new/analysis">拆书工作台</Link>
            <Link href="/templates">模板库</Link> */}
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

        <div className="auth-card">
          <div className="auth-card-head">
            <div>
              <h2>{user ? "切换账号" : "密码登录"}</h2>
              <p>{user ? "输入另一个账号后，会直接切换当前登录身份。" : "继续进入你的写作工作台。"}</p>
            </div>
            <div className="chip">邮箱登录</div>
          </div>

          {user ? (
            <div className="auth-current-account">
              <span>当前账号</span>
              <strong>{user.name}</strong>
              <div>{user.email}</div>
            </div>
          ) : null}

          <AuthForm mode="login" nextPath={nextPath} initialError={params.error} />
        </div>

        <footer className="auth-immersive-footer">© 2026 AI 网文写作助手</footer>
      </div>
    </section>
  );
}
