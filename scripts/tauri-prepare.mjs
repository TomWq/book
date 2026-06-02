import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const ssrChunksDir = path.join(standaloneDir, ".next", "server", "chunks", "ssr");
const nodeModulesDir = path.join(standaloneDir, "node_modules");
const sourceStaticDir = path.join(root, ".next", "static");
const targetStaticDir = path.join(standaloneDir, ".next", "static");
const sourcePublicDir = path.join(root, "public");
const targetPublicDir = path.join(standaloneDir, "public");
const standaloneDataDir = path.join(standaloneDir, "data");
const betterSqliteDir = path.join(nodeModulesDir, "better-sqlite3");
const forcedRuntimePackages = ["better-sqlite3", "bindings", "file-uri-to-path"];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        APP_RUNTIME: "desktop",
        NEXT_PUBLIC_APP_RUNTIME: "desktop",
        AUTH_COOKIE_SECURE: "false",
        ...options.env
      }
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} 退出：${code}`));
    });
  });
}

function collectFiles(dir, files = []) {
  if (!existsSync(dir)) {
    return files;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function findBetterSqliteAliases() {
  const aliases = new Set();
  const pattern = /better-sqlite3-[a-f0-9]+/g;

  for (const file of collectFiles(ssrChunksDir)) {
    const content = readFileSync(file, "utf8");
    const matches = content.matchAll(pattern);

    for (const match of matches) {
      aliases.add(match[0]);
    }
  }

  return [...aliases].sort();
}

function writeBetterSqliteAlias(alias) {
  const aliasDir = path.join(nodeModulesDir, alias);

  mkdirSync(aliasDir, { recursive: true });
  writeFileSync(
    path.join(aliasDir, "package.json"),
    JSON.stringify({ name: alias, version: "0.0.0", main: "index.js", private: true }, null, 2),
    "utf8"
  );
  writeFileSync(
    path.join(aliasDir, "index.js"),
    "module.exports = require('better-sqlite3');\n",
    "utf8"
  );
}

function copyRuntimePackage(packageName) {
  const source = path.join(root, "node_modules", packageName);
  const target = path.join(nodeModulesDir, packageName);

  if (!existsSync(source)) {
    throw new Error(`缺少运行时依赖 ${packageName}，请先执行 npm install。`);
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function syncNativeRuntimePackages() {
  for (const packageName of forcedRuntimePackages) {
    copyRuntimePackage(packageName);
  }

  console.log(`[tauri-prepare] 已补齐原生运行时依赖：${forcedRuntimePackages.join(", ")}`);
}

function syncStaticAssets() {
  if (!existsSync(sourceStaticDir)) {
    throw new Error("缺少 .next/static，Next 构建可能未完整生成。");
  }

  rmSync(targetStaticDir, { recursive: true, force: true });
  mkdirSync(path.dirname(targetStaticDir), { recursive: true });
  cpSync(sourceStaticDir, targetStaticDir, { recursive: true });
  console.log("[tauri-prepare] 已同步 Next 静态资源到 .next/standalone/.next/static");
}

function syncPublicAssets() {
  if (!existsSync(sourcePublicDir)) {
    return;
  }

  rmSync(targetPublicDir, { recursive: true, force: true });
  mkdirSync(path.dirname(targetPublicDir), { recursive: true });
  cpSync(sourcePublicDir, targetPublicDir, { recursive: true });
  console.log("[tauri-prepare] 已同步 public 资源到 .next/standalone/public");
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function directorySize(dir) {
  if (!existsSync(dir)) {
    return 0;
  }

  const stat = statSync(dir);

  if (stat.isFile()) {
    return stat.size;
  }

  if (!stat.isDirectory()) {
    return 0;
  }

  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    return total + directorySize(path.join(dir, entry.name));
  }, 0);
}

function removeMacMetadata(dir) {
  if (!existsSync(dir)) {
    return 0;
  }

  let removed = 0;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      rmSync(fullPath, { recursive: true, force: true });
      removed += 1;
      continue;
    }

    if (entry.isDirectory()) {
      removed += removeMacMetadata(fullPath);
    }
  }

  return removed;
}

function cleanStandaloneReleaseResources() {
  const removedDataSize = directorySize(standaloneDataDir);
  rmSync(standaloneDataDir, { recursive: true, force: true });

  const removableRuntimeArtifacts = [
    path.join(betterSqliteDir, "deps"),
    path.join(betterSqliteDir, "src"),
    path.join(betterSqliteDir, "binding.gyp"),
    path.join(betterSqliteDir, "README.md")
  ];
  let removedRuntimeSize = 0;

  for (const artifact of removableRuntimeArtifacts) {
    removedRuntimeSize += directorySize(artifact);
    rmSync(artifact, { recursive: true, force: true });
  }

  const removedMetadataCount = removeMacMetadata(standaloneDir);

  if (removedDataSize > 0) {
    console.log(`[tauri-prepare] 已移除发行包本地数据目录：${formatBytes(removedDataSize)}`);
  }

  if (removedMetadataCount > 0) {
    console.log(`[tauri-prepare] 已移除 macOS 元数据文件：${removedMetadataCount} 个`);
  }

  if (removedRuntimeSize > 0) {
    console.log(`[tauri-prepare] 已移除运行时包构建残留：${formatBytes(removedRuntimeSize)}`);
  }
}

async function main() {
  await run("next", ["build"]);
  syncStaticAssets();
  syncPublicAssets();
  syncNativeRuntimePackages();
  cleanStandaloneReleaseResources();

  const aliases = findBetterSqliteAliases();

  for (const alias of aliases) {
    writeBetterSqliteAlias(alias);
  }

  if (aliases.length > 0) {
    console.log(`[tauri-prepare] 已生成 better-sqlite3 别名：${aliases.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
