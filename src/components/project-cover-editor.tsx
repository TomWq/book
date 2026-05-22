"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    setPreviewUrl(String(coverImageUrl ?? "").trim());
    setError("");
  }, [coverImageUrl]);

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
          onClick={() => inputRef.current?.click()}
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
    </div>
  );
}
