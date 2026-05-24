import { existsSync, lstatSync, readlinkSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const releaseDir = path.join(root, "release");
const packageJson = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(path.join(root, "package.json"), "utf8")));
const args = new Set(process.argv.slice(2));

const checks = [];
const warnings = [];

function getTarget() {
  const hasWin = args.has("--win");
  const hasMac = args.has("--mac");
  const hasAll = args.has("--all");

  if (hasAll) {
    return "all";
  }

  if (hasWin && hasMac) {
    return "all";
  }

  if (hasMac) {
    return "mac";
  }

  return "win";
}

const target = getTarget();

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${bytes}B`;
}

function pass(message) {
  checks.push({ ok: true, message });
}

function fail(message) {
  checks.push({ ok: false, message });
}

function warn(message) {
  warnings.push(message);
}

function dirSize(targetPath) {
  if (!existsSync(targetPath)) {
    return 0;
  }

  try {
    const output = execFileSync("du", ["-sk", targetPath], { encoding: "utf8" }).trim();
    const blocks = Number(output.split(/\s+/)[0]);
    if (Number.isFinite(blocks)) {
      return blocks * 1024;
    }
  } catch {
    // Fall back to stat-based counting below.
  }

  const stat = statSync(targetPath);

  if (!stat.isDirectory()) {
    return stat.size;
  }

  return readdirSync(targetPath).reduce((sum, child) => sum + dirSize(path.join(targetPath, child)), 0);
}

function assertFile(relativePath, label, options = {}) {
  const fullPath = path.join(root, relativePath);

  if (!existsSync(fullPath)) {
    fail(`缺少 ${label}：${relativePath}`);
    return;
  }

  const rawStat = statSync(fullPath);
  const size = rawStat.isDirectory() ? dirSize(fullPath) : rawStat.size;
  const minBytes = options.minBytes ?? 1;
  const maxBytes = options.maxBytes ?? Infinity;

  if (size < minBytes) {
    fail(`${label} 体积异常偏小：${relativePath} (${formatBytes(size)})`);
    return;
  }

  if (size > maxBytes) {
    fail(`${label} 体积异常偏大：${relativePath} (${formatBytes(size)})`);
    return;
  }

  pass(`${label} 存在：${relativePath} (${formatBytes(size)})`);
}

function assertMissing(relativePath, label) {
  if (existsSync(path.join(root, relativePath))) {
    fail(`不应存在 ${label}：${relativePath}`);
    return;
  }

  pass(`${label} 已清理`);
}

function warnIfExists(relativePath, label) {
  if (existsSync(path.join(root, relativePath))) {
    warn(`发现 ${label}：${relativePath}。当前打包配置不会带入发布包；如需保持工作区干净，可关闭 dev 服务后运行 npm run desktop:clean。`);
    return;
  }

  pass(`${label} 已清理`);
}

function shouldCheck(platform) {
  return target === "all" || target === platform;
}

function selectedArch(defaultArch = "arm64") {
  if (args.has("--x64")) {
    return "x64";
  }

  if (args.has("--arm64")) {
    return "arm64";
  }

  return defaultArch;
}

function firstExisting(relativePaths) {
  return relativePaths.find((relativePath) => existsSync(path.join(root, relativePath))) ?? relativePaths[0];
}

function fileInfo(relativePath) {
  try {
    return execFileSync("file", [path.join(root, relativePath)], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function assertBinaryArch(relativePath, label, pattern) {
  if (!existsSync(path.join(root, relativePath))) {
    fail(`缺少 ${label}：${relativePath}`);
    return;
  }

  const info = fileInfo(relativePath);
  if (!info) {
    warn(`无法读取 ${label} 架构信息：${relativePath}`);
    return;
  }

  if (!pattern.test(info)) {
    fail(`${label} 架构异常：${info}`);
    return;
  }

  pass(`${label} 架构正常：${relativePath}`);
}

function assertCodeSignature(relativePath, label) {
  const absolutePath = path.join(root, relativePath);

  if (!existsSync(absolutePath)) {
    fail(`缺少 ${label}：${relativePath}`);
    return;
  }

  try {
    execFileSync("codesign", ["--verify", "--deep", "--verbose=2", absolutePath], {
      stdio: "pipe"
    });
    pass(`${label} 代码签名完整`);
  } catch (error) {
    const output = Buffer.concat([
      error.stdout ?? Buffer.alloc(0),
      error.stderr ?? Buffer.alloc(0)
    ]).toString("utf8").trim();
    fail(`${label} 代码签名异常：${output || "codesign 校验失败"}`);
  }
}

function assertSymlinkTarget(relativePath, label) {
  const absolutePath = path.join(root, relativePath);

  if (!existsSync(absolutePath)) {
    fail(`缺少 ${label}：${relativePath}`);
    return;
  }

  try {
    const stat = lstatSync(absolutePath);

    if (!stat.isSymbolicLink()) {
      pass(`${label} 不是符号链接，无需检查`);
      return;
    }

    const target = readlinkSync(absolutePath);
    const resolvedTarget = path.resolve(path.dirname(absolutePath), target);

    if (!existsSync(resolvedTarget)) {
      fail(`${label} 符号链接目标不存在：${target}`);
      return;
    }

    pass(`${label} 符号链接目标正常`);
  } catch (error) {
    fail(`${label} 符号链接检查失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

const version = String(packageJson.version ?? "").trim();
const winInstaller = `release/AI网文写作助手-Setup-${version}-x64.exe`;
const winArmInstaller = `release/AI网文写作助手-Setup-${version}-arm64.exe`;
const winUnpacked = "release/win-unpacked/AI 网文写作助手.exe";
const winRuntimeNode = "release/win-unpacked/resources/node-runtime/node.exe";
const winBetterSqlite = "release/win-unpacked/resources/app/.next/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node";
const macArch = selectedArch();
const macApp = firstExisting([
  `release/mac-${macArch}/AI 网文写作助手.app`,
  "release/mac/AI 网文写作助手.app"
]);
const macZip = firstExisting([
  `release/AI网文写作助手-${version}-${macArch}-mac.zip`,
  `release/AI 网文写作助手-${version}-${macArch}-mac.zip`,
  `release/AI网文写作助手-${version}-${macArch}.zip`
]);
const macRuntimeNode = `${macApp}/Contents/Resources/node-runtime/bin/node`;
const macRuntimeCorepack = `${macApp}/Contents/Resources/node-runtime/bin/corepack`;
const macRuntimeNpm = `${macApp}/Contents/Resources/node-runtime/bin/npm`;
const macRuntimeNpx = `${macApp}/Contents/Resources/node-runtime/bin/npx`;
const macStandaloneStatic = `${macApp}/Contents/Resources/app/.next/standalone/.next/static`;
const macBetterSqlite = `${macApp}/Contents/Resources/app/.next/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node`;

if (/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  pass(`版本号格式正常：${version}`);
} else {
  fail(`版本号格式异常：${version || "未设置"}`);
}

if (packageJson.scripts?.["desktop:dist:win"] === "node scripts/desktop-build.mjs --win --x64") {
  pass("Windows 打包命令固定为 x64");
} else {
  fail("desktop:dist:win 未固定为 --win --x64");
}

assertFile("DESKTOP.md", "桌面端说明文档", { minBytes: 500 });
assertFile("scripts/desktop-build.mjs", "桌面端统一打包脚本", { minBytes: 1000 });
assertFile("scripts/desktop-release.mjs", "一键发布打包脚本", { minBytes: 1000 });
assertFile("scripts/publish-downloads.mjs", "安装包上传脚本", { minBytes: 1000 });
assertFile("src/lib/app-update.ts", "版本更新检查逻辑", { minBytes: 1000 });
assertFile("src/app/api/app/update/manifest/route.ts", "版本发布清单接口", { minBytes: 100 });
assertFile("src/app/api/app/update/check/route.ts", "客户端检查更新接口", { minBytes: 100 });
assertFile("src/components/version-update-card.tsx", "版本更新页面组件", { minBytes: 500 });
assertFile("build/icon.ico", "Windows 图标", { minBytes: 1000 });
assertFile("build/icon.icns", "macOS 图标", { minBytes: 1000 });
warnIfExists(".next/dev", "Next dev 缓存");
warnIfExists(".next/cache", "Next 构建缓存");

if (shouldCheck("win")) {
  assertFile(winInstaller, "Windows x64 安装包", {
    minBytes: 50 * 1024 * 1024,
    maxBytes: 400 * 1024 * 1024
  });
  assertFile(winUnpacked, "Windows x64 解包程序", {
    minBytes: 100 * 1024 * 1024,
    maxBytes: 500 * 1024 * 1024
  });
  assertBinaryArch(winRuntimeNode, "Windows x64 Node runtime", /PE32\+.*x86-64/i);
  assertBinaryArch(winBetterSqlite, "Windows x64 better-sqlite3", /PE32\+.*x86-64/i);

  if (existsSync(path.join(root, winArmInstaller))) {
    warn(`发现 Windows arm64 历史安装包：${winArmInstaller}。普通用户发布时建议不要混在一起发。`);
  }

  if (existsSync(path.join(root, "release/win-arm64-unpacked"))) {
    warn("发现 win-arm64-unpacked 历史目录。普通用户发布时建议清理，避免误发。");
  }
}

if (shouldCheck("mac")) {
  const macPattern = macArch === "x64" ? /Mach-O .*x86_64/i : /Mach-O .*arm64/i;

  assertFile(macZip, `macOS ${macArch} 压缩包`, {
    minBytes: 40 * 1024 * 1024,
    maxBytes: 250 * 1024 * 1024
  });

  if (existsSync(path.join(root, macApp))) {
    const size = dirSize(path.join(root, macApp));
    if (size > 900 * 1024 * 1024) {
      fail(`macOS .app 体积异常偏大：${formatBytes(size)}`);
    } else {
    pass(`macOS .app 目录存在：${formatBytes(size)}`);
    }
    assertBinaryArch(macRuntimeNode, `macOS ${macArch} Node runtime`, macPattern);
    assertSymlinkTarget(macRuntimeCorepack, `macOS ${macArch} corepack`);
    assertSymlinkTarget(macRuntimeNpm, `macOS ${macArch} npm`);
    assertSymlinkTarget(macRuntimeNpx, `macOS ${macArch} npx`);
    assertFile(macStandaloneStatic, `macOS ${macArch} standalone 静态资源`, { minBytes: 1000 });
    assertBinaryArch(macBetterSqlite, `macOS ${macArch} better-sqlite3`, macPattern);
    assertCodeSignature(macApp, `macOS ${macArch} .app`);
  } else {
    fail(`缺少 macOS ${macArch} .app 目录：${macApp}`);
  }
} else if (existsSync(path.join(root, macApp))) {
  warn("发现 macOS 历史产物；本次 Windows 自检不会检查它。需要发布 macOS 时请运行 npm run release:check:mac。");
}

if (!existsSync(releaseDir)) {
  fail("缺少 release 目录");
}

console.log(`\n发布前自检结果（${target === "all" ? "全部平台" : target === "mac" ? "macOS" : "Windows x64"}）`);
console.log("================");

for (const item of checks) {
  console.log(`${item.ok ? "✓" : "✗"} ${item.message}`);
}

if (warnings.length > 0) {
  console.log("\n警告");
  console.log("----");
  for (const message of warnings) {
    console.log(`! ${message}`);
  }
}

const failed = checks.filter((item) => !item.ok);

if (failed.length > 0) {
  console.log(`\n自检未通过：${failed.length} 项失败。`);
  process.exit(1);
}

console.log("\n自检通过。");
