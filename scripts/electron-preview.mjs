import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const electronBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "electron.cmd" : "electron");

const child = spawn(electronBin, ["."], {
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

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
