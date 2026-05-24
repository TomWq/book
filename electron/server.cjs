const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("node:url");

function appendLog(message) {
  const logPath = process.env.DESKTOP_LOG_PATH;

  if (!logPath) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [server] ${message}\n`, "utf8");
  } catch {
    // Ignore logging failures.
  }
}

function formatError(error) {
  return error instanceof Error ? error.stack || error.message : String(error);
}

async function main() {
  const port = Number(process.env.PORT || process.argv[2] || 3130);
  const dir = process.env.ELECTRON_APP_ROOT || path.resolve(__dirname, "..");
  const next = require("next");
  const app = next({
    dev: false,
    dir,
    hostname: "127.0.0.1",
    port
  });
  const handler = app.getRequestHandler();

  process.on("uncaughtException", (error) => {
    appendLog(`[uncaughtException] ${formatError(error)}`);
    console.error(error);
  });

  process.on("unhandledRejection", (reason) => {
    appendLog(`[unhandledRejection] ${formatError(reason)}`);
    console.error(reason);
  });

  await app.prepare();

  const server = http.createServer((request, response) => {
    Promise.resolve(handler(request, response, parse(request.url, true))).catch((error) => {
      appendLog(`[request-error] ${request.method} ${request.url} ${formatError(error)}`);
      console.error(error);

      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("content-type", "text/plain; charset=utf-8");
        response.end("本地服务发生错误，请在客户端菜单中打开日志目录并发送 desktop.log。");
      } else {
        response.end();
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  process.send?.({ type: "ready", port });

  function shutdown() {
    server.close(() => {
      process.exit(0);
    });
  }

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.send?.({
    type: "error",
    message: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
