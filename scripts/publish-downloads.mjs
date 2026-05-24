import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.resolve(rootDir, "deploy.config.json");
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const version = String(packageJson.version ?? "").trim();
const args = new Set(process.argv.slice(2));
const localOnly = args.has("--local-only");
const manifestOnly = args.has("--manifest-only");

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
    port: Number(process.env.DEPLOY_PORT || fileConfig.port || 22)
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
  const configured = String(process.env.DOWNLOAD_BASE_URL || process.env.APP_DOWNLOAD_BASE_URL || "").trim();
  if (!configured && localOnly) {
    return "/downloads";
  }

  const base = configured || `http://${config.host}/downloads`;
  return base.replace(/\/+$/, "");
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
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
  const filePath = path.join(rootDir, "release", fileName);

  if (!existsSync(filePath)) {
    throw new Error(`缺少发布包：release/${fileName}。请先执行 npm run release:download。`);
  }

  assertReleasePackageFresh(filePath);

  return filePath;
}

function releaseFileIfManifestOnly(fileName) {
  const filePath = path.join(rootDir, "release", fileName);

  if (!manifestOnly) {
    return releaseFile(fileName);
  }

  if (!existsSync(filePath)) {
    throw new Error(`缺少发布包：release/${fileName}。请先执行 npm run release:download。`);
  }

  return filePath;
}

function fileEntry(input) {
  const sizeBytes = statSync(input.path).size;

  return {
    label: input.label,
    fileName: input.fileName,
    url: `${input.baseUrl}/${encodeURIComponent(input.fileName)}`,
    sizeBytes,
    sha256: sha256(input.path),
    platform: input.platform,
    arch: input.arch
  };
}

async function main() {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json 版本号异常：${version || "未设置"}`);
  }

  const config = getConfig();
  const target = `${config.user}@${config.host}`;
  const remoteDownloadsDir = path.posix.join(config.path, "public", "downloads");
  const baseUrl = normalizeBaseUrl(config);
  const files = {
    win32X64: {
      label: "Windows x64",
      fileName: `AI网文写作助手-Setup-${version}-x64.exe`,
      platform: "win32",
      arch: "x64"
    },
    darwinArm64: {
      label: "macOS Apple 芯片",
      fileName: `AI网文写作助手-${version}-arm64-mac.dmg`,
      platform: "darwin",
      arch: "arm64"
    },
    darwinX64: {
      label: "macOS Intel",
      fileName: `AI网文写作助手-${version}-x64-mac.dmg`,
      platform: "darwin",
      arch: "x64"
    }
  };
  const prepared = Object.fromEntries(
    Object.entries(files).map(([key, value]) => {
      const filePath = releaseFileIfManifestOnly(value.fileName);
      return [key, fileEntry({ ...value, path: filePath, baseUrl })];
    })
  );
  const manifest = {
    productName: "AI 网文写作助手",
    version,
    notes: String(process.env.APP_LATEST_RELEASE_NOTES || `发布 ${version} 版本。`).trim(),
    announcement: String(process.env.APP_RELEASE_ANNOUNCEMENT || "").trim(),
    releaseDate: new Date().toISOString(),
    required: ["1", "true", "yes", "on"].includes(String(process.env.APP_UPDATE_REQUIRED || "").toLowerCase()),
    downloads: {
      win32X64: prepared.win32X64.url,
      darwinArm64: prepared.darwinArm64.url,
      darwinX64: prepared.darwinX64.url
    },
    files: prepared
  };
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
      }
    }

    writeFileSync(path.join(tempDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    writeFileSync(path.join(localDownloadsDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    mkdirSync(path.join(rootDir, "release"), { recursive: true });
    writeFileSync(path.join(rootDir, "release", "download-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    if (localOnly) {
      console.log("[publish-downloads] 已生成本地下载中心预览：public/downloads/");
      console.log("[publish-downloads] 打开 http://localhost:3000/download 查看。");
      return;
    }

    await run("ssh", ["-p", String(config.port), target, `mkdir -p ${shellQuote(remoteDownloadsDir)}`]);
    if (manifestOnly) {
      await run("rsync", [
        "-az",
        "-e",
        `ssh -p ${config.port}`,
        path.join(tempDir, "manifest.json"),
        `${target}:${remoteDownloadsDir}/manifest.json`
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
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
