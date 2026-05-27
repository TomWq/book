import { AccountBackupActions } from "@/components/account-backup-actions";
import { AccountRestoreActions } from "@/components/account-restore-actions";
import Link from "next/link";
import { Panel } from "@/components/panel";
import { LicenseSessionActions } from "@/components/license-session-actions";
import { VersionUpdateCard } from "@/components/version-update-card";
import { getCurrentAppVersion } from "@/lib/app-update";
import { isDesktopRuntime } from "@/lib/app-runtime";
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
  const desktopRuntime = isDesktopRuntime();
  const currentVersion = getCurrentAppVersion();

  return (
    <div className="account-page">
      <Panel
        title={desktopRuntime ? "账号与授权" : "账号与数据"}
        description={desktopRuntime
          ? "当前客户端使用一次性授权，AI 调用走你自己配置的服务商 Key。"
          : "网页端使用账号登录，AI 调用走你自己配置的服务商 Key。"}
      >
        <div className="account-overview">
          {desktopRuntime ? (
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
          ) : (
            <div className="account-balance-card">
              <span className="muted">网页账号</span>
              <div className="license-status-line">
                <strong>{overview.user.name}</strong>
                <span className="pill success">{overview.planName}</span>
              </div>
              <p>{overview.user.email}</p>
              <div className="license-detail-grid">
                <span>笔名</span>
                <strong>{overview.user.penName || "未设置"}</strong>
                <span>助手名称</span>
                <strong>{overview.user.assistantName || "墨澜"}</strong>
                <span>账号 ID</span>
                <strong>{overview.user.id.slice(0, 8)}</strong>
                <span>配置状态</span>
                <strong>{overview.aiSettings.model ? "已配置 AI 服务" : "未配置 AI 服务"}</strong>
              </div>
            </div>
          )}

          <div className="account-data-tools">
            <div>
              <span className="muted">{desktopRuntime ? "本地数据" : "账号数据"}</span>
              <strong>备份与恢复</strong>
              <p>
                {desktopRuntime
                  ? "导出 JSON 文件，适合换电脑、重装前保存，或在恢复数据前留一份保险。"
                  : "导出 JSON 文件，适合迁移账号数据，或在恢复数据前留一份保险。"}
              </p>
            </div>
            <div className="account-data-actions">
              <AccountBackupActions />
              <AccountRestoreActions />
            </div>
          </div>

          <div className="account-data-tools">
            <div>
              <span className="muted">帮助文档</span>
              <strong>使用手册</strong>
              <p>查看完整使用流程。PDF 文件会随安装包一起发布，适合放在下载中心或单独发给用户。</p>
            </div>
            <div className="account-data-actions">
              <Link href="/manual" className="button primary">
                查看手册
              </Link>
            </div>
          </div>
        </div>
      </Panel>

      {desktopRuntime ? (
        <Panel
          title="版本更新"
          description="检查当前客户端是否有新版本。内测阶段先使用手动下载安装，避免自动更新影响写作数据。"
        >
          <VersionUpdateCard currentVersion={currentVersion} />
        </Panel>
      ) : null}
    </div>
  );
}
