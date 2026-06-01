"use client";

export type CoverQuota = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
};

export type CoverImageGenerationRequest = {
  title: string;
  authorName: string;
  stylePrompt: string;
  onGenerated: (coverImageUrl: string) => Promise<void> | void;
};

export const coverImageGenerationEventName = "ai-novel-workbench:cover-image-generation";

export function requestCoverImageGeneration(payload: CoverImageGenerationRequest) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<CoverImageGenerationRequest>(coverImageGenerationEventName, { detail: payload }));
}
