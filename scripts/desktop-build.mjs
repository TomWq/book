import { access, chmod, cp, mkdir, readdir, rm, symlink } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const cacheDir = path.join(root, "node_modules", ".cache", "desktop-build");
const npmVersion = "11.6.2";
const nodeVersion = "22.18.0";
const npmMirror = process.env.NPM_TARBALL_URL || `https://registry.npmmirror.com/npm/-/npm-${npmVersion}.tgz`;
const npmFallback = `https://registry.npmjs.org/npm/-/npm-${npmVersion}.tgz`;
const nodeMirror = process.env.NODE_DIST_MIRROR || "https://npmmirror.com/mirrors/node";
const nodeFallback = "https://nodejs.org/dist";
const projectNode = process.platform === "win32"
  ? path.join(root, "node_modules", "node", "bin", "node.exe")
  : path.join(root, "node_modules", "node", "bin", "node");
const binDir = path.join(root, "node_modules", ".bin");
const bundledNodeRuntimeDir = path.join(root, "build", "node-runtime");
const standaloneDir = path.join(root, ".next", "standalone");

function log(message) {
  console.log(`[desktop-build] ${message}`);
}

async function isExecutable(file) {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    log(`${command} ${args.join(" ")}`.trim());

    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        ELECTRON_MIRROR: "https://npmmirror.com/mirrors/electron/",
        ELECTRON_BUILDER_BINARIES_MIRROR: "https://npmmirror.com/mirrors/electron-builder-binaries/",
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

async function ensureProjectNode() {
  if (await isExecutable(projectNode)) {
    return;
  }

  throw new Error("未找到项目内 Node 运行时，请先执行 npm install。");
}

async function ensureNpmShim() {
  const shimDir = path.join(cacheDir, "npm-bin");
  const shimPath = process.platform === "win32" ? path.join(shimDir, "npm.cmd") : path.join(shimDir, "npm");

  if (existsSync(shimPath)) {
    return shimDir;
  }

  await mkdir(shimDir, { recursive: true });

  const systemCheck = await new Promise((resolve) => {
    const child = spawn("npm", ["--version"], {
      cwd: root,
      stdio: "ignore",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        PATH: `${path.dirname(projectNode)}${path.delimiter}${process.env.PATH ?? ""}`
      }
    });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });

  if (systemCheck) {
    return "";
  }

  const packageDir = path.join(cacheDir, "npm", "package");
  const npmCli = path.join(packageDir, "bin", "npm-cli.js");

  if (!existsSync(npmCli)) {
    const archive = path.join(cacheDir, `npm-${npmVersion}.tgz`);
    await mkdir(path.dirname(archive), { recursive: true });

    try {
      await run("curl", ["-L", "--fail", "--silent", "--show-error", npmMirror, "-o", archive]);
    } catch {
      await run("curl", ["-L", "--fail", "--silent", "--show-error", npmFallback, "-o", archive]);
    }

    await rm(path.join(cacheDir, "npm"), { recursive: true, force: true });
    await mkdir(path.join(cacheDir, "npm"), { recursive: true });
    await run("tar", ["-xzf", archive, "-C", path.join(cacheDir, "npm")]);
  }

  if (process.platform === "win32") {
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(shimPath, `@"${projectNode}" "${npmCli}" %*\r\n`, "utf8")
    );
  } else {
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(shimPath, `#!/bin/sh\nexec "${projectNode}" "${npmCli}" "$@"\n`, "utf8")
    );
    await chmod(shimPath, 0o755);
  }

  return shimDir;
}

function electronBuilderArgs() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args;
  }

  return [];
}

function targetPlatform(args) {
  if (args.includes("--win") || args.includes("-w")) {
    return "win32";
  }

  if (args.includes("--mac") || args.includes("-m")) {
    return "darwin";
  }

  if (args.includes("--linux") || args.includes("-l")) {
    return "linux";
  }

  return process.platform;
}

function targetArch(args) {
  if (args.includes("--universal")) {
    return "universal";
  }

  if (args.includes("--x64")) {
    return "x64";
  }

  if (args.includes("--arm64")) {
    return "arm64";
  }

  if (args.includes("--ia32")) {
    return "ia32";
  }

  return process.arch;
}

function nodeDistPlatform(platform) {
  if (platform === "win32") {
    return "win";
  }

  return platform;
}

function nodeBinaryName(platform) {
  return platform === "win32" ? "node.exe" : "node";
}

function binCommand(name) {
  return path.join(binDir, process.platform === "win32" ? `${name}.cmd` : name);
}

function nodeArchiveName(platform, arch) {
  const distPlatform = nodeDistPlatform(platform);
  const ext = platform === "win32" ? "zip" : "tar.gz";
  return `node-v${nodeVersion}-${distPlatform}-${arch}.${ext}`;
}

function nodeRuntimeCacheDir(platform, arch) {
  return path.join(cacheDir, "node-runtime", `${nodeDistPlatform(platform)}-${arch}`);
}

async function extractNodeArchive(archive, destination) {
  const tmpDir = `${destination}-tmp`;

  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });
  await run("tar", ["-xf", archive, "-C", tmpDir]);

  const entries = await readdir(tmpDir);
  const extracted = entries.length === 1 ? path.join(tmpDir, entries[0]) : tmpDir;

  await rm(destination, { recursive: true, force: true });
  await cp(extracted, destination, { recursive: true });
  await rm(tmpDir, { recursive: true, force: true });
}

async function ensureNodeRuntime(platform, arch) {
  const runtimeDir = nodeRuntimeCacheDir(platform, arch);
  const binaryPath = path.join(runtimeDir, platform === "win32" ? "node.exe" : "bin/node");

  if (existsSync(binaryPath)) {
    return runtimeDir;
  }

  const archiveName = nodeArchiveName(platform, arch);
  const archive = path.join(cacheDir, "node-runtime", archiveName);
  const primaryUrl = `${nodeMirror}/v${nodeVersion}/${archiveName}`;
  const fallbackUrl = `${nodeFallback}/v${nodeVersion}/${archiveName}`;

  await mkdir(path.dirname(archive), { recursive: true });

  try {
    await run("curl", ["-L", "--fail", "--silent", "--show-error", primaryUrl, "-o", archive]);
  } catch {
    await run("curl", ["-L", "--fail", "--silent", "--show-error", fallbackUrl, "-o", archive]);
  }

  await extractNodeArchive(archive, runtimeDir);

  if (!existsSync(binaryPath)) {
    throw new Error(`Node runtime 准备失败，未找到 ${binaryPath}`);
  }

  return runtimeDir;
}

async function copyNodeRuntime(platform, arch) {
  const runtimeDir = await ensureNodeRuntime(platform, arch);

  await rm(bundledNodeRuntimeDir, { recursive: true, force: true });
  await mkdir(bundledNodeRuntimeDir, { recursive: true });
  await cp(runtimeDir, bundledNodeRuntimeDir, { recursive: true });
  await normalizeBundledNodeBinLinks();

  const binaryPath = path.join(bundledNodeRuntimeDir, platform === "win32" ? "node.exe" : "bin/node");
  if (platform !== "win32") {
    await chmod(binaryPath, 0o755);
  }

  log(`已准备 ${nodeDistPlatform(platform)}-${arch} Node runtime：${binaryPath}`);
}

async function normalizeBundledNodeBinLinks() {
  const binPath = path.join(bundledNodeRuntimeDir, "bin");
  const links = {
    corepack: "../lib/node_modules/corepack/dist/corepack.js",
    npm: "../lib/node_modules/npm/bin/npm-cli.js",
    npx: "../lib/node_modules/npm/bin/npx-cli.js"
  };

  for (const [name, target] of Object.entries(links)) {
    const linkPath = path.join(binPath, name);

    try {
      await rm(linkPath, { force: true });
      await symlink(target, linkPath);
    } catch {
      // Windows runtime does not use these POSIX symlinks.
    }
  }
}

async function copyUniversalMacNodeRuntime() {
  const arm64Runtime = await ensureNodeRuntime("darwin", "arm64");
  const x64Runtime = await ensureNodeRuntime("darwin", "x64");
  const arm64Node = path.join(arm64Runtime, "bin/node");
  const x64Node = path.join(x64Runtime, "bin/node");
  const universalNode = path.join(bundledNodeRuntimeDir, "bin/node");

  await rm(bundledNodeRuntimeDir, { recursive: true, force: true });
  await mkdir(bundledNodeRuntimeDir, { recursive: true });
  await cp(arm64Runtime, bundledNodeRuntimeDir, { recursive: true });
  await normalizeBundledNodeBinLinks();
  await run("lipo", ["-create", arm64Node, x64Node, "-output", universalNode]);
  await chmod(universalNode, 0o755);
  log(`已准备 macOS universal Node runtime：${universalNode}`);
}

async function prepareBundledNodeRuntime(args) {
  const platform = targetPlatform(args);
  const arch = targetArch(args);

  if (platform === "darwin" && arch === "universal") {
    await copyUniversalMacNodeRuntime();
    return;
  }

  if (arch === "universal") {
    throw new Error("目前仅 macOS 支持 universal 打包。");
  }

  await copyNodeRuntime(platform, arch);
}

async function syncStandaloneStaticAssets() {
  const sourceStatic = path.join(root, ".next", "static");
  const targetStatic = path.join(standaloneDir, ".next", "static");

  if (!existsSync(sourceStatic)) {
    throw new Error("缺少 .next/static，Next 构建可能未完整生成。");
  }

  if (!existsSync(standaloneDir)) {
    throw new Error("缺少 .next/standalone，Next standalone 构建可能未完整生成。");
  }

  await rm(targetStatic, { recursive: true, force: true });
  await mkdir(path.dirname(targetStatic), { recursive: true });
  await cp(sourceStatic, targetStatic, { recursive: true });
  log("已同步 Next 静态资源到 .next/standalone/.next/static");
}

async function patchBetterSqlitePackage(packageDir, platform, arch, toolPath, label) {
  if (arch === "universal") {
    throw new Error("当前项目包含 better-sqlite3 原生模块，暂不支持直接打 universal 包；请分别打 mac arm64 和 mac x64。");
  }

  const nativeFile = path.join(packageDir, "build", "Release", "better_sqlite3.node");

  if (!existsSync(packageDir)) {
    return;
  }

  await rm(path.join(packageDir, "build"), { recursive: true, force: true });
  await run(binCommand("prebuild-install"), [
    "--runtime", "node",
    "--target", nodeVersion,
    "--platform", platform,
    "--arch", arch
  ], {
    cwd: packageDir,
    env: {
      PATH: toolPath,
      npm_config_platform: platform,
      npm_config_arch: arch
    }
  });

  if (!existsSync(nativeFile)) {
    throw new Error(`better-sqlite3 ${platform}-${arch} 原生模块准备失败。`);
  }

  log(`已准备 ${label} better-sqlite3 ${platform}-${arch} 原生模块`);
}

async function patchBetterSqliteNative(platform, arch, toolPath) {
  await patchBetterSqlitePackage(
    path.join(standaloneDir, "node_modules", "better-sqlite3"),
    platform,
    arch,
    toolPath,
    "打包目标"
  );
}

async function prepareTargetNativeModules(args, toolPath) {
  const platform = targetPlatform(args);
  const arch = targetArch(args);

  await patchBetterSqliteNative(platform, arch, toolPath);
}

async function restoreDevelopmentNativeModules(toolPath) {
  await patchBetterSqlitePackage(
    path.join(root, "node_modules", "better-sqlite3"),
    process.platform,
    process.arch,
    toolPath,
    "本机开发"
  );
}

async function main() {
  await ensureProjectNode();
  const npmShimDir = await ensureNpmShim();
  const builderArgs = electronBuilderArgs();
  const toolPath = [
    npmShimDir,
    path.dirname(projectNode),
    binDir,
    process.env.PATH ?? ""
  ].filter(Boolean).join(path.delimiter);

  await run(projectNode, ["scripts/generate-desktop-icons.mjs"], {
    env: { PATH: toolPath }
  });
  await run(path.join(binDir, process.platform === "win32" ? "next.cmd" : "next"), ["build"], {
    env: { PATH: toolPath }
  });
  await syncStandaloneStaticAssets();
  await run(projectNode, ["scripts/clean-desktop-build.mjs"], {
    env: { PATH: toolPath }
  });
  await prepareTargetNativeModules(builderArgs, toolPath);
  await prepareBundledNodeRuntime(builderArgs);
  await run(path.join(binDir, process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"), builderArgs, {
    env: { PATH: toolPath }
  });
  await restoreDevelopmentNativeModules(toolPath);
  await run(projectNode, ["scripts/clean-desktop-build.mjs"], {
    env: { PATH: toolPath }
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
