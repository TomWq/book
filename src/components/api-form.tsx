"use client";

import { type ReactNode, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/client-toast";
import { useConfirmDialog } from "@/components/confirm-dialog-provider";

type Method = "POST" | "PUT" | "PATCH" | "DELETE";

function splitList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n|，|、/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function valueAtPath(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, source);
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body) {
    return String((body as { error: unknown }).error);
  }
  return "操作失败，请稍后重试";
}

export function ActionLoadingOverlay({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  const overlay = (
    <div className="action-loading-overlay" aria-live="polite" role="status">
      <div className="route-loading-board">
        <div className="route-loading-head">
          <span className="loading-bookmark" aria-hidden="true">
            <span />
          </span>
          <div>
            <strong>{title}</strong>
            <span>{description}</span>
          </div>
        </div>
        <span className="route-loading-progress" aria-hidden="true" />
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.body);
}

function useApiMutation() {
  const router = useRouter();
  const [isRoutePending, startTransition] = useTransition();
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isPending = isMutating || isRoutePending;

  async function mutate({
    endpoint,
    method,
    body,
    redirectTo,
    redirectDataPath,
    redirectPrefix,
    refresh = true,
    successMessage
  }: {
    endpoint: string;
    method: Method;
    body?: Record<string, unknown>;
    redirectTo?: string;
    redirectDataPath?: string;
    redirectPrefix?: string;
    refresh?: boolean;
    successMessage?: string;
  }) {
    setError("");
    setSuccess("");
    setIsMutating(true);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(body ?? {})
      });

      if (!response.ok) {
        const nextError = await readError(response);
        setError(nextError);
        showToast({ type: "error", title: "操作失败", message: nextError });
        return false;
      }

      const data = await response.json().catch(() => null);
      const dynamicTarget =
        redirectDataPath && redirectPrefix
          ? `${redirectPrefix}${String(valueAtPath(data, redirectDataPath) ?? "")}`
          : "";
      const target = redirectTo || dynamicTarget;

      startTransition(() => {
        if (target) {
          router.push(target);
        }
        if (refresh) {
          router.refresh();
          window.setTimeout(() => {
            router.refresh();
          }, 350);
        }
      });
      const nextSuccess = successMessage || "操作已完成";
      setSuccess(nextSuccess);
      showToast({ type: "success", title: nextSuccess });
      return true;
    } catch {
      const nextError = "网络请求失败，请稍后重试";
      setError(nextError);
      showToast({ type: "error", title: "操作失败", message: nextError });
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  return { mutate, error, success, isPending };
}

export function ApiForm({
  endpoint,
  method = "POST",
  body,
  arrayFields = [],
  booleanFields = [],
  redirectTo,
  redirectDataPath,
  redirectPrefix,
  refresh = true,
  successMessage,
  resetOnSuccess = false,
  className,
  children,
  pendingTitle = "正在提交内容",
  pendingDescription = "正在保存和处理你的操作，请稍等一下。",
  showInlinePending = false
}: {
  endpoint: string;
  method?: Method;
  body?: Record<string, unknown>;
  arrayFields?: string[];
  booleanFields?: string[];
  redirectTo?: string;
  redirectDataPath?: string;
  redirectPrefix?: string;
  refresh?: boolean;
  successMessage?: string;
  resetOnSuccess?: boolean;
  className?: string;
  children: ReactNode;
  pendingTitle?: string;
  pendingDescription?: string;
  showInlinePending?: boolean;
}) {
  const { mutate, error, success, isPending } = useApiMutation();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, unknown> = { ...(body ?? {}) };

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        continue;
      }
      payload[key] = value;
    }

    for (const field of arrayFields) {
      payload[field] = splitList(formData.get(field));
    }

    for (const field of booleanFields) {
      payload[field] = formData.has(field);
    }

    const ok = await mutate({
      endpoint,
      method,
      body: payload,
      redirectTo,
      redirectDataPath,
      redirectPrefix,
      refresh,
      successMessage
    });

    if (ok && resetOnSuccess) {
      form.reset();
    }
  }

  return (
    <form className={className} onSubmit={handleSubmit} aria-busy={isPending}>
      {children}
      {isPending ? <ActionLoadingOverlay title={pendingTitle} description={pendingDescription} /> : null}
      {isPending && showInlinePending ? <div className="pill form-status">正在处理，请稍候...</div> : null}
      {success ? <div className="pill success form-status">{success}</div> : null}
      {error ? <div className="pill danger form-error">{error}</div> : null}
    </form>
  );
}

export function ApiButton({
  endpoint,
  method = "POST",
  body,
  label,
  disabled,
  className = "button",
  confirmMessage,
  redirectTo,
  redirectDataPath,
  redirectPrefix,
  refresh = true,
  successMessage,
  pendingTitle,
  pendingDescription
}: {
  endpoint: string;
  method?: Method;
  body?: Record<string, unknown>;
  label: string;
  disabled?: boolean;
  className?: string;
  confirmMessage?: string;
  redirectTo?: string;
  redirectDataPath?: string;
  redirectPrefix?: string;
  refresh?: boolean;
  successMessage?: string;
  pendingTitle?: string;
  pendingDescription?: string;
}) {
  const { mutate, error, isPending } = useApiMutation();
  const { confirm } = useConfirmDialog();

  return (
    <>
      <button
        className={className}
        type="button"
        disabled={disabled || isPending}
        onClick={async () => {
          if (confirmMessage && !(await confirm({
            title: label,
            message: confirmMessage,
            confirmLabel: "确认",
            cancelLabel: "取消",
            tone: className?.includes("danger") ? "danger" : "default"
          }))) {
            return;
          }

          void mutate({
            endpoint,
            method,
            body,
            redirectTo,
            redirectDataPath,
            redirectPrefix,
            refresh,
            successMessage
          });
        }}
      >
        {isPending ? "处理中..." : label}
      </button>
      {isPending ? (
        <ActionLoadingOverlay
          title={pendingTitle || `正在${label}`}
          description={pendingDescription || "正在处理请求，请稍等一下。"}
        />
      ) : null}
      {error ? <div className="pill danger form-error">{error}</div> : null}
    </>
  );
}
