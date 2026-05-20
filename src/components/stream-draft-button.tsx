"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DraftExportActions } from "@/components/draft-export-actions";

type StreamState =
  | { status: "idle"; content: string; error?: string }
  | { status: "running"; content: string; error?: string }
  | { status: "done"; content: string; error?: string }
  | { status: "error"; content: string; error: string };

export function StreamDraftButton({
  projectId,
  taskCardId,
  projectName,
  chapterNumber,
  title
}: {
  projectId: string;
  taskCardId: string;
  projectName?: string;
  chapterNumber?: number;
  title?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<StreamState>({ status: "idle", content: "" });
  const [targetWordCount, setTargetWordCount] = useState(2500);
  const [oneShotState, setOneShotState] = useState<{
    status: "idle" | "running" | "done" | "error";
    error?: string;
  }>({ status: "idle" });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isRunning = state.status === "running";
  const isOneShotRunning = oneShotState.status === "running";
  const liveCharacterCount = state.content.replace(/\s/g, "").length;

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isPreviewOpen]);

  function normalizedTargetWordCount() {
    const parsed = Number(targetWordCount);

    if (!Number.isFinite(parsed)) {
      return 2500;
    }

    return Math.min(8000, Math.max(800, Math.floor(parsed)));
  }

  async function generateDraft() {
    const normalizedTarget = normalizedTargetWordCount();
    setTargetWordCount(normalizedTarget);
    setState({ status: "running", content: "" });
    let content = "";

    try {
      const response = await fetch(`/api/projects/${projectId}/writing/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "generate_draft",
          taskCardId,
          targetWordCount: normalizedTarget
        })
      });

      if (!response.ok || !response.body) {
        const payload = await response.text();
        throw new Error(payload || "流式生成失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        content += decoder.decode(value, { stream: true });
        setState({ status: "running", content });
      }

      content += decoder.decode();

      if (content.includes("[生成失败]")) {
        throw new Error(content.split("[生成失败]").at(-1)?.trim() || "流式生成失败");
      }

      setState({ status: "done", content });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        content,
        error: error instanceof Error ? error.message : "流式生成失败"
      });
    }
  }

  async function generateDraftOnce() {
    const normalizedTarget = normalizedTargetWordCount();
    setTargetWordCount(normalizedTarget);
    setOneShotState({ status: "running" });

    try {
      const response = await fetch(`/api/projects/${projectId}/writing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "generate_draft",
          taskCardId,
          targetWordCount: normalizedTarget
        })
      });

      if (!response.ok) {
        const payload = await response.text();
        throw new Error(payload || "正文生成失败");
      }

      setOneShotState({ status: "done" });
      router.refresh();
    } catch (error) {
      setOneShotState({
        status: "error",
        error: error instanceof Error ? error.message : "正文生成失败"
      });
    }
  }

  return (
    <div className="list">
      <div className="field">
        <div className="field-label-row">
          <div className="field-label">目标字数</div>
          <div className="field-hint">800-8000 字，实际会有小幅浮动</div>
        </div>
        <input
          type="number"
          min={800}
          max={8000}
          step={100}
          value={targetWordCount}
          onChange={(event) => setTargetWordCount(Number(event.target.value))}
          disabled={isRunning || isOneShotRunning}
        />
      </div>
      <div className="hero-actions">
        <button
          className="button"
          type="button"
          onClick={generateDraft}
          disabled={isRunning || isOneShotRunning}
        >
          {isRunning ? "正在流式生成..." : "流式生成正文草稿"}
        </button>
        <button
          className="button"
          type="button"
          onClick={generateDraftOnce}
          disabled={isRunning || isOneShotRunning}
        >
          {isOneShotRunning ? "正在生成..." : "一次性生成正文草稿"}
        </button>
      </div>
      {oneShotState.status === "done" ? (
        <div className="pill success">正文草稿已生成并保存</div>
      ) : null}
      {oneShotState.status === "error" ? (
        <div className="pill danger">{oneShotState.error}</div>
      ) : null}
      {state.status !== "idle" ? (
        <div className="field stream-draft-field">
          <div className="field-label-row">
            <div className="field-label">
              {state.status === "done" ? "流式生成完成，已保存草稿" : "实时正文"}
            </div>
            <div className="hero-actions">
              <span className="field-hint">{liveCharacterCount.toLocaleString("zh-CN")} 字</span>
              <DraftExportActions
                content={state.content}
                projectName={projectName}
                chapterNumber={chapterNumber}
                title={title}
                compact
              />
              <button
                className="mini-action-button"
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                disabled={!state.content.trim()}
              >
                全屏预览
              </button>
            </div>
          </div>
          <textarea className="stream-draft-textarea" value={state.content} readOnly />
          {state.status === "error" ? <div className="pill danger">{state.error}</div> : null}
        </div>
      ) : null}
      {isPreviewOpen ? (
        <div className="draft-preview-overlay" role="dialog" aria-modal="true" aria-label="正文全屏预览">
          <div className="draft-preview-panel">
            <div className="draft-preview-head">
              <div>
                <div className="mini-label">正文预览</div>
                <strong>{isRunning ? "正在生成中" : "当前正文"}</strong>
              </div>
              <div className="hero-actions">
                <span className="chip">{liveCharacterCount.toLocaleString("zh-CN")} 字</span>
                <DraftExportActions
                  content={state.content}
                  projectName={projectName}
                  chapterNumber={chapterNumber}
                  title={title}
                  compact
                />
                <button className="button" type="button" onClick={() => setIsPreviewOpen(false)}>
                  关闭预览
                </button>
              </div>
            </div>
            <article className="draft-preview-reader">
              {state.content
                .split(/\n+/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph.replace(/^#\s*/, "")}</p>
                ))}
            </article>
          </div>
        </div>
      ) : null}
    </div>
  );
}
