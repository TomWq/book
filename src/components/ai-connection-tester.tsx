"use client";

import { useState } from "react";

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function AiConnectionTester() {
  const [state, setState] = useState<TestState>({ status: "idle" });

  async function testConnection() {
    setState({ status: "running" });

    try {
      const response = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const payload = (await response.json()) as
        | { ok?: boolean; latencyMs?: number; providerName?: string; model?: string; error?: string }
        | undefined;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "连接测试失败");
      }

      setState({
        status: "success",
        message: `连接成功 · ${payload.providerName ?? "AI 服务"} / ${payload.model ?? "未命名模型"} · ${payload.latencyMs ?? 0} ms`
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "连接测试失败"
      });
    }
  }

  const isRunning = state.status === "running";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="row">
        <div>
          <strong>连接测试</strong>
          <div className="muted">保存配置后，直接验证请求地址、Key 和模型是否能正常返回。</div>
        </div>
        <button className="button" type="button" onClick={testConnection} disabled={isRunning}>
          {isRunning ? "测试中..." : "测试连接"}
        </button>
      </div>

      {state.status === "success" ? (
        <div className="pill success">{state.message}</div>
      ) : state.status === "error" ? (
        <div className="pill danger">{state.message}</div>
      ) : state.status === "running" ? (
        <div className="pill warning">正在向配置的 AI 服务发起请求...</div>
      ) : (
        <div className="pill">尚未测试</div>
      )}
    </div>
  );
}
