import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

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

  console.log(`部署目标: ${target}:${config.path}`);
  console.log("同步代码...");

  await run("rsync", [
    "-az",
    "--delete",
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

  const remoteScript = `set -e
cd ${remotePath}
if [ ${forceInstall ? 1 : 0} -eq 1 ] || [ ! -x node_modules/.bin/next ]; then
  npm install --no-audit --no-fund
fi
if [ ! -f node_modules/better-sqlite3/build/Release/better_sqlite3.node ]; then
  npm rebuild better-sqlite3 --build-from-source --no-audit --no-fund
fi
npm run build
if systemctl status ${remoteService} >/dev/null 2>&1; then
  systemctl restart ${remoteService}
elif command -v pm2 >/dev/null 2>&1; then
  pm2 restart ${remotePm2Name} || pm2 start npm --name ${remotePm2Name} -- start
else
  nohup npm start >/tmp/book-license-center.log 2>&1 &
fi`;

  console.log("远端构建并重启...");
  await run("ssh", ["-p", remotePort, target, `bash -lc ${shellQuote(remoteScript)}`]);

  console.log("部署完成");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
