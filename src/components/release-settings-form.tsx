"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type ReleaseSettingsFormValue = {
  version: string;
  releaseDate: string;
  notes: string;
  announcement?: string;
  required: boolean;
};

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error ? String(body.error) : "保存发布信息失败";
}

function toDatetimeLocal(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const date = new Date(timestamp);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export function ReleaseSettingsForm({ initialValue }: { initialValue: ReleaseSettingsFormValue }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const busy = isPending || isSaving;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/release", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: String(formData.get("version") ?? ""),
          releaseDate: fromDatetimeLocal(String(formData.get("releaseDate") ?? "")),
          notes: String(formData.get("notes") ?? ""),
          announcement: String(formData.get("announcement") ?? ""),
          required: formData.get("required") === "on"
        })
      });

      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      setSuccess("发布信息已保存");
      startTransition(() => router.refresh());
    } catch {
      setError("网络请求失败，请稍后重试");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="release-settings-form" onSubmit={handleSubmit} aria-busy={busy}>
      <div className="admin-control-grid compact-admin-control-grid">
        <div className="field">
          <div className="field-label">版本号</div>
          <input name="version" defaultValue={initialValue.version} placeholder="例如：1.0.1" />
        </div>
        <div className="field">
          <div className="field-label">发布时间</div>
          <input name="releaseDate" type="datetime-local" defaultValue={toDatetimeLocal(initialValue.releaseDate)} />
        </div>
        <label className="checkbox-row release-required-row">
          <input name="required" type="checkbox" defaultChecked={initialValue.required} />
          <span>标记为重要更新</span>
        </label>
      </div>

      <div className="field">
        <div className="field-label">发布公告</div>
        <input name="announcement" defaultValue={initialValue.announcement ?? ""} placeholder="例如：新版已发布，建议所有作者升级。" />
      </div>

      <div className="field">
        <div className="field-label">发布日志</div>
        <textarea name="notes" defaultValue={initialValue.notes} rows={5} placeholder="写给用户看的更新说明、修复内容和注意事项。" />
      </div>

      <div className="release-settings-actions">
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "保存中..." : "保存发布信息"}
        </button>
        {success ? <span className="pill success">{success}</span> : null}
        {error ? <span className="pill danger">{error}</span> : null}
      </div>
    </form>
  );
}

