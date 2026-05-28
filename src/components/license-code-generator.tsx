"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/copy-button";

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error ? String(body.error) : "操作失败，请稍后重试";
}

export function LicenseCodeGenerator() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [lastPurpose, setLastPurpose] = useState<"desktop" | "web" | "">("");
  const pending = isPending || isMutating;

  async function submitLicenseCodes(purpose: "desktop" | "web") {
    if (pending) {
      return;
    }

    const form = formRef.current;

    if (!form) {
      return;
    }

    setError("");
    setCodes([]);
    setIsMutating(true);

    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/licenses", {
        // desktop default below; web button uses dedicated endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(formData.entries()),
          purpose
        })
      });

      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      const body = await response.json().catch(() => null);
      setCodes(Array.isArray(body?.codes) ? body.codes.map(String) : []);
      setLastPurpose(purpose);
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
      <form
        ref={formRef}
        className="forms"
        onSubmit={(event) => {
          event.preventDefault();
          void submitLicenseCodes("desktop");
        }}
        aria-busy={pending}
      >
        <div className="admin-control-grid compact-admin-control-grid">
          <div className="field">
            <div className="field-label">客户名称</div>
            <input name="customerName" placeholder="例如：张三 / 某工作室" />
          </div>
          <div className="field">
            <div className="field-label">联系方式</div>
            <input name="customerContact" placeholder="手机号、微信或邮箱" />
          </div>
          <div className="field">
            <div className="field-label">生成数量</div>
            <input name="quantity" type="number" min="1" max="50" step="1" defaultValue="1" />
          </div>
          <div className="field">
            <div className="field-label">体验时长（分钟）</div>
            <input
              name="durationMinutes"
              type="number"
              min="1"
              step="1"
              placeholder="留空为永久"
            />
          </div>
          <div className="field">
            <div className="field-label">备注</div>
            <input name="notes" placeholder="交付批次、渠道或内部说明" />
          </div>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <button
            className="button"
            type="button"
            disabled={pending}
            onClick={() => void submitLicenseCodes("desktop")}
          >
            生成客户端授权码
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={pending}
            onClick={async () => {
              if (pending) return;
              const form = formRef.current;
              if (!form) return;

              setError("");
              setCodes([]);
              setIsMutating(true);

              try {
                const response = await fetch("/api/admin/licenses/web", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
                });

                if (!response.ok) {
                  setError(await readError(response));
                  return;
                }

                const body = await response.json().catch(() => null);
                setCodes(Array.isArray(body?.codes) ? body.codes.map(String) : []);
                setLastPurpose("web");
                form.reset();
                startTransition(() => router.refresh());
              } catch {
                setError("网络请求失败，请稍后重试");
              } finally {
                setIsMutating(false);
              }
            }}
          >
            生成网页特邀码
          </button>
        </div>
        <div className="pill" style={{ marginTop: 10 }}>
          左侧按钮生成桌面客户端码，右侧按钮生成网页特邀码。
        </div>
        {error ? <div className="pill danger form-error">{error}</div> : null}
      </form>

      {codes.length > 0 ? (
        <div className="list-item license-generated-box">
          <div className="row">
            <strong>本次生成的授权码</strong>
            <span className="chip">{lastPurpose === "web" ? "网页特邀" : "桌面客户端"}</span>
            <CopyButton value={codes.join("\n")} label="复制全部" />
          </div>
          <textarea readOnly value={codes.join("\n")} rows={Math.min(8, codes.length + 1)} />
        </div>
      ) : null}
    </div>
  );
}
