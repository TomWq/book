"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatReviewText } from "@/lib/review-display";

type ReviewIssue = {
  type: string;
  location: string;
  severity: "low" | "medium" | "high";
  problem?: string;
  suggestion: string;
};

type ApplyResult = {
  applied: number;
  skipped: number;
  message: string;
};

type IssueApplyStatus = "pending" | "applied" | "manual";
type IssueApplyAnalysis = {
  canApply: boolean;
  original: string;
  replacement: string;
  insertAfter: boolean;
  reason: string;
};

function countTextCharacters(value: string) {
  return value.replace(/\s/g, "").length;
}

function quotedTexts(value: string) {
  const matches = value.matchAll(/[“"‘'「『]([^“”"‘’'「」『』]{2,400})[”"’'」』]/g);
  return Array.from(matches).map((match) => match[1].trim()).filter(Boolean);
}

function plainLocationText(issue: ReviewIssue) {
  const value = issue.location
    .replace(/^(?:第?\s*\d+\s*(?:段|处|句)?|问题位置|位置)\s*[:：,，-]?\s*/i, "")
    .trim();

  return value.length >= 2 && value.length <= 400 ? value : "";
}

function issueOriginalTexts(issue: ReviewIssue) {
  const suggestionQuotes = quotedTexts(issue.suggestion);
  const quotedOriginal =
    suggestionQuotes.length >= 2 && /将|把|在|原句|后补|补入|改为|改成|替换/.test(issue.suggestion)
      ? suggestionQuotes[0]
      : "";
  const candidates = [...quotedTexts(issue.location), quotedOriginal, plainLocationText(issue)];
  return Array.from(new Set(candidates.filter(Boolean)));
}

function issueReplacementText(issue: ReviewIssue) {
  const quoted = quotedTexts(issue.suggestion);
  const quotedReplacement =
    quoted.length >= 2 && /将|把|在|原句|后补|补入|改为|改成|替换/.test(issue.suggestion)
      ? quoted.at(-1)
      : "";

  if (quotedReplacement) {
    return quotedReplacement;
  }

  const rewritten = issue.suggestion.match(
    /(?:建议)?(?:改为|改成|替换为|换成|调整为)\s*[:：]?\s*([^。；;\n]{2,300}[。！？!?]?)/u
  );

  return rewritten?.[1]?.trim() ?? "";
}

function hasCompleteSentenceEnding(value: string) {
  return /[。！？!?…」』”’"）)]$/.test(value.trim());
}

function looksLikeInstruction(value: string) {
  return /建议|可以|需要|应该|尽量|补一个|补入一段|改成具体|口语化|节奏|优化|相应变化|等相应|自行|手动|检查|确认/.test(value);
}

function analyzeIssueApply(content: string, issue: ReviewIssue): IssueApplyAnalysis {
  const original = issueOriginalTexts(issue).find((candidate) => content.includes(candidate)) ?? "";
  const replacement = issueReplacementText(issue);
  const insertAfter = /后(?:补入|补上|补一段|加入|添加|增加)|之后(?:补入|补上|加入|添加|增加)/.test(
    issue.suggestion
  );

  if (!original || !content.includes(original)) {
    return {
      canApply: false,
      original: "",
      replacement: "",
      insertAfter,
      reason: "没有识别到正文中的完整原句。"
    };
  }

  if (/删|删除|去掉|删掉/.test(issue.suggestion) && !replacement) {
    return {
      canApply: false,
      original,
      replacement: "",
      insertAfter,
      reason: "删除类建议容易误删上下文，建议手动确认。"
    };
  }

  if (!replacement) {
    return {
      canApply: false,
      original,
      replacement: "",
      insertAfter,
      reason: "没有识别到完整替换文本。"
    };
  }

  if (looksLikeInstruction(replacement)) {
    return {
      canApply: false,
      original,
      replacement,
      insertAfter,
      reason: "替换文本更像修改方向，不是可直接放进正文的句子。"
    };
  }

  if (!hasCompleteSentenceEnding(replacement)) {
    return {
      canApply: false,
      original,
      replacement,
      insertAfter,
      reason: "替换文本不是完整句子，自动套用可能导致上下文断裂。"
    };
  }

  if (!insertAfter && original.replace(/\s/g, "").length >= 30 && replacement.replace(/\s/g, "").length < original.replace(/\s/g, "").length * 0.55) {
    return {
      canApply: false,
      original,
      replacement,
      insertAfter,
      reason: "替换文本比原句短太多，可能会丢失上下文。"
    };
  }

  return { canApply: true, original, replacement, insertAfter, reason: "" };
}

function applyIssueToText(content: string, issue: ReviewIssue) {
  const analysis = analyzeIssueApply(content, issue);

  if (!analysis.canApply) {
    return { content, applied: false, reason: analysis.reason };
  }

  return {
    content: content.replace(
      analysis.original,
      analysis.insertAfter ? `${analysis.original}\n\n${analysis.replacement}` : analysis.replacement
    ),
    applied: true,
    reason: ""
  };
}

function canAutoApplyIssue(content: string, issue: ReviewIssue) {
  return analyzeIssueApply(content, issue).canApply;
}

export function DraftRevisionEditor({
  projectId,
  draftId,
  initialContent,
  reviewIssues = []
}: {
  projectId: string;
  draftId: string;
  initialContent: string;
  reviewIssues?: ReviewIssue[];
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<{
    status: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ status: "idle" });
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [issueStatuses, setIssueStatuses] = useState<Record<number, IssueApplyStatus>>({});
  const characterCount = countTextCharacters(content);
  const hasChanges = content !== initialContent;

  function issueStatus(issue: ReviewIssue, index: number) {
    return issueStatuses[index] ?? (canAutoApplyIssue(content, issue) ? "pending" : "manual");
  }

  function applyOne(issue: ReviewIssue, index: number) {
    const result = applyIssueToText(content, issue);

    if (!result.applied) {
      setIssueStatuses((current) => ({ ...current, [index]: "manual" }));
      setApplyResult({
        applied: 0,
        skipped: 1,
        message: result.reason || "这条建议不适合自动替换，已保留给你手动修改。"
      });
      return;
    }

    setContent(result.content);
    setIssueStatuses((current) => ({ ...current, [index]: "applied" }));
    setApplyResult({
      applied: 1,
      skipped: 0,
      message: "已把这条建议套用到编辑框，保存后才会替换正文。"
    });
  }

  function applyAll() {
    let nextContent = content;
    let applied = 0;
    let skipped = 0;
    const nextStatuses: Record<number, IssueApplyStatus> = { ...issueStatuses };

    reviewIssues.forEach((issue, index) => {
      if (!canAutoApplyIssue(nextContent, issue)) {
        skipped += 1;
        nextStatuses[index] = "manual";
        return;
      }

      const result = applyIssueToText(nextContent, issue);

      if (result.applied) {
        nextContent = result.content;
        applied += 1;
        nextStatuses[index] = "applied";
      } else {
        skipped += 1;
        nextStatuses[index] = "manual";
      }
    });

    setContent(nextContent);
    setIssueStatuses(nextStatuses);
    setApplyResult({
      applied,
      skipped,
      message:
        applied > 0
          ? `已套用 ${applied} 条可识别建议，${skipped} 条需要手动处理。`
          : "没有找到可直接套用的建议，建议在编辑框里手动修改。"
    });
  }

  async function saveDraft() {
    if (!hasChanges) {
      setState({ status: "idle", message: "正文没有变化，无需保存。" });
      return;
    }

    const confirmed = window.confirm(
      "确定保存并替换当前章节正文吗？保存后本章原有台账和审稿结果会失效，需要重新生成。"
    );

    if (!confirmed) {
      return;
    }

    setState({ status: "saving" });

    try {
      const response = await fetch(`/api/projects/${projectId}/writing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_edit_to_draft",
          draftId,
          revisedText: content
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "保存正文失败"
        );
      }

      setState({ status: "saved", message: "正文已替换，请重新生成台账和审稿。" });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "保存正文失败"
      });
    }
  }

  return (
    <div className="draft-revision-editor">
      {reviewIssues.length > 0 ? (
        <div className="review-apply-panel">
          <div className="field-label-row">
            <div>
              <div className="field-label">审稿建议套用</div>
              <div className="footer-note">先套用到编辑框，确认后再保存替换正文。</div>
            </div>
            <button
              className="mini-action-button"
              type="button"
              onClick={applyAll}
              disabled={!reviewIssues.some((issue, index) => issueStatus(issue, index) === "pending")}
            >
              套用全部可识别建议
            </button>
          </div>
          <div className="review-apply-list">
            {reviewIssues.map((issue, index) => {
              const status = issueStatus(issue, index);
              const statusLabel =
                status === "applied" ? "已套用" : status === "manual" ? "需手动" : "可自动";
              const statusClass =
                status === "applied"
                  ? "pill success"
                  : status === "manual"
                    ? "pill warning"
                    : "pill";

              return (
                <div className={`review-apply-item ${status}`} key={`${issue.type}-${issue.location}-${index}`}>
                  <div className="review-apply-copy">
                    <div className="meta-row">
                      <span className={statusClass}>{statusLabel}</span>
                      <span className="muted">建议 {index + 1}</span>
                    </div>
                    <div className="muted">
                      {formatReviewText(issue.location) || "正文相关段落"}：{formatReviewText(issue.suggestion)}
                    </div>
                    {status === "manual" ? (
                      <div className="footer-note">
                        {analyzeIssueApply(content, issue).reason || "这条建议不适合自动替换，请在下方正文里手动修改。"}
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="mini-action-button"
                    type="button"
                    onClick={() => applyOne(issue, index)}
                    disabled={status === "applied" || status === "manual"}
                  >
                    {status === "applied" ? "已套用" : status === "manual" ? "手动处理" : "套用到编辑框"}
                  </button>
                </div>
              );
            })}
          </div>
          {applyResult ? <div className="pill form-status">{applyResult.message}</div> : null}
        </div>
      ) : null}

      <div className="field">
        <div className="field-label-row">
          <div className="field-label">可编辑正文</div>
          <span className="chip">{characterCount.toLocaleString("zh-CN")} 字</span>
        </div>
        <textarea
          className="saved-draft-textarea editable-draft-textarea"
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setState({ status: "idle" });
          }}
        />
      </div>
      <div className="hero-actions">
        <button
          className="button primary"
          type="button"
          onClick={saveDraft}
          disabled={state.status === "saving" || content.trim().length < 10}
        >
          {state.status === "saving" ? "正在保存..." : "保存替换正文"}
        </button>
        <button
          className="button"
          type="button"
          onClick={() => {
            setContent(initialContent);
            setApplyResult(null);
            setIssueStatuses({});
            setState({ status: "idle" });
          }}
          disabled={!hasChanges || state.status === "saving"}
        >
          撤回未保存修改
        </button>
      </div>
      {state.message ? (
        <div className={`pill ${state.status === "error" ? "danger" : state.status === "saved" ? "success" : ""}`.trim()}>
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
