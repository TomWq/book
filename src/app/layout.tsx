import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import { ConfirmDialogProvider } from "@/components/confirm-dialog-provider";
import { AppShell } from "@/components/app-shell";
import { AppToaster } from "@/components/app-toaster";
import { FormValidationLocalizer } from "@/components/form-validation-localizer";
import { isDesktopRuntime } from "@/lib/app-runtime";

export const metadata: Metadata = {
  title: "AI 网文写作助手",
  description: "拆书、模板迁移、长篇创作状态管理的 Web 工作台"
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const desktopRuntime = isDesktopRuntime();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const root = document.documentElement; const themeKey = "ai-novel-workbench-theme"; const stored = localStorage.getItem(themeKey); const theme = stored === "dark" || stored === "light" ? stored : "light"; const clamp = (value) => { const numericValue = Number(value); return Number.isFinite(numericValue) ? Math.min(100, Math.max(0, Math.round(numericValue))) : 55; }; const legacyClarity = (value) => value === "weak" ? 28 : value === "strong" ? 82 : 55; const applyTuning = (clarity, dark) => { const ratio = clamp(clarity) / 100; const blur = Math.max(0, Math.round((18 - ratio * 18) * 10) / 10); const opacity = Math.round((0.14 + ratio * 0.42) * 100) / 100; const saturation = Math.round((0.76 + ratio * 0.34) * 100) / 100; const overlayAlpha = Math.round((dark ? 0.74 - ratio * 0.42 : 0.72 - ratio * 0.56) * 100) / 100; const surfaceAlpha = Math.round((dark ? 0.58 - ratio * 0.28 : 0.58 - ratio * 0.34) * 100) / 100; const softAlpha = Math.round((dark ? 0.42 - ratio * 0.22 : 0.42 - ratio * 0.24) * 100) / 100; root.style.setProperty("--workspace-bg-opacity", String(opacity)); root.style.setProperty("--workspace-bg-blur", blur + "px"); root.style.setProperty("--workspace-bg-saturation", String(saturation)); root.style.setProperty("--workspace-bg-overlay", dark ? "rgba(9, 14, 22, " + overlayAlpha + ")" : "rgba(242, 247, 255, " + overlayAlpha + ")"); root.style.setProperty("--workspace-surface", dark ? "rgba(23, 30, 42, " + surfaceAlpha + ")" : "rgba(255, 255, 255, " + surfaceAlpha + ")"); root.style.setProperty("--workspace-surface-soft", dark ? "rgba(23, 30, 42, " + softAlpha + ")" : "rgba(255, 255, 255, " + softAlpha + ")"); }; root.dataset.theme = theme; root.style.colorScheme = theme; const bgRaw = localStorage.getItem("ai-novel-workbench-background"); if (bgRaw) { const bg = JSON.parse(bgRaw); const clarity = typeof bg.clarity !== "undefined" ? clamp(bg.clarity) : legacyClarity(bg.strength); if (theme === "light" && bg && bg.enabled !== false && typeof bg.imageDataUrl === "string" && bg.imageDataUrl) { root.dataset.workspaceBg = "on"; delete root.dataset.workspaceBgStrength; root.style.setProperty("--workspace-bg-image", 'url("' + bg.imageDataUrl + '")'); applyTuning(clarity, false); } else { root.dataset.workspaceBg = "off"; } } } catch {} })();`
          }}
        />
      </head>
      <body className={desktopRuntime ? "desktop-runtime" : undefined}>
        <FormValidationLocalizer />
        <ConfirmDialogProvider>
          <AppShell>{children}</AppShell>
        </ConfirmDialogProvider>
        <AppToaster />
      </body>
    </html>
  );
}
