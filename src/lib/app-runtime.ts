export type AppRuntime = "desktop" | "cloud";

function normalizeRuntime(value: string) {
  return value.trim().toLowerCase();
}

export function getAppRuntime(): AppRuntime {
  const configured = normalizeRuntime(
    process.env.APP_RUNTIME ?? process.env.NEXT_PUBLIC_APP_RUNTIME ?? ""
  );

  if (["cloud", "server", "admin", "license-center"].includes(configured)) {
    return "cloud";
  }

  if (["desktop", "electron", "client", "local"].includes(configured)) {
    return "desktop";
  }

  if (process.env.VERCEL) {
    return "cloud";
  }

  if (process.env.NODE_ENV === "production") {
    return "cloud";
  }

  return "desktop";
}

export function isDesktopRuntime() {
  return getAppRuntime() === "desktop";
}

export function isCloudRuntime() {
  return getAppRuntime() === "cloud";
}
