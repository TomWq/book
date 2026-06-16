"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionLoadingOverlay } from "@/components/api-form";
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
type IssueFocusResult = {
  found: boolean;
  message: string;
};
type TextRange = {
  start: number;
  end: number;
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

function chineseNumberToInteger(value: string) {
  const digits: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (value === "十") {
    return 10;
  }

  const tenIndex = value.indexOf("十");

  if (tenIndex >= 0) {
    const left = value.slice(0, tenIndex);
    const right = value.slice(tenIndex + 1);
    return (left ? digits[left] ?? 0 : 1) * 10 + (right ? digits[right] ?? 0 : 0);
  }

  return digits[value] ?? 0;
}

function paragraphReference(issue: ReviewIssue) {
  const match = issue.location.match(/(?:正文)?第\s*([一二两三四五六七八九十\d]{1,3})\s*段/u);
  const number = match ? chineseNumberToInteger(match[1]) : 0;

  return Number.isFinite(number) && number > 0 ? number : 0;
}

function contentParagraphs(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function contentParagraphRanges(content: string) {
  return Array.from(content.matchAll(/\S[\s\S]*?(?=\n{2,}|$)/g)).map((match) => {
    const raw = match[0];
    const rawStart = match.index ?? 0;
    const leadingWhitespace = raw.length - raw.trimStart().length;
    const trimmedEnd = raw.trimEnd().length;

    return {
      text: raw.trim(),
      start: rawStart + leadingWhitespace,
      end: rawStart + trimmedEnd
    };
  }).filter((item) => item.text);
}

function compactTextWithMap(value: string) {
  const chars: string[] = [];
  const map: number[] = [];

  Array.from(value).forEach((char, index) => {
    if (/\s/.test(char)) {
      return;
    }

    chars.push(char);
    map.push(index);
  });

  return {
    text: chars.join(""),
    map
  };
}

function uniqueCandidates(candidates: string[]) {
  return Array.from(new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean)));
}

function suggestionOriginalText(issue: ReviewIssue) {
  const suggestionQuotes = quotedTexts(issue.suggestion);

  return suggestionQuotes.length >= 2 && /将|把|在|原句|后补|补入|改为|改成|替换/.test(issue.suggestion)
    ? suggestionQuotes[0]
    : "";
}

function issueOriginalTexts(content: string, issue: ReviewIssue) {
  const quotedOriginal = suggestionOriginalText(issue);
  const paragraphNumber = paragraphReference(issue);
  const paragraphOriginal = paragraphNumber ? contentParagraphs(content)[paragraphNumber - 1] ?? "" : "";
  const candidates = [paragraphOriginal, quotedOriginal, ...quotedTexts(issue.location), plainLocationText(issue)];
  return uniqueCandidates(candidates);
}

function isGenericLocationText(value: string) {
  return /^(?:全文|全篇|通篇|多处|多段|开头|结尾|开头段|结尾段|正文相关段落|相关段落|正文第\s*[一二两三四五六七八九十\d]{1,3}\s*段|第\s*[一二两三四五六七八九十\d]{1,3}\s*段)$/u.test(
    value.trim()
  );
}

function exactCandidateRange(content: string, candidate: string): TextRange | null {
  const index = content.indexOf(candidate);

  if (index >= 0) {
    return { start: index, end: index + candidate.length };
  }

  return null;
}

function compactCandidateRange(content: string, candidate: string): TextRange | null {
  const compactCandidate = compactTextWithMap(candidate).text;

  if (compactCandidate.length < 8) {
    return null;
  }

  const compactContent = compactTextWithMap(content);
  const index = compactContent.text.indexOf(compactCandidate);

  if (index < 0) {
    return null;
  }

  const start = compactContent.map[index] ?? 0;
  const end = (compactContent.map[index + compactCandidate.length - 1] ?? start) + 1;
  return { start, end };
}

function candidateRange(content: string, candidate: string): TextRange | null {
  return exactCandidateRange(content, candidate) ?? compactCandidateRange(content, candidate);
}

function locationQuotedRange(content: string, issue: ReviewIssue): TextRange | null {
  const quoted = quotedTexts(issue.location);

  if (quoted.length < 2 || !/[至到-]/.test(issue.location)) {
    return null;
  }

  const startIndex = content.indexOf(quoted[0]);
  const endIndex = content.indexOf(quoted[1], Math.max(0, startIndex));

  if (startIndex < 0 || endIndex < 0) {
    return null;
  }

  const end = endIndex + quoted[1].length;
  return end > startIndex && end - startIndex <= 1600 ? { start: startIndex, end } : null;
}

function issueFocusCandidates(issue: ReviewIssue) {
  const plainLocation = plainLocationText(issue);
  return uniqueCandidates([
    ...quotedTexts(issue.location),
    plainLocation && !isGenericLocationText(plainLocation) ? plainLocation : "",
    suggestionOriginalText(issue)
  ]);
}

function findIssueTextRange(content: string, issue: ReviewIssue) {
  const quotedRange = locationQuotedRange(content, issue);

  if (quotedRange) {
    return quotedRange;
  }

  const exactCandidates = issueFocusCandidates(issue);

  for (const candidate of exactCandidates) {
    const range = candidateRange(content, candidate);

    if (range) {
      return range;
    }
  }

  const paragraphNumber = paragraphReference(issue);

  if (paragraphNumber) {
    const paragraph = contentParagraphRanges(content)[paragraphNumber - 1];

    if (paragraph) {
      return { start: paragraph.start, end: paragraph.end };
    }
  }

  return null;
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

function issueHasUnmatchedQuotedOriginal(content: string, issue: ReviewIssue) {
  const quotedOriginal = suggestionOriginalText(issue);

  return Boolean(quotedOriginal && !candidateRange(content, quotedOriginal));
}

function hasCompleteSentenceEnding(value: string) {
  return /[。！？!?…」』”’"）)]$/.test(value.trim());
}

function hasContinuationEnding(value: string) {
  return /(?:——|—|：|:)$/.test(value.trim());
}

function hasSafeReplacementEnding(original: string, replacement: string, insertAfter: boolean) {
  if (hasCompleteSentenceEnding(replacement)) {
    return true;
  }

  return !insertAfter && hasContinuationEnding(original) && hasContinuationEnding(replacement);
}

function normalizedLength(value: string) {
  return value.replace(/\s/g, "").length;
}

function isShortInlineReplacement(original: string, replacement: string, issue: ReviewIssue, insertAfter: boolean) {
  if (insertAfter) {
    return false;
  }

  const originalLength = normalizedLength(original);
  const replacementLength = normalizedLength(replacement);
  const isRewriteSuggestion = /将|把|改为|改成|替换|换成|名字|名称|称呼|全名|人名/.test(issue.suggestion);
  const hasSentencePunctuation = /[。！？!?；;\n]/.test(`${original}${replacement}`);

  return (
    isRewriteSuggestion &&
    originalLength >= 2 &&
    replacementLength >= 2 &&
    originalLength <= 30 &&
    replacementLength <= 30 &&
    !hasSentencePunctuation
  );
}

function looksLikeInstruction(value: string) {
  return /建议|可以|需要|应该|尽量|补一个|补入一段|改成具体|口语化|节奏|优化|相应变化|等相应|自行|手动|检查|确认/.test(value);
}

function analyzeIssueApply(content: string, issue: ReviewIssue): IssueApplyAnalysis {
  if (issueHasUnmatchedQuotedOriginal(content, issue)) {
    return {
      canApply: false,
      original: "",
      replacement: "",
      insertAfter: false,
      reason: "AI 引用的原句未在当前正文中找到，这条建议只能作为修改方向手动核对。"
    };
  }

  const original = issueOriginalTexts(content, issue)
    .map((candidate) => {
      const range = candidateRange(content, candidate);
      return range ? content.slice(range.start, range.end) : "";
    })
    .find(Boolean) ?? "";
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
      reason: paragraphReference(issue)
        ? "已识别到段落定位，但对应段落或摘录与当前正文不一致，请手动确认。"
        : "没有识别到正文中的完整原句。"
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

  if (!hasSafeReplacementEnding(original, replacement, insertAfter) && !isShortInlineReplacement(original, replacement, issue, insertAfter)) {
    return {
      canApply: false,
      original,
      replacement,
      insertAfter,
      reason: "替换文本不是完整句子，自动套用可能导致上下文断裂。"
    };
  }

  if (!insertAfter && normalizedLength(original) >= 30 && normalizedLength(replacement) < normalizedLength(original) * 0.55) {
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<{
    status: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ status: "idle" });
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [issueStatuses, setIssueStatuses] = useState<Record<number, IssueApplyStatus>>({});
  const [focusedIssueIndex, setFocusedIssueIndex] = useState<number | null>(null);
  const characterCount = countTextCharacters(content);
  const hasChanges = content !== initialContent;

  useEffect(() => {
    setContent(initialContent);
    setState({ status: "idle" });
    setApplyResult(null);
    setIssueStatuses({});
    setFocusedIssueIndex(null);
  }, [draftId, initialContent]);

  function issueStatus(issue: ReviewIssue, index: number) {
    return issueStatuses[index] ?? (canAutoApplyIssue(content, issue) ? "pending" : "manual");
  }

  function focusIssue(issue: ReviewIssue, index: number): IssueFocusResult {
    const range = findIssueTextRange(content, issue);
    const textarea = textareaRef.current;

    if (!range || !textarea) {
      setFocusedIssueIndex(null);
      return {
        found: false,
        message: "没有在正文里定位到对应原句，可以按这条建议的修改方向手动搜索关键词。"
      };
    }

    setFocusedIssueIndex(index);
    textarea.focus();
    textarea.setSelectionRange(range.start, range.end);

    const selectionRatio = range.start / Math.max(1, content.length);
    textarea.scrollTop = Math.max(0, selectionRatio * textarea.scrollHeight - textarea.clientHeight * 0.28);
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });

    return {
      found: true,
      message: `已定位到建议 ${index + 1} 对应的正文位置，选中的内容可以直接改。`
    };
  }

  function applyOne(issue: ReviewIssue, index: number) {
    const result = applyIssueToText(content, issue);

    if (!result.applied) {
      const focusResult = focusIssue(issue, index);
      setIssueStatuses((current) => ({ ...current, [index]: "manual" }));
      setApplyResult({
        applied: 0,
        skipped: 1,
        message: focusResult.found
          ? `${result.reason || "这条建议不适合自动替换。"}${focusResult.message}`
          : result.reason || focusResult.message
      });
      return;
    }

    setContent(result.content);
    setIssueStatuses((current) => ({ ...current, [index]: "applied" }));
    setFocusedIssueIndex(index);
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

      setState({ status: "saved", message: "正文已替换，章节台账和长期状态已保留，请重新审稿。" });
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
              const unmatchedQuotedOriginal = issueHasUnmatchedQuotedOriginal(content, issue);
              const statusLabel =
                status === "applied" ? "已套用" : status === "manual" ? "需手动" : "可自动";
              const statusClass =
                status === "applied"
                  ? "pill success"
                  : status === "manual"
                    ? "pill warning"
                    : "pill";

              return (
                <div
                  className={`review-apply-item ${status} ${focusedIssueIndex === index ? "focused" : ""}`}
                  key={`${issue.type}-${issue.location}-${index}`}
                >
                  <div className="review-apply-copy">
                    <div className="review-apply-meta">
                      <span className="review-apply-title">建议 {index + 1}</span>
                      <span className={`${statusClass} review-status-pill`}>{statusLabel}</span>
                    </div>
                    <div className="muted">
                      {formatReviewText(issue.location) || "正文相关段落"}：{formatReviewText(issue.suggestion)}
                    </div>
                    {unmatchedQuotedOriginal ? (
                      <div className="footer-note warning-text">
                        AI 引用的原句未在当前正文中找到，请按修改方向手动核对，不要直接套用。
                      </div>
                    ) : null}
                    {status === "manual" ? (
                      <div className="footer-note">
                        {analyzeIssueApply(content, issue).reason || "这条建议不适合自动替换，请在下方正文里手动修改。"}
                      </div>
                    ) : null}
                  </div>
                  <div className="review-apply-actions">
                    <button
                      className="mini-action-button"
                      type="button"
                      onClick={() => applyOne(issue, index)}
                      disabled={status === "applied" || status === "manual"}
                    >
                      {status === "applied" ? "已套用" : status === "manual" ? "手动处理" : "套用到编辑框"}
                    </button>
                    {status !== "applied" ? (
                      <button
                        className="mini-action-button"
                        type="button"
                        onClick={() => {
                          const result = focusIssue(issue, index);
                          setIssueStatuses((current) => ({ ...current, [index]: "manual" }));
                          setApplyResult({
                            applied: 0,
                            skipped: result.found ? 0 : 1,
                            message: result.message
                          });
                        }}
                      >
                        定位原文
                      </button>
                    ) : null}
                  </div>
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
          ref={textareaRef}
          className="saved-draft-textarea editable-draft-textarea"
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setState({ status: "idle" });
          }}
        />
      </div>
      <div className="hero-actions">
        {state.status === "saving" ? (
          <ActionLoadingOverlay
            title="正在保存替换正文"
            description="正在更新章节正文，保留章节台账和长期状态，只清理本章旧审稿。"
          />
        ) : null}
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
