"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type AiCoverGeneratorDialogProps = {
  open: boolean;
  title: string;
  authorName?: string;
  onClose: () => void;
  onGenerated: (coverImageUrl: string) => Promise<void> | void;
};

type CoverQuota = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
};

const stylePrompts = [
  "玄幻升级流，少年主角背对古老宗门，远处有巨大神兽虚影，金色灵气，热血高燃",
  "都市逆袭爽文，现代城市夜景，主角立于高楼边缘，冷色霓虹，强反差光影",
  "女频重生复仇，华丽古风宅院，女主沉静回眸，红金配色，克制但有压迫感",
  "末世生存，废墟城市和破晓天光，主角小队剪影，危机感强，电影海报质感",
  "规则怪谈，诡异校园走廊，冷白灯光，空间轻微扭曲，悬疑压迫但不血腥",
  "修仙群像，云海仙山，飞剑与阵法光纹，东方幻想，留白充足适合封面排版"
];

export function AiCoverGeneratorDialog({
  open,
  title,
  authorName,
  onClose,
  onGenerated
}: AiCoverGeneratorDialogProps) {
  const [bookTitle, setBookTitle] = useState(title);
  const [bookAuthor, setBookAuthor] = useState(authorName ?? "");
  const [stylePrompt, setStylePrompt] = useState("");
  const [quota, setQuota] = useState<CoverQuota | null>(null);
  const [configured, setConfigured] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setBookTitle(title);
    setBookAuthor(authorName ?? "");
    setError("");
    setIsLoadingStatus(true);
    fetch("/api/cover-image/generate", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(body?.error || "获取封面生成状态失败");
        }

        setConfigured(Boolean(body.configured));
        setQuota(body.quota ?? null);
      })
      .catch((statusError) => setError(statusError instanceof Error ? statusError.message : "获取封面生成状态失败"))
      .finally(() => setIsLoadingStatus(false));
  }, [authorName, open, title]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const remaining = quota?.remaining ?? 0;
  const canGenerate = configured && remaining > 0 && bookTitle.trim().length > 0 && !isGenerating;
  const quotaHint = isLoadingStatus
    ? "正在读取今日剩余次数..."
    : remaining > 0
      ? `点击生成会消耗 1 次，生成后剩余 ${Math.max(0, remaining - 1)} 次。`
      : "今日次数已用完，请明天再试。";

  async function generateCover() {
    if (!canGenerate) {
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/cover-image/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: bookTitle,
          authorName: bookAuthor,
          stylePrompt
        })
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.error ? String(body.error) : "生成封面失败，请稍后重试");
      }

      const coverImageUrl = String(body.coverImageUrl ?? "");

      if (!coverImageUrl) {
        throw new Error("接口没有返回封面图片");
      }

      setQuota(body.quota ?? quota);
      await onGenerated(coverImageUrl);
      onClose();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "生成封面失败");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="tag-dialog-backdrop ai-cover-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="tag-dialog ai-cover-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-cover-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tag-dialog-head">
          <div>
            <h3 id="ai-cover-dialog-title">AI 生成封面</h3>
            <span className="muted">每日次数按当前 Key 的后台配置限制，生成成功后会自动替换当前封面。</span>
          </div>
          <button className="tag-dialog-close" type="button" onClick={onClose} aria-label="关闭 AI 生成封面">
            ×
          </button>
        </div>

        <div className="ai-cover-dialog-body">
          <div className="split-panels">
            <div className="field">
              <div className="field-label">书名</div>
              <input value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} maxLength={60} placeholder="请输入书名" />
            </div>
            <div className="field">
              <div className="field-label">作者名</div>
              <input value={bookAuthor} onChange={(event) => setBookAuthor(event.target.value)} maxLength={20} placeholder="请输入作者名" />
            </div>
          </div>

          <div className="field">
            <div className="field-label">画面风格描述</div>
            <textarea
              value={stylePrompt}
              onChange={(event) => setStylePrompt(event.target.value)}
              maxLength={500}
              placeholder="写题材、主角姿态、场景、色彩、氛围和封面质感，例如：都市逆袭，雨夜高楼，主角背影，冷色霓虹，强商业封面感"
            />
            <div className="field-hint">{stylePrompt.length}/500</div>
          </div>
          {/* 样式建议 */}
          <div className="field">
            <div className="field-label">画面风格参考</div>
             <div className="ai-cover-style-grid">
            {stylePrompts.map((prompt) => (
              <button key={prompt} className="assist-suggestion" type="button" onClick={() => setStylePrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          </div>
         

          <div className="quote-box warning-box">
            {isLoadingStatus
              ? "正在读取今日剩余次数..."
              : configured
                ? `今日还可免费生成 ${remaining}/${quota?.limit ?? 3} 次。`
                : "后台还没有配置封面生图 Key，请管理员先到授权后台填写。"}
          </div>
          {error ? <div className="field-hint project-cover-error">{error}</div> : null}
        </div>

        <div className="tag-dialog-foot">
          <span>{quotaHint}</span>
          <div className="hero-actions">
            <button className="button" type="button" onClick={onClose}>
              取消
            </button>
            <button className="button primary" type="button" onClick={generateCover} disabled={!canGenerate}>
              {isGenerating ? "生成中..." : "生成封面"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
