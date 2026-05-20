import { notFound } from "next/navigation";
import { ApiButton, ApiForm } from "@/components/api-form";
import { LicenseCodeGenerator } from "@/components/license-code-generator";
import { Panel } from "@/components/panel";
import { getBillingMode } from "@/lib/billing-mode";
import { getAdminDashboard, getAdminLicenseCenter } from "@/lib/projects";
import { getPersistenceStatus } from "@/lib/store-persistence";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

function avg(total: number, units: number) {
  return units > 0 ? total / units : 0;
}

function unitName(type: string) {
  switch (type) {
    case "analyze_chapters":
      return "章";
    case "generate_chapter":
      return "章正文";
    case "generate_task_card":
      return "任务卡";
    case "review_chapter":
      return "审稿";
    case "edit_second_draft":
      return "二稿";
    case "generate_outline":
      return "大纲";
    default:
      return "次";
  }
}

function typeName(type: string) {
  switch (type) {
    case "analyze_chapters":
      return "章节分析";
    case "generate_outline":
      return "生成大纲";
    case "generate_task_card":
      return "生成任务卡";
    case "generate_chapter":
      return "创作正文";
    case "review_chapter":
      return "审稿";
    case "edit_second_draft":
      return "二稿编辑";
    default:
      return "AI 任务";
  }
}

function usageByType(
  dashboard: Awaited<ReturnType<typeof getAdminDashboard>>,
  type: string
) {
  return dashboard.aiUsage.byType.find((item) => item.type === type);
}

function previewTaskCredits(item: {
  baseCredits: number;
  unitCredits: number;
  multiplier: number;
}) {
  return Math.ceil((item.baseCredits + item.unitCredits) * item.multiplier);
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

export default async function AdminPage() {
  let dashboard;
  let licenseCenter;
  let storage: Awaited<ReturnType<typeof getPersistenceStatus>>;

  try {
    [dashboard, licenseCenter, storage] = await Promise.all([
      getAdminDashboard(),
      getAdminLicenseCenter(),
      getPersistenceStatus()
    ]);
  } catch {
    notFound();
  }
  const analysisUsage = usageByType(dashboard, "analyze_chapters");
  const chapterDraftUsage = usageByType(dashboard, "generate_chapter");
  const reviewUsage = usageByType(dashboard, "review_chapter");
  const taskCardUsage = usageByType(dashboard, "generate_task_card");
  const isCreditsMode = getBillingMode() === "credits";

  return (
    <div className="grid">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="pill success">管理后台</div>
            <h1>{isCreditsMode ? "用户、灵石和 AI 任务运营" : "用户、授权和 AI 用量"}</h1>
            <p>{isCreditsMode ? "这里用于查看注册用户、灵石余额、AI 消耗情况，并给用户手动充值或赠送灵石。" : "当前是一次性授权/本地部署模式，这里主要查看用户、存储状态和 AI 任务用量。"}</p>
          </div>
          <div className="hero-actions">
            <span className="chip">用户 {formatNumber(dashboard.totalUsers)}</span>
            <span className="chip">管理员 {formatNumber(dashboard.adminUsers)}</span>
            <span className="chip">AI 任务 {formatNumber(dashboard.totalAiJobs)}</span>
          </div>
        </div>

        <div className="grid stats">
          <div className="stat-card">
            <strong>{formatNumber(dashboard.totalUsers)}</strong>
            <span>注册用户</span>
          </div>
          <div className="stat-card">
            <strong>{isCreditsMode ? formatNumber(dashboard.totalCreditsBalance) : "自带 Key"}</strong>
            <span>{isCreditsMode ? "用户剩余灵石" : "计费模式"}</span>
          </div>
          <div className="stat-card">
            <strong>{isCreditsMode ? formatNumber(dashboard.totalConsumed) : formatNumber(dashboard.aiUsage.totalTokens)}</strong>
            <span>{isCreditsMode ? "累计消耗灵石" : "累计算力"}</span>
          </div>
          <div className="stat-card">
            <strong>{isCreditsMode ? formatNumber(dashboard.totalRecharged) : formatNumber(dashboard.aiUsage.aiJobs)}</strong>
            <span>{isCreditsMode ? "累计充值/赠送" : "AI 调用任务"}</span>
          </div>
        </div>
      </section>

      <Panel title="存储状态" description="查看当前数据桥接和 PostgreSQL 镜像进度。">
        <div className="list">
          <div className="list-item">
            <div className="row">
              <strong>存储模式</strong>
              <span className={`pill ${storage.mode === "postgres" ? "success" : "warning"}`}>
                {storage.mode === "postgres" ? "PostgreSQL" : storage.mode === "sqlite" ? "SQLite" : "文件"}
              </span>
            </div>
            <div className="muted">数据库来源：{storage.databaseUrlConfigured ? "已配置" : "未配置"}</div>
            <div className="muted">读模式：{storage.readMode}</div>
          </div>
          <div className="meta-row">
            <span className="chip">AppState {storage.appStateCount}</span>
            <span className="chip">StoreRecord {storage.storeRecordCount}</span>
          </div>
          {storage.storeRecordEntities.length > 0 ? (
            <div className="meta-row">
              {storage.storeRecordEntities.slice(0, 6).map((item) => (
                <span key={item.entityType} className="chip">
                  {item.entityType} {item.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title="授权码管理" description="生成一次性授权码，查看激活状态，并处理客户换设备或误激活。">
        <div className="usage-summary">
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

        <LicenseCodeGenerator />

        <div className="list license-list">
          {licenseCenter.licenses.length === 0 ? (
            <div className="empty-state">
              <strong>暂无授权码</strong>
              <span>生成后会显示在这里；完整授权码只会在生成当次展示。</span>
            </div>
          ) : (
            licenseCenter.licenses.map((license) => (
              <div key={license.id} className="list-item">
                <div className="row">
                  <div>
                    <strong>{license.customerName || "未命名客户"}</strong>
                    <div className="muted">{license.customerContact || "未填写联系方式"}</div>
                  </div>
                  <span className={`pill ${licenseStatusClass(license.status)}`}>
                    {licenseStatusName(license.status)}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="chip">授权码 {license.codePreview}</span>
                  <span className="chip">激活 {license.activationCount}/{license.maxActivations}</span>
                  {license.machineHash ? <span className="chip">设备 {license.machineHash.slice(0, 8)}...</span> : null}
                  {license.activatedAt ? <span className="chip">首次激活 {formatTime(license.activatedAt)}</span> : null}
                  {license.lastVerifiedAt ? <span className="chip">最近验证 {formatTime(license.lastVerifiedAt)}</span> : null}
                  {license.expiresAt ? <span className="chip">到期 {formatTime(license.expiresAt)}</span> : null}
                </div>
                {license.notes ? <div className="muted">备注：{license.notes}</div> : null}
                <div className="row admin-license-actions">
                  {license.status === "disabled" ? (
                    <ApiButton
                      endpoint="/api/admin/licenses"
                      method="PATCH"
                      body={{ licenseId: license.id, action: "enable" }}
                      label="恢复授权码"
                      className="button secondary"
                    />
                  ) : (
                    <ApiButton
                      endpoint="/api/admin/licenses"
                      method="PATCH"
                      body={{ licenseId: license.id, action: "disable" }}
                      label="禁用授权码"
                      className="button danger"
                      confirmMessage="确定禁用这个授权码吗？"
                    />
                  )}
                  <ApiButton
                    endpoint="/api/admin/licenses"
                    method="PATCH"
                    body={{ licenseId: license.id, action: "reset" }}
                    label="重置设备绑定"
                    className="button secondary"
                    confirmMessage="确定重置这个授权码的设备绑定吗？客户需要重新激活。"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel title="AI 消耗看板" description={isCreditsMode ? "看清每类功能的算力用量和灵石成本。" : "看清每类功能的算力用量；模型费用由部署方或用户自己的 Key 承担。"}>
        <div className="usage-summary">
          <div className="stat-card">
            <strong>{formatNumber(dashboard.aiUsage.totalTokens)}</strong>
            <span>总算力用量</span>
          </div>
          <div className="stat-card">
            <strong>{isCreditsMode ? formatNumber(dashboard.aiUsage.actualCredits) : "不扣费"}</strong>
            <span>{isCreditsMode ? "AI 实扣灵石" : "平台计费"}</span>
          </div>
          <div className="stat-card">
            <strong>{formatNumber(avg(analysisUsage?.totalTokens ?? 0, analysisUsage?.units ?? 0))}</strong>
            <span>分析一章算力</span>
          </div>
          <div className="stat-card">
            <strong>{formatNumber(avg(chapterDraftUsage?.totalTokens ?? 0, chapterDraftUsage?.units ?? 0))}</strong>
            <span>创作一章算力</span>
          </div>
        </div>

        <div className="usage-summary">
          <div className="stat-card">
            <strong>{isCreditsMode ? formatNumber(avg(analysisUsage?.actualCredits ?? 0, analysisUsage?.units ?? 0)) : "自理"}</strong>
            <span>{isCreditsMode ? "分析一章灵石" : "分析费用"}</span>
          </div>
          <div className="stat-card">
            <strong>{isCreditsMode ? formatNumber(avg(chapterDraftUsage?.actualCredits ?? 0, chapterDraftUsage?.units ?? 0)) : "自理"}</strong>
            <span>{isCreditsMode ? "创作一章灵石" : "创作费用"}</span>
          </div>
          <div className="stat-card">
            <strong>{formatNumber(avg(reviewUsage?.totalTokens ?? 0, reviewUsage?.units ?? 0))}</strong>
            <span>审稿一次算力</span>
          </div>
          <div className="stat-card">
            <strong>{formatNumber(avg(taskCardUsage?.totalTokens ?? 0, taskCardUsage?.units ?? 0))}</strong>
            <span>任务卡一次算力</span>
          </div>
        </div>

        {dashboard.aiUsage.byType.length > 0 ? (
          <div className="usage-table">
            <div className="usage-table-row usage-table-head">
              <span>功能</span>
              <span>次数</span>
              <span>单位</span>
              <span>总算力</span>
              <span>平均算力</span>
              <span>{isCreditsMode ? "平均灵石" : "费用"}</span>
            </div>
            {dashboard.aiUsage.byType.map((item) => (
              <div key={item.type} className="usage-table-row">
                <strong>{typeName(item.type)}</strong>
                <span>{formatNumber(item.jobs)}</span>
                <span>{formatNumber(item.units)} {unitName(item.type)}</span>
                <span>{formatNumber(item.totalTokens)}</span>
                <span>{formatNumber(avg(item.totalTokens, item.units))} / {unitName(item.type)}</span>
                <span>{isCreditsMode ? `${formatNumber(avg(item.actualCredits, item.units))} / ${unitName(item.type)}` : "自理"}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>暂无 AI 消耗数据</strong>
            <span>完成一次章节分析、正文生成或审稿后，这里会显示每类功能的平均成本。</span>
          </div>
        )}
      </Panel>

      <Panel title="用户列表" description={isCreditsMode ? "查看用户用量，并为用户手动补灵石。" : "查看用户项目、任务和 AI 用量。"}>
        <div className="list">
          {dashboard.users.length === 0 ? (
            <div className="empty-state">
              <strong>暂无用户</strong>
              <span>注册用户后会显示在这里。</span>
            </div>
          ) : (
            dashboard.users.map((user) => (
              <div key={user.id} className="list-item">
                <div className="row">
                  <div>
                    <strong>{user.name}</strong>
                    <div className="muted">{user.email}</div>
                  </div>
                  <span className={`pill ${user.role === "admin" ? "success" : "warning"}`}>
                    {user.role === "admin" ? "管理员" : "用户"}
                  </span>
                </div>

                <div className="meta-row">
                  <span className="chip">套餐 {user.plan}</span>
                  {!isCreditsMode && user.licenseCustomerId ? <span className="chip">客户 {user.licenseCustomerId}</span> : null}
                  {!isCreditsMode && user.licenseActivatedAt ? <span className="chip">激活 {formatTime(user.licenseActivatedAt)}</span> : null}
                  {isCreditsMode ? <span className="chip">灵石余额 {formatNumber(user.creditsBalance)}</span> : null}
                  <span className="chip">项目 {formatNumber(user.projectCount)}</span>
                  <span className="chip">任务 {formatNumber(user.aiJobCount)}</span>
                  <span className="chip">模型 {user.aiModel}</span>
                  {isCreditsMode ? <span className="chip">倍率 {user.aiBillingMarkup}x</span> : null}
                  {isCreditsMode ? <span className="chip">最低 {formatNumber(user.aiBillingMinimum)} 灵石</span> : null}
                  <span className="chip">算力 {formatNumber(user.aiTokenTotal)}</span>
                  {isCreditsMode ? <span className="chip">AI实扣灵石 {formatNumber(user.aiCreditActual)}</span> : null}
                  {isCreditsMode ? <span className="chip">消耗 {formatNumber(user.creditConsumed)}</span> : null}
                  {isCreditsMode ? <span className="chip">充值/赠送 {formatNumber(user.creditRecharged)}</span> : null}
                  <span className="chip">活跃 {formatTime(user.lastActiveAt)}</span>
                </div>

                {isCreditsMode ? (
                <ApiForm className="forms" endpoint="/api/admin/credits" resetOnSuccess>
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="split-panels">
                    <div className="field">
                      <div className="field-label">赠送灵石</div>
                      <input name="amount" type="number" min="1" step="1" placeholder="例如：10000" />
                    </div>
                    <div className="field">
                      <div className="field-label">备注</div>
                      <input name="reason" placeholder="例如：内测补贴 / 客服补偿 / 线下充值" />
                    </div>
                  </div>
                  <button className="button" type="submit">
                    手动充值灵石
                  </button>
                </ApiForm>
                ) : null}

                {isCreditsMode ? (
                <ApiForm className="forms" endpoint="/api/admin/user-ai-controls">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="admin-control-grid">
                    <div className="field">
                      <div className="field-label">模型档位</div>
                      <select name="model" defaultValue={user.aiModel}>
                        <option value="platform-fast">快速档：成本低，适合拆书和常规生成</option>
                        <option value="platform-quality">质量档：质量更稳，适合重点正文</option>
                      </select>
                    </div>
                    <div className="field">
                      <div className="field-label">灵石倍率</div>
                      <input
                        name="aiBillingMarkup"
                        type="number"
                        min="1"
                        step="0.1"
                        defaultValue={user.aiBillingMarkup}
                      />
                    </div>
                    <div className="field">
                      <div className="field-label">最低实扣灵石</div>
                      <input
                        name="aiBillingMinimum"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={user.aiBillingMinimum}
                      />
                    </div>
                  </div>
                  <div className="usage-table task-pricing-table">
                    <div className="usage-table-row usage-table-head">
                      <span>任务</span>
                      <span>基础价</span>
                      <span>单位价</span>
                      <span>倍率</span>
                      <span>预览</span>
                    </div>
                    {user.aiTaskPricing.map((item) => (
                      <div key={item.type} className="usage-table-row">
                        <strong>
                          {item.label}
                          <span className="muted"> / {item.unitLabel}</span>
                        </strong>
                        <input
                          name={`pricing.${item.type}.baseCredits`}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={item.baseCredits}
                          aria-label={`${item.label}基础价`}
                        />
                        <input
                          name={`pricing.${item.type}.unitCredits`}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={item.unitCredits}
                          aria-label={`${item.label}单位价`}
                        />
                        <input
                          name={`pricing.${item.type}.multiplier`}
                          type="number"
                          min="0"
                          step="0.1"
                          defaultValue={item.multiplier}
                          aria-label={`${item.label}倍率`}
                        />
                        <span className="chip">
                          {item.isCustom ? "自定义" : "默认"} {formatNumber(previewTaskCredits(item))} 灵石
                        </span>
                      </div>
                    ))}
                  </div>
                  <button className="button secondary" type="submit">
                    保存 AI 与灵石策略
                  </button>
                </ApiForm>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
