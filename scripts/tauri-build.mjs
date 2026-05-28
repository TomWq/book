import { access, chmod, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const cacheDir = path.join(root, "node_modules", ".cache", "tauri-build");
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
const bundledNodeRuntimeDir = path.join(root, "build", "tauri-node-runtime");
const standaloneDir = path.join(root, ".next", "standalone");
const packageJsonPath = path.join(root, "package.json");
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");
const cargoManifestPath = path.join(root, "src-tauri", "Cargo.toml");
const cargoLockPath = path.join(root, "src-tauri", "Cargo.lock");

function log(message) {
  console.log(`[tauri-build] ${message}`);
}

async function syncTauriVersion() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const version = String(packageJson.version ?? "").trim();

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json 版本号异常：${version || "未设置"}`);
  }

  const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));

  if (tauriConfig.version !== version) {
    tauriConfig.version = version;
    await writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`, "utf8");
    log(`已同步 Tauri 版本：${version}`);
  } else {
    log(`Tauri 版本已同步：${version}`);
  }

  const cargoManifest = await readFile(cargoManifestPath, "utf8");
  const nextCargoManifest = cargoManifest.replace(
    /^version = ".*"$/m,
    `version = "${version}"`
  );

  if (nextCargoManifest !== cargoManifest) {
    await writeFile(cargoManifestPath, nextCargoManifest, "utf8");
    log(`已同步 Cargo.toml 版本：${version}`);
  }

  const cargoLock = await readFile(cargoLockPath, "utf8");
  const nextCargoLock = cargoLock.replace(
    /(name = "ai-novel-workbench"\nversion = )".*"/,
    `$1"${version}"`
  );

  if (nextCargoLock !== cargoLock) {
    await writeFile(cargoLockPath, nextCargoLock, "utf8");
    log(`已同步 Cargo.lock 版本：${version}`);
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

function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: {
        ...process.env,
        ...options.env
      }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr || `${command} ${args.join(" ")} 退出：${code}`));
    });
  });
}

async function isExecutable(file) {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
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

function targetPlatform(args) {
  if (args.includes("--win") || args.includes("-w")) {
    return "win32";
  }

  if (args.includes("--mac") || args.includes("-m")) {
    return "darwin";
  }

  return process.platform;
}

function targetArch(args) {
  if (args.includes("--x64")) {
    return "x64";
  }

  if (args.includes("--arm64")) {
    return "arm64";
  }

  return process.arch;
}

function rustTargetTriple(platform, arch) {
  if (platform === "darwin" && arch === "arm64") {
    return "aarch64-apple-darwin";
  }

  if (platform === "win32" && arch === "x64") {
    return "x86_64-pc-windows-msvc";
  }

  throw new Error("当前 Tauri 打包脚本只支持 macOS arm64 和 Windows x64。");
}

function nodeDistPlatform(platform) {
  return platform === "win32" ? "win" : platform;
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
  const sourceBinary = path.join(runtimeDir, platform === "win32" ? "node.exe" : "bin/node");
  const targetBinary = path.join(bundledNodeRuntimeDir, platform === "win32" ? "node.exe" : "bin/node");

  await rm(bundledNodeRuntimeDir, { recursive: true, force: true });
  await mkdir(path.dirname(targetBinary), { recursive: true });
  await cp(sourceBinary, targetBinary);

  if (platform !== "win32") {
    await chmod(targetBinary, 0o755);
  }

  log(`已准备 ${nodeDistPlatform(platform)}-${arch} Tauri Node runtime：${targetBinary}`);
}

async function patchBetterSqliteNative(platform, arch, toolPath) {
  const packageDir = path.join(standaloneDir, "node_modules", "better-sqlite3");
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

  log(`已准备 better-sqlite3 ${platform}-${arch} 原生模块`);
}

async function ensureRustTarget(triple) {
  const output = await capture("rustup", ["target", "list", "--installed"]);
  const installed = output.split(/\r?\n/).includes(triple);

  if (!installed) {
    await run("rustup", ["target", "add", triple]);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const prepareOnly = args.includes("--prepare-only");
  const targetArgs = args.filter((arg) => arg !== "--prepare-only");
  const platform = targetPlatform(targetArgs);
  const arch = targetArch(targetArgs);
  const triple = rustTargetTriple(platform, arch);
  const iconFiles = [
    path.join(root, "build", "icon.png"),
    path.join(root, "build", "icon.ico"),
    path.join(root, "build", "icon.icns")
  ];

  if (platform === "darwin" && process.platform !== "darwin") {
    throw new Error("Tauri macOS 包需要在 macOS 上执行。");
  }

  if (platform === "win32" && process.platform !== "win32" && !prepareOnly) {
    throw new Error("Tauri Windows 安装包建议通过 GitHub Actions 的 windows-latest 原生构建，或在 Windows 机器上执行。");
  }

  await syncTauriVersion();
  await ensureProjectNode();
  const npmShimDir = await ensureNpmShim();
  const toolPath = [
    npmShimDir,
    path.dirname(projectNode),
    binDir,
    process.env.PATH ?? ""
  ].filter(Boolean).join(path.delimiter);

  if (iconFiles.every((file) => existsSync(file))) {
    log("桌面端图标已存在，跳过重新生成。");
  } else {
    await run(projectNode, ["scripts/generate-desktop-icons.mjs"], {
      env: { PATH: toolPath }
    });
  }

  await run(projectNode, ["scripts/tauri-prepare.mjs"], {
    env: { PATH: toolPath }
  });
  await patchBetterSqliteNative(platform, arch, toolPath);
  await copyNodeRuntime(platform, arch);

  if (prepareOnly) {
    log(`Tauri ${platform}-${arch} 目标资源准备完成。`);
    return;
  }

  await ensureRustTarget(triple);

  const tauriArgs = ["build", "--target", triple];
  const hasSigningKey = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY || process.env.TAURI_SIGNING_PRIVATE_KEY_PATH);

  await run(binCommand("tauri"), tauriArgs, {
    env: {
      PATH: toolPath,
      TAURI_UPDATER_PUBLIC_KEY: process.env.TAURI_UPDATER_PUBLIC_KEY || "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE3M0I3RkZFQkM5NzVGNApSV1QwZGNuci83ZHpDdnJrYlJtdUloV1p5SERoSGZiVHJPdUc5MXJXNUtrTk9MU1dzZzZRM2dCKwo=",
      ...(hasSigningKey ? {} : { TAURI_BUNDLER_NO_SIGN: "1" })
    }
  });

  log(`Tauri ${platform}-${arch} 打包完成。`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
