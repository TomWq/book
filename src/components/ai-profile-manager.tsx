"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openExternalUrl } from "@/lib/client-open-external";

type AiProfile = {
  id: string;
  profileName: string;
  providerName: string;
  baseUrl: string;
  model: string;
  models: string[];
  timeoutMs: number;
  active: boolean;
  hasApiKey: boolean;
  apiKeyPreview: string;
};

type Status = { type: "idle" | "success" | "error" | "loading"; message: string };

const recommendedProviderUrl = "https://newapi.602774041.xyz/";

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error ? String(body.error) : "操作失败，请稍后重试";
}

function blankProfile(): AiProfile {
  return {
    id: "new",
    profileName: "default",
    providerName: "OpenAI Compatible",
    baseUrl: "",
    model: "",
    models: [],
    timeoutMs: 60000,
    active: false,
    hasApiKey: false,
    apiKeyPreview: ""
  };
}

function profilesFromResponse(body: unknown) {
  if (!body || typeof body !== "object") {
    return [];
  }

  const settings = (body as { settings?: unknown }).settings;
  if (!settings || typeof settings !== "object") {
    return [];
  }

  const profiles = (settings as { profiles?: unknown }).profiles;
  return Array.isArray(profiles) ? (profiles as AiProfile[]) : [];
}

function applyProfiles({
  profiles,
  setProfileList,
  setSelectedId,
  setEditing,
  setApiKey
}: {
  profiles: AiProfile[];
  setProfileList: (profiles: AiProfile[]) => void;
  setSelectedId: (id: string) => void;
  setEditing: (profile: AiProfile) => void;
  setApiKey: (value: string) => void;
}) {
  const activeProfile = profiles.find((profile) => profile.active) ?? profiles[0];
  if (!activeProfile) {
    return;
  }

  setProfileList(profiles);
  setSelectedId(activeProfile.id);
  setEditing(activeProfile);
  setApiKey("");
}

export function AiProfileManager({ profiles }: { profiles: AiProfile[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [profileList, setProfileList] = useState(profiles);
  const initialProfile = profileList.find((profile) => profile.active) ?? profileList[0] ?? blankProfile();
  const [selectedId, setSelectedId] = useState(initialProfile.id);
  const [editing, setEditing] = useState<AiProfile>(initialProfile);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const modelOptions = useMemo(
    () => Array.from(new Set([...(editing.models ?? []), editing.model].filter(Boolean))).sort(),
    [editing.models, editing.model]
  );

  function selectProfile(profileId: string) {
    const profile = profileList.find((item) => item.id === profileId) ?? blankProfile();
    setSelectedId(profile.id);
    setEditing(profile);
    setApiKey("");
    setStatus({ type: "idle", message: "" });
  }

  function startNewProfile() {
    const profile = blankProfile();
    setSelectedId(profile.id);
    setEditing(profile);
    setApiKey("");
    setStatus({ type: "idle", message: "" });
  }

  async function fetchModels() {
    setStatus({ type: "loading", message: "正在读取模型列表..." });
    const response = await fetch("/api/settings/ai/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: editing.baseUrl, apiKey })
    });

    if (!response.ok) {
      setStatus({ type: "error", message: await readError(response) });
      return;
    }

    const body = await response.json().catch(() => null);
    const models = Array.isArray(body?.models) ? body.models.map(String) : [];
    setEditing((current) => ({ ...current, models, model: current.model || models[0] || "" }));
    setStatus({ type: "success", message: models.length > 0 ? `读取到 ${models.length} 个模型` : "没有读取到模型，可手动填写" });
  }

  async function saveProfile() {
    setStatus({ type: "loading", message: "正在保存配置..." });
    const response = await fetch("/api/settings/ai", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: editing.id === "new" ? "" : editing.id,
        profileName: editing.profileName,
        providerName: "OpenAI Compatible",
        baseUrl: editing.baseUrl,
        apiKey,
        model: editing.model,
        models: editing.models,
        timeoutMs: editing.timeoutMs
      })
    });

    if (!response.ok) {
      setStatus({ type: "error", message: await readError(response) });
      return;
    }

    const body = await response.json().catch(() => null);
    const nextProfiles = profilesFromResponse(body);
    if (nextProfiles.length > 0) {
      applyProfiles({ profiles: nextProfiles, setProfileList, setSelectedId, setEditing, setApiKey });
    }
    setStatus({ type: "success", message: "已保存并切换为当前配置" });
    startTransition(() => router.refresh());
  }

  async function switchProfile(profileId: string) {
    const response = await fetch("/api/settings/ai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", profileId })
    });
    if (!response.ok) {
      setStatus({ type: "error", message: await readError(response) });
      return;
    }
    const body = await response.json().catch(() => null);
    const nextProfiles = profilesFromResponse(body);
    if (nextProfiles.length > 0) {
      applyProfiles({ profiles: nextProfiles, setProfileList, setSelectedId, setEditing, setApiKey });
    }
    setStatus({ type: "success", message: "已切换当前配置" });
    startTransition(() => router.refresh());
  }

  async function deleteProfile(profileId: string) {
    if (!window.confirm("确定删除这个 AI 配置吗？")) {
      return;
    }

    const response = await fetch("/api/settings/ai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", profileId })
    });

    if (!response.ok) {
      setStatus({ type: "error", message: await readError(response) });
      return;
    }
    const body = await response.json().catch(() => null);
    const nextProfiles = profilesFromResponse(body);
    setProfileList(nextProfiles);
    const activeProfile = nextProfiles.find((profile: AiProfile) => profile.active) ?? nextProfiles[0] ?? blankProfile();
    setSelectedId(activeProfile.id);
    setEditing(activeProfile);
    setStatus({ type: "success", message: "已删除配置" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="ai-profile-manager">
      <div className="ai-profile-sidebar">
        <div className="row">
          <strong>配置档案</strong>
          <button className="button small-button" type="button" onClick={startNewProfile}>新增</button>
        </div>
        {profileList.length === 0 ? <div className="muted">暂无配置，先新增一个。</div> : null}
        {profileList.map((profile) => (
          <button
            key={profile.id}
            className={`ai-profile-item ${profile.id === selectedId ? "active" : ""}`}
            type="button"
            onClick={() => selectProfile(profile.id)}
          >
            <span>
              <strong>{profile.profileName}</strong>
              <em>{profile.baseUrl || "未填写地址"}</em>
            </span>
            {profile.active ? <i>当前</i> : null}
          </button>
        ))}
      </div>

      <div className="ai-profile-editor">
        <div className="split-panels">
          <div className="field">
            <div className="field-label">配置名称</div>
            <input value={editing.profileName} onChange={(event) => setEditing({ ...editing, profileName: event.target.value })} />
          </div>
          <div className="field">
            <div className="field-label">超时时间 ms</div>
            <input type="number" min="1000" step="1000" value={editing.timeoutMs} onChange={(event) => setEditing({ ...editing, timeoutMs: Number(event.target.value) || 60000 })} />
          </div>
        </div>
        <div className="field">
          <div className="field-label">请求地址</div>
          <input value={editing.baseUrl} placeholder="例如：https://api.openai.com/v1" onChange={(event) => setEditing({ ...editing, baseUrl: event.target.value })} />
        </div>
        <div className="ai-provider-recommend" aria-label="第三方接口推荐">
          <span className="ai-provider-recommend-mark" aria-hidden="true">AI</span>
          <div>
            <strong>兼容接口推荐</strong>
            <span>还没有可用的模型接口？可以了解 奕灵Code 大模型中转服务，再把它提供的请求地址填到这里。</span>
          </div>
          <button className="button small-button" type="button" onClick={() => void openExternalUrl(recommendedProviderUrl)}>
            了解一下
          </button>
        </div>
        <div className="split-panels">
          <div className="field">
            <div className="field-label">API Key</div>
            <input type="password" value={apiKey} placeholder={editing.hasApiKey ? `已保存 ${editing.apiKeyPreview}，留空则不修改` : "填写 API Key 后读取模型"} onChange={(event) => setApiKey(event.target.value)} />
          </div>
          <div className="field">
            <div className="field-label">模型</div>
            <input list="ai-model-options" value={editing.model} placeholder="先读取模型，或手动填写" onChange={(event) => setEditing({ ...editing, model: event.target.value })} />
            <datalist id="ai-model-options">
              {modelOptions.map((model) => <option key={model} value={model} />)}
            </datalist>
          </div>
        </div>
        {modelOptions.length > 0 ? (
          <div className="meta-row">
            {modelOptions.slice(0, 12).map((model) => (
              <button key={model} className={`chip chip-button ${model === editing.model ? "active" : ""}`} type="button" onClick={() => setEditing({ ...editing, model })}>{model}</button>
            ))}
          </div>
        ) : null}
        <div className="row ai-profile-actions">
          <button className="button secondary" type="button" onClick={fetchModels} disabled={isPending}>读取模型列表</button>
          <button className="button primary" type="button" onClick={saveProfile} disabled={isPending}>保存并启用</button>
          {editing.id !== "new" && !editing.active ? <button className="button" type="button" onClick={() => switchProfile(editing.id)} disabled={isPending}>设为当前</button> : null}
          {editing.id !== "new" ? <button className="button danger" type="button" onClick={() => deleteProfile(editing.id)} disabled={isPending}>删除</button> : null}
        </div>
        {status.type !== "idle" ? <div className={`pill ${status.type === "success" ? "success" : status.type === "error" ? "danger" : "warning"}`}>{status.message}</div> : null}
      </div>
    </div>
  );
}
