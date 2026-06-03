import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.resolve(rootDir, "deploy.config.json");
const releaseNotesPath = path.join(rootDir, "release", "release-notes.json");
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const artifactVersion = String(process.env.APP_ARTIFACT_VERSION || process.env.DESKTOP_ARTIFACT_VERSION || packageJson.version || "").trim();
const manifestVersion = String(process.env.APP_LATEST_VERSION || artifactVersion).trim();
const releasePackageDir = path.join(rootDir, "release", "packages", `v${artifactVersion}`);
const args = new Set(process.argv.slice(2));
const localOnly = args.has("--local-only");
const manifestOnly = args.has("--manifest-only");
const defaultPublicBaseUrl = "https://www.wqxinxin.cn";

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getConfig() {
  const fileConfig = readJsonIfExists(configPath) ?? {};

  return {
    host: process.env.DEPLOY_HOST || fileConfig.host || "62.234.205.107",
    user: process.env.DEPLOY_USER || fileConfig.user || "root",
    path: process.env.DEPLOY_PATH || fileConfig.path || "/root/book",
    port: Number(process.env.DEPLOY_PORT || fileConfig.port || 22),
    downloadBaseUrl: process.env.DOWNLOAD_BASE_URL || process.env.APP_DOWNLOAD_BASE_URL || fileConfig.downloadBaseUrl || ""
  };
}

function getReleaseNotes() {
  const fileNotes = readJsonIfExists(releaseNotesPath) ?? {};

  return {
    notes: String(process.env.APP_LATEST_RELEASE_NOTES || fileNotes.notes || `发布 ${manifestVersion} 版本。`).trim(),
    announcement: String(process.env.APP_RELEASE_ANNOUNCEMENT || fileNotes.announcement || "").trim(),
    required: ["1", "true", "yes", "on"].includes(
      String(process.env.APP_UPDATE_REQUIRED ?? fileNotes.required ?? "").toLowerCase()
    )
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`[publish-downloads] ${command} ${args.join(" ")}`.trim());

    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: false,
      env: process.env,
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function normalizeBaseUrl(config) {
  const configured = String(config.downloadBaseUrl || "").trim();
  if (!configured && localOnly) {
    return "/downloads";
  }

  const base = configured || `${defaultPublicBaseUrl}/downloads`;
  return base.replace(/\/+$/, "");
}

function normalizeDownloadPageUrl(config) {
  const configured = String(process.env.APP_DOWNLOAD_PAGE_URL || "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return `${defaultPublicBaseUrl}/download`;
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readTextIfExists(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8").trim() : "";
}

function newestExistingMtime(paths) {
  return paths
    .map((filePath) => existsSync(filePath) ? statSync(filePath).mtimeMs : 0)
    .reduce((max, value) => Math.max(max, value), 0);
}

function assertReleasePackageFresh(filePath) {
  const iconMtime = newestExistingMtime([
    path.join(rootDir, "build", "icon.svg"),
    path.join(rootDir, "build", "icon.png"),
    path.join(rootDir, "build", "icon.icns"),
    path.join(rootDir, "build", "icon.ico")
  ]);

  if (iconMtime <= 0) {
    return;
  }

  const packageMtime = statSync(filePath).mtimeMs;
  const sameReleaseBatchToleranceMs = 15 * 60 * 1000;

  if (packageMtime + sameReleaseBatchToleranceMs < iconMtime) {
    const packageTime = new Date(packageMtime).toLocaleString("zh-CN");
    const iconTime = new Date(iconMtime).toLocaleString("zh-CN");
    throw new Error(
      [
        `发布包比桌面图标资源旧：${path.relative(rootDir, filePath)}`,
        `发布包时间：${packageTime}`,
        `图标时间：${iconTime}`,
        "请先重新下载最新发布包：npm run release:download，然后再执行 npm run downloads:manifest 或 npm run downloads:local。"
      ].join("\n")
    );
  }
}

function releaseFile(fileName) {
  const filePath = path.join(releasePackageDir, fileName);

  if (!existsSync(filePath)) {
    throw new Error(`缺少发布包：release/packages/v${artifactVersion}/${fileName}。请先执行 npm run release:download。`);
  }

  assertReleasePackageFresh(filePath);

  return filePath;
}

function releaseFileIfManifestOnly(fileName) {
  const filePath = path.join(releasePackageDir, fileName);

  if (!manifestOnly) {
    return releaseFile(fileName);
  }

  if (!existsSync(filePath)) {
    throw new Error(`缺少发布包：release/packages/v${artifactVersion}/${fileName}。请先执行 npm run release:download。`);
  }

  return filePath;
}

function fileEntry(input) {
  const sizeBytes = statSync(input.path).size;
  const updaterPath = input.updaterFileName
    ? path.join(releasePackageDir, input.updaterFileName)
    : "";
  const updaterSignaturePath = updaterPath ? `${updaterPath}.sig` : "";
  const hasUpdater = updaterPath && existsSync(updaterPath) && existsSync(updaterSignaturePath);

  return {
    label: input.label,
    fileName: input.fileName,
    url: `${input.baseUrl}/${encodeURIComponent(input.fileName)}`,
    sizeBytes,
    sha256: sha256(input.path),
    updaterFileName: hasUpdater ? input.updaterFileName : "",
    updaterUrl: hasUpdater ? `${input.baseUrl}/${encodeURIComponent(input.updaterFileName)}` : "",
    updaterSignature: hasUpdater ? readTextIfExists(updaterSignaturePath) : "",
    updaterSizeBytes: hasUpdater ? statSync(updaterPath).size : undefined,
    platform: input.platform,
    arch: input.arch
  };
}

function addTauriPlatform(platforms, keys, file) {
  if (!file?.updaterUrl || !file.updaterSignature) {
    return;
  }

  for (const key of keys) {
    platforms[key] = {
      url: file.updaterUrl,
      signature: file.updaterSignature,
      label: file.label,
      sizeBytes: file.updaterSizeBytes ?? file.sizeBytes
    };
  }
}

function toTauriUpdateManifest(manifest, config) {
  const platforms = {};

  addTauriPlatform(platforms, ["windows-x86_64-nsis", "windows-x86_64", "windows-x64"], manifest.files.win32X64);
  addTauriPlatform(platforms, ["darwin-aarch64-app", "darwin-aarch64", "darwin-arm64-app", "darwin-arm64"], manifest.files.darwinArm64);

  return {
    version: manifest.version,
    notes: manifest.notes,
    pub_date: manifest.releaseDate,
    platforms,
    required: manifest.required,
    announcement: manifest.announcement,
    downloadPageUrl: normalizeDownloadPageUrl(config)
  };
}

async function main() {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(artifactVersion)) {
    throw new Error(`package.json 版本号异常：${artifactVersion || "未设置"}`);
  }

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifestVersion)) {
    throw new Error(`APP_LATEST_VERSION 版本号异常：${manifestVersion || "未设置"}`);
  }

  const config = getConfig();
  const releaseNotes = getReleaseNotes();
  const target = `${config.user}@${config.host}`;
  const remoteDownloadsDir = path.posix.join(config.path, "public", "downloads");
  const baseUrl = normalizeBaseUrl(config);
  const files = {
    win32X64: {
      label: "Windows x64",
      fileName: `墨澜 · AI 网文写作助手-Setup-${artifactVersion}-x64.exe`,
      updaterFileName: `墨澜 · AI 网文写作助手-Setup-${artifactVersion}-x64.exe`,
      platform: "win32",
      arch: "x64"
    },
    darwinArm64: {
      label: "macOS Apple 芯片",
      fileName: `墨澜 · AI 网文写作助手-${artifactVersion}-arm64-mac.dmg`,
      updaterFileName: `墨澜 · AI 网文写作助手-${artifactVersion}-arm64-mac.app.tar.gz`,
      platform: "darwin",
      arch: "arm64"
    }
  };
  const prepared = Object.fromEntries(
    Object.entries(files).map(([key, value]) => {
      const filePath = releaseFileIfManifestOnly(value.fileName);
      return [key, fileEntry({ ...value, path: filePath, baseUrl })];
    })
  );
  const manifest = {
    productName: "墨澜 · AI 网文写作助手",
    version: manifestVersion,
    notes: releaseNotes.notes,
    announcement: releaseNotes.announcement,
    releaseDate: new Date().toISOString(),
    required: releaseNotes.required,
    downloads: {
      win32X64: prepared.win32X64.url,
      darwinArm64: prepared.darwinArm64.url
    },
    files: prepared
  };
  const tauriUpdateManifest = toTauriUpdateManifest(manifest, config);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "novel-downloads-"));
  const localDownloadsDir = path.join(rootDir, "public", "downloads");

  try {
    await rm(localDownloadsDir, { recursive: true, force: true });
    mkdirSync(localDownloadsDir, { recursive: true });

    for (const item of Object.values(prepared)) {
      if (!manifestOnly) {
        const source = releaseFile(item.fileName);
        const targetPath = path.join(tempDir, item.fileName);
        writeFileSync(targetPath, readFileSync(source));
        writeFileSync(path.join(localDownloadsDir, item.fileName), readFileSync(source));
        if (item.updaterFileName) {
          const updaterSource = releaseFile(item.updaterFileName);
          const updaterSignatureSource = releaseFile(`${item.updaterFileName}.sig`);
          writeFileSync(path.join(tempDir, item.updaterFileName), readFileSync(updaterSource));
          writeFileSync(path.join(tempDir, `${item.updaterFileName}.sig`), readFileSync(updaterSignatureSource));
          writeFileSync(path.join(localDownloadsDir, item.updaterFileName), readFileSync(updaterSource));
          writeFileSync(path.join(localDownloadsDir, `${item.updaterFileName}.sig`), readFileSync(updaterSignatureSource));
        }
      }
    }

    writeFileSync(path.join(tempDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    writeFileSync(path.join(tempDir, "tauri-update.json"), JSON.stringify(tauriUpdateManifest, null, 2), "utf8");
    writeFileSync(path.join(localDownloadsDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    writeFileSync(path.join(localDownloadsDir, "tauri-update.json"), JSON.stringify(tauriUpdateManifest, null, 2), "utf8");
    mkdirSync(path.join(rootDir, "release"), { recursive: true });
    mkdirSync(releasePackageDir, { recursive: true });
    writeFileSync(path.join(rootDir, "release", "download-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    writeFileSync(path.join(rootDir, "release", "tauri-update.json"), JSON.stringify(tauriUpdateManifest, null, 2), "utf8");
    writeFileSync(path.join(releasePackageDir, "download-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    writeFileSync(path.join(releasePackageDir, "tauri-update.json"), JSON.stringify(tauriUpdateManifest, null, 2), "utf8");

    if (localOnly) {
      console.log("[publish-downloads] 已生成本地下载中心预览：public/downloads/");
      console.log("[publish-downloads] 打开 http://localhost:3000/download 查看。");
      return;
    }

    await run("ssh", ["-p", String(config.port), target, `mkdir -p ${shellQuote(remoteDownloadsDir)}`]);
    if (manifestOnly) {
      await run("scp", [
        "-P",
        String(config.port),
        path.join(tempDir, "manifest.json"),
        `${target}:${remoteDownloadsDir}/manifest.json`
      ]);
      await run("scp", [
        "-P",
        String(config.port),
        path.join(tempDir, "tauri-update.json"),
        `${target}:${remoteDownloadsDir}/tauri-update.json`
      ]);
    } else {
      await run("rsync", [
        "-az",
        "--delete",
        "-e",
        `ssh -p ${config.port}`,
        `${tempDir}/`,
        `${target}:${remoteDownloadsDir}/`
      ]);
    }

    console.log(`[publish-downloads] 下载中心文件已上传：${baseUrl}`);
    console.log(`[publish-downloads] 下载页：${baseUrl.replace(/\/downloads$/, "")}/download`);
    console.log(`[publish-downloads] Tauri 更新清单：${baseUrl.replace(/\/downloads$/, "")}/tauri-update.json`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
