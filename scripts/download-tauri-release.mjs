import { mkdir, rm, rename, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "release");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const version = String(packageJson.version ?? "").trim();
const tag = `app-v${version}`;
const packageDir = path.join(releaseDir, "packages", `v${version}`);

const assets = [
  {
    pattern: "*x64-setup.exe",
    output: `AI网文写作助手-Setup-${version}-x64.exe`
  },
  {
    pattern: "*aarch64.dmg",
    output: `AI网文写作助手-${version}-arm64-mac.dmg`
  },
  {
    pattern: "*x64.dmg",
    output: `AI网文写作助手-${version}-x64-mac.dmg`
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
  const tempPath = path.join(packageDir, `.tauri-${asset.output}`);
  const outputPath = path.join(packageDir, asset.output);

  await rm(tempPath, { force: true });
  await rm(outputPath, { force: true });
  await run("gh", [
    "release",
    "download",
    tag,
    "--repo",
    "TomWq/book",
    "--pattern",
    asset.pattern,
    "--output",
    tempPath,
    "--clobber"
  ]);

  if (!existsSync(tempPath)) {
    throw new Error(`下载失败，未找到 ${tempPath}`);
  }

  await rename(tempPath, outputPath);
  console.log(`[release-download] 已保存：release/packages/v${version}/${asset.output}`);
}

async function main() {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json 版本号异常：${version || "未设置"}`);
  }

  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  for (const asset of assets) {
    await downloadAsset(asset);
  }

  await writeFile(
    path.join(packageDir, "UPLOAD_THESE_FILES.txt"),
    [
      "上传 COS 时只上传本目录里的三个安装包：",
      "",
      `AI网文写作助手-Setup-${version}-x64.exe`,
      `AI网文写作助手-${version}-arm64-mac.dmg`,
      `AI网文写作助手-${version}-x64-mac.dmg`,
      "",
      "不要上传这个说明文件。",
      ""
    ].join("\n"),
    "utf8"
  );

  console.log(`[release-download] 三端安装包已下载到 release/packages/v${version}/。`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
