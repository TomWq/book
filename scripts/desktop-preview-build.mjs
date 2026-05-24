import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const projectNode = process.platform === "win32"
  ? path.join(root, "node_modules", "node", "bin", "node.exe")
  : path.join(root, "node_modules", "node", "bin", "node");
const binDir = path.join(root, "node_modules", ".bin");
const toolPath = [path.dirname(projectNode), binDir, process.env.PATH ?? ""].join(path.delimiter);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        PATH: toolPath,
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

      reject(new Error(`${command} ${args.join(" ")} 退出：${code}`));
    });
  });
}

async function syncStandaloneStaticAssets() {
  const sourceStatic = path.join(root, ".next", "static");
  const targetStatic = path.join(root, ".next", "standalone", ".next", "static");

  if (!existsSync(sourceStatic) || !existsSync(path.join(root, ".next", "standalone"))) {
    throw new Error("Next standalone 静态资源不完整，请检查 next build 输出。");
  }

  await rm(targetStatic, { recursive: true, force: true });
  await mkdir(path.dirname(targetStatic), { recursive: true });
  await cp(sourceStatic, targetStatic, { recursive: true });
}

await run(projectNode, ["scripts/generate-desktop-icons.mjs"]);
await run(path.join(binDir, process.platform === "win32" ? "next.cmd" : "next"), ["build"]);
await syncStandaloneStaticAssets();
await run(projectNode, ["scripts/clean-desktop-build.mjs"]);
await run(projectNode, ["scripts/electron-preview.mjs"]);
