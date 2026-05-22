import Link from "next/link";
import { Panel } from "@/components/panel";
import { getAccountOverview } from "@/lib/projects";

export const dynamic = "force-dynamic";

function percentage(value: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / limit) * 100));
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString("zh-CN") : "未激活";
}

export default async function AccountSettingsPage() {
  const overview = await getAccountOverview();
  const usageRows = [
    { label: "项目", value: overview.usage.projects, limit: overview.limits.projects },
    { label: "模板", value: overview.usage.templates, limit: overview.limits.templates },
    { label: "本月 AI 任务", value: overview.usage.aiJobsThisMonth, limit: overview.limits.monthlyAiJobs },
    { label: "导入字符", value: overview.usage.importedCharacters, limit: overview.limits.importedCharacters }
  ];
  const activeModel = overview.aiSettings.model || "未配置";

  return (
    <div className="account-page">
      <Panel
        title="账号与授权"
        description="当前客户端使用一次性授权，AI 调用走你自己配置的服务商 Key。"
        action={
          <Link className="button primary" href="/settings/ai">
            配置 AI 服务
          </Link>
        }
      >
        <div className="account-overview">
          <div className="account-profile-card">
            <span className="muted">当前用户</span>
            <strong>{overview.user.name}</strong>
            <p>{overview.user.email}</p>
            <a href="/api/account/export" className="button small-button">
              导出数据
            </a>
          </div>

          <div className="account-balance-card">
            <span className="muted">授权状态</span>
            <strong>{overview.user.licenseCustomerId ? "已激活" : "本地账号"}</strong>
            <p>
              {overview.user.licenseCustomerId
                ? `客户 ID：${overview.user.licenseCustomerId}，激活时间：${formatTime(overview.user.licenseActivatedAt)}`
                : "当前账号没有绑定远程授权客户 ID。"}
            </p>
            {overview.user.licenseExpiresAt ? (
              <p>到期时间：{formatTime(overview.user.licenseExpiresAt)}</p>
            ) : overview.user.licenseCustomerId ? (
              <p>授权类型：永久激活</p>
            ) : null}
          </div>

          <div className="account-usage-grid">
            {usageRows.map((row) => (
              <div key={row.label} className="account-usage-card">
                <div className="row">
                  <strong>{row.label}</strong>
                  <span className="chip">
                    {row.value.toLocaleString("zh-CN")} / {row.limit.toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="usage-bar" aria-hidden="true">
                  <span style={{ width: `${percentage(row.value, row.limit)}%` }} />
                </div>
              </div>
            ))}
            <div className="quote-box account-usage-note">
              数据默认保存在本机；导出文件可用于备份、迁移或交给你自己保管。
            </div>
          </div>

          <div className="account-model-card">
            <span className="muted">当前模型</span>
            <strong>{activeModel}</strong>
            <p>分析、创作和审稿会使用你在 AI 设置里保存的地址、Key 和模型。</p>
            <Link href="/settings/ai" className="button small-button">
              配置 AI 服务
            </Link>
          </div>
        </div>
      </Panel>
    </div>
  );
}
