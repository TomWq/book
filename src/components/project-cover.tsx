"use client";

import { useEffect, useState } from "react";

type ProjectCoverProps = {
  title: string;
  coverImageUrl?: string;
  fallbackLabel?: string;
  size?: "sm" | "lg";
  className?: string;
};

export function ProjectCover({
  title,
  coverImageUrl,
  fallbackLabel,
  size = "sm",
  className = ""
}: ProjectCoverProps) {
  const [imageError, setImageError] = useState(false);
  const fallbackText = title.trim() || fallbackLabel?.trim() || "未命名作品";
  const compactFallbackText = fallbackText.length > 10 ? `${fallbackText.slice(0, 10)}…` : fallbackText;
  const smallFallbackText = fallbackText.length > 6 ? `${fallbackText.slice(0, 6)}…` : fallbackText;
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
        <div className="project-cover-fallback" aria-hidden="true">
          <strong>{size === "lg" ? compactFallbackText : smallFallbackText}</strong>
        </div>
      )}
    </div>
  );
}
