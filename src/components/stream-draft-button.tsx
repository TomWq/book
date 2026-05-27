"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionLoadingOverlay } from "@/components/api-form";
import { DraftExportActions } from "@/components/draft-export-actions";

type StreamState =
  | { status: "idle"; content: string; error?: string }
  | { status: "running"; content: string; phase: "generating" | "saving"; error?: string }
  | { status: "done"; content: string; error?: string }
  | { status: "error"; content: string; error: string };

const streamDraftSavingMarker = "[[AI_NOVEL_WORKBENCH:STREAM_DRAFT_SAVING]]";
const streamDraftFinalMarker = "[[AI_NOVEL_WORKBENCH:STREAM_DRAFT_FINAL]]";

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
  const [targetWordCount, setTargetWordCount] = useState(1500);
  const [oneShotState, setOneShotState] = useState<{
    status: "idle" | "running" | "done" | "error";
    error?: string;
  }>({ status: "idle" });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isRunning = state.status === "running";
  const isOneShotRunning = oneShotState.status === "running";
  const liveCharacterCount = state.content.replace(/\s/g, "").length;
  const isSavingStreamDraft = state.status === "running" && state.phase === "saving";
  const runningButtonLabel = isSavingStreamDraft ? "正在保存草稿..." : "正在流式生成...";
  const runningStatusText = isSavingStreamDraft
    ? "正文已生成，正在保存草稿并更新章节台账，请稍候。"
    : "正在生成正文，实时内容会持续出现在下方。";
  const normalizedPreviewTarget = normalizedTargetWordCount();
  const targetRangeText = `${Math.floor(normalizedPreviewTarget * 0.7)}-${Math.ceil(normalizedPreviewTarget * 1.25)}`;

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

    return Math.min(3000, Math.max(800, Math.floor(parsed)));
  }

  function splitFailureMarker(value: string) {
    const marker = "[生成失败]";
    const index = value.indexOf(marker);

    if (index < 0) {
      return { content: value, error: "" };
    }

    return {
      content: value.slice(0, index).trimEnd(),
      error: value.slice(index + marker.length).trim() || "流式生成失败"
    };
  }

  function stripStreamSystemMessages(value: string) {
    return value
      .replace(
        /\n*\[(?:AI 输出被长度限制截断|补尾后结尾仍不完整|补尾仍不稳定)[^\]]*]\n*/g,
        ""
      )
      .replace(
        /\n*\[(?:正文需要补足|结尾仍疑似被截断|AI 流式生成提前结束)[^\]]*]\n*/g,
        "\n\n"
      );
  }

  function parseStreamText(value: string) {
    const visible = splitFailureMarker(value);
    const phase: "generating" | "saving" = visible.content.includes(streamDraftSavingMarker)
      ? "saving"
      : "generating";
    const finalIndex = visible.content.lastIndexOf(streamDraftFinalMarker);
    const sourceContent = finalIndex >= 0
      ? visible.content.slice(finalIndex + streamDraftFinalMarker.length).trimStart()
      : visible.content;
    const content = stripStreamSystemMessages(
      sourceContent
        .replaceAll(`\n\n${streamDraftSavingMarker}\n\n`, "\n\n")
        .replaceAll(streamDraftSavingMarker, "")
        .replaceAll(streamDraftFinalMarker, "")
    ).replace(/\n{3,}/g, "\n\n");

    return { ...visible, content, phase };
  }

  async function generateDraft() {
    const normalizedTarget = normalizedTargetWordCount();
    setTargetWordCount(normalizedTarget);
    setState({ status: "running", phase: "generating", content: "" });
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
        const visible = parseStreamText(content);
        setState({ status: "running", phase: visible.phase, content: visible.content });
      }

      content += decoder.decode();
      const visible = parseStreamText(content);

      if (visible.error) {
        content = visible.content;
        throw new Error(visible.error);
      }

      setState({ status: "done", content: visible.content });
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
      {isSavingStreamDraft ? (
        <ActionLoadingOverlay
          title="正在保存章节草稿"
          description="正文已经生成，正在写入草稿并更新章节台账，请不要刷新页面。"
        />
      ) : null}
      <div className="field">
        <div className="field-label-row">
          <div className="field-label">目标字数</div>
          <div className="target-word-guide">
            <span className="target-word-recommend">推荐 1500-2000 字</span>
            <span className="field-hint">可填 800-3000 字；当前保存参考约 {targetRangeText} 字</span>
          </div>
        </div>
        <input
          type="number"
          min={800}
          max={3000}
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
          {isRunning ? runningButtonLabel : "流式生成正文草稿"}
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
              {state.status === "done" ? "流式生成完成，已保存草稿" : isSavingStreamDraft ? "正文已生成，正在保存" : "实时正文"}
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
          {state.status === "running" ? <div className="pill form-status">{runningStatusText}</div> : null}
          {state.status === "done" ? <div className="pill success">草稿已保存，台账已更新，可以继续审稿。</div> : null}
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
