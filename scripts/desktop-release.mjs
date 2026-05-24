import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const projectNode = process.platform === "win32"
  ? path.join(root, "node_modules", "node", "bin", "node.exe")
  : path.join(root, "node_modules", "node", "bin", "node");
const args = new Set(process.argv.slice(2));
const skipCheck = args.has("--no-check");

function log(message) {
  console.log(`[desktop-release] ${message}`);
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    log(`${command} ${commandArgs.join(" ")}`.trim());

    const child = spawn(command, commandArgs, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        APP_RUNTIME: "desktop",
        NEXT_PUBLIC_APP_RUNTIME: "desktop",
        AUTH_COOKIE_SECURE: "false"
      }
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${commandArgs.join(" ")} 退出：${code}`));
    });
  });
}

async function buildTarget(label, targetArgs) {
  log(`开始打包：${label}`);
  await run(projectNode, ["scripts/desktop-build.mjs", ...targetArgs]);
  log(`完成打包：${label}`);
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("一键打 Windows + macOS 双架构包需要在 macOS 上执行。Windows 机器不能构建 macOS 安装包。");
  }

  const targets = [
    { label: "Windows x64 安装包", args: ["--win", "--x64"] },
    { label: "macOS Apple 芯片 arm64 压缩包", args: ["--mac", "--arm64"] },
    { label: "macOS Intel x64 压缩包", args: ["--mac", "--x64"] }
  ];

  for (const target of targets) {
    await buildTarget(target.label, target.args);
  }

  if (!skipCheck) {
    log("开始发布前自检：Windows x64");
    await run(projectNode, ["scripts/release-check.mjs", "--win"]);
    log("开始发布前自检：macOS arm64");
    await run(projectNode, ["scripts/release-check.mjs", "--mac", "--arm64"]);
    log("开始发布前自检：macOS x64");
    await run(projectNode, ["scripts/release-check.mjs", "--mac", "--x64"]);
    log("发布前自检完成");
  }

  log("全部发布包已生成。产物位于 release/ 目录。");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
