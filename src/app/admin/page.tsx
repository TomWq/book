import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApiButton } from "@/components/api-form";
import { CopyButton } from "@/components/copy-button";
import { LicenseCodeGenerator } from "@/components/license-code-generator";
import { Panel } from "@/components/panel";
import { ReleaseSettingsForm } from "@/components/release-settings-form";
import { getLocalUpdateManifest, type AppUpdateFile } from "@/lib/app-update";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getAdminLicenseCenter } from "@/lib/projects";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const RECENT_LOG_PAGE_SIZE = 10;

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString("zh-CN") : "-";
}

function numberParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function buildAdminHref(page: number, logsPage: number) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (logsPage > 1) {
    params.set("logsPage", String(logsPage));
  }

  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function licenseStatusName(status: string) {
  switch (status) {
    case "unused":
      return "未使用";
    case "used":
      return "已使用";
    case "disabled":
      return "已作废";
    case "expired":
      return "已过期";
    default:
      return "未知";
  }
}

function licenseStatusClass(status: string) {
  return status === "unused" ? "warning" : status === "used" ? "success" : "danger";
}

function logReasonName(reason: string) {
  switch (reason) {
    case "activated":
      return "首次激活";
    case "verified":
      return "状态校验";
    case "already_used":
      return "已使用";
    case "not_found":
      return "授权码不存在";
    case "disabled":
      return "授权码已作废";
    case "expired":
      return "授权码已过期";
    case "already_bound_other_machine":
      return "其他设备尝试";
    case "activation_limit_reached":
      return "已有绑定设备";
    case "machine_reset":
      return "设备已重置";
    default:
      return reason || "未知原因";
  }
}

function compactMachine(value?: string) {
  const text = String(value ?? "").trim();
  return text ? `${text.slice(0, 10)}...` : "-";
}

function compactId(value?: string) {
  const text = String(value ?? "").trim();
  return text ? `${text.slice(0, 8)}...${text.slice(-6)}` : "-";
}

function formatBytes(value?: number) {
  const bytes = Number(value ?? 0);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "-";
  }

  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

function shortHash(value?: string) {
  const text = String(value ?? "").trim();
  return text ? `${text.slice(0, 8)}...${text.slice(-6)}` : "-";
}

function releaseFileRows(files?: Record<string, AppUpdateFile | undefined>) {
  return [
    files?.win32X64,
    files?.darwinArm64,
    files?.darwinX64
  ].filter((item): item is AppUpdateFile => Boolean(item?.fileName || item?.url));
}

function bindingStatusName(license: { status: string; machineHash?: string; recentLogs: { reason: string }[] }) {
  if (license.status === "disabled") {
    return "已作废";
  }

  if (license.status === "expired") {
    return "已过期";
  }

  if (license.status === "used" && license.machineHash) {
    return "已绑定";
  }

  if (license.recentLogs.some((log) => log.reason === "machine_reset")) {
    return "已解绑可重新激活";
  }

  return "未绑定";
}

function bindingStatusClass(license: { status: string; machineHash?: string; recentLogs: { reason: string }[] }) {
  if (license.status === "used" && license.machineHash) {
    return "success";
  }

  if (license.status === "disabled" || license.status === "expired") {
    return "danger";
  }

  return "warning";
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string | string[]; logsPage?: string | string[] }>;
}) {
  if (isDesktopRuntime()) {
    redirect("/projects");
  }

  const query = searchParams ? await searchParams : {};
  const requestedPage = numberParam(query.page);
  const requestedLogsPage = numberParam(query.logsPage);

  let licenseCenter;

  try {
    licenseCenter = await getAdminLicenseCenter({
      recentLogLimit: RECENT_LOG_PAGE_SIZE,
      recentLogOffset: (requestedLogsPage - 1) * RECENT_LOG_PAGE_SIZE
    });
  } catch {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(licenseCenter.licenses.length / PAGE_SIZE));
  const logsTotalPages = Math.max(1, Math.ceil(licenseCenter.recentLogCount / RECENT_LOG_PAGE_SIZE));
  const currentPage = Math.min(totalPages, requestedPage);
  const currentLogsPage = Math.min(logsTotalPages, requestedLogsPage);

  if (currentPage !== requestedPage || currentLogsPage !== requestedLogsPage) {
    redirect(buildAdminHref(currentPage, currentLogsPage));
  }

  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageLicenses = licenseCenter.licenses.slice(pageStart, pageStart + PAGE_SIZE);
  const pageRecentLogs = licenseCenter.recentLogs.slice(0, RECENT_LOG_PAGE_SIZE);
  const releaseManifest = getLocalUpdateManifest();
  const releaseFiles = releaseFileRows(releaseManifest.files);

  return (
    <div className="grid license-admin-page">
      <section className="hero license-admin-hero">
        <div className="hero-top">
          <div>
            <h1>授权码管理</h1>
            <p>批量生成单设备授权码，查看绑定状态、客户信息、最近记录和异常激活记录。</p>
          </div>
          <div className="hero-actions">
            <span className="chip">每页 {PAGE_SIZE}</span>
            <span className="chip">第 {currentPage} / {totalPages} 页</span>
          </div>
        </div>

        <div className="grid stats">
          <div className="stat-card">
            <strong>{formatNumber(licenseCenter.total)}</strong>
            <span>授权码总数</span>
          </div>
          <div className="stat-card">
            <strong>{formatNumber(licenseCenter.unused)}</strong>
            <span>未使用</span>
          </div>
          <div className="stat-card">
            <strong>{formatNumber(licenseCenter.active)}</strong>
            <span>已绑定</span>
          </div>
          <div className="stat-card">
            <strong>{formatNumber(licenseCenter.disabled + licenseCenter.expired)}</strong>
            <span>不可用</span>
          </div>
        </div>
      </section>

      <Panel title="版本发布中心" description="管理客户端安装包发布信息。安装包地址、大小和校验码由上传脚本生成，版本号和发布说明可在这里调整。">
        <div className="release-admin-grid">
          <ReleaseSettingsForm
            initialValue={{
              version: releaseManifest.version,
              releaseDate: releaseManifest.releaseDate,
              notes: releaseManifest.notes,
              announcement: releaseManifest.announcement,
              required: releaseManifest.required
            }}
          />

          <div className="release-package-list">
            <div>
              <strong>当前安装包</strong>
              <p>发布后客户端检查更新和下载中心都会读取这里的清单。</p>
            </div>
            {releaseFiles.length ? (
              <div className="release-package-table">
                {releaseFiles.map((file) => (
                  <div key={file.fileName || file.url} className="release-package-row">
                    <div>
                      <strong>{file.label || file.fileName || "安装包"}</strong>
                      <span>{file.fileName || file.url}</span>
                    </div>
                    <span>{formatBytes(file.sizeBytes)}</span>
                    <span>{shortHash(file.sha256)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>暂无安装包清单</strong>
                <span>先执行 downloads:manifest 发布安装包清单。</span>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="批量生成授权码" description="当前为单设备授权。生成后可在授权码列表继续复制，旧版只保存哈希的授权码无法还原完整内容。">
        <LicenseCodeGenerator />
      </Panel>

      <Panel title="授权码列表" description="按创建时间倒序显示，支持分页、作废和删除。">
        {pageLicenses.length === 0 ? (
          <div className="empty-state">
            <strong>暂无授权码</strong>
            <span>先在上方批量生成授权码。</span>
          </div>
        ) : (
          <div className="license-table">
            <div className="license-table-row license-table-head">
              <span>授权码</span>
              <span>客户</span>
              <span>状态</span>
              <span>绑定</span>
              <span>设备</span>
              <span>时间</span>
              <span>最近来源</span>
              <span>操作</span>
            </div>

            {pageLicenses.map((license) => {
              const latestLog = license.recentLogs[0];

              return (
                <div key={license.id} className="license-table-row">
                  <div>
                    <div className="license-code-cell">
                      <strong>{license.plainCode || license.codePreview}</strong>
                      {license.plainCode ? <CopyButton value={license.plainCode} /> : null}
                    </div>
                    {!license.plainCode ? <div className="muted">旧记录仅保留预览，无法复制完整码</div> : null}
                    {license.notes ? <div className="muted">{license.notes}</div> : null}
                  </div>
                  <div>
                    <strong>{license.customerName || "未填写"}</strong>
                    <div className="license-code-cell muted">
                      <span>客户 ID：{compactId(license.id)}</span>
                      <CopyButton value={license.id} label="复制ID" />
                    </div>
                    <div className="muted">{license.customerContact || "无联系方式"}</div>
                  </div>
                  <div>
                    <span className={`pill ${licenseStatusClass(license.status)}`}>
                      {licenseStatusName(license.status)}
                    </span>
                  </div>
                  <div>
                    <span className={`pill ${bindingStatusClass(license)}`}>
                      {bindingStatusName(license)}
                    </span>
                    {license.expiresAt ? <div className="muted">到期 {formatTime(license.expiresAt)}</div> : null}
                  </div>
                  <div>
                    <span className="chip">{compactMachine(license.machineHash)}</span>
                  </div>
                  <div>
                    <div>创建 {formatTime(license.createdAt)}</div>
                    <div className="muted">激活 {formatTime(license.activatedAt)}</div>
                    <div className="muted">验证 {formatTime(license.lastVerifiedAt)}</div>
                  </div>
                  <div>
                    {latestLog ? (
                      <>
                        <span className={`pill ${latestLog.result === "success" ? "success" : "danger"}`}>
                          {logReasonName(latestLog.reason)}
                        </span>
                        <div className="muted license-client-name">{latestLog.clientName || "未记录来源"}</div>
                        <div className="muted">{formatTime(latestLog.createdAt)}</div>
                      </>
                    ) : (
                      <span className="muted">暂无记录</span>
                    )}
                  </div>
                  <div className="license-actions">
                    <ApiButton
                      endpoint="/api/admin/licenses"
                      method="PATCH"
                      body={{ licenseId: license.id, action: "resetMachine" }}
                      label="解绑设备"
                      className="button"
                      confirmMessage="确定解除这个授权码的设备绑定吗？解除后客户可用原授权码在新设备重新激活。"
                    />
                    <ApiButton
                      endpoint="/api/admin/licenses"
                      method="PATCH"
                      body={{ licenseId: license.id, action: "disable" }}
                      label="作废"
                      className="button danger"
                      confirmMessage="确定作废这个授权码吗？作废后不能再次使用。"
                    />
                    <ApiButton
                      endpoint="/api/admin/licenses"
                      method="PATCH"
                      body={{ licenseId: license.id, action: "delete" }}
                      label="删除"
                      className="button danger"
                      confirmMessage="确定永久删除这个授权码吗？测试数据和相关激活记录都会被删除。"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pagination">
          {currentPage > 1 ? (
            <Link className="button secondary" href={buildAdminHref(currentPage - 1, currentLogsPage)}>
              上一页
            </Link>
          ) : (
            <span className="button secondary disabled">上一页</span>
          )}
          <span className="chip">
            第 {currentPage.toLocaleString("zh-CN")} / {totalPages.toLocaleString("zh-CN")} 页
          </span>
          {currentPage < totalPages ? (
            <Link className="button secondary" href={buildAdminHref(currentPage + 1, currentLogsPage)}>
              下一页
            </Link>
          ) : (
            <span className="button secondary disabled">下一页</span>
          )}
        </div>
      </Panel>

      <Panel title="最近激活记录" description="展示最近的首次激活和失败原因，用于排查客户换机或误输授权码。">
        {pageRecentLogs.length === 0 ? (
          <div className="empty-state">
            <strong>暂无激活记录</strong>
            <span>客户端完成激活或验证后会出现在这里。</span>
          </div>
        ) : (
          <div className="usage-table license-log-table">
            <div className="usage-table-row usage-table-head">
              <span>结果</span>
              <span>原因</span>
              <span>设备</span>
              <span>来源</span>
              <span>时间</span>
            </div>
            {pageRecentLogs.map((log) => (
              <div key={log.id} className="usage-table-row">
                <span className={`pill ${log.result === "success" ? "success" : "danger"}`}>
                  {log.result === "success" ? "成功" : "失败"}
                </span>
                <strong>{logReasonName(log.reason)}</strong>
                <span>{compactMachine(log.machineHash)}</span>
                <span className="license-client-name">{log.clientName || "未记录来源"}</span>
                <span>{formatTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="pagination">
          {currentLogsPage > 1 ? (
            <Link className="button secondary" href={buildAdminHref(currentPage, currentLogsPage - 1)}>
              上一页
            </Link>
          ) : (
            <span className="button secondary disabled">上一页</span>
          )}
          <span className="chip">
            第 {currentLogsPage.toLocaleString("zh-CN")} / {logsTotalPages.toLocaleString("zh-CN")} 页
          </span>
          {currentLogsPage < logsTotalPages ? (
            <Link className="button secondary" href={buildAdminHref(currentPage, currentLogsPage + 1)}>
              下一页
            </Link>
          ) : (
            <span className="button secondary disabled">下一页</span>
          )}
        </div>
      </Panel>
    </div>
  );
}
