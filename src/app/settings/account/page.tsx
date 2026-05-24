import { AccountRestoreActions } from "@/components/account-restore-actions";
import { Panel } from "@/components/panel";
import { LicenseSessionActions } from "@/components/license-session-actions";
import { VersionUpdateCard } from "@/components/version-update-card";
import { getCurrentAppVersion } from "@/lib/app-update";
import { getAccountOverview } from "@/lib/projects";

export const dynamic = "force-dynamic";

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString("zh-CN") : "未激活";
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString("zh-CN") : "未设置";
}

function compactMachine(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "未绑定";
  }

  return text.length > 18 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text;
}

function licenseStatusLabel(status: string) {
  if (status === "active") {
    return "授权正常";
  }

  if (status === "expired") {
    return "授权到期";
  }

  if (status === "disabled") {
    return "授权禁用";
  }

  if (status === "missing") {
    return "授权失效";
  }

  return "未激活";
}

function licenseStatusClass(status: string) {
  if (status === "active") {
    return "success";
  }

  if (status === "expired" || status === "disabled" || status === "missing") {
    return "danger";
  }

  return "warning";
}

function remainingLabel(expiresAt?: string) {
  if (!expiresAt) {
    return "永久授权";
  }

  const remainingMs = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "已到期";
  }

  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return days > 1 ? `剩余约 ${days} 天` : "24 小时内到期";
}

export default async function AccountSettingsPage() {
  const overview = await getAccountOverview();
  const license = overview.license;
  const currentVersion = getCurrentAppVersion();

  return (
    <div className="account-page">
      <Panel
        title="账号与授权"
        description="当前客户端使用一次性授权，AI 调用走你自己配置的服务商 Key。"
      >
        <div className="account-overview">
          <div className="account-balance-card">
            <span className="muted">授权状态</span>
            <div className="license-status-line">
              <strong>{licenseStatusLabel(license.status)}</strong>
              <span className={`pill ${licenseStatusClass(license.status)}`}>{remainingLabel(license.expiresAt)}</span>
            </div>
            <p>
              {license.customerId
                ? `客户 ID：${license.customerId}`
                : "当前账号没有绑定远程授权客户 ID。"}
            </p>
            <div className="license-detail-grid">
              <span>授权码</span>
              <strong>{license.codePreview || "未记录"}</strong>
              <span>本机设备</span>
              <strong>{compactMachine(license.machineHash)}</strong>
              <span>激活时间</span>
              <strong>{formatTime(license.activatedAt)}</strong>
              <span>最近校验</span>
              <strong>{formatTime(license.lastVerifiedAt)}</strong>
              <span>到期时间</span>
              <strong>{license.expiresAt ? formatDate(license.expiresAt) : "永久授权"}</strong>
            </div>
            {license.message ? <p className="license-status-note">{license.message}</p> : null}
            {license.customerId ? <LicenseSessionActions /> : null}
          </div>

          <div className="account-data-tools">
            <div>
              <span className="muted">本地数据</span>
              <strong>备份与恢复</strong>
              <p>导出 JSON 文件，适合换电脑、重装前保存，或在恢复数据前留一份保险。</p>
            </div>
            <div className="account-data-actions">
              <a href="/api/account/export" className="button primary">
                导出备份
              </a>
              <AccountRestoreActions />
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="版本更新"
        description="检查当前客户端是否有新版本。内测阶段先使用手动下载安装，避免自动更新影响写作数据。"
      >
        <VersionUpdateCard currentVersion={currentVersion} />
      </Panel>
    </div>
  );
}
