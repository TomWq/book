"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <section className="route-error-page">
          <div className="route-error-card">
            <span className="route-error-icon" aria-hidden="true">!</span>
            <div>
              <h1>页面加载失败</h1>
              <p>应用服务遇到错误，请先点击重试。如果仍然失败，请把当前页面地址和错误编号发给开发者。</p>
              {error.digest ? <code>错误编号：{error.digest}</code> : null}
            </div>
            <button className="button primary" type="button" onClick={reset}>
              重试
            </button>
          </div>
        </section>
      </body>
    </html>
  );
}
