import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const root = process.cwd();
const requestedPort = Number(process.env.ELECTRON_NEXT_PORT || 3130);
const explicitPort = Boolean(process.env.ELECTRON_NEXT_PORT);
const projectNode = process.platform === "win32"
  ? path.join(root, "node_modules", "node", "bin", "node.exe")
  : path.join(root, "node_modules", "node", "bin", "node");
const binDir = path.join(root, "node_modules", ".bin");
const nextBin = path.join(binDir, process.platform === "win32" ? "next.cmd" : "next");
const toolPath = [path.dirname(projectNode), binDir, process.env.PATH ?? ""].join(path.delimiter);

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      PATH: toolPath,
      ...options.env
    }
  });
}

function isPortAvailable(targetPort) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(targetPort, "127.0.0.1");
  });
}

async function resolveDevPort(startPort) {
  if (explicitPort) {
    if (await isPortAvailable(startPort)) {
      return startPort;
    }

    throw new Error(`端口 ${startPort} 已被占用。请关闭占用进程，或设置 ELECTRON_NEXT_PORT 使用其他端口。`);
  }

  for (let currentPort = startPort; currentPort < startPort + 20; currentPort += 1) {
    if (await isPortAvailable(currentPort)) {
      if (currentPort !== startPort) {
        console.warn(`[desktop:dev] 端口 ${startPort} 已被占用，改用 ${currentPort}。`);
      }

      return currentPort;
    }
  }

  throw new Error(`没有找到可用调试端口，请关闭占用 127.0.0.1:${startPort}-${startPort + 19} 的进程后重试。`);
}

function waitForPort(targetPort, timeoutMs = 45000) {
  const startedAt = Date.now();
  const url = `http://127.0.0.1:${targetPort}`;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port: targetPort });

      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();

        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`等待 Next dev server 超时：${url}`));
          return;
        }

        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

const port = await resolveDevPort(requestedPort);
const url = `http://127.0.0.1:${port}`;
const nextProcess = run(nextBin, ["dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: {
    APP_RUNTIME: "desktop",
    NEXT_PUBLIC_APP_RUNTIME: "desktop",
    AUTH_COOKIE_SECURE: "false"
  }
});

let electronProcess = null;

try {
  await waitForPort(port);
  const electronBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "electron.cmd" : "electron");
  electronProcess = run(electronBin, ["."], {
    env: {
      ELECTRON_START_URL: url,
      APP_RUNTIME: "desktop",
      NEXT_PUBLIC_APP_RUNTIME: "desktop",
      AUTH_COOKIE_SECURE: "false"
    }
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  nextProcess.kill("SIGTERM");
  process.exit(1);
}

function shutdown() {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill("SIGTERM");
  }
  if (!nextProcess.killed) {
    nextProcess.kill("SIGTERM");
  }
}

electronProcess?.once("exit", () => {
  shutdown();
});

nextProcess.once("exit", (code) => {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill("SIGTERM");
  }

  if (code && code !== 0) {
    process.exit(code);
  }
});

process.once("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.once("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
