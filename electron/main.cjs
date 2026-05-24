const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { execFileSync, fork } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEFAULT_PORT = 3130;
const APP_NAME = "AI 网文写作助手";
const MACHINE_ID_NAMESPACE = "ai-novel-workbench-license-v1";

let mainWindow = null;
let nextProcess = null;
let splashWindow = null;
let logFilePath = "";

function appendLogLine(level, message) {
  if (!logFilePath) {
    return;
  }

  try {
    fs.appendFileSync(
      logFilePath,
      `[${new Date().toISOString()}] [${level}] ${String(message)}\n`,
      "utf8"
    );
  } catch {
    // Logging must never prevent the desktop app from starting.
  }
}

function configureApplicationLogging() {
  const logsDir = path.join(app.getPath("userData"), "logs");
  ensureDir(logsDir);
  logFilePath = path.join(logsDir, "desktop.log");
  process.env.DESKTOP_LOG_PATH = logFilePath;

  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);

  console.log = (...args) => {
    appendLogLine("info", args.join(" "));
    originalLog(...args);
  };

  console.error = (...args) => {
    appendLogLine("error", args.join(" "));
    originalError(...args);
  };

  process.on("uncaughtException", (error) => {
    console.error(`[uncaughtException] ${error instanceof Error ? error.stack || error.message : String(error)}`);
  });

  process.on("unhandledRejection", (reason) => {
    console.error(`[unhandledRejection] ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
  });

  appendLogLine("info", `${APP_NAME} starting, version=${app.getVersion()}, platform=${process.platform}, arch=${process.arch}`);
}

function openLogsDir() {
  const logsDir = logFilePath ? path.dirname(logFilePath) : path.join(app.getPath("userData"), "logs");
  ensureDir(logsDir);
  shell.openPath(logsDir);
}

function isDevelopment() {
  return Boolean(process.env.ELECTRON_START_URL) || !app.isPackaged;
}

function rootDir() {
  return app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "..");
}

function iconPath() {
  return path.join(rootDir(), "build", "icon.png");
}

function appIconUrl() {
  const icon = iconPath();

  if (!fs.existsSync(icon)) {
    return "";
  }

  try {
    return `data:image/png;base64,${fs.readFileSync(icon).toString("base64")}`;
  } catch {
    return pathToFileURL(icon).toString();
  }
}

function nodeExecutablePath() {
  const binaryName = process.platform === "win32" ? "node.exe" : "node";
  const candidates = [
    path.join(process.resourcesPath || rootDir(), "node-runtime", binaryName),
    path.join(process.resourcesPath || rootDir(), "node-runtime", "bin", binaryName),
    path.join(rootDir(), "node_modules", "node", "bin", binaryName),
    path.join(rootDir(), "node_modules", "node", "node_modules", `node-bin-${process.platform}-${process.arch}`, "bin", binaryName)
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));

  if (!found) {
    throw new Error("未找到随客户端打包的 Node 运行时，请重新安装依赖后再打包。");
  }

  return found;
}

function standaloneServerPath() {
  return path.join(rootDir(), ".next", "standalone", "server.js");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function hashMachineSource(source) {
  return crypto.createHash("sha256")
    .update(MACHINE_ID_NAMESPACE)
    .update(":")
    .update(String(source || "").trim())
    .digest("hex");
}

function runCommand(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500
    }).trim();
  } catch {
    return "";
  }
}

function readMacHardwareId() {
  const output = runCommand("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]);
  const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
  return match?.[1] || "";
}

function readWindowsHardwareId() {
  const output = runCommand("powershell.exe", [
    "-NoProfile",
    "-Command",
    "(Get-CimInstance Win32_ComputerSystemProduct).UUID"
  ]);
  return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function readLinuxHardwareId() {
  const candidates = ["/etc/machine-id", "/var/lib/dbus/machine-id"];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const value = fs.readFileSync(candidate, "utf8").trim();
        if (value) {
          return value;
        }
      }
    } catch {
      // Continue with the next candidate.
    }
  }

  return "";
}

function readHardwareId() {
  if (process.platform === "darwin") {
    return readMacHardwareId();
  }

  if (process.platform === "win32") {
    return readWindowsHardwareId();
  }

  if (process.platform === "linux") {
    return readLinuxHardwareId();
  }

  return "";
}

function readPersistedMachineSource(machineIdPath) {
  try {
    if (!fs.existsSync(machineIdPath)) {
      return "";
    }

    const parsed = JSON.parse(fs.readFileSync(machineIdPath, "utf8"));
    return typeof parsed.id === "string" ? parsed.id.trim() : "";
  } catch {
    return "";
  }
}

function writePersistedMachineSource(machineIdPath, id) {
  try {
    ensureDir(path.dirname(machineIdPath));
    fs.writeFileSync(machineIdPath, JSON.stringify({ id, createdAt: new Date().toISOString() }, null, 2), "utf8");
  } catch {
    // The app can still start; activation will report a missing machine hash if all sources fail.
  }
}

function resolveDesktopMachineHash(dataDir) {
  const hardwareId = readHardwareId();

  if (hardwareId) {
    return hashMachineSource(`${process.platform}:${hardwareId}`);
  }

  const machineIdPath = path.join(dataDir, "machine-id.json");
  const persisted = readPersistedMachineSource(machineIdPath);

  if (persisted) {
    return hashMachineSource(persisted);
  }

  const fallback = [
    "fallback",
    os.hostname(),
    os.platform(),
    os.arch(),
    crypto.randomUUID()
  ].join(":");

  writePersistedMachineSource(machineIdPath, fallback);
  return hashMachineSource(fallback);
}

function configureDesktopEnvironment() {
  app.setName(APP_NAME);

  const dataDir = path.join(app.getPath("userData"), "data");
  ensureDir(dataDir);

  process.env.APP_RUNTIME = "desktop";
  process.env.NEXT_PUBLIC_APP_RUNTIME = "desktop";
  process.env.AUTH_COOKIE_SECURE = "false";
  process.env.HOSTNAME = "127.0.0.1";
  process.env.APP_STORE_PATH = process.env.APP_STORE_PATH || path.join(dataDir, "app-db.json");
  process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(dataDir, "license-center.db")}`;
  process.env.DESKTOP_MACHINE_HASH = process.env.DESKTOP_MACHINE_HASH || resolveDesktopMachineHash(dataDir);
}

function configureApplicationMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [{
          label: APP_NAME,
          submenu: [
            { role: "about", label: `关于 ${APP_NAME}` },
            { type: "separator" },
            { role: "hide", label: "隐藏" },
            { role: "hideOthers", label: "隐藏其他" },
            { role: "unhide", label: "全部显示" },
            { type: "separator" },
            { role: "quit", label: "退出" }
          ]
        }]
      : []),
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "togglefullscreen", label: "全屏" },
        { type: "separator" },
        { role: "reload", label: "重新载入" }
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "打开日志目录",
          click: openLogsDir
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function findFreePort(startPort = DEFAULT_PORT) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        findFreePort(startPort + 1).then(resolve, reject);
        return;
      }

      reject(error);
    });
    server.listen(startPort, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : startPort;
      server.close(() => resolve(port));
    });
  });
}

function waitForPort(port, timeoutMs = 45000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port });

      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();

        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error("本地 Next 服务启动超时"));
          return;
        }

        setTimeout(attempt, 300);
      });
    };

    attempt();
  });
}

async function startBundledNextServer() {
  const port = Number(process.env.ELECTRON_NEXT_PORT || 0) || await findFreePort();
  const dir = rootDir();
  const standaloneScript = standaloneServerPath();
  const useStandalone = fs.existsSync(standaloneScript);
  const serverScript = useStandalone ? standaloneScript : path.join(dir, "electron", "server.cjs");
  const nodePath = nodeExecutablePath();

  nextProcess = fork(serverScript, [String(port)], {
    cwd: useStandalone ? path.dirname(standaloneScript) : dir,
    execPath: nodePath,
    env: {
      ...process.env,
      ELECTRON_APP_ROOT: dir,
      PORT: String(port),
      APP_RUNTIME: "desktop",
      NEXT_PUBLIC_APP_RUNTIME: "desktop",
      AUTH_COOKIE_SECURE: "false",
      HOSTNAME: "127.0.0.1"
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });

  nextProcess.stdout?.on("data", (chunk) => {
    console.log(`[next] ${chunk.toString().trimEnd()}`);
  });
  nextProcess.stderr?.on("data", (chunk) => {
    console.error(`[next] ${chunk.toString().trimEnd()}`);
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("本地 Next 服务启动超时"));
    }, 45000);

    if (useStandalone) {
      waitForPort(port)
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
      return;
    }

    nextProcess.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`本地 Next 服务异常退出：${code ?? "unknown"}`));
    });

    nextProcess.on("message", (message) => {
      if (message?.type === "ready") {
        clearTimeout(timeout);
        resolve();
      }

      if (message?.type === "error") {
        clearTimeout(timeout);
        reject(new Error(message.message || "本地 Next 服务启动失败"));
      }
    });
  });

  return `http://127.0.0.1:${port}`;
}

async function resolveAppUrl() {
  if (process.env.ELECTRON_START_URL) {
    return process.env.ELECTRON_START_URL;
  }

  return startBundledNextServer();
}

function splashHtml() {
  const iconUrl = appIconUrl();

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; }
    body {
      display: grid;
      place-items: center;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      user-select: none;
    }
    .splash {
      position: relative;
      width: 430px;
      min-height: 320px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 18px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 28px;
      background:
        linear-gradient(135deg, rgba(24,31,47,.9), rgba(9,13,24,.95)),
        linear-gradient(145deg, #273047 0%, #121a2b 48%, #0c111d 100%);
      box-shadow: 0 34px 96px rgba(0,0,0,.42);
    }
    .splash::before {
      content: "";
      position: absolute;
      inset: -30%;
      background:
        linear-gradient(120deg, transparent 20%, rgba(93, 171, 255, .16) 44%, transparent 58%),
        radial-gradient(circle at 70% 24%, rgba(107, 244, 194, .22), transparent 32%),
        repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 76px);
      animation: drift 5.8s ease-in-out infinite alternate;
    }
    .halo {
      position: absolute;
      width: 190px;
      height: 190px;
      border-radius: 999px;
      background: rgba(37, 99, 235, .2);
      filter: blur(18px);
      animation: pulse 1.8s ease-in-out infinite;
    }
    .icon {
      position: relative;
      width: 92px;
      height: 92px;
      display: block;
      border-radius: 24px;
      box-shadow: 0 20px 42px rgba(31, 94, 255, .34);
      animation: float 2.4s ease-in-out infinite;
    }
    h1 {
      position: relative;
      margin: 6px 0 0;
      font-size: 24px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    p {
      position: relative;
      margin: 0;
      color: rgba(255,255,255,.62);
      font-size: 13px;
      font-weight: 700;
    }
    .loader {
      position: relative;
      width: 180px;
      height: 4px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255,255,255,.1);
    }
    .loader::after {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 44%;
      border-radius: inherit;
      background: linear-gradient(90deg, #60a5fa, #45f0ad);
      animation: loading 1.25s ease-in-out infinite;
    }
    @keyframes loading {
      from { transform: translateX(-100%); }
      to { transform: translateX(240%); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes pulse {
      0%, 100% { opacity: .72; transform: scale(.94); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    @keyframes drift {
      from { transform: translate3d(-2%, -2%, 0); }
      to { transform: translate3d(3%, 2%, 0); }
    }
  </style>
</head>
<body>
  <main class="splash">
    <span class="halo"></span>
    ${iconUrl ? `<img class="icon" src="${iconUrl}" alt="" />` : ""}
    <h1>${APP_NAME}</h1>
    <p>正在准备你的创作工作台</p>
    <div class="loader" aria-hidden="true"></div>
  </main>
</body>
</html>`;
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    return splashWindow;
  }

  splashWindow = new BrowserWindow({
    width: 460,
    height: 350,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml())}`);

  return splashWindow;
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }

  splashWindow = null;
}

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 640,
    title: APP_NAME,
    icon: iconPath(),
    backgroundColor: "#10151d",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    closeSplashWindow();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return { action: "allow" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(appUrl) || url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`[renderer] render-process-gone ${JSON.stringify(details)}`);
  });

  mainWindow.loadURL(appUrl);
}

async function bootstrap() {
  configureApplicationLogging();
  configureDesktopEnvironment();
  configureApplicationMenu();
  createSplashWindow();

  try {
    const appUrl = await resolveAppUrl();
    createWindow(appUrl);
  } catch (error) {
    closeSplashWindow();
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("启动失败", `作者端客户端启动失败：${message}`);
    app.quit();
  }
}

app.whenReady().then(bootstrap);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createSplashWindow();
    resolveAppUrl().then(createWindow).catch((error) => {
      closeSplashWindow();
      dialog.showErrorBox("启动失败", error instanceof Error ? error.message : String(error));
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nextProcess) {
    nextProcess.kill("SIGTERM");
    nextProcess = null;
  }
});
