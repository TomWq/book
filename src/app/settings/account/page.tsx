import Link from "next/link";
import { Panel } from "@/components/panel";
import { formatAiJobType, getAccountOverview } from "@/lib/projects";

export const dynamic = "force-dynamic";

const AI_TASK_PREFIX = "AI 任务：";
const CREDIT_TRANSACTION_PAGE_SIZE = 40;

type CreditTransaction = Awaited<ReturnType<typeof getAccountOverview>>["billing"]["recentTransactions"][number];

type CreditEntry =
  | {
      kind: "ai-job";
      id: string;
      title: string;
      description: string;
      createdAt: string;
      balanceAfter: number;
      preauthorizedCredits: number;
      actualCredits: number | null;
      returnedCredits: number;
      extraCredits: number;
    }
  | {
      kind: "transaction";
      transaction: CreditTransaction;
      createdAt: string;
    };

function percentage(value: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / limit) * 100));
}

function numberParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function isAiSettlementReturn(reason: string) {
  return (
    reason.includes("实际 token 结算退款") ||
    reason.includes("实际 token 结算返还") ||
    reason.includes("实际算力结算返还")
  );
}

function isAiSettlementExtraCharge(reason: string) {
  return reason.includes("实际 token 结算补扣") || reason.includes("实际算力结算补扣");
}

function isAiFullReturn(reason: string) {
  return reason.includes("未使用模型") || reason.includes("失败返还") || reason.includes("失败退款");
}

function formatTransactionType(item: CreditTransaction) {
  switch (item.type) {
    case "consume":
      if (isAiSettlementExtraCharge(item.reason)) {
        return "结算补扣";
      }
      return "消耗";
    case "refund":
      if (isAiSettlementReturn(item.reason)) {
        return "结算返还";
      }
      if (isAiFullReturn(item.reason)) {
        return "任务退回";
      }
      return "返还";
    case "recharge":
      return "充值";
    case "grant":
      return "赠送";
    case "adjust":
      return "调整";
    default:
      return "流水";
  }
}

function formatTransactionReason(reason: string) {
  if (reason.startsWith(AI_TASK_PREFIX)) {
    return `${AI_TASK_PREFIX}${formatAiJobType(reason.slice(AI_TASK_PREFIX.length))}`;
  }

  if (isAiSettlementReturn(reason)) {
    return "按实际算力结算，多预扣的灵石已自动返还";
  }

  if (isAiSettlementExtraCharge(reason)) {
    return "按实际算力结算，实际消耗高于预扣，已补扣差额";
  }

  if (reason === "AI 任务未使用模型退款" || reason === "AI 任务未使用模型返还") {
    return "任务未实际调用模型，预扣灵石已退回";
  }

  return reason;
}

function formatSignedCredits(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("zh-CN")}`;
}

function formatPrice(priceCents: number) {
  return (priceCents / 100).toLocaleString("zh-CN", {
    maximumFractionDigits: 0
  });
}

function getAiJobTitle(rows: CreditTransaction[]) {
  const preauthorization = rows.find((item) => item.reason.startsWith(AI_TASK_PREFIX));

  if (!preauthorization) {
    return "AI 任务结算";
  }

  return `AI 任务结算：${formatAiJobType(preauthorization.reason.slice(AI_TASK_PREFIX.length))}`;
}

function getLatestTransaction(rows: CreditTransaction[]) {
  return rows.reduce((latest, item) => (item.createdAt > latest.createdAt ? item : latest), rows[0]);
}

function buildAiJobEntry(jobId: string, rows: CreditTransaction[]): CreditEntry {
  const preauthorizedCredits = rows
    .filter((item) => item.type === "consume" && item.reason.startsWith(AI_TASK_PREFIX))
    .reduce((total, item) => total + Math.abs(item.amount), 0);
  const extraCredits = rows
    .filter((item) => item.type === "consume" && isAiSettlementExtraCharge(item.reason))
    .reduce((total, item) => total + Math.abs(item.amount), 0);
  const returnedCredits = rows
    .filter((item) => item.type === "refund")
    .reduce((total, item) => total + Math.max(0, item.amount), 0);
  const hasSettlement = rows.some(
    (item) => isAiSettlementReturn(item.reason) || isAiSettlementExtraCharge(item.reason) || isAiFullReturn(item.reason)
  );
  const actualCredits = hasSettlement ? Math.max(0, preauthorizedCredits + extraCredits - returnedCredits) : null;
  const latest = getLatestTransaction(rows);
  const description = hasSettlement
    ? returnedCredits > 0
      ? `按实际算力结算，本次实扣 ${actualCredits?.toLocaleString("zh-CN")} 灵石，返还 ${returnedCredits.toLocaleString("zh-CN")} 灵石。`
      : extraCredits > 0
        ? `按实际算力结算，本次实扣 ${actualCredits?.toLocaleString("zh-CN")} 灵石，补扣 ${extraCredits.toLocaleString("zh-CN")} 灵石。`
        : `按实际算力结算，本次实扣 ${actualCredits?.toLocaleString("zh-CN")} 灵石。`
    : "任务开始时已预扣预计灵石，完成后会按实际算力自动结算。";

  return {
    kind: "ai-job",
    id: jobId,
    title: getAiJobTitle(rows),
    description,
    createdAt: latest.createdAt,
    balanceAfter: latest.balanceAfter,
    preauthorizedCredits,
    actualCredits,
    returnedCredits,
    extraCredits
  };
}

function buildCreditEntries(transactions: CreditTransaction[]) {
  const aiJobGroups = new Map<string, CreditTransaction[]>();
  const normalEntries: CreditEntry[] = [];

  for (const item of transactions) {
    if (item.relatedJobId) {
      const rows = aiJobGroups.get(item.relatedJobId) ?? [];
      rows.push(item);
      aiJobGroups.set(item.relatedJobId, rows);
    } else {
      normalEntries.push({
        kind: "transaction",
        transaction: item,
        createdAt: item.createdAt
      });
    }
  }

  const entries = [
    ...normalEntries,
    ...Array.from(aiJobGroups.entries()).map(([jobId, rows]) => buildAiJobEntry(jobId, rows))
  ];

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getPackageTag(index: number) {
  return `方案 ${index + 1}`;
}

function getPackageFeatures(packageId: string) {
  switch (packageId) {
    case "starter":
      return ["适合小范围测试拆书与生成", "可完成多次章节分析", "失败任务自动返还预扣灵石"];
    case "creator":
      return ["适合单本长篇稳定推进", "拆书、任务卡、正文生成更从容", "适合连续测试创作闭环"];
    case "studio":
      return ["适合高频创作和多项目并行", "大纲、正文、审稿都留足余量", "适合工作室或重度作者"];
    default:
      return ["可用于 AI 拆书、创作和审稿", "按实际算力结算", "余额可在灵石流水中查看"];
  }
}

export default async function AccountSettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const query = searchParams ? await searchParams : {};
  const requestedPage = numberParam(query.page);
  const overview = await getAccountOverview({
    creditTransactionLimit: CREDIT_TRANSACTION_PAGE_SIZE,
    creditTransactionOffset: (requestedPage - 1) * CREDIT_TRANSACTION_PAGE_SIZE
  });
  const usageRows = [
    { label: "项目", value: overview.usage.projects, limit: overview.limits.projects },
    { label: "模板", value: overview.usage.templates, limit: overview.limits.templates },
    { label: "本月 AI 任务", value: overview.usage.aiJobsThisMonth, limit: overview.limits.monthlyAiJobs },
    { label: "导入字符", value: overview.usage.importedCharacters, limit: overview.limits.importedCharacters }
  ];
  const billing = overview.billing;
  const isSubscriptionMode = overview.billingMode === "subscription";
  const activeModel = overview.aiSettings.model || "deepseek-v4-flash";
  const totalTransactionPages = Math.max(1, Math.ceil(billing.transactionTotalCount / billing.transactionLimit));
  const currentTransactionPage = Math.min(requestedPage, totalTransactionPages);
  const creditEntries = buildCreditEntries(billing.recentTransactions);

  return (
    <div className="account-page">
      <Panel
        title={isSubscriptionMode ? "账号与授权" : "账号与额度"}
        description={isSubscriptionMode ? "当前是一次性授权/本地部署模式，AI 消耗由你自己的 Key 承担。" : "查看当前套餐、用量和账号状态。"}
        action={
          isSubscriptionMode ? (
            <Link className="button primary" href="/settings/ai">
              配置 AI Key
            </Link>
          ) : (
            <a className="button primary" href="#recharge-lingshi">
              补充灵石
            </a>
          )
        }
      >
        <div className="account-overview">
          <div className="account-profile-card">
            <span className="muted">当前套餐</span>
            <strong>{overview.planName}</strong>
            <p>{overview.user.name} · {overview.user.email}</p>
            <a href="/api/account/export" className="button small-button">
              导出数据
            </a>
          </div>
          <div className="account-balance-card">
            <span className="muted">{isSubscriptionMode ? "计费模式" : "可用灵石"}</span>
            <strong>{isSubscriptionMode ? "自带 Key" : billing.creditsBalance.toLocaleString("zh-CN")}</strong>
            <p>{isSubscriptionMode ? "本地部署不扣灵石，模型费用由你配置的 AI 服务商结算。" : "AI 任务开始预扣，结束后按实际算力自动结算。"}</p>
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
              这是当前账号的真实用量统计。后续如果接套餐付费，这一页会直接接到升级入口。
            </div>
          </div>
          <div className="account-model-card">
            <span className="muted">{isSubscriptionMode ? "当前模型" : "当前 AI 模式"}</span>
            <strong>{isSubscriptionMode ? activeModel : activeModel.includes("pro") ? "高质量模式" : "省灵石模式"}</strong>
            <p>{isSubscriptionMode ? "分析、创作和审稿会使用你在 AI 设置里保存的地址、Key 和模型。" : activeModel.includes("pro") ? "适合正文和复杂二稿，灵石消耗更高。" : "适合拆书、任务卡和日常审稿。"}</p>
            <Link href="/settings/ai" className="button small-button">
              {isSubscriptionMode ? "配置 AI 服务" : "切换 AI 模式"}
            </Link>
          </div>
        </div>
      </Panel>

      {!isSubscriptionMode ? (
      <Panel title="灵石流水" description="AI 任务按“预扣预计灵石 → 实际算力结算”的方式记录。">
        <div className="list">
          <div className="quote-box">
            你看到的“结算返还”不是人工退款，而是任务开始先预扣一笔预计灵石，结束后按实际算力成本结算，多扣的部分自动退回。当前第 {currentTransactionPage.toLocaleString("zh-CN")} / {totalTransactionPages.toLocaleString("zh-CN")} 页，共 {billing.transactionTotalCount.toLocaleString("zh-CN")} 条原始流水。
          </div>
          {creditEntries.length === 0 ? (
            <div className="section-card">暂无灵石流水。</div>
          ) : (
            creditEntries.map((entry) => {
              if (entry.kind === "ai-job") {
                return (
                  <div key={entry.id} className="list-item">
                    <div className="row">
                      <strong>{entry.title}</strong>
                      <span className="chip">灵石余额 {entry.balanceAfter.toLocaleString("zh-CN")}</span>
                    </div>
                    <div className="muted">{entry.description}</div>
                    <div className="meta-row">
                      {entry.preauthorizedCredits > 0 ? (
                        <span className="chip">预扣 -{entry.preauthorizedCredits.toLocaleString("zh-CN")}</span>
                      ) : null}
                      <span className="chip">
                        实扣 {entry.actualCredits === null ? "结算中" : entry.actualCredits.toLocaleString("zh-CN")}
                      </span>
                      {entry.returnedCredits > 0 ? (
                        <span className="chip">返还 +{entry.returnedCredits.toLocaleString("zh-CN")}</span>
                      ) : null}
                      {entry.extraCredits > 0 ? (
                        <span className="chip">补扣 -{entry.extraCredits.toLocaleString("zh-CN")}</span>
                      ) : null}
                      <span className="chip">{new Date(entry.createdAt).toLocaleString("zh-CN")}</span>
                    </div>
                  </div>
                );
              }

              const item = entry.transaction;

              return (
                <div key={item.id} className="list-item">
                  <div className="row">
                    <strong>{formatTransactionType(item)}</strong>
                    <span className="chip">灵石余额 {item.balanceAfter.toLocaleString("zh-CN")}</span>
                  </div>
                  <div className="muted">{formatTransactionReason(item.reason)}</div>
                  <div className="meta-row">
                    <span className="chip">{formatSignedCredits(item.amount)}</span>
                    <span className="chip">{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                  </div>
                </div>
              );
            })
          )}
          {billing.transactionTotalCount > billing.transactionLimit ? (
            <div className="pagination">
              {currentTransactionPage > 1 ? (
                <Link className="button secondary" href={`/settings/account?page=${currentTransactionPage - 1}`}>
                  上一页
                </Link>
              ) : (
                <span className="button secondary disabled">上一页</span>
              )}
              <span className="chip">
                第 {currentTransactionPage.toLocaleString("zh-CN")} / {totalTransactionPages.toLocaleString("zh-CN")} 页
              </span>
              {currentTransactionPage < totalTransactionPages ? (
                <Link className="button secondary" href={`/settings/account?page=${currentTransactionPage + 1}`}>
                  下一页
                </Link>
              ) : (
                <span className="button secondary disabled">下一页</span>
              )}
            </div>
          ) : null}
        </div>
      </Panel>
      ) : null}

      {!isSubscriptionMode ? (
      <section id="recharge-lingshi" className="recharge-modal" aria-labelledby="recharge-title">
        <a className="recharge-backdrop" href="/settings/account" aria-label="关闭灵石补给窗口" />
        <div className="recharge-dialog">
          <div className="recharge-top">
            <div className="recharge-user">
              <div className="recharge-avatar" aria-hidden="true">
                石
              </div>
              <div>
                <div className="recharge-name">
                  <strong>{overview.user.name}</strong>
                  <span>作者模式</span>
                </div>
                <p>{overview.user.email} · 灵石余额 {billing.creditsBalance.toLocaleString("zh-CN")}</p>
              </div>
            </div>
            <div className="recharge-actions">
              <a className="button primary" href="#recharge-lingshi">
                充值灵石
              </a>
              <a className="icon-button" href="/settings/account" aria-label="关闭">
                ×
              </a>
            </div>
          </div>

          <div className="recharge-body">
            <div className="recharge-heading">
              <h2 id="recharge-title">灵石补给</h2>
              <p>用于拆书分析、生成任务卡、正文创作和二稿审稿；任务完成后按实际算力结算。</p>
            </div>

            <div className="recharge-plans">
              {billing.packages.map((item, index) => {
                const totalCredits = item.credits + item.bonusCredits;
                const isFeatured = item.id === "creator";

                return (
                  <article key={item.id} className={`recharge-plan ${isFeatured ? "featured" : ""}`}>
                    <div className="recharge-plan-head">
                      <div>
                        <span>{item.name}</span>
                        <h3>{item.credits.toLocaleString("zh-CN")} 灵石</h3>
                      </div>
                      <em>{getPackageTag(index)}</em>
                    </div>
                    <div className="recharge-price">
                      <span>¥</span>
                      <strong>{formatPrice(item.priceCents)}</strong>
                    </div>
                    <div className="recharge-gift">
                      <strong>到账 {totalCredits.toLocaleString("zh-CN")} 灵石</strong>
                      <span>含赠送 {item.bonusCredits.toLocaleString("zh-CN")} 灵石</span>
                    </div>
                    <span className="button primary recharge-plan-button">
                      联系管理员开通
                    </span>
                    <ul>
                      {getPackageFeatures(item.id).map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      ) : null}
    </div>
  );
}
