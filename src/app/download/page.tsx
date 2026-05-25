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
            <div className="download-calligraphy">好故事<br />不止一章<br />更要稳稳写下去</div>
            <div className="download-slogan-side">
              <strong>Good stories</strong>
              <span>structure first</span>
              <span>write longer</span>
            </div>
          </div>

          <section className="download-panel" aria-label="版本选择">
            <div className="download-panel-head">
              <div>
                {/* <span className="download-kicker">桌面客户端下载</span> */}
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
              {options.map((option) => {
                const size = formatBytes(option.file?.sizeBytes);
                const hasDownload = Boolean(option.file || option.url);
                const href = hasDownload ? option.url || "#" : "#";
                const meta = [option.arch, size, formatDate(manifest.releaseDate)]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <article key={option.key} className={`download-card ${hasDownload ? "" : "disabled"}`}>
                    <div className="download-card-head">
                      <span className="download-platform">{option.platform}</span>
                      {option.badge ? <span className="download-badge">{option.badge}</span> : null}
                    </div>
                    <div className="download-card-body">
                      <h2>
                        <span>{option.title}</span>
                        <em>客户端 v{manifest.version}</em>
                      </h2>
                      <p>{option.subtitle}</p>
                      <div className="download-card-meta">{meta}</div>
                    </div>
                    {hasDownload ? (
                      <a className="download-card-button" href={href}>
                        立即下载
                      </a>
                    ) : (
                      <span className="download-card-button disabled">暂未发布</span>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="download-notes">
              <div>
                <strong>隐私保护</strong>
                <p>作品、草稿、设定、人物档案和项目数据默认保存在你的电脑里，不上传到我们的服务器。</p>
              </div>
              {manifest.announcement ? (
                <div>
                  <strong>发布公告</strong>
                  <p>{manifest.announcement}</p>
                </div>
              ) : null}
              <div>
                <strong>Mac 首次打开</strong>
                <ol>
                  <li>解压后先拖入“应用程序”。</li>
                  {/* <li>按住 Control 点应用图标，选择“打开”。</li> */}
                  <li>如提示已损坏，在终端执行：</li>
                </ol>
                <code>xattr -dr com.apple.quarantine "/Applications/AI 网文写作助手.app"</code>
              </div>
              <div>
                <strong>内测说明</strong>
                <p>当前包已做内测用 ad-hoc 签名，Windows 若提示未知发布者，确认来源可信后继续安装。</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
