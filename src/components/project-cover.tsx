"use client";

import { useEffect, useState } from "react";

type ProjectCoverProps = {
  title: string;
  authorName?: string;
  coverImageUrl?: string;
  fallbackLabel?: string;
  size?: "sm" | "lg";
  className?: string;
};

export function ProjectCover({
  title,
  authorName,
  coverImageUrl,
  fallbackLabel,
  size = "sm",
  className = ""
}: ProjectCoverProps) {
  const [imageError, setImageError] = useState(false);
  const fallbackText = title.trim() || fallbackLabel?.trim() || "未命名作品";
  const fallbackAuthor = authorName?.trim() || "作者";
  const src = String(coverImageUrl ?? "").trim();
  const isRenderableSrc =
    src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/");

  useEffect(() => {
    setImageError(false);
  }, [src]);

  return (
    <div
      className={`project-cover project-cover-${size} ${isRenderableSrc && !imageError ? "has-image" : ""} ${className}`.trim()}
    >
      {isRenderableSrc && !imageError ? (
        <img
          className="project-cover-image"
          src={src}
          alt={`${title} 封面`}
          loading="lazy"
          decoding="async"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="book-cover project-cover-fallback" aria-hidden="true">
          <div className="book-cover-title">{fallbackText}</div>
          <div className="book-cover-author">{fallbackAuthor}</div>
        </div>
      )}
    </div>
  );
}
