"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AiCoverGeneratorDialog } from "@/components/ai-cover-generator-dialog";

type ProjectCoverEditorProps = {
  projectId: string;
  title: string;
  coverImageUrl?: string;
  subtitle?: string;
};

const maxCoverWidth = 960;
const maxCoverHeight = 1400;

function getRenderableCoverUrl(value?: string) {
  const url = String(value ?? "").trim();

  if (!url) {
    return "";
  }

  if (
    url.startsWith("data:image/") ||
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/")
  ) {
    return url;
  }

  return "";
}

async function fileToOptimizedDataUrl(file: File) {
  try {
    const objectUrl = URL.createObjectURL(file);

    try {
      const image = new Image();
      image.decoding = "async";
      image.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("封面图片加载失败"));
      });

      const naturalWidth = Math.max(1, image.naturalWidth);
      const naturalHeight = Math.max(1, image.naturalHeight);
      const scale = Math.min(maxCoverWidth / naturalWidth, maxCoverHeight / naturalHeight, 1);
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("封面处理失败");
      }

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", 0.86);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("封面读取失败"));
      reader.readAsDataURL(file);
    });
  }
}

export function ProjectCoverEditor({
  projectId,
  title,
  coverImageUrl,
  subtitle = "项目封面"
}: ProjectCoverEditorProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(() => String(coverImageUrl ?? "").trim());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [isMethodDialogOpen, setIsMethodDialogOpen] = useState(false);
  const [isAiCoverDialogOpen, setIsAiCoverDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPreviewUrl(String(coverImageUrl ?? "").trim());
    setError("");
  }, [coverImageUrl]);

  useEffect(() => {
    if (!isMethodDialogOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMethodDialogOpen]);

  const storedCoverUrl = String(coverImageUrl ?? "").trim();
  const effectiveCoverUrl = getRenderableCoverUrl(previewUrl);
  const hasStoredCover = Boolean(storedCoverUrl);
  const hasRenderableCover = Boolean(effectiveCoverUrl);

  async function persistCover(nextUrl: string) {
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ coverImageUrl: nextUrl })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "更新封面失败");
      }

      const savedCoverUrl = String(payload?.project?.coverImageUrl ?? nextUrl).trim();
      setPreviewUrl(savedCoverUrl);
      router.refresh();
    } catch (submitError) {
      setPreviewUrl(storedCoverUrl);
      setError(submitError instanceof Error ? submitError.message : "更新封面失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const optimizedDataUrl = await fileToOptimizedDataUrl(file);
      setPreviewUrl(optimizedDataUrl);
      await persistCover(optimizedDataUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传封面失败");
      setPreviewUrl(storedCoverUrl);
    }
  }

  async function handleClearCover() {
    setPreviewUrl("");
    await persistCover("");
  }

  async function handleGeneratedCover(nextCoverImageUrl: string) {
    setPreviewUrl(nextCoverImageUrl);
    await persistCover(nextCoverImageUrl);
  }

  return (
    <div className="project-cover-editor">
      <div className={`book-cover ${hasRenderableCover ? "has-custom-cover" : ""}`}>
        {hasRenderableCover ? (
          <img className="book-cover-image" src={effectiveCoverUrl} alt={`${title} 封面`} />
        ) : (
          <>
            <div className="book-cover-title">{title}</div>
            <div className="book-cover-author">{subtitle}</div>
          </>
        )}
      </div>

      <div className="cover-upload-actions">
        <button
          className="button cover-upload-button"
          type="button"
          onClick={() => setIsMethodDialogOpen(true)}
          disabled={isSaving}
        >
          {isSaving ? "保存中..." : hasStoredCover ? "更换封面" : "上传封面"}
        </button>
        <button
          className="button"
          type="button"
          onClick={handleClearCover}
          disabled={isSaving || !hasStoredCover}
        >
          移除封面
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
      </div>

      {error ? <div className="field-hint project-cover-error">{error}</div> : null}

      {isMethodDialogOpen && mounted
        ? createPortal(
            <div className="tag-dialog-backdrop cover-method-backdrop" role="presentation" onMouseDown={() => setIsMethodDialogOpen(false)}>
              <div
                className="cover-method-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cover-method-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="tag-dialog-head">
                  <h3 id="cover-method-title">更换封面</h3>
                  <button className="tag-dialog-close" type="button" onClick={() => setIsMethodDialogOpen(false)} aria-label="关闭更换封面">
                    ×
                  </button>
                </div>
                <div className="cover-method-options">
                  <button
                    className="taxonomy-card taxonomy-card-main"
                    type="button"
                    onClick={() => {
                      setIsMethodDialogOpen(false);
                      inputRef.current?.click();
                    }}
                  >
                    <span className="taxonomy-card-icon" aria-hidden="true">传</span>
                    <span>
                      <strong>本地上传</strong>
                      <small>从电脑选择已有封面图片。</small>
                    </span>
                  </button>
                  <button
                    className="taxonomy-card taxonomy-card-main"
                    type="button"
                    onClick={() => {
                      setIsMethodDialogOpen(false);
                      setIsAiCoverDialogOpen(true);
                    }}
                  >
                    <span className="taxonomy-card-icon alt" aria-hidden="true">AI</span>
                    <span>
                      <strong>AI 生成</strong>
                      <small>按当前 Key 的后台次数限制，生成成功后自动替换当前封面。</small>
                    </span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <AiCoverGeneratorDialog
        open={isAiCoverDialogOpen}
        title={title}
        authorName={subtitle === "项目封面" ? "" : subtitle}
        onClose={() => setIsAiCoverDialogOpen(false)}
        onGenerated={handleGeneratedCover}
      />
    </div>
  );
}
