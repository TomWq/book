import { redirect } from "next/navigation";
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
  const activeModel = settings.model || DEFAULT_MODEL;
  const activeMode = AI_MODES.find((item) => item.value === activeModel) ?? AI_MODES[0];

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
