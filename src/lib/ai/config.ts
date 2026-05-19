import { AsyncLocalStorage } from "node:async_hooks";
import { getAiSettings } from "@/lib/projects";

export type AiProviderConfig = {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

const aiModelOverrideStorage = new AsyncLocalStorage<string>();

export async function runWithAiModelOverride<T>(model: string | undefined, callback: () => Promise<T>) {
  const trimmed = model?.trim();

  if (!trimmed) {
    return callback();
  }

  return aiModelOverrideStorage.run(trimmed, callback);
}

export async function getAiProviderConfig(): Promise<AiProviderConfig> {
  const settings = await getAiSettings();
  const modelOverride = aiModelOverrideStorage.getStore();

  return {
    providerName: settings.providerName,
    baseUrl: settings.baseUrl.replace(/\/+$/, ""),
    apiKey: settings.apiKey,
    model: modelOverride || settings.model,
    timeoutMs: settings.timeoutMs
  };
}

export function assertAiProviderConfigured(config: AiProviderConfig) {
  const missing = [
    !config.baseUrl ? "请求地址" : "",
    !config.apiKey ? "API Key" : "",
    !config.model ? "模型名称" : ""
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`AI 配置不完整：请填写 ${missing.join("、")}`);
  }
}
