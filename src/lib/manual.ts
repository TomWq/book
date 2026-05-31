import { readFileSync } from "node:fs";
import path from "node:path";

export type ManualContentSource = {
  markdown: string;
  source: "remote" | "local";
  sourceUrl?: string;
  updatedAt?: string;
};

type ManualRemotePayload = {
  markdown?: unknown;
  content?: unknown;
  updatedAt?: unknown;
  sourceUrl?: unknown;
};

const manualFallbackPath = path.join(process.cwd(), "USER_MANUAL.md");

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = String(process.env[key] ?? "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function appendPath(baseUrl: string, suffix: string) {
  return `${baseUrl.replace(/\/+$/, "")}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

export function getRemoteManualUrl() {
  const direct = envValue("APP_MANUAL_URL", "NEXT_PUBLIC_MANUAL_URL", "MANUAL_REMOTE_URL");
  if (direct) {
    return direct;
  }

  const baseUrl = envValue("APP_PUBLIC_BASE_URL", "LICENSE_SERVER_URL");
  return baseUrl ? appendPath(baseUrl, "/api/manual") : "";
}

export function getManualSourceUrl() {
  const direct = envValue("MANUAL_SOURCE_URL", "MANUAL_CONTENT_URL");
  if (direct) {
    return direct;
  }

  return "";
}

function readLocalManual() {
  return readFileSync(manualFallbackPath, "utf8");
}

function isUsableManual(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 100 && trimmed.includes("AI 网文写作助手使用手册");
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json, text/markdown, text/plain;q=0.9, */*;q=0.1"
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseRemoteManual(raw: string, sourceUrl: string): ManualContentSource | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(?:<!doctype\s+html|<html[\s>])/i.test(trimmed)) {
    return null;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const payload = JSON.parse(trimmed) as ManualRemotePayload;
      const markdown = String(payload.markdown ?? payload.content ?? "").trim();

      if (!isUsableManual(markdown)) {
        return null;
      }

      return {
        markdown,
        source: "remote",
        sourceUrl: String(payload.sourceUrl ?? sourceUrl).trim() || sourceUrl || undefined,
        updatedAt: String(payload.updatedAt ?? "").trim() || undefined
      };
    } catch {
      return null;
    }
  }

  if (!isUsableManual(trimmed)) {
    return null;
  }

  return {
    markdown: raw,
    source: "remote",
    sourceUrl
  };
}

export async function loadManualContent() {
  const remoteUrl = getRemoteManualUrl();

  if (remoteUrl) {
    const remoteText = await fetchText(remoteUrl);
    if (remoteText) {
      const parsed = parseRemoteManual(remoteText, remoteUrl);
      if (parsed) {
        return parsed;
      }
    }
  }

  return {
    markdown: readLocalManual(),
    source: "local"
  } satisfies ManualContentSource;
}

export async function loadManualApiContent() {
  const sourceUrl = getManualSourceUrl();

  if (sourceUrl) {
    const remoteText = await fetchText(sourceUrl);
    if (remoteText) {
      const parsed = parseRemoteManual(remoteText, sourceUrl);
      if (parsed) {
        return parsed;
      }
    }
  }

  return {
    markdown: readLocalManual(),
    source: "local"
  } satisfies ManualContentSource;
}
