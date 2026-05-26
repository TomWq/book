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
  title: "下载中心 - AI 网文写作助手",
  description: "下载 AI 网文写作助手 Windows 和 macOS 客户端。"
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
  const manualHtmlUrl = "/manual/AI网文写作助手使用手册.html";
  const manualPdfUrl = "/manual/AI网文写作助手使用手册.pdf";
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
    },
    {
      key: "darwinX64",
      title: "Mac Intel 版",
      shortTitle: "Mac Intel",
      subtitle: "适用于 Intel 芯片 Mac。苹果芯片用户不要下载这个版本。",
      platform: "macOS",
      arch: "Intel",
      url: getManifestDownloadUrl(manifest, "darwinX64") ? getAppDownloadUrl("darwinX64") : "",
      file: manifest.files?.darwinX64
    }
  ];
  const availableCount = options.filter((item) => item.file || item.url).length;
  const primaryOption = options[0];
  const secondaryOptions = options.slice(1);

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
              <span>桌面客户端</span>
            </div>
          </div>
        </header>

        <div className="download-layout">
          <div className="download-slogan">
            <div className="download-calligraphy">
              <span>灯下起长卷</span>
              <span>笔端生云烟</span>
              <span>胸中藏万象</span>
              <span>落笔自成篇</span>
            </div>
          </div>

          <section className="download-panel" aria-label="版本选择">
            <div className="download-panel-head">
              <div>
                <span className="download-kicker">桌面客户端下载</span>
                <h1>选择你的安装版本</h1>
                <p>选择适合你电脑的版本，安装后使用授权码激活。</p>
              </div>
              <div className="download-manual-actions">
                <a className="download-card-button primary" href={manualHtmlUrl} target="_blank" rel="noreferrer">
                  查看使用说明
                </a>
                <a className="download-card-button" href={manualPdfUrl}>
                  PDF
                </a>
              </div>
            </div>

            <div className="download-hero-meta">
              <span>{availableCount} 个版本可下载</span>
              <span>{manifest.required ? "重要更新" : "内测发布"}</span>
              <span>创作数据仅保存在本机</span>
            </div>

            <div className="download-grid">
              <article className={`download-card download-primary-card ${primaryOption.file || primaryOption.url ? "" : "disabled"}`}>
                <div className="download-recommend-badge">推荐版本</div>
                <div className="download-primary-main">
                  <span className="download-os-icon windows" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <div className="download-primary-heading">
                    <h2>
                      <span>{primaryOption.title}</span>
                    </h2>
                    <div className="download-card-version">客户端 v{manifest.version}</div>
                  </div>
                  <p>{primaryOption.subtitle}</p>
                  <div className="download-card-meta">{renderDownloadMeta(primaryOption)}</div>
                </div>
                {primaryOption.file || primaryOption.url ? (
                  <a className="download-card-button" href={renderDownloadHref(primaryOption)}>
                    立即下载 <span aria-hidden="true">↓</span>
                  </a>
                ) : (
                  <span className="download-card-button disabled">暂未发布</span>
                )}
              </article>

              <div className="download-secondary-list">
                {secondaryOptions.map((option) => {
                  const hasDownload = Boolean(option.file || option.url);

                  return (
                    <article key={option.key} className={`download-card download-secondary-card ${hasDownload ? "" : "disabled"}`}>
                      <span className="download-os-icon mac" aria-hidden="true"></span>
                      <div className="download-secondary-heading">
                        <h2>{option.platform} ({option.arch})</h2>
                        <div className="download-card-version">
                          <span>{option.title}</span>
                          <em>客户端 v{manifest.version}</em>
                        </div>
                      </div>
                      <p>{option.subtitle}</p>
                      <div className="download-card-meta">{renderDownloadMeta(option)}</div>
                      {hasDownload ? (
                        <a className="download-card-button" href={renderDownloadHref(option)}>
                          下载 <span aria-hidden="true">↓</span>
                        </a>
                      ) : (
                        <span className="download-card-button disabled">暂未发布</span>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="download-notes">
              {manifest.announcement ? (
                <div className="download-note announcement">
                  <strong>发布公告</strong>
                  <p>{manifest.announcement}</p>
                </div>
              ) : null}
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
                  <code>xattr -dr com.apple.quarantine "/Applications/AI 网文写作助手.app"</code>
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
