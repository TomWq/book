import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const root = process.cwd();
const envPath = path.join(root, ".env");
const storePath = path.resolve(process.env.APP_STORE_PATH || path.join(root, "data", "app-db.json"));

function readEnvValue(name) {
  const raw = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const line = raw
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${name}=`));

  if (!line) {
    return process.env[name] || "";
  }

  const value = line.slice(line.indexOf("=") + 1).trim();
  return value.replace(/^['\"]|['\"]$/g, "");
}

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const value = databaseUrl.slice("file:".length);

  if (!value) {
    return null;
  }

  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function resetSqlite(sqlitePath) {
  if (!existsSync(sqlitePath)) {
    console.log(`[activation:reset] SQLite 文件不存在，跳过：${sqlitePath}`);
    return;
  }

  const db = new Database(sqlitePath);

  try {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM "Session"').run();
      db.prepare('DELETE FROM "User" WHERE "licenseCustomerId" IS NOT NULL OR "licenseCodeHash" IS NOT NULL').run();

      const hasAppState = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'AppState'")
        .get();

      if (hasAppState) {
        db.prepare('DELETE FROM "AppState"').run();
      }
    });

    transaction();
    console.log(`[activation:reset] 已清除本地 SQLite 激活状态：${sqlitePath}`);
  } finally {
    db.close();
  }
}

function resetJsonStore() {
  if (!existsSync(storePath)) {
    console.log(`[activation:reset] JSON 存储不存在，跳过：${storePath}`);
    return;
  }

  const store = JSON.parse(readFileSync(storePath, "utf8"));
  store.sessions = [];
  store.users = Array.isArray(store.users)
    ? store.users.filter((user) => !user.licenseCustomerId && !user.licenseCodeHash)
    : [];

  writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  console.log(`[activation:reset] 已清除本地 JSON 激活状态：${storePath}`);
}

function main() {
  const databaseUrl = process.env.DATABASE_URL || readEnvValue("DATABASE_URL");

  if (/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error("检测到 DATABASE_URL 是 PostgreSQL。为避免误删线上授权数据，本命令只允许清理本地 SQLite/JSON 状态。");
  }

  const sqlitePath = resolveSqlitePath(databaseUrl);

  if (sqlitePath) {
    resetSqlite(sqlitePath);
  } else {
    resetJsonStore();
  }

  console.log("[activation:reset] 浏览器 localStorage 里的 nw_license_machine_id 需要在浏览器控制台手动清除：");
  console.log('localStorage.removeItem("nw_license_machine_id")');
  console.log("[activation:reset] 然后重启 dev 服务并打开 /activate，就接近首次拿到软件的状态。");
}

main();
