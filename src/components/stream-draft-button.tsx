"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ActionLoadingOverlay } from "@/components/api-form";
import { useConfirmDialog } from "@/components/confirm-dialog-provider";
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
  draftId,
  projectName,
  chapterNumber,
  title,
  mode = "create",
  initialContent = ""
}: {
  projectId: string;
  taskCardId: string;
  draftId?: string;
  projectName?: string;
  chapterNumber?: number;
  title?: string;
  mode?: "create" | "regenerate";
  initialContent?: string;
}) {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const [state, setState] = useState<StreamState>({ status: "idle", content: "" });
  const [targetWordCount, setTargetWordCount] = useState(() => {
    const initialCount = initialContent.replace(/\s/g, "").length;

    if (mode === "regenerate" && initialCount > 0) {
      return Math.min(3000, Math.max(1200, Math.round(initialCount / 100) * 100));
    }

    return 1500;
  });
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
  const isRegenerating = mode === "regenerate";
  const runningStatusText = isSavingStreamDraft
    ? isRegenerating
      ? "新正文已生成，正在整理并替换当前正文，请稍候。"
      : "正文已生成，正在整理、保存草稿并更新章节台账，请稍候。"
    : "正在生成正文，实时内容会持续出现在下方。";
  const isRegenerateDone = isRegenerating && state.status === "done";
  const shouldShowStreamResultTools = !isRegenerateDone;
  const normalizedPreviewTarget = normalizedTargetWordCount();
  const targetRangeText = `${Math.floor(normalizedPreviewTarget * 0.82)}-${Math.ceil(normalizedPreviewTarget * 1.25)}`;
  const previewOverlay = (
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
  );

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
        /\n*\[(?:正文需要补足|正文已达到可保存长度|正文超过目标范围|正文接近字数上限|正文漏掉任务卡|结尾仍疑似被截断|结尾仍未完整|结尾不完整|结尾补写仍不完整|输出已达到可保存长度|AI 流式生成提前结束)[^\]]*]\n*/g,
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
    if (isRegenerating && !draftId) {
      setState({ status: "error", content: "", error: "缺少章节正文，无法重写" });
      return;
    }

    if (
      isRegenerating &&
      !(await confirm({
        title: "流式重写正文",
        message: "确定清空当前正文并流式重写吗？",
        detail: "保存成功后会替换原正文，旧台账和旧审稿会清空，请重新生成章节台账。",
        confirmLabel: "开始重写",
        tone: "danger"
      }))
    ) {
      return;
    }

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
          action: isRegenerating ? "regenerate_draft_content" : "generate_draft",
          taskCardId,
          draftId,
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

      if (!content.includes(streamDraftFinalMarker)) {
        content = visible.content;
        throw new Error("流式正文已结束，但没有收到最终保存版正文。请刷新页面确认是否保存成功。");
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
    if (isRegenerating) {
      return;
    }

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
          title={isRegenerating ? "正在保存重写正文" : "正在保存章节草稿"}
          description={isRegenerating ? "新正文已经生成，正在替换当前正文并清空旧台账，请不要刷新页面。" : "正文已经生成，正在写入草稿并更新章节台账，请不要刷新页面。"}
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
          {isRunning ? runningButtonLabel : isRegenerating ? "流式重写正文" : "流式生成正文草稿"}
        </button>
        {isRegenerating ? null : (
          <button
            className="button"
            type="button"
            onClick={generateDraftOnce}
            disabled={isRunning || isOneShotRunning}
          >
            {isOneShotRunning ? "正在生成..." : "一次性生成正文草稿"}
          </button>
        )}
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
              {isRegenerateDone
                ? "重写已完成"
                : state.status === "done"
                  ? isRegenerating
                  ? "流式重写完成，已替换正文"
                  : "流式生成完成，已保存草稿"
                : isSavingStreamDraft
                  ? "正文已生成，正在保存"
                  : "实时正文"}
            </div>
            {shouldShowStreamResultTools ? (
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
            ) : null}
          </div>
          {state.status === "running" ? <div className="pill form-status">{runningStatusText}</div> : null}
          {state.status === "done" ? (
            <div className="pill success">
              {isRegenerating
                ? "正文已重写并替换，上方“可编辑正文”会同步为最新版本；旧台账已清空，请重新生成章节台账。"
                : "草稿已保存，台账已更新，可以继续审稿。"}
            </div>
          ) : null}
          {shouldShowStreamResultTools ? (
            <textarea className="stream-draft-textarea" value={state.content} readOnly />
          ) : null}
          {state.status === "error" ? <div className="pill danger">{state.error}</div> : null}
        </div>
      ) : null}
      {isPreviewOpen
        ? typeof document === "undefined"
          ? previewOverlay
          : createPortal(previewOverlay, document.body)
        : null}
    </div>
  );
}
