"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmTone = "default" | "danger";

export type ConfirmDialogOptions = {
  title?: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmDialogOptions | string) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

function normalizeOptions(options: ConfirmDialogOptions | string): Required<Pick<ConfirmDialogOptions, "title" | "message" | "confirmLabel" | "cancelLabel" | "tone">> & {
  detail?: string;
} {
  if (typeof options === "string") {
    return {
      title: "确认操作",
      message: options,
      confirmLabel: "确认",
      cancelLabel: "取消",
      tone: "default"
    };
  }

  return {
    title: options.title || "确认操作",
    message: options.message,
    detail: options.detail,
    confirmLabel: options.confirmLabel || "确认",
    cancelLabel: options.cancelLabel || "取消",
    tone: options.tone || "default"
  };
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(false);
  const [options, setOptions] = useState<ReturnType<typeof normalizeOptions> | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const resolve = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!options) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => confirmButtonRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        resolve(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [options, resolve]);

  const confirm = useCallback((nextOptions: ConfirmDialogOptions | string) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setOptions(normalizeOptions(nextOptions));

    return new Promise<boolean>((resolvePromise) => {
      resolverRef.current = resolvePromise;
    });
  }, []);

  const dialog = options ? (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => resolve(false)}>
      <div
        className={`confirm-dialog ${options.tone === "danger" ? "danger-dialog" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-head">
          <div>
            <div className={options.tone === "danger" ? "pill danger" : "pill"}>{options.tone === "danger" ? "危险操作" : "操作确认"}</div>
            <h2 id={titleId}>{options.title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={() => resolve(false)}>
            x
          </button>
        </div>

        <div className="confirm-dialog-body" id={descriptionId}>
          <p>{options.message}</p>
          {options.detail ? <div className="list-item">{options.detail}</div> : null}
        </div>

        <div className="confirm-dialog-actions">
          <button className="button" type="button" onClick={() => resolve(false)}>
            {options.cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            className={options.tone === "danger" ? "button danger" : "button primary"}
            type="button"
            onClick={() => resolve(true)}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error("useConfirmDialog 必须在 ConfirmDialogProvider 中使用");
  }

  return context;
}
