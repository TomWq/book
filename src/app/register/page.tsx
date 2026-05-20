import { AuthForm } from "@/components/auth-form";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getCurrentUser } from "@/lib/projects";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (isDesktopRuntime()) {
    redirect("/activate");
  }

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
          <div className="auth-calligraphy">先拆懂<br />再迁移<br />把长篇管住</div>
          <div className="auth-slogan-side">
            <strong>Build your formula</strong>
            <span>chapter ledger</span>
            <span>story bible</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-head">
            <div>
              <h2>{user ? "注册新账号" : "创建账号"}</h2>
              <p>{user ? "注册完成后会切换到新账号。" : "创建你的个人写作工作台。"}</p>
            </div>
            <div className="chip">新账号</div>
          </div>

          {user ? (
            <div className="auth-current-account">
              <span>当前账号</span>
              <strong>{user.name}</strong>
              <div>{user.email}</div>
            </div>
          ) : null}

          <AuthForm mode="register" nextPath={nextPath} initialError={params.error} />
        </div>

        <footer className="auth-immersive-footer">© 2026 AI 网文写作助手</footer>
      </div>
    </section>
  );
}
