"use client";

import Link from "next/link";
import { useState } from "react";

type AuthMode = "login" | "register";

export function AuthForm({
  mode,
  nextPath,
  initialError,
  showSwitch = true
}: {
  mode: AuthMode;
  nextPath: string;
  initialError?: string;
  showSwitch?: boolean;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const isLogin = mode === "login";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nw-name": encodeURIComponent(String(formData.get("name") ?? "")),
          "x-nw-email": encodeURIComponent(String(formData.get("email") ?? "")),
          "x-nw-password": encodeURIComponent(String(formData.get("password") ?? ""))
        },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? "")
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ? String(body.error) : isLogin ? "登录失败" : "注册失败");
        setIsPending(false);
        return;
      }

      const body = await response.json().catch(() => null);
      if (nextPath === "/admin" && body?.user?.role !== "admin") {
        setError("当前账号不是管理员，请使用管理员账号登录");
        setIsPending(false);
        return;
      }

      const targetPath = body?.user?.role === "admin" ? "/admin" : nextPath;
      window.location.replace(targetPath);
    } catch {
      setError(isLogin ? "登录失败，请稍后重试" : "注册失败，请稍后重试");
      setIsPending(false);
    }
  }

  return (
    <>
      {error ? <div className="pill danger auth-alert">{error}</div> : null}

      <form className="auth-form" method="post" action={`/api/auth/${mode}`} onSubmit={handleSubmit} aria-busy={isPending}>
        <input type="hidden" name="next" value={nextPath} />
        {!isLogin ? (
          <label className="auth-field">
            <span>用户名</span>
            <input name="name" autoComplete="name" placeholder="例如：小明" required />
          </label>
        ) : null}
        <label className="auth-field">
          <span>邮箱</span>
          <input name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
        </label>
        <label className="auth-field">
          <span>密码</span>
          <input
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder={isLogin ? "输入密码" : "至少 8 位更稳妥"}
            minLength={isLogin ? undefined : 8}
            required
          />
        </label>
        <button className="button auth-submit" type="submit" disabled={isPending}>
          {isPending ? "处理中..." : isLogin ? "登录" : "注册并登录"}
        </button>
      </form>

      {showSwitch ? (
        <div className="auth-switch">
          {isLogin ? (
            <>
              <span>还没有账号？</span>
              <Link href={`/register?next=${encodeURIComponent(nextPath)}`}>去注册</Link>
            </>
          ) : (
            <>
              <span>已经有账号？</span>
              <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>去登录</Link>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
