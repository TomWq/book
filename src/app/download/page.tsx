import type { Metadata } from "next";
import { AppIconMark } from "@/components/app-icon-mark";
import {
  getAppDownloadUrl,
  getLocalUpdateManifest,
  getManifestDownloadUrl,
  type AppDownloadKey,
  type AppUpdateFile
} from "@/lib/app-update";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "下载中心 - 墨澜 · AI 网文写作助手",
  description: "下载 墨澜 · AI 网文写作助手 Windows 和 Apple 芯片 macOS 客户端。"
};

type DownloadOption = {
  key: AppDownloadKey;
  title: string;
  shortTitle: string;
  subtitle: string;
  platform: string;
  arch: string;
  badge?: string;
  url?: string;
  file?: AppUpdateFile;
};

function formatBytes(value?: number) {
  const bytes = Number(value ?? 0);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }

  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(value).toLocaleDateString("zh-CN") : value;
}

export default function DownloadPage() {
  const manifest = getLocalUpdateManifest();
  const manualHtmlUrl = "/manual";
  const manualPdfUrl = "/manual/墨澜 · AI 网文写作助手使用手册.pdf";
  const options: DownloadOption[] = [
    {
      key: "win32X64",
      title: "Windows 版",
      shortTitle: "Windows",
      subtitle: "适用于 Windows 10 / Windows 11 64 位电脑。",
      platform: "Windows",
      arch: "x64",
      url: getManifestDownloadUrl(manifest, "win32X64") ? getAppDownloadUrl("win32X64") : "",
      file: manifest.files?.win32X64
    },
    {
      key: "darwinArm64",
      title: "Mac 版",
      shortTitle: "Mac Apple 芯片",
      subtitle: "适用于 M1 / M2 / M3 / M4 等 Apple 芯片 Mac。",
      platform: "macOS",
      arch: "Apple 芯片",
      url: getManifestDownloadUrl(manifest, "darwinArm64") ? getAppDownloadUrl("darwinArm64") : "",
      file: manifest.files?.darwinArm64
    }
  ];
  const availableCount = options.filter((item) => item.file || item.url).length;

  function renderDownloadMeta(option: DownloadOption) {
    const size = formatBytes(option.file?.sizeBytes);
    return [option.arch, size, formatDate(manifest.releaseDate)].filter(Boolean).join(" · ");
  }

  function renderDownloadHref(option: DownloadOption) {
    return option.file || option.url ? option.url || "#" : "#";
  }

  return (
    <section className="download-center-page">
      <div className="download-immersive">
        <header className="download-nav">
          <div className="download-brand">
            <AppIconMark className="download-brand-icon" />
            <div>
              <strong>{manifest.productName}</strong>
              <span>灵感成章 · 妙笔生花</span>
            </div>
          </div>
        </header>

        <div className="download-layout">
          <div className="download-slogan" aria-hidden="true" />

          <section className="download-panel" id="download-versions" aria-label="版本选择">
            <div className="download-panel-head">
              <div>
                <span className="download-kicker">桌面客户端下载 (授权码请联系管理员) </span>
                {/* <h1>下载 AI 网文写作助手</h1> */}
                <p>选择适合你的版本，安装后使用授权码激活，开启创作之旅。</p>
              </div>
              <div className="download-manual-actions">
                <a className="download-card-button tertiary" href="/activate?mode=web">
                  特邀用户入口
                </a>
                <a className="download-card-button primary" href={manualHtmlUrl} target="_blank" rel="noreferrer">
                  查看使用说明
                </a>
                {/* <a className="download-card-button" href={manualPdfUrl}>
                  PDF
                </a> */}
              </div>
            </div>

            <div className="download-hero-meta">
              <span>{availableCount} 个版本可下载</span>
              <span>{manifest.required ? "重要更新" : "内测发布"}</span>
              <span>Mac 仅支持 Apple 芯片</span>
              <span>网页仅面向特邀用户</span>
            </div>

            {/* <div className="download-invite-card">
              <div>
                <strong>特邀用户网页入口</strong>
                <p>普通访客不能直接使用网页工作台。只有收到你发放的特殊激活码，才可以从这里进入。</p>
              </div>
              <a className="download-card-button primary" href="/activate">
                输入激活码进入
              </a>
            </div> */}

            <div className="download-grid">
              {options.map((option, index) => {
                const hasDownload = Boolean(option.file || option.url);
                const isWindows = option.platform === "Windows";

                return (
                  <article
                    key={option.key}
                    className={`download-card download-platform-card ${index === 0 ? "featured" : ""} ${hasDownload ? "" : "disabled"}`}
                  >
                    <div className="download-recommend-badge">{isWindows ? "推荐版本" : "Apple 芯片"}</div>
                    <div className="download-platform-main">
                      {isWindows ? (
                        <span className="download-os-icon windows" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        <span className="download-os-icon mac" aria-hidden="true"></span>
                      )}
                      <div className="download-primary-heading">
                        <h2>
                          <span>{option.title}</span>
                        </h2>
                        <div className="download-card-version">
                          <span>{option.platform} · {option.arch}</span>
                          <em>客户端 v{manifest.version}</em>
                        </div>
                      </div>
                    </div>
                    <p>{option.subtitle}</p>
                    <div className="download-card-meta">{renderDownloadMeta(option)}</div>
                    {hasDownload ? (
                      <a className="download-card-button" href={renderDownloadHref(option)}>
                        立即下载 <span aria-hidden="true">↓</span>
                      </a>
                    ) : (
                      <span className="download-card-button disabled">暂未发布</span>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="download-notes" id="download-notes">
              {/* {manifest.announcement ? (
                <div className="download-note announcement">
                  <strong>发布公告</strong>
                  <p>{manifest.announcement}</p>
                </div>
              ) : null} */}
              <details className="download-note">
                <summary className="download-help-row">
                  <strong>Mac 首次打开提示</strong>
                  <p>若提示“无法打开”，请在系统设置中允许后再打开应用。</p>
                  <span aria-hidden="true">⌄</span>
                </summary>
                <div className="download-note-detail">
                  <ol>
                    <li>下载后先解压安装包，再把应用拖入“应用程序”。</li>
                    <li>如果系统提示无法验证开发者，请打开“系统设置”里的“隐私与安全性”，允许后再打开。</li>
                    <li>如果提示应用已损坏，可以在终端执行下面命令后重新打开。</li>
                  </ol>
                  <code>xattr -dr com.apple.quarantine "/Applications/墨澜 · AI 网文写作助手.app"</code>
                </div>
              </details>
              <details className="download-note">
                <summary className="download-help-row">
                  <strong>本地隐私</strong>
                  <p>作品、草稿、设定、人物档案和项目数据默认保存在你的电脑里。</p>
                  <span aria-hidden="true">⌄</span>
                </summary>
                <div className="download-note-detail">
                  <p>客户端默认把作品、草稿、设定、人物档案、项目状态和模板数据保存在本机。除非你主动配置 AI 接口并发起生成，否则这些创作数据不会上传到我们的服务器。</p>
                </div>
              </details>
              <details className="download-note">
                <summary className="download-help-row">
                  <strong>内测签名</strong>
                  <p>若遇到系统安全提示，请确认来源可信后继续安装。</p>
                  <span aria-hidden="true">⌄</span>
                </summary>
                <div className="download-note-detail">
                  <p>当前安装包用于内测分发。Windows 如果提示“未知发布者”或安全提醒，请确认下载来源是本页面后继续安装；macOS 如果拦截打开，请按上面的 Mac 首次打开提示处理。</p>
                </div>
              </details>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
