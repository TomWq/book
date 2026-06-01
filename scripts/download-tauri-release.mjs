import { copyFile, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "release");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const version = String(packageJson.version ?? "").trim();
const tag = `app-v${version}`;
const packageDir = path.join(releaseDir, "packages", `v${version}`);
const args = new Set(process.argv.slice(2));
const force = args.has("--force") || args.has("--clobber");

const assets = [
  {
    patterns: [`AI-Novel-Workbench-Setup-${version}-x64.exe`, `*Setup-${version}-x64.exe`, "*x64-setup.exe"],
    output: `墨澜 · AI 网文写作助手-Setup-${version}-x64.exe`
  },
  {
    patterns: [`AI-Novel-Workbench-Setup-${version}-x64.exe.sig`, `*Setup-${version}-x64.exe.sig`, "*x64-setup.exe.sig"],
    output: `墨澜 · AI 网文写作助手-Setup-${version}-x64.exe.sig`,
    optional: true
  },
  {
    patterns: [`AI-Novel-Workbench-${version}-arm64-mac.dmg`, `*${version}-arm64-mac.dmg`, "*aarch64.dmg"],
    output: `墨澜 · AI 网文写作助手-${version}-arm64-mac.dmg`
  },
  {
    patterns: [`AI-Novel-Workbench-${version}-arm64-mac.app.tar.gz`, `*${version}-arm64-mac.app.tar.gz`, "*aarch64.app.tar.gz"],
    output: `墨澜 · AI 网文写作助手-${version}-arm64-mac.app.tar.gz`,
    optional: true
  },
  {
    patterns: [`AI-Novel-Workbench-${version}-arm64-mac.app.tar.gz.sig`, `*${version}-arm64-mac.app.tar.gz.sig`, "*aarch64.app.tar.gz.sig"],
    output: `墨澜 · AI 网文写作助手-${version}-arm64-mac.app.tar.gz.sig`,
    optional: true
  }
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`[release-download] ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: false
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

async function downloadAsset(asset) {
  const outputPath = path.join(packageDir, asset.output);

  if (!force && await fileExists(outputPath)) {
    console.log(`[release-download] 已存在，跳过：release/packages/v${version}/${asset.output}`);
    return true;
  }

  return null;
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*")
    .replaceAll("?", ".");

  return new RegExp(`^${escaped}$`);
}

function findDownloadedAsset(files, asset) {
  const patterns = asset.patterns ?? [asset.pattern];

  for (const pattern of patterns) {
    const regex = globToRegExp(pattern);
    const match = files.find((file) => regex.test(file));

    if (match) {
      return match;
    }
  }

  return "";
}

async function downloadReleaseAssets(tempDir) {
  await run("gh", [
    "release",
    "download",
    tag,
    "--repo",
    "TomWq/book",
    "--dir",
    tempDir,
    "--clobber"
  ]);
}

async function saveDownloadedAsset(tempDir, files, asset) {
  const outputPath = path.join(packageDir, asset.output);

  if (!force && await fileExists(outputPath)) {
    return true;
  }

  const downloadedName = findDownloadedAsset(files, asset);

  if (!downloadedName) {
    if (asset.optional) {
      console.warn(`[release-download] 可选 updater 产物不存在，已跳过：${(asset.patterns ?? [asset.pattern]).join(" / ")}`);
      return false;
    }

    throw new Error(`下载失败，未找到 ${(asset.patterns ?? [asset.pattern]).join(" / ")}`);
  }

  await rm(outputPath, { force: true });
  await copyFile(path.join(tempDir, downloadedName), outputPath);
  console.log(`[release-download] 已保存：release/packages/v${version}/${asset.output}`);
  return true;
}

async function main() {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json 版本号异常：${version || "未设置"}`);
  }

  await mkdir(packageDir, { recursive: true });

  if (force) {
    await Promise.all(assets.map((asset) => rm(path.join(packageDir, asset.output), { force: true })));
  }

  const downloaded = assets.filter((asset) => existsSync(path.join(packageDir, asset.output))).map((asset) => asset.output);
  const pendingAssets = [];

  for (const asset of assets) {
    const result = await downloadAsset(asset);

    if (result === true) {
      if (!downloaded.includes(asset.output)) {
        downloaded.push(asset.output);
      }
      continue;
    }

    pendingAssets.push(asset);
  }

  if (pendingAssets.length > 0) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), `tauri-release-${version}-`));

    try {
      await downloadReleaseAssets(tempDir);
      const files = await readdir(tempDir);

      for (const asset of pendingAssets) {
        if (await saveDownloadedAsset(tempDir, files, asset)) {
          downloaded.push(asset.output);
        }
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  await writeFile(
    path.join(packageDir, "UPLOAD_THESE_FILES.txt"),
    [
      "上传 COS 时上传本目录里的安装包和 updater 产物：",
      "",
      ...downloaded,
      "",
      "不要上传这个说明文件。",
      ""
    ].join("\n"),
    "utf8"
  );

  console.log(`[release-download] Windows 和 macOS Apple 芯片安装包已下载到 release/packages/v${version}/。`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
