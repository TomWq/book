const path = require("node:path");

const serverPath = process.argv[2];
const parentPid = Number(process.env.TAURI_PARENT_PID || "0");

if (!serverPath) {
  console.error("[tauri-wrapper] missing Next server path");
  process.exit(1);
}

if (parentPid > 0) {
  setInterval(() => {
    if (process.ppid !== parentPid) {
      process.exit(0);
    }

    try {
      process.kill(parentPid, 0);
    } catch {
      process.exit(0);
    }
  }, 1000).unref();
}

process.argv = [process.argv[0], serverPath, ...process.argv.slice(3)];
require(path.resolve(serverPath));
