"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error ? String(body.error) : "操作失败，请稍后重试";
}

export function LicenseCodeGenerator() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const pending = isPending || isMutating;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCodes([]);
    setIsMutating(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });

      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      const body = await response.json().catch(() => null);
      setCodes(Array.isArray(body?.codes) ? body.codes.map(String) : []);
      form.reset();
      startTransition(() => router.refresh());
    } catch {
      setError("网络请求失败，请稍后重试");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="list">
      <form className="forms" onSubmit={handleSubmit} aria-busy={pending}>
        <div className="admin-control-grid compact-admin-control-grid">
          <div className="field">
            <div className="field-label">生成数量</div>
            <input name="quantity" type="number" min="1" max="50" step="1" defaultValue="1" />
          </div>
          <div className="field">
            <div className="field-label">可激活设备数</div>
            <input name="maxActivations" type="number" min="1" max="10" step="1" defaultValue="1" />
          </div>
        </div>
        <button className="button" type="submit" disabled={pending}>
          {pending ? "生成中..." : "生成授权码"}
        </button>
        {error ? <div className="pill danger form-error">{error}</div> : null}
      </form>

      {codes.length > 0 ? (
        <div className="list-item license-generated-box">
          <div className="row">
            <strong>本次生成的授权码</strong>
            <span className="pill success">列表可继续复制</span>
          </div>
          <textarea readOnly value={codes.join("\n")} rows={Math.min(8, codes.length + 1)} />
        </div>
      ) : null}
    </div>
  );
}
