import { redirect } from "next/navigation";
import { AiConnectionTester } from "@/components/ai-connection-tester";
import { AiProfileManager } from "@/components/ai-profile-manager";
import { Panel } from "@/components/panel";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getCurrentUser, getPublicAiSettings } from "@/lib/projects";

export default async function AiSettingsPage() {
  const user = await getCurrentUser();
  const desktopRuntime = isDesktopRuntime();

  if (!user) {
    redirect("/login?next=/settings/ai");
  }

  if (user.role === "admin" && !desktopRuntime) {
    redirect("/admin");
  }

  const settings = await getPublicAiSettings();

  return (
    <div className="grid">
      <section className="hero">
        <div className="hero-top">
          <div>
            <h1>配置你自己的 AI 服务</h1>
            <p>保存兼容 OpenAI 的请求地址、API Key 和模型名，客户端会用这组配置完成拆书、创作和审稿。</p>
          </div>
          <div className="hero-actions">
            <span className="chip">当前模型 {settings.model || "未配置"}</span>
            <span className="chip">配置 {settings.profiles.length}</span>
          </div>
        </div>
      </section>

      <Panel title="AI 配置档案" description="可以保存多组服务商配置，例如 DeepSeek、OpenAI、通义、Moonshot、Ollama 或其他 OpenAI-compatible 接口。">
        <AiProfileManager profiles={settings.profiles} />
      </Panel>

      <Panel title="连接测试" description="确认当前配置能正常请求模型。">
        <AiConnectionTester />
      </Panel>
    </div>
  );
}
