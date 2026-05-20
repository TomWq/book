import { redirect } from "next/navigation";
import { AiConnectionTester } from "@/components/ai-connection-tester";
import { ApiForm } from "@/components/api-form";
import { Panel } from "@/components/panel";
import { getCurrentUser, getPublicAiSettings } from "@/lib/projects";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const AI_MODES = [
  {
    value: "deepseek-v4-flash",
    label: "省灵石模式",
    badge: "推荐日常使用",
    description: "适合拆书分析、任务卡、普通审稿和大多数测试，速度更快，灵石消耗更省。",
    examples: ["拆书分析", "生成任务卡", "日常审稿"]
  },
  {
    value: "deepseek-v4-pro",
    label: "高质量模式",
    badge: "适合关键正文",
    description: "适合正式正文、关键章节、复杂设定承接和二稿精修，质量更稳，灵石消耗更高。",
    examples: ["正式正文", "关键章节", "复杂二稿"]
  }
];

export default async function AiSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/settings/ai");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  const settings = await getPublicAiSettings();
  const isSubscriptionMode = settings.billingMode === "subscription";
  const activeModel = settings.model || DEFAULT_MODEL;
  const activeMode = AI_MODES.find((item) => item.value === activeModel) ?? AI_MODES[0];

  if (isSubscriptionMode) {
    return (
      <div className="grid">
        <section className="hero">
          <div className="hero-top">
            <div>
              <div className="pill success">自带 AI Key</div>
              <h1>配置你自己的 AI 服务</h1>
              <p>
                当前是一次性授权/本地部署模式，不走灵石扣费。这里保存的是当前账号自己的 AI 地址、Key 和模型名。
              </p>
            </div>
            <div className="hero-actions">
              <span className="chip">{settings.hasApiKey ? `Key ${settings.apiKeyPreview}` : "未填写 Key"}</span>
            </div>
          </div>
        </section>

        <Panel title="AI 接口配置" description="保存后，新建的分析、创作、审稿和二稿任务会使用这里的配置。">
          <ApiForm className="forms" endpoint="/api/settings/ai" method="PUT" booleanFields={["clearApiKey"]}>
            <div className="split-panels">
              <div className="field">
                <div className="field-label">服务商名称</div>
                <input name="providerName" defaultValue={settings.providerName || "Custom"} placeholder="例如：DeepSeek / OpenAI / OpenRouter" />
              </div>
              <div className="field">
                <div className="field-label">模型名称</div>
                <input name="model" defaultValue={settings.model} placeholder="例如：deepseek-chat / gpt-4.1-mini" />
              </div>
            </div>
            <div className="field">
              <div className="field-label">请求地址</div>
              <input name="baseUrl" defaultValue={settings.baseUrl} placeholder="例如：https://api.deepseek.com" />
            </div>
            <div className="split-panels">
              <div className="field">
                <div className="field-label">API Key</div>
                <input name="apiKey" type="password" placeholder={settings.hasApiKey ? `已保存 ${settings.apiKeyPreview}，留空则不修改` : "填写你的 API Key"} />
              </div>
              <div className="field">
                <div className="field-label">超时时间 ms</div>
                <input name="timeoutMs" type="number" min="1000" step="1000" defaultValue={settings.timeoutMs || 60000} />
              </div>
            </div>
            <label className="checkbox-row">
              <input name="clearApiKey" type="checkbox" value="true" />
              <span>清空已保存的 API Key</span>
            </label>
            <div className="hero-actions">
              <button className="button primary" type="submit">
                保存 AI 配置
              </button>
            </div>
          </ApiForm>
        </Panel>

        <Panel title="连接测试" description="确认配置能正常请求模型。">
          <AiConnectionTester />
        </Panel>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="pill success">AI 模式</div>
            <h1>选择本次创作的生成质量</h1>
            <p>
              这里不会展示底层模型配置。你只需要按当前任务选择“省灵石”或“高质量”，之后新建的 AI 任务会按这个模式执行。
            </p>
          </div>
          <div className="hero-actions">
            <span className="chip">当前：{activeMode.label}</span>
          </div>
        </div>
      </section>

      <Panel title="生成质量" description="切换后只影响之后新建的 AI 任务，已经入队或正在执行的任务不会改变。">
        <ApiForm
          className="forms"
          endpoint="/api/settings/ai"
          method="PUT"
          body={{
            providerName: "DeepSeek",
            baseUrl: DEEPSEEK_BASE_URL,
            timeoutMs: settings.timeoutMs || 60000
          }}
        >
          <div className="ai-mode-grid">
            {AI_MODES.map((mode) => (
              <label
                key={mode.value}
                className={`ai-mode-card ${mode.value === activeModel ? "active" : ""}`}
              >
                <input name="model" type="radio" value={mode.value} defaultChecked={mode.value === activeModel} />
                <span className="ai-mode-card-head">
                  <strong>{mode.label}</strong>
                  <em>{mode.badge}</em>
                </span>
                <span className="muted">{mode.description}</span>
                <span className="meta-row">
                  {mode.examples.map((example) => (
                    <span key={example} className="chip">
                      {example}
                    </span>
                  ))}
                </span>
              </label>
            ))}
          </div>

          <div className="quote-box">
            建议拆书、生成任务卡时使用省灵石模式；正式生成正文、关键剧情和复杂二稿时再切到高质量模式。
          </div>

          <div className="hero-actions">
            <button className="button primary" type="submit">
              保存 AI 模式
            </button>
          </div>
        </ApiForm>
      </Panel>
    </div>
  );
}
