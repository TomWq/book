import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import os from "node:os";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(rootDir, "deploy.config.json");
const forceInstall = process.env.DEPLOY_FORCE_INSTALL?.trim() === "1";

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function readJsonIfExists(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: rootDir,
      env: process.env,
      shell: false,
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

function getConfig() {
  const fileConfig = readJsonIfExists(configPath) ?? {};
  const envConfig = {
    host: process.env.DEPLOY_HOST,
    user: process.env.DEPLOY_USER,
    path: process.env.DEPLOY_PATH,
    port: process.env.DEPLOY_PORT,
    service: process.env.DEPLOY_SERVICE,
    pm2Name: process.env.DEPLOY_PM2_NAME
  };

  return {
    host: envConfig.host || fileConfig.host || "62.234.205.107",
    user: envConfig.user || fileConfig.user || "root",
    path: envConfig.path || fileConfig.path || "/root/book",
    port: Number(envConfig.port || fileConfig.port || 22),
    service: envConfig.service || fileConfig.service || "myapp.service",
    pm2Name: envConfig.pm2Name || fileConfig.pm2Name || "book-license-center"
  };
}

function validateConfig(config) {
  const missing = [];

  if (!config.host) missing.push("host");
  if (!config.user) missing.push("user");
  if (!config.path) missing.push("path");
  if (!config.service) missing.push("service");

  if (missing.length > 0) {
    throw new Error(
      `缺少部署配置: ${missing.join(", ")}。请创建 deploy.config.json，或通过 DEPLOY_HOST / DEPLOY_USER / DEPLOY_PATH / DEPLOY_SERVICE 提供。`
    );
  }
}

async function main() {
  const config = getConfig();
  validateConfig(config);

  const target = `${config.user}@${config.host}`;
  const remotePath = shellQuote(config.path);
  const remoteService = shellQuote(config.service);
  const remotePm2Name = shellQuote(config.pm2Name);
  const remotePort = String(config.port);
  const sshKeepAlive = ["-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=6"];
  const sshArgs = ["-p", remotePort, ...sshKeepAlive];
  const scpArgs = ["-P", remotePort, ...sshKeepAlive];
  const rsyncSsh = ["ssh", "-p", remotePort, ...sshKeepAlive].join(" ");

  console.log(`部署目标: ${target}:${config.path}`);
  console.log("清理远端桌面端构建缓存...");
  await run("ssh", [
    ...sshArgs,
    target,
    [
      "set -e",
      `rm -rf ${remotePath}/src-tauri/target`,
      `rm -rf ${remotePath}/build`
    ].join("; ")
  ]);

  console.log("同步代码...");

  await run("rsync", [
    "-az",
    "--delete",
    "-e",
    rsyncSsh,
    "--exclude",
    ".git",
    "--exclude",
    ".next",
    "--exclude",
    "node_modules",
    "--exclude",
    ".env",
    "--exclude",
    ".env.*",
    "--exclude",
    "public/downloads",
    "--exclude",
    "src-tauri/target",
    "--exclude",
    "src-tauri/target/***",
    "--exclude",
    "build",
    "--exclude",
    "build/***",
    "--exclude",
    "release",
    "--exclude",
    "release/***",
    "--exclude",
    "dev.db",
    "--exclude",
    "dev.db-*",
    "--exclude",
    "*.sqlite",
    "--exclude",
    "*.sqlite3",
    "--exclude",
    "data",
    "--exclude",
    "coverage",
    "--exclude",
    "test-results",
    "--exclude",
    ".turbo",
    "--exclude",
    ".cache",
    "--exclude",
    "playwright-report",
    "--exclude",
    ".DS_Store",
    "./",
    `${target}:${config.path}/`
  ]);

  const remoteScript = `set -eo pipefail
trap 'echo "[deploy] 失败：第 $LINENO 行，退出码 $?" >&2' ERR
echo "[deploy] 进入目录"
cd ${remotePath}
echo "[deploy] 当前目录：$(pwd)"
if [ -f /etc/profile ]; then . /etc/profile; fi
if [ -f "$HOME/.bash_profile" ]; then . "$HOME/.bash_profile"; fi
if [ -f "$HOME/.bashrc" ]; then . "$HOME/.bashrc"; fi
if [ -f "$HOME/.profile" ]; then . "$HOME/.profile"; fi
if ! command -v npm >/dev/null 2>&1; then
  for npm_bin in /usr/local/bin/npm /usr/bin/npm /www/server/nodejs/*/bin/npm "$HOME"/.nvm/versions/node/*/bin/npm; do
    if [ -x "$npm_bin" ]; then
      export PATH="$(dirname "$npm_bin"):$PATH"
      break
    fi
  done
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[deploy] 找不到 npm。请在服务器安装 Node.js，或把 npm 所在目录加入 PATH。" >&2
  exit 127
fi
echo "[deploy] Node：$(node -v 2>/dev/null || echo 未找到)"
echo "[deploy] npm：$(npm -v)"
needs_install=0
if [ ${forceInstall ? 1 : 0} -eq 1 ] || [ ! -x node_modules/.bin/next ]; then
  needs_install=1
fi
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  needs_install=1
fi
if ! node -e "require.resolve('react-markdown'); require.resolve('remark-gfm')" >/dev/null 2>&1; then
  needs_install=1
fi
if [ "$needs_install" -eq 1 ]; then
  echo "[deploy] 安装/更新依赖"
  npm install --no-audit --no-fund
else
  echo "[deploy] 依赖已存在，跳过 npm install"
fi
if [ ! -f node_modules/better-sqlite3/build/Release/better_sqlite3.node ]; then
  echo "[deploy] 重建 better-sqlite3"
  npm rebuild better-sqlite3 --build-from-source --no-audit --no-fund
fi
echo "[deploy] 构建 Next"
npm run build
if systemctl status ${remoteService} >/dev/null 2>&1; then
  echo "[deploy] 重启 systemd 服务：${config.service}"
  systemctl restart ${remoteService}
elif command -v pm2 >/dev/null 2>&1; then
  echo "[deploy] 重启 PM2 服务：${config.pm2Name}"
  pm2 restart ${remotePm2Name} || pm2 start npm --name ${remotePm2Name} -- start
else
  echo "[deploy] 后台启动 npm start"
  nohup npm start >/tmp/book-license-center.log 2>&1 &
fi
echo "[deploy] 远端完成"`;

  console.log("远端构建并重启...");
  const tempDir = mkdtempSync(join(os.tmpdir(), "book-deploy-"));
  const localScriptPath = join(tempDir, "deploy-remote.sh");
  const remoteScriptPath = `/tmp/book-deploy-${Date.now()}.sh`;

  try {
    writeFileSync(localScriptPath, remoteScript, "utf8");
    await run("scp", [...scpArgs, localScriptPath, `${target}:${remoteScriptPath}`]);
    await run("ssh", [
      ...sshArgs,
      target,
      `bash -lc ${shellQuote(`bash ${shellQuote(remoteScriptPath)}; status=$?; rm -f ${shellQuote(remoteScriptPath)}; exit $status`)}`
    ]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  console.log("部署完成");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
