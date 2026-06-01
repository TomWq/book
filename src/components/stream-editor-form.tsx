"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/confirm-dialog-provider";

type ComparisonBlock = {
  id: string;
  type: "same" | "changed" | "added" | "removed";
  original: string;
  revised: string;
};

type StreamEditorState =
  | { status: "idle"; revisedText: string; error?: string }
  | { status: "running"; revisedText: string; error?: string }
  | { status: "done"; revisedText: string; error?: string }
  | { status: "error"; revisedText: string; error: string };

type DraftOption = {
  id: string;
  chapterNumber: number;
  title: string;
  content: string;
  updatedAt: string;
};

function countTextCharacters(value: string) {
  return value.replace(/\s/g, "").length;
}

function splitCompareBlocks(value: string) {
  return value
    .split(/\n{2,}|\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBlock(value: string) {
  return value.replace(/\s+/g, "");
}

function buildComparisonBlocks(originalText: string, revisedText: string): ComparisonBlock[] {
  const originalBlocks = splitCompareBlocks(originalText);
  const revisedBlocks = splitCompareBlocks(revisedText);
  const maxLength = Math.max(originalBlocks.length, revisedBlocks.length);

  return Array.from({ length: maxLength }, (_, index) => {
    const original = originalBlocks[index] ?? "";
    const revised = revisedBlocks[index] ?? "";
    let type: ComparisonBlock["type"] = "same";

    if (!original && revised) {
      type = "added";
    } else if (original && !revised) {
      type = "removed";
    } else if (normalizeBlock(original) !== normalizeBlock(revised)) {
      type = "changed";
    }

    return {
      id: `${index}-${type}`,
      type,
      original,
      revised
    };
  });
}

function blockLabel(type: ComparisonBlock["type"]) {
  if (type === "same") {
    return "保留";
  }

  if (type === "added") {
    return "新增";
  }

  if (type === "removed") {
    return "删减";
  }

  return "调整";
}

export function TextComparison({
  originalText,
  revisedText,
  title = "对照查看"
}: {
  originalText: string;
  revisedText: string;
  title?: string;
}) {
  const blocks = useMemo(
    () => buildComparisonBlocks(originalText, revisedText),
    [originalText, revisedText]
  );
  const changedCount = blocks.filter((block) => block.type !== "same").length;
  const originalCharacters = countTextCharacters(originalText);
  const revisedCharacters = countTextCharacters(revisedText);

  return (
    <div className="text-compare">
      <div className="text-compare-head">
        <div>
          <strong>{title}</strong>
          <span>按段落对齐，方便快速看删改和新增。</span>
        </div>
        <div className="chip-row">
          <span className="chip">原文 {originalCharacters.toLocaleString("zh-CN")} 字</span>
          <span className="chip">二稿 {revisedCharacters.toLocaleString("zh-CN")} 字</span>
          <span className={changedCount > 0 ? "chip warning-chip" : "chip success-chip"}>
            差异 {changedCount} 段
          </span>
        </div>
      </div>

      <div className="text-compare-grid" role="table" aria-label="二稿对照">
        <div className="text-compare-column-head">原文</div>
        <div className="text-compare-column-head">改写</div>
        {blocks.map((block, index) => (
          <div className={`text-compare-row ${block.type}`} key={block.id} role="row">
            <div className="text-compare-cell original" role="cell">
              <span className="compare-index">{index + 1}</span>
              <span className="compare-label">{blockLabel(block.type)}</span>
              <p>{block.original || "这一段在原文中不存在。"}</p>
            </div>
            <div className="text-compare-cell revised" role="cell">
              <span className="compare-index">{index + 1}</span>
              <span className="compare-label">{blockLabel(block.type)}</span>
              <p>{block.revised || "这一段在二稿中被删减。"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApplySecondDraftButton({
  projectId,
  draftId,
  revisedText,
  onApplied
}: {
  projectId: string;
  draftId: string;
  revisedText: string;
  onApplied?: () => void;
}) {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const [state, setState] = useState<{
    status: "idle" | "running" | "done" | "error";
    error?: string;
  }>({ status: "idle" });

  async function applyToDraft() {
    const confirmed = await confirm({
      title: "替换章节初稿",
      message: "确定用这版二稿替换当前章节初稿吗？",
      detail: "替换后，本章原有台账和审稿结果会失效，需要重新生成。",
      confirmLabel: "确认替换",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    setState({ status: "running" });

    try {
      const response = await fetch(`/api/projects/${projectId}/writing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "apply_edit_to_draft",
          draftId,
          revisedText
        })
      });

      if (!response.ok) {
        const payload = await response.text();
        throw new Error(payload || "替换章节正文失败");
      }

      setState({ status: "done" });
      onApplied?.();
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "替换章节正文失败"
      });
    }
  }

  return (
    <div className="apply-edit-box">
      <button
        className="button primary"
        type="button"
        onClick={applyToDraft}
        disabled={state.status === "running" || revisedText.trim().length < 10}
      >
        {state.status === "running" ? "正在替换..." : "替换当前章节初稿"}
      </button>
      {state.status === "done" ? <span className="pill success">已替换章节正文</span> : null}
      {state.status === "error" ? <span className="pill danger">{state.error}</span> : null}
    </div>
  );
}

export function StreamEditorForm({
  projectId,
  modes,
  draftOptions,
  initialDraftId,
  initialText
}: {
  projectId: string;
  modes: string[];
  draftOptions: DraftOption[];
  initialDraftId?: string;
  initialText: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState("网文作者版");
  const [selectedDraftId, setSelectedDraftId] = useState(initialDraftId ?? draftOptions[0]?.id ?? "");
  const [text, setText] = useState(initialText);
  const [state, setState] = useState<StreamEditorState>({ status: "idle", revisedText: "" });
  const [oneShotState, setOneShotState] = useState<{
    status: "idle" | "running" | "done" | "error";
    error?: string;
  }>({ status: "idle" });
  const isRunning = state.status === "running";
  const isOneShotRunning = oneShotState.status === "running";
  const textCharacters = useMemo(() => countTextCharacters(text), [text]);
  const selectedDraft = useMemo(
    () => draftOptions.find((draft) => draft.id === selectedDraftId),
    [draftOptions, selectedDraftId]
  );

  function selectDraft(draftId: string) {
    setSelectedDraftId(draftId);
    const draft = draftOptions.find((item) => item.id === draftId);

    if (draft) {
      setText(draft.content);
      setState({ status: "idle", revisedText: "" });
      setOneShotState({ status: "idle" });
    }
  }

  async function submit() {
    setState({ status: "running", revisedText: "" });
    let revisedText = "";

    try {
      const response = await fetch(`/api/projects/${projectId}/writing/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "edit_text",
          mode,
          text,
          draftId: selectedDraftId || undefined
        })
      });

      if (!response.ok || !response.body) {
        const payload = await response.text();
        throw new Error(payload || "流式二稿失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        revisedText += decoder.decode(value, { stream: true });
        setState({ status: "running", revisedText });
      }

      revisedText += decoder.decode();

      if (revisedText.includes("[生成失败]")) {
        throw new Error(revisedText.split("[生成失败]").at(-1)?.trim() || "流式二稿失败");
      }

      setState({ status: "done", revisedText });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        revisedText,
        error: error instanceof Error ? error.message : "流式二稿失败"
      });
    }
  }

  async function submitOnce() {
    setOneShotState({ status: "running" });

    try {
      const response = await fetch(`/api/projects/${projectId}/writing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "edit_text",
          mode,
          text,
          draftId: selectedDraftId || undefined
        })
      });

      if (!response.ok) {
        const payload = await response.text();
        throw new Error(payload || "二稿生成失败");
      }

      const payload = await response.json() as { editReport?: { revisedText?: string } };
      const revisedText = String(payload.editReport?.revisedText ?? "").trim();

      if (revisedText) {
        setState({ status: "done", revisedText });
      }

      setOneShotState({ status: "done" });
      router.refresh();
    } catch (error) {
      setOneShotState({
        status: "error",
        error: error instanceof Error ? error.message : "二稿生成失败"
      });
    }
  }

  return (
    <div className="forms editor-workbench">
      <div className="editor-control-grid">
        <div className="field">
          <div className="field-label">选择章节</div>
          {draftOptions.length > 0 ? (
            <select
              value={selectedDraftId}
              onChange={(event) => selectDraft(event.target.value)}
              disabled={isRunning || isOneShotRunning}
            >
              {draftOptions.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  第 {draft.chapterNumber} 章 · {draft.title}
                </option>
              ))}
            </select>
          ) : (
            <div className="section-card">还没有章节正文，可以先手动粘贴一段文本做二稿。</div>
          )}
          {selectedDraft ? (
            <div className="footer-note">
              当前载入：第 {selectedDraft.chapterNumber} 章《{selectedDraft.title}》 ·{" "}
              {selectedDraft.content.replace(/\s/g, "").length.toLocaleString("zh-CN")} 字
            </div>
          ) : null}
        </div>
        <div className="field">
          <div className="field-label">编辑模式</div>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            disabled={isRunning || isOneShotRunning}
          >
            {modes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field editor-input-field">
        <div className="field-label-row">
          <div>
            <div className="field-label">待改文本</div>
            <div className="footer-note">建议按章节处理，长文会按完整性校验，明显少写不会保存。</div>
          </div>
          <span className="chip">{textCharacters.toLocaleString("zh-CN")} 字</span>
        </div>
        <textarea
          className="editor-source-textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={isRunning || isOneShotRunning}
        />
        <div className="hero-actions editor-actions">
          <button className="button primary" type="button" onClick={submit} disabled={isRunning || isOneShotRunning}>
            {isRunning ? "正在流式改写..." : "流式生成二稿"}
          </button>
          <button className="button" type="button" onClick={submitOnce} disabled={isRunning || isOneShotRunning}>
            {isOneShotRunning ? "正在生成..." : "一次性生成二稿建议"}
          </button>
        </div>
      </div>
      {oneShotState.status === "done" ? <div className="pill success">二稿建议已生成并保存</div> : null}
      {oneShotState.status === "error" ? <div className="pill danger">{oneShotState.error}</div> : null}
      {state.status !== "idle" ? (
        <div className="editor-live-result">
          <TextComparison
            originalText={text}
            revisedText={state.revisedText}
            title={state.status === "done" ? "本次二稿对照" : "实时改写对照"}
          />
          {state.status === "done" && selectedDraftId ? (
            <ApplySecondDraftButton
              projectId={projectId}
              draftId={selectedDraftId}
              revisedText={state.revisedText}
              onApplied={() => {
                setText(state.revisedText);
                setState({ status: "idle", revisedText: "" });
                setOneShotState({ status: "idle" });
              }}
            />
          ) : null}
          {state.status === "error" ? <div className="pill danger">{state.error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
