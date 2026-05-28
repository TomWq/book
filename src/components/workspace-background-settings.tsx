"use client";

import { CSSProperties, ChangeEvent, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ai-novel-workbench-background";
const maxImageBytes = 8 * 1024 * 1024;
const maxCanvasSide = 2200;
const defaultClarity = 55;

type BackgroundConfig = {
  imageDataUrl?: string;
  fileName?: string;
  clarity: number;
  enabled: boolean;
  updatedAt: string;
};

type StoredBackgroundConfig = Partial<BackgroundConfig> & {
  strength?: unknown;
};

function clampClarity(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return defaultClarity;
  }

  return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function clarityFromLegacyStrength(value: unknown) {
  if (value === "weak") {
    return 28;
  }

  if (value === "strong") {
    return 82;
  }

  return defaultClarity;
}

function getBackgroundTuning(clarity: number, dark = false) {
  const ratio = clampClarity(clarity) / 100;
  const blur = Math.max(0, Math.round((18 - ratio * 18) * 10) / 10);
  const opacity = Math.round((0.14 + ratio * 0.42) * 100) / 100;
  const saturation = Math.round((0.76 + ratio * 0.34) * 100) / 100;
  const overlayAlpha = Math.round((dark ? 0.74 - ratio * 0.42 : 0.72 - ratio * 0.56) * 100) / 100;
  const surfaceAlpha = Math.round((dark ? 0.58 - ratio * 0.28 : 0.58 - ratio * 0.34) * 100) / 100;
  const softAlpha = Math.round((dark ? 0.42 - ratio * 0.22 : 0.42 - ratio * 0.24) * 100) / 100;

  return {
    blur: `${blur}px`,
    opacity: String(opacity),
    saturation: String(saturation),
    overlay: dark ? `rgba(9, 14, 22, ${overlayAlpha})` : `rgba(242, 247, 255, ${overlayAlpha})`,
    surface: dark ? `rgba(23, 30, 42, ${surfaceAlpha})` : `rgba(255, 255, 255, ${surfaceAlpha})`,
    soft: dark ? `rgba(23, 30, 42, ${softAlpha})` : `rgba(255, 255, 255, ${softAlpha})`
  };
}

function isDarkTheme() {
  return document.documentElement.dataset.theme === "dark";
}

function getClarityDescription(clarity: number) {
  if (clarity <= 20) {
    return "非常模糊，只保留一点氛围。";
  }

  if (clarity <= 45) {
    return "偏柔和，背景存在感较低。";
  }

  if (clarity <= 75) {
    return "比较均衡，能看到背景但不抢正文。";
  }

  return "偏清晰，适合干净、低对比度背景图。";
}

function applyBackgroundTuning(clarity: number) {
  const isDark = isDarkTheme();
  const tuning = getBackgroundTuning(clarity, isDark);

  document.documentElement.style.setProperty("--workspace-bg-opacity", tuning.opacity);
  document.documentElement.style.setProperty("--workspace-bg-blur", tuning.blur);
  document.documentElement.style.setProperty("--workspace-bg-saturation", tuning.saturation);
  document.documentElement.style.setProperty("--workspace-bg-overlay", tuning.overlay);
  document.documentElement.style.setProperty("--workspace-surface", tuning.surface);
  document.documentElement.style.setProperty("--workspace-surface-soft", tuning.soft);
}

function clearBackgroundTuning() {
  document.documentElement.style.removeProperty("--workspace-bg-opacity");
  document.documentElement.style.removeProperty("--workspace-bg-blur");
  document.documentElement.style.removeProperty("--workspace-bg-saturation");
  document.documentElement.style.removeProperty("--workspace-bg-overlay");
  document.documentElement.style.removeProperty("--workspace-surface");
  document.documentElement.style.removeProperty("--workspace-surface-soft");
}

function readStoredConfig(): BackgroundConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredBackgroundConfig;
    return {
      imageDataUrl: typeof parsed.imageDataUrl === "string" ? parsed.imageDataUrl : undefined,
      fileName: typeof parsed.fileName === "string" ? parsed.fileName : undefined,
      clarity: typeof parsed.clarity !== "undefined"
        ? clampClarity(parsed.clarity)
        : clarityFromLegacyStrength(parsed.strength),
      enabled: parsed.enabled !== false,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function applyBackground(config: BackgroundConfig | null) {
  if (typeof document === "undefined") {
    return;
  }

  if (!config || !config.enabled || !config.imageDataUrl || isDarkTheme()) {
    document.documentElement.dataset.workspaceBg = "off";
    document.documentElement.style.removeProperty("--workspace-bg-image");
    delete document.documentElement.dataset.workspaceBgStrength;
    clearBackgroundTuning();
    return;
  }

  document.documentElement.dataset.workspaceBg = "on";
  delete document.documentElement.dataset.workspaceBgStrength;
  document.documentElement.style.setProperty("--workspace-bg-image", `url("${config.imageDataUrl}")`);
  applyBackgroundTuning(config.clarity);
}

function saveConfig(config: BackgroundConfig | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!config) {
    window.localStorage.removeItem(STORAGE_KEY);
    applyBackground(null);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  applyBackground(config);
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败，请换一张图片重试"));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("图片读取失败，请换一张图片重试"));
    reader.readAsDataURL(file);
  });
}

async function compressBackgroundImage(file: File) {
  const rawDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(rawDataUrl);
  const ratio = Math.min(1, maxCanvasSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持处理图片");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function WorkspaceBackgroundSettings() {
  const [config, setConfig] = useState<BackgroundConfig | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const currentClarity = config?.clarity ?? defaultClarity;
  const clarityDescription = useMemo(
    () => getClarityDescription(currentClarity),
    [currentClarity]
  );
  const previewTuning = getBackgroundTuning(currentClarity);
  const previewStyle = config?.imageDataUrl ? ({
    "--workspace-preview-image": `url("${config.imageDataUrl}")`,
    "--workspace-preview-blur": previewTuning.blur,
    "--workspace-preview-saturation": previewTuning.saturation,
    "--workspace-preview-opacity": previewTuning.opacity,
    "--workspace-preview-overlay": previewTuning.overlay
  } as CSSProperties) : undefined;

  useEffect(() => {
    const stored = readStoredConfig();
    setConfig(stored);
    setDarkMode(isDarkTheme());
    applyBackground(stored);

    const observer = new MutationObserver(() => {
      const nextDarkMode = isDarkTheme();
      setDarkMode(nextDarkMode);
      applyBackground(readStoredConfig());
    });

    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme"]
    });

    return () => observer.disconnect();
  }, []);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    setStatus("");

    if (!file) {
      return;
    }

    if (darkMode) {
      setError("个性化背景只支持亮色模式。请先切换到浅色主题后再上传。");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件。");
      return;
    }

    if (file.size > maxImageBytes) {
      setError("图片建议不超过 8MB，可以先压缩后再上传。");
      return;
    }

    try {
      setStatus("正在处理背景图...");
      const imageDataUrl = await compressBackgroundImage(file);
      const nextConfig: BackgroundConfig = {
        imageDataUrl,
        fileName: file.name,
        clarity: currentClarity,
        enabled: true,
        updatedAt: new Date().toISOString()
      };
      setConfig(nextConfig);
      saveConfig(nextConfig);
      setStatus("背景图已应用。");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "图片处理失败，请换一张图片重试。");
      setStatus("");
    }
  }

  function updateClarity(value: number) {
    const clarity = clampClarity(value);
    const nextConfig: BackgroundConfig = {
      imageDataUrl: config?.imageDataUrl,
      fileName: config?.fileName,
      clarity,
      enabled: Boolean(config?.enabled && config.imageDataUrl),
      updatedAt: new Date().toISOString()
    };

    setConfig(nextConfig);
    saveConfig(nextConfig);
    setStatus(config?.imageDataUrl ? "背景清晰度已更新。" : "清晰度已保存，上传背景图后生效。");
  }

  function resetBackground() {
    setConfig(null);
    setStatus("已恢复默认背景。");
    setError("");
    saveConfig(null);
  }

  return (
    <div className="workspace-background-settings" id="workspace-background">
      <div
        className={`workspace-background-preview${config?.imageDataUrl ? " has-image" : ""}`}
        style={previewStyle}
      >
        {config?.imageDataUrl ? (
          <img src={config.imageDataUrl} alt="当前工作台背景预览" />
        ) : (
          <div>
            <strong>默认背景</strong>
            <span>上传一张图后，这里会显示弱化后的氛围预览。</span>
          </div>
        )}
      </div>

      <div className="workspace-background-controls">
        <label className="workspace-background-upload">
          <span>{darkMode ? "亮色模式可上传" : "上传背景图"}</span>
          <input
            type="file"
            accept="image/*"
            disabled={darkMode}
            onChange={(event) => void handleUpload(event)}
          />
        </label>

        <div className="workspace-background-tuning">
          <div className="workspace-background-tuning-head">
            <span>模糊</span>
            <strong>清晰度 {currentClarity}%</strong>
            <span>清楚</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={currentClarity}
            aria-label="背景清晰度"
            disabled={darkMode}
            onChange={(event) => updateClarity(Number(event.target.value))}
          />
        </div>

        <button className="button" type="button" onClick={resetBackground}>
          恢复默认
        </button>
      </div>

      <div className="workspace-background-meta">
        <p>
          当前清晰度：<strong>{currentClarity}%</strong>，{clarityDescription}
        </p>
        {darkMode ? <p className="form-status">个性化背景仅在亮色模式下生效，暗色模式会自动恢复默认背景。</p> : null}
        {config?.fileName ? <p>当前图片：{config.fileName}</p> : null}
        {status ? <p className="form-status">{status}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
}
