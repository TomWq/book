import { mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { exportCurrentUserData } from "@/lib/projects";

export const runtime = "nodejs";

function timestampForFilename() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

async function directoryExists(targetPath: string) {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

async function resolveExportDirectory() {
  const homeDir = os.homedir();
  const candidates = [
    path.join(homeDir, "Desktop"),
    path.join(homeDir, "Downloads"),
    homeDir
  ];

  for (const candidate of candidates) {
    if (await directoryExists(candidate)) {
      return candidate;
    }
  }

  await mkdir(homeDir, { recursive: true });
  return homeDir;
}

export async function POST() {
  if (!isDesktopRuntime()) {
    return Response.json(
      { error: "当前环境不支持直接保存到本机桌面，请使用浏览器下载备份。" },
      { status: 400 }
    );
  }

  const payload = await exportCurrentUserData();
  const exportDir = await resolveExportDirectory();
  const filename = `墨澜 · AI 网文写作助手-备份-${timestampForFilename()}.json`;
  const filePath = path.join(exportDir, filename);

  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  return Response.json({
    ok: true,
    filename,
    path: filePath
  });
}
