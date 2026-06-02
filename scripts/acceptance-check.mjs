import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFile(relativePath) {
  assert(existsSync(path.join(root, relativePath)), `缺少文件：${relativePath}`);
}

function assertMissing(relativePath) {
  assert(!existsSync(path.join(root, relativePath)), `不应再保留文件：${relativePath}`);
}

function assertIncludes(relativePath, snippets) {
  const content = read(relativePath);

  for (const snippet of snippets) {
    assert(content.includes(snippet), `${relativePath} 缺少关键内容：${snippet}`);
  }
}

const requiredDocs = ["AGENTS.md", "README.md", "PRD.md", "ARCHITECTURE.md", "DESIGN.md"];
const requiredRoutes = [
  "src/app/api/auth/register/route.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/projects/[projectId]/import/page.tsx",
  "src/app/projects/[projectId]/chapters/page.tsx",
  "src/app/projects/[projectId]/analysis/page.tsx",
  "src/app/templates/[templateId]/generate-outline/page.tsx",
  "src/app/projects/[projectId]/writing/page.tsx",
  "src/app/projects/[projectId]/state/page.tsx",
  "src/app/projects/[projectId]/editor/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/api/app/update/manifest/route.ts",
  "src/app/api/app/update/check/route.ts",
  "src/app/api/app/tauri-update/[target]/[arch]/[currentVersion]/route.ts",
  "src/app/download/page.tsx",
  "src/app/downloads/page.tsx",
  "src/app/api/jobs/worker/route.ts",
  "scripts/run-worker.mjs",
  "scripts/main-flow-check.mjs",
  "scripts/download-tauri-release.mjs",
  "scripts/publish-downloads.mjs"
];

for (const file of [...requiredDocs, ...requiredRoutes]) {
  assertFile(file);
}

assertMissing("src/lib/mock-data.ts");

assertIncludes("src/lib/chapters.ts", ["Chapter\\s*\\d+", "第[零〇一二三四五六七八九十百千万\\d]+"]);
assertIncludes("src/lib/ai/novel-analysis.ts", [
  "pressurePoint",
  "pleasurePoints",
  "whyItWorks",
  "drivesMainPlot",
  "avoidCopying"
]);
assertIncludes("src/lib/ai/outline.ts", [
  "templateInheritance",
  "variableMapping",
  "first10Chapters",
  "first100Pacing",
  "pleasureDistribution"
]);
assertIncludes("src/lib/ai/writing.ts", [
  "generateWritingTaskCardWithAi",
  "generateChapterDraftWithAi",
  "reviewChapterDraftWithAi",
  "editDraftTextWithAi",
  "人物不能知道自己不知道的信息"
]);
assertIncludes("src/lib/project-store.ts", [
  "APP_STORE_PATH",
  "loadPersistedStore",
  "savePersistedStore"
]);
assertIncludes("src/lib/projects.ts", [
  "processPendingAiJobsAsWorker",
  "processAiJobAsOwner",
  "applyLedgerToWritingState",
  "AsyncLocalStorage",
  "createDomainReadRepository",
  "createDomainWriteRepository",
  "getDashboardStatsForUser",
  "getProjectAnalysisForUser",
  "getProjectWritingStateForUser"
]);
assertIncludes("package.json", [
  "acceptance:flow",
  "release:tauri",
  "release:download",
  "downloads:manifest",
  "@tauri-apps/plugin-updater"
]);
assertIncludes("src/lib/app-update.ts", [
  "APP_LATEST_VERSION",
  "APP_UPDATE_DOWNLOAD_WIN_URL",
  "APP_UPDATE_MANIFEST_URL",
  "compareAppVersions",
  "updaterSignature"
]);
assertIncludes("src/app/download/page.tsx", ["Windows 版", "Mac 版", "Apple 芯片"]);
assertIncludes("src/components/version-update-card.tsx", ["检查更新", "下载新版"]);
assertIncludes("src/lib/store-persistence.ts", [
  "resolveSqliteFilePath",
  "syncCoreTables",
  "readCoreStoreFromDb",
  "getPersistenceStatus"
]);
assertIncludes("src/proxy.ts", ["/download", "/downloads", "/api/jobs/worker", "/api/app/update/manifest", "/api/app/tauri-update/"]);
assertIncludes("src-tauri/tauri.conf.json", ["createUpdaterArtifacts", "https://book-1253439621.cos.ap-beijing.myqcloud.com/tauri-update.json"]);
assertIncludes("src-tauri/capabilities/default.json", ["updater:default", "process:default", "opener:default"]);

console.log("验收守门检查通过：拆书、模板、大纲、创作、状态、二稿、后台 Worker 和 SQLite 关键契约均存在。");
