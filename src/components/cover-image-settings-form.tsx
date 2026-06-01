"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PublicCoverImageSettings = {
  providerName: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  dailyLimit: number;
  hasApiKey: boolean;
  apiKeyPreview: string;
  configured: boolean;
  quota: {
    limit: number;
    used: number;
    remaining: number;
    resetAt: string;
  };
};

type Status = { type: "idle" | "success" | "error" | "loading"; message: string };

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error ? String(body.error) : "操作失败，请稍后重试";
}

export function CoverImageSettingsForm({ settings }: { settings: PublicCoverImageSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl || "https://newapi.602774041.xyz/v1");
  const [model, setModel] = useState(settings.model || "gpt-image-2");
  const [timeoutMs, setTimeoutMs] = useState(settings.timeoutMs || 90000);
  const [dailyLimit, setDailyLimit] = useState(settings.dailyLimit || 3);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });

  async function saveSettings() {
    setStatus({ type: "loading", message: "正在保存封面生图配置..." });
    const response = await fetch("/api/admin/cover-image", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerName: "OpenAI Compatible Image",
        baseUrl,
        apiKey,
        model,
        timeoutMs,
        dailyLimit
      })
    });

    if (!response.ok) {
      setStatus({ type: "error", message: await readError(response) });
      return;
    }

    const body = await response.json().catch(() => ({}));
    const nextSettings = body?.settings as PublicCoverImageSettings | undefined;

    setApiKey("");
    setStatus({
      type: nextSettings?.configured ? "success" : "error",
      message: nextSettings?.configured ? "封面生图配置已保存并生效" : "配置还不完整，请确认请求地址、模型和 API Key 都已填写"
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="cover-image-settings-form">
      <div className="split-panels">
        <div className="field">
          <div className="field-label">请求地址</div>
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://newapi.602774041.xyz/v1" />
        </div>
        <div className="field">
          <div className="field-label">模型</div>
          <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-image-2" />
        </div>
      </div>
      <div className="split-panels">
        <div className="field">
          <div className="field-label">API Key</div>
          <input
            type="password"
            value={apiKey}
            placeholder={settings.hasApiKey ? `已保存 ${settings.apiKeyPreview}，留空则不修改` : "填写封面生图 API Key"}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </div>
        <div className="field">
          <div className="field-label">超时时间 ms</div>
          <input
            type="number"
            min="10000"
            step="1000"
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(Number(event.target.value) || 90000)}
          />
        </div>
      </div>
      <div className="field">
        <div className="field-label">每日免费生成次数</div>
        <input
          type="number"
          min="1"
          max="999"
          step="1"
          value={dailyLimit}
          onChange={(event) => setDailyLimit(Math.min(999, Math.max(1, Number(event.target.value) || 3)))}
        />
        <div className="field-hint">按当前 API Key 单独统计，换 Key 后会使用另一组当天次数。</div>
      </div>
      <div className="row ai-profile-actions">
        <span className={`pill ${settings.configured ? "success" : "warning"}`}>
          {settings.configured ? "已配置" : "未配置"}
        </span>
        <span className="chip">今日剩余 {settings.quota.remaining}/{settings.quota.limit}</span>
        <button className="button primary" type="button" onClick={saveSettings} disabled={isPending}>
          保存封面生图配置
        </button>
      </div>
      {status.type !== "idle" ? (
        <div className={`pill ${status.type === "success" ? "success" : status.type === "error" ? "danger" : "warning"}`}>
          {status.message}
        </div>
      ) : null}
    </div>
  );
}
