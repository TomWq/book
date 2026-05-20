import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton } from "@/components/api-form";
import { LicenseCodeGenerator } from "@/components/license-code-generator";
import { Panel } from "@/components/panel";
import { getAdminLicenseCenter } from "@/lib/projects";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

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

function licenseStatusName(status: string) {
  switch (status) {
    case "unused":
      return "未使用";
    case "active":
      return "已激活";
    case "disabled":
      return "已禁用";
    case "expired":
      return "已过期";
    default:
      return "未知";
  }
}

function licenseStatusClass(status: string) {
  return status === "active" ? "success" : status === "unused" ? "warning" : "danger";
}

function logReasonName(reason: string) {
  switch (reason) {
    case "activated":
      return "首次激活";
    case "verified_same_machine":
      return "同设备验证";
    case "not_found":
      return "授权码不存在";
    case "disabled":
      return "授权码已禁用";
    case "expired":
      return "授权码已过期";
    case "already_bound_other_machine":
      return "其他设备尝试";
    case "activation_limit_reached":
      return "超过激活次数";
    default:
      return reason || "未知原因";
  }
}

function compactMachine(value?: string) {
  return value ? `${value.slice(0, 10)}...` : "-";
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  let licenseCenter;

  try {
    licenseCenter = await getAdminLicenseCenter();
  } catch {
    notFound();
  }

  const query = searchParams ? await searchParams : {};
  const totalPages = Math.max(1, Math.ceil(licenseCenter.licenses.length / PAGE_SIZE));
  const currentPage = Math.min(totalPages, numberParam(query.page));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageLicenses = licenseCenter.licenses.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="grid license-admin-page">
      <section className="hero license-admin-hero">
        <div className="hero-top">
          <div>
            <div className="pill success">授权中心</div>
            <h1>授权码管理</h1>
            <p>批量生成一次性授权码，查看激活状态、设备绑定、最近验证和异常激活记录。</p>
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
            <span>已激活</span>
          </div>
          <div className="stat-card">
            <strong>{formatNumber(licenseCenter.disabled + licenseCenter.expired)}</strong>
            <span>不可用</span>
          </div>
        </div>
      </section>

      <Panel title="批量生成授权码" description="完整授权码只会在生成后显示一次，建议立即交付或保存到你自己的客户记录里。">
        <LicenseCodeGenerator />
      </Panel>

      <Panel title="授权码列表" description="按创建时间倒序显示，支持分页、禁用、恢复和重置设备绑定。">
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
              <span>激活</span>
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
                    <strong>{license.codePreview}</strong>
                    {license.notes ? <div className="muted">{license.notes}</div> : null}
                  </div>
                  <div>
                    <strong>{license.customerName || "未填写"}</strong>
                    <div className="muted">{license.customerContact || "无联系方式"}</div>
                  </div>
                  <div>
                    <span className={`pill ${licenseStatusClass(license.status)}`}>
                      {licenseStatusName(license.status)}
                    </span>
                  </div>
                  <div>
                    <strong>{license.activationCount}/{license.maxActivations}</strong>
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
                    {license.status === "disabled" ? (
                      <ApiButton
                        endpoint="/api/admin/licenses"
                        method="PATCH"
                        body={{ licenseId: license.id, action: "enable" }}
                        label="恢复"
                        className="button secondary"
                      />
                    ) : (
                      <ApiButton
                        endpoint="/api/admin/licenses"
                        method="PATCH"
                        body={{ licenseId: license.id, action: "disable" }}
                        label="禁用"
                        className="button danger"
                        confirmMessage="确定禁用这个授权码吗？"
                      />
                    )}
                    <ApiButton
                      endpoint="/api/admin/licenses"
                      method="PATCH"
                      body={{ licenseId: license.id, action: "reset" }}
                      label="重置设备"
                      className="button secondary"
                      confirmMessage="确定重置这个授权码的设备绑定吗？客户需要重新激活。"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pagination">
          {currentPage > 1 ? (
            <Link className="button secondary" href={`/admin?page=${currentPage - 1}`}>
              上一页
            </Link>
          ) : (
            <span className="button secondary disabled">上一页</span>
          )}
          <span className="chip">
            第 {currentPage.toLocaleString("zh-CN")} / {totalPages.toLocaleString("zh-CN")} 页
          </span>
          {currentPage < totalPages ? (
            <Link className="button secondary" href={`/admin?page=${currentPage + 1}`}>
              下一页
            </Link>
          ) : (
            <span className="button secondary disabled">下一页</span>
          )}
        </div>
      </Panel>

      <Panel title="最近激活记录" description="展示最近的授权验证、首次激活和失败原因，用于排查客户换机或误输授权码。">
        {licenseCenter.recentLogs.length === 0 ? (
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
            {licenseCenter.recentLogs.map((log) => (
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
      </Panel>
    </div>
  );
}
