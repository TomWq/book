"use client";

import { useEffect, useState } from "react";
import {
  coverImageGenerationEventName,
  type CoverImageGenerationRequest,
  type CoverQuota
} from "@/lib/cover-image-generation-events";
import { showToast } from "@/lib/client-toast";

type GenerationState =
  | { state: "idle" }
  | { state: "running"; startedAt: number; token: string; request: CoverImageGenerationRequest }
  | {
      state: "done";
      startedAt: number;
      finishedAt: number;
      token: string;
      request: CoverImageGenerationRequest;
      coverImageUrl: string;
      quota: CoverQuota | null;
    }
  | {
      state: "error";
      startedAt: number;
      finishedAt: number;
      token: string;
      request: CoverImageGenerationRequest;
      error: string;
    };

function makeGenerationToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `cover-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeFileName(value: string) {
  return (value.trim() || "cover").replace(/[\\/:*?"<>|]/g, "_");
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function dataUrlToBytes(dataUrl: string) {
  const [metadata, base64 = ""] = dataUrl.split(",", 2);
  const mimeMatch = metadata.match(/^data:([^;]+);base64$/);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    bytes,
    mimeType: mimeMatch?.[1] || "image/png"
  };
}

async function coverImageToBytes(coverImageUrl: string) {
  if (coverImageUrl.startsWith("data:")) {
    return dataUrlToBytes(coverImageUrl);
  }

  const response = await fetch(coverImageUrl, { cache: "no-store" });
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType
  };
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

async function downloadCoverImage(coverImageUrl: string, title: string) {
  const image = await coverImageToBytes(coverImageUrl);
  const extension = extensionForMimeType(image.mimeType);
  const fileName = `${safeFileName(title)}.${extension}`;

  if (isTauriRuntime()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs")
    ]);
    const savePath = await save({
      title: "保存 AI 封面",
      defaultPath: fileName,
      filters: [{ name: "图片", extensions: [extension] }]
    });

    if (!savePath) {
      return;
    }

    await writeFile(savePath, image.bytes);
    return;
  }

  const anchor = document.createElement("a");
  const blob = new Blob([image.bytes], { type: image.mimeType });
  const objectUrl = URL.createObjectURL(blob);

  try {
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function CoverImageGenerationCenter() {
  const [generation, setGeneration] = useState<GenerationState>({ state: "idle" });
  const [actionError, setActionError] = useState("");

  async function startGeneration(request: CoverImageGenerationRequest) {
    const token = makeGenerationToken();
    const startedAt = Date.now();
    setActionError("");
    setGeneration({ state: "running", startedAt, token, request });

    try {
      const response = await fetch("/api/cover-image/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: request.title,
          authorName: request.authorName,
          stylePrompt: request.stylePrompt,
          variationToken: token
        })
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.error ? String(body.error) : "生成封面失败，请稍后重试");
      }

      const coverImageUrl = String(body.coverImageUrl ?? "");

      console.info("[cover-image][client] generate response", {
        ok: response.ok,
        hasImage: Boolean(coverImageUrl),
        imageKind: coverImageUrl.startsWith("data:") ? "base64" : coverImageUrl.startsWith("http") ? "url" : "other",
        imageLength: coverImageUrl.length,
        quota: body.quota,
        elapsedMs: Date.now() - startedAt
      });

      if (!coverImageUrl) {
        throw new Error("接口没有返回封面图片");
      }

      setGeneration({
        state: "done",
        startedAt,
        finishedAt: Date.now(),
        token,
        request,
        coverImageUrl,
        quota: body.quota ?? null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成封面失败";
      setGeneration({
        state: "error",
        startedAt,
        finishedAt: Date.now(),
        token,
        request,
        error: message
      });
      showToast({ type: "error", title: "封面生成失败", message, durationMs: 7000 });
    }
  }

  useEffect(() => {
    function onRequest(event: Event) {
      const detail = (event as CustomEvent<CoverImageGenerationRequest>).detail;
      const title = String(detail?.title ?? "").trim();

      if (!title) {
        showToast({ type: "error", title: "无法生成封面", message: "请先填写书名。" });
        return;
      }

      void startGeneration({
        title,
        authorName: String(detail?.authorName ?? "").trim(),
        stylePrompt: String(detail?.stylePrompt ?? "").trim(),
        onGenerated: detail.onGenerated
      });
    }

    window.addEventListener(coverImageGenerationEventName, onRequest);
    return () => window.removeEventListener(coverImageGenerationEventName, onRequest);
  }, []);

  async function useCover() {
    if (generation.state !== "done") {
      return;
    }

    setActionError("");

    try {
      await generation.request.onGenerated(generation.coverImageUrl);
      setGeneration({ state: "idle" });
      showToast({ type: "success", title: "封面已应用" });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "应用封面失败");
    }
  }

  async function downloadCurrentCover() {
    if (generation.state !== "done") {
      return;
    }

    setActionError("");

    try {
      await downloadCoverImage(generation.coverImageUrl, generation.request.title);
      showToast({ type: "success", title: "封面已保存" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "下载封面失败";
      console.error("[cover-image][client] download failed", error);
      setActionError(`下载封面失败：${message}`);
    }
  }

  function regenerate() {
    if (generation.state === "idle" || generation.state === "running") {
      return;
    }

    void startGeneration(generation.request);
  }

  if (generation.state === "idle") {
    return null;
  }

  return (
    <div className="ai-cover-floating-panel" role="status" aria-live="polite">
      {generation.state === "running" ? (
        <div className="ai-cover-floating-card">
          <div className="ai-cover-floating-head">
            <strong>封面后台生成中</strong>
            <button className="icon-button" type="button" onClick={() => setGeneration({ state: "idle" })} aria-label="关闭提示">
              ×
            </button>
          </div>
          <span>你可以继续写章节、简介或大纲，封面生成好后这里会提示你。</span>
        </div>
      ) : generation.state === "done" ? (
        <div className="ai-cover-floating-card ai-cover-floating-card-done">
          <div className="ai-cover-floating-head">
            <strong>封面已生成</strong>
            <button className="icon-button" type="button" onClick={() => setGeneration({ state: "idle" })} aria-label="关闭结果">
              ×
            </button>
          </div>
          <img className="ai-cover-floating-preview" src={generation.coverImageUrl} alt="AI 封面预览" />
          {actionError ? <span className="field-hint project-cover-error">{actionError}</span> : null}
          <div className="hero-actions ai-cover-floating-actions">
            <button className="button" type="button" onClick={() => void downloadCurrentCover()}>
              下载
            </button>
            <button className="button" type="button" onClick={regenerate}>
              重新生成
            </button>
            <button className="button primary" type="button" onClick={() => void useCover()}>
              使用封面
            </button>
          </div>
        </div>
      ) : (
        <div className="ai-cover-floating-card ai-cover-floating-card-error">
          <div className="ai-cover-floating-head">
            <strong>封面生成失败</strong>
            <button className="icon-button" type="button" onClick={() => setGeneration({ state: "idle" })} aria-label="关闭结果">
              ×
            </button>
          </div>
          <span>{generation.error}</span>
          <div className="hero-actions ai-cover-floating-actions">
            <button className="button" type="button" onClick={() => setGeneration({ state: "idle" })}>
              关闭
            </button>
            <button className="button primary" type="button" onClick={regenerate}>
              再试一次
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
