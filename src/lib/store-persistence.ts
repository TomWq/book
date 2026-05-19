import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import type postgres from "postgres";

const DEFAULT_STATE_ID = "default";
const STORE_RECORD_ENTITY_KEYS = [
  "users",
  "sessions",
  "projects",
  "sourceTexts",
  "chapters",
  "chapterAnalyses",
  "storyAnalyses",
  "templates",
  "outlines",
  "writingBibles",
  "characterProfiles",
  "foreshadowings",
  "plotStates",
  "writingTaskCards",
  "chapterDrafts",
  "chapterLedgers",
  "reviewReports",
  "editReports",
  "aiJobs",
  "creditTransactions",
  "aiSettings"
];

type PostgresClient = ReturnType<typeof postgres>;

const globalForPersistence = globalThis as typeof globalThis & {
  __appStatePostgres?: PostgresClient;
  __appStatePostgresLoader?: Promise<PostgresClient>;
};

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function resolveSqliteFilePath() {
  const url = process.env.DATABASE_URL?.trim();

  if (!url || !url.startsWith("file:")) {
    return null;
  }

  const rawPath = url.slice("file:".length);

  if (!rawPath) {
    return null;
  }

  if (rawPath.startsWith("./")) {
    return path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawPath.slice(2));
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawPath);
}

function resolvePostgresUrl() {
  const url = process.env.DATABASE_URL?.trim();

  if (!url || !/^postgres(?:ql)?:\/\//.test(url)) {
    return null;
  }

  return url;
}

async function getPostgresClient() {
  const url = resolvePostgresUrl();

  if (!url) {
    return null;
  }

  if (!globalForPersistence.__appStatePostgres) {
    if (!globalForPersistence.__appStatePostgresLoader) {
      globalForPersistence.__appStatePostgresLoader = (async () => {
        const { default: postgresClientFactory } = await import("postgres");
        const client = postgresClientFactory(url, {
          max: Number(process.env.DATABASE_POOL_SIZE ?? 3),
          idle_timeout: 20,
          onnotice: () => {}
        });

        await ensurePostgresSchema(client);
        globalForPersistence.__appStatePostgres = client;
        return client;
      })();
    }

    return globalForPersistence.__appStatePostgresLoader;
  }

  return globalForPersistence.__appStatePostgres;
}

async function ensurePostgresSchema(sql: PostgresClient) {
  await sql`
    CREATE TABLE IF NOT EXISTS "AppState" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "payload" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "StoreRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "entityType" TEXT NOT NULL,
      "userId" TEXT,
      "ownerUserId" TEXT,
      "projectId" TEXT,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "StoreRecord_entityType_idx" ON "StoreRecord" ("entityType")`;
  await sql`CREATE INDEX IF NOT EXISTS "StoreRecord_userId_idx" ON "StoreRecord" ("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS "StoreRecord_ownerUserId_idx" ON "StoreRecord" ("ownerUserId")`;
  await sql`CREATE INDEX IF NOT EXISTS "StoreRecord_projectId_idx" ON "StoreRecord" ("projectId")`;
}

function ensureSqliteSchema() {
  const sqlitePath = resolveSqliteFilePath();

  if (!sqlitePath) {
    return;
  }

  const db = new Database(sqlitePath);

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS "AppState" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "payload" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "Project" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "ownerUserId" TEXT,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "genre" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "SourceText" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      "charCount" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "SourceText_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Chapter" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "sourceTextId" TEXT NOT NULL,
      "chapterNumber" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "charCount" INTEGER NOT NULL,
      "orderIndex" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Chapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Chapter_sourceTextId_fkey" FOREIGN KEY ("sourceTextId") REFERENCES "SourceText" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "ChapterAnalysis" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "chapterId" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "mainEvent" TEXT NOT NULL,
      "conflict" TEXT NOT NULL,
      "pressurePoint" TEXT NOT NULL,
      "payoff" TEXT NOT NULL,
      "cliffhanger" TEXT NOT NULL,
      "readerHook" TEXT NOT NULL,
      "newInformation" JSON,
      "newCharacters" JSON,
      "stateChanges" JSON,
      "entityRelations" JSON,
      "pleasurePoints" JSON,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ChapterAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ChapterAnalysis_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "StoryAnalysis" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "genre" TEXT NOT NULL,
      "protagonistModel" TEXT NOT NULL,
      "openingModel" TEXT NOT NULL,
      "goldenFingerMechanism" TEXT NOT NULL,
      "villainFunction" TEXT NOT NULL,
      "supportingRoles" TEXT NOT NULL,
      "mapProgression" TEXT NOT NULL,
      "usablePatterns" JSON,
      "avoidCopying" JSON,
      "openingHook" TEXT NOT NULL,
      "mainLoop" TEXT NOT NULL,
      "pacing" TEXT NOT NULL,
      "topPleasureTypes" JSON,
      "formula" TEXT NOT NULL,
      "migrationAdvice" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "StoryAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Template" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "ownerUserId" TEXT,
      "sourceProjectId" TEXT,
      "sourceStoryAnalysisId" TEXT,
      "name" TEXT NOT NULL,
      "genre" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "openingHook" TEXT NOT NULL,
      "mainLoop" TEXT NOT NULL,
      "chapterPacing" TEXT NOT NULL,
      "formula" TEXT NOT NULL,
      "migrationAdvice" TEXT NOT NULL,
      "protagonistModel" TEXT NOT NULL,
      "goldenFinger" TEXT NOT NULL,
      "usablePatterns" JSON,
      "avoidCopying" JSON,
      "tags" JSON,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Template_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Template_sourceStoryAnalysisId_fkey" FOREIGN KEY ("sourceStoryAnalysisId") REFERENCES "StoryAnalysis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Outline" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "templateId" TEXT NOT NULL,
      "variables" JSON NOT NULL,
      "titleOptions" JSON,
      "logline" TEXT NOT NULL,
      "intro" TEXT NOT NULL,
      "templateInheritance" JSON,
      "variableMapping" JSON,
      "coreSellingPoints" JSON,
      "worldSetting" TEXT NOT NULL,
      "protagonist" TEXT NOT NULL,
      "characters" JSON,
      "first10Chapters" JSON,
      "first100Pacing" TEXT NOT NULL,
      "foreshadowingPlan" JSON,
      "pleasureDistribution" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Outline_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "WritingBible" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "workType" TEXT NOT NULL,
      "targetReader" TEXT NOT NULL,
      "corePleasure" TEXT NOT NULL,
      "protagonistDesire" TEXT NOT NULL,
      "worldRules" TEXT NOT NULL,
      "goldenFingerRules" TEXT NOT NULL,
      "powerSystem" TEXT NOT NULL,
      "narrativeTaboos" TEXT NOT NULL,
      "immutableSettings" TEXT NOT NULL,
      "styleGuide" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "WritingBible_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "CharacterProfile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "identity" TEXT NOT NULL,
      "currentGoal" TEXT NOT NULL,
      "longTermGoal" TEXT NOT NULL,
      "secret" TEXT NOT NULL,
      "relationshipToProtagonist" TEXT NOT NULL,
      "attitude" TEXT NOT NULL,
      "abilityBoundary" TEXT NOT NULL,
      "voice" TEXT NOT NULL,
      "knownInformation" TEXT NOT NULL,
      "unknownInformation" TEXT NOT NULL,
      "lastAppearance" TEXT NOT NULL,
      "currentState" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "CharacterProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Foreshadowing" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "plantedChapter" TEXT NOT NULL,
      "relatedCharacters" JSON,
      "relatedLocation" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "expectedRevealChapter" TEXT NOT NULL,
      "revealMethod" TEXT NOT NULL,
      "hiddenInformation" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Foreshadowing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "PlotState" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "currentVolume" TEXT NOT NULL,
      "currentMap" TEXT NOT NULL DEFAULT '',
      "mainGoal" TEXT NOT NULL,
      "shortTermGoal" TEXT NOT NULL DEFAULT '',
      "currentStage" TEXT NOT NULL,
      "currentEnemy" TEXT NOT NULL DEFAULT '',
      "unresolvedQuestions" JSON,
      "openThreads" JSON,
      "resolvedThreads" JSON,
      "nextMilestones" JSON,
      "nextStageGoal" TEXT NOT NULL DEFAULT '',
      "powerSystemState" TEXT NOT NULL DEFAULT '',
      "mapAndForces" TEXT NOT NULL DEFAULT '',
      "resourceState" TEXT NOT NULL DEFAULT '',
      "relationshipChanges" JSON,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "PlotState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "WritingTaskCard" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "chapterNumber" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "chapterGoal" TEXT NOT NULL,
      "continuity" TEXT NOT NULL,
      "mainPlotProgress" TEXT NOT NULL,
      "requiredCharacters" JSON,
      "pleasurePoint" TEXT NOT NULL,
      "foreshadowingTasks" JSON,
      "rulesNotToBreak" JSON,
      "endingHook" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "WritingTaskCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "ChapterDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "taskCardId" TEXT NOT NULL,
      "chapterNumber" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ChapterDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ChapterDraft_taskCardId_fkey" FOREIGN KEY ("taskCardId") REFERENCES "WritingTaskCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "ChapterLedger" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "draftId" TEXT NOT NULL,
      "chapterNumber" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "events" JSON,
      "newCharacters" JSON,
      "newClues" JSON,
      "payoff" TEXT NOT NULL,
      "cliffhanger" TEXT NOT NULL,
      "stateChanges" JSON,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ChapterLedger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ChapterLedger_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ChapterDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "ReviewReport" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "draftId" TEXT NOT NULL,
      "chapterNumber" INTEGER NOT NULL,
      "overall" TEXT NOT NULL,
      "issues" JSON,
      "shouldUpdateState" INTEGER NOT NULL,
      "stateUpdateSuggestions" JSON,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ReviewReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ReviewReport_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ChapterDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "EditReport" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "draftId" TEXT,
      "mode" TEXT NOT NULL,
      "originalText" TEXT NOT NULL,
      "aiFlavorSentences" JSON,
      "diagnosis" JSON,
      "revisedText" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "EditReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "AiJob" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "projectId" TEXT,
      "type" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "input" JSON,
      "output" JSON,
      "error" TEXT,
      "attempts" INTEGER NOT NULL,
      "model" TEXT,
      "retryOfJobId" TEXT,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL,
      "startedAt" DATETIME,
      "finishedAt" DATETIME,
      CONSTRAINT "AiJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "AiSetting" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "providerName" TEXT NOT NULL,
      "baseUrl" TEXT NOT NULL,
      "apiKey" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "timeoutMs" INTEGER NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "passwordSalt" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "plan" TEXT,
      "creditsBalance" INTEGER,
      "aiBillingMarkup" REAL,
      "aiBillingMinimum" INTEGER,
      "onboardingCompletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL,
      "updatedAt" DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "createdAt" DATETIME NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "lastSeenAt" DATETIME NOT NULL,
      CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "CreditTransaction" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "balanceAfter" INTEGER NOT NULL,
      "reason" TEXT NOT NULL,
      "relatedJobId" TEXT,
      "orderId" TEXT,
      "createdAt" DATETIME NOT NULL
    );
  `);

  [
    'ALTER TABLE "Project" ADD COLUMN "ownerUserId" TEXT',
    'ALTER TABLE "Template" ADD COLUMN "ownerUserId" TEXT',
    'ALTER TABLE "User" ADD COLUMN "aiBillingMarkup" REAL',
    'ALTER TABLE "User" ADD COLUMN "aiBillingMinimum" INTEGER',
    'ALTER TABLE "AiJob" ADD COLUMN "userId" TEXT',
    'ALTER TABLE "AiSetting" ADD COLUMN "userId" TEXT',
    'ALTER TABLE "PlotState" ADD COLUMN "currentMap" TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE "PlotState" ADD COLUMN "shortTermGoal" TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE "PlotState" ADD COLUMN "currentEnemy" TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE "PlotState" ADD COLUMN "openThreads" JSON',
    'ALTER TABLE "PlotState" ADD COLUMN "resolvedThreads" JSON',
    'ALTER TABLE "PlotState" ADD COLUMN "nextStageGoal" TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE "PlotState" ADD COLUMN "powerSystemState" TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE "PlotState" ADD COLUMN "mapAndForces" TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE "PlotState" ADD COLUMN "resourceState" TEXT NOT NULL DEFAULT \'\'',
    'ALTER TABLE "PlotState" ADD COLUMN "relationshipChanges" JSON',
    'ALTER TABLE "ChapterAnalysis" ADD COLUMN "entityRelations" JSON',
    'ALTER TABLE "EditReport" ADD COLUMN "draftId" TEXT'
  ].forEach((statement) => {
    try {
      db.exec(statement);
    } catch {
      // Column already exists in an upgraded local database.
    }
  });

  db.close();
}

function asRecordArray(store: unknown, key: string) {
  if (!store || typeof store !== "object") {
    return [];
  }

  const value = (store as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function asEntityRecordArray(store: unknown, key: string) {
  if (!store || typeof store !== "object") {
    return [];
  }

  const value = (store as Record<string, unknown>)[key];

  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }

  if (value && typeof value === "object") {
    return [value as Record<string, unknown>];
  }

  return [];
}

function asObject(store: unknown, key: string) {
  if (!store || typeof store !== "object") {
    return null;
  }

  const value = (store as Record<string, unknown>)[key];
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function recordIdentity(entityType: string, item: Record<string, unknown>, index: number) {
  return text(item.id) || text(item.userId) || `${entityType}:${index}`;
}

function recordUserId(item: Record<string, unknown>) {
  return nullableText(item.userId) ?? nullableText(item.ownerUserId);
}

async function syncPostgresStoreRecords(sql: PostgresClient, store: unknown) {
  await ensurePostgresSchema(sql);
  await sql.begin(async (transaction) => {
    await transaction`DELETE FROM "StoreRecord"`;

    for (const entityType of STORE_RECORD_ENTITY_KEYS) {
      const items = asEntityRecordArray(store, entityType);

      for (const [index, item] of items.entries()) {
        const id = `${entityType}:${recordIdentity(entityType, item, index)}`;
        const payload = JSON.stringify(item);

        await transaction`
          INSERT INTO "StoreRecord" (
            "id", "entityType", "userId", "ownerUserId", "projectId", "payload"
          )
          VALUES (
            ${id},
            ${entityType},
            ${recordUserId(item)},
            ${nullableText(item.ownerUserId)},
            ${nullableText(item.projectId) ?? nullableText(item.sourceProjectId)},
            ${payload}::jsonb
          )
          ON CONFLICT ("id") DO UPDATE SET
            "entityType" = EXCLUDED."entityType",
            "userId" = EXCLUDED."userId",
            "ownerUserId" = EXCLUDED."ownerUserId",
            "projectId" = EXCLUDED."projectId",
            "payload" = EXCLUDED."payload",
            "updatedAt" = now()
        `;
      }
    }
  });
}

function parseStoreRecordPayload(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function buildStoreFromEntityRecords<T>(
  fallback: T,
  records: Array<{ entityType?: string; payload?: unknown }>
) {
  if (records.length === 0) {
    return null;
  }

  const nextStore: Record<string, unknown> = { ...(fallback as Record<string, unknown>) };

  for (const key of STORE_RECORD_ENTITY_KEYS) {
    const payloads = records
      .filter((record) => record.entityType === key)
      .map((record) => parseStoreRecordPayload(record.payload))
      .filter((payload): payload is Record<string, unknown> => Boolean(payload));

    if (key === "aiSettings") {
      nextStore.aiSettings = payloads.length <= 1 ? payloads[0] : payloads;
    } else {
      nextStore[key] = payloads;
    }
  }

  return nextStore as T;
}

async function readStoreRecordsFromPostgres<T>(
  sql: PostgresClient,
  fallback: T
) {
  await ensurePostgresSchema(sql);
  const records = await sql`
    SELECT "entityType", "payload"
    FROM "StoreRecord"
    ORDER BY "entityType", "createdAt", "id"
  ` as Array<{ entityType?: string; payload?: unknown }>;

  return buildStoreFromEntityRecords(fallback, records);
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function nullableText(value: unknown) {
  return value == null || value === "" ? null : String(value);
}

function existingText(value: unknown, allowed: Set<string>) {
  const candidate = nullableText(value);
  return candidate && allowed.has(candidate) ? candidate : null;
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateText(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function jsonText(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function syncCoreTables(store: unknown) {
  const sqlitePath = resolveSqliteFilePath();

  if (!sqlitePath) {
    return;
  }

  ensureSqliteSchema();
  const db = new Database(sqlitePath);

  const projects = asRecordArray(store, "projects");
  const users = asRecordArray(store, "users");
  const sessions = asRecordArray(store, "sessions");
  const sourceTexts = asRecordArray(store, "sourceTexts");
  const chapters = asRecordArray(store, "chapters");
  const chapterAnalyses = asRecordArray(store, "chapterAnalyses");
  const storyAnalyses = asRecordArray(store, "storyAnalyses");
  const templates = asRecordArray(store, "templates");
  const outlines = asRecordArray(store, "outlines");
  const writingBibles = asRecordArray(store, "writingBibles");
  const characterProfiles = asRecordArray(store, "characterProfiles");
  const foreshadowings = asRecordArray(store, "foreshadowings");
  const plotStates = asRecordArray(store, "plotStates");
  const writingTaskCards = asRecordArray(store, "writingTaskCards");
  const chapterDrafts = asRecordArray(store, "chapterDrafts");
  const chapterLedgers = asRecordArray(store, "chapterLedgers");
  const reviewReports = asRecordArray(store, "reviewReports");
  const editReports = asRecordArray(store, "editReports");
  const aiJobs = asRecordArray(store, "aiJobs");
  const creditTransactions = asRecordArray(store, "creditTransactions");
  const aiSettings = asEntityRecordArray(store, "aiSettings");
  const projectIds = new Set(projects.map((project) => text(project.id)));
  const storyAnalysisIds = new Set(storyAnalyses.map((analysis) => text(analysis.id)));

  const sync = db.transaction(() => {
    db.prepare('DELETE FROM "ReviewReport"').run();
    db.prepare('DELETE FROM "ChapterLedger"').run();
    db.prepare('DELETE FROM "ChapterDraft"').run();
    db.prepare('DELETE FROM "WritingTaskCard"').run();
    db.prepare('DELETE FROM "PlotState"').run();
    db.prepare('DELETE FROM "Foreshadowing"').run();
    db.prepare('DELETE FROM "CharacterProfile"').run();
    db.prepare('DELETE FROM "WritingBible"').run();
    db.prepare('DELETE FROM "Outline"').run();
    db.prepare('DELETE FROM "Template"').run();
    db.prepare('DELETE FROM "StoryAnalysis"').run();
    db.prepare('DELETE FROM "ChapterAnalysis"').run();
    db.prepare('DELETE FROM "Chapter"').run();
    db.prepare('DELETE FROM "SourceText"').run();
    db.prepare('DELETE FROM "AiJob"').run();
    db.prepare('DELETE FROM "EditReport"').run();
    db.prepare('DELETE FROM "Project"').run();
    db.prepare('DELETE FROM "AiSetting"').run();
    db.prepare('DELETE FROM "CreditTransaction"').run();
    db.prepare('DELETE FROM "Session"').run();
    db.prepare('DELETE FROM "User"').run();

    const insertUser = db.prepare(`
      INSERT INTO "User" (
        "id", "email", "name", "passwordSalt", "passwordHash", "role", "plan", "creditsBalance", "aiBillingMarkup", "aiBillingMinimum", "onboardingCompletedAt", "createdAt", "updatedAt"
      ) VALUES (
        @id, @email, @name, @passwordSalt, @passwordHash, @role, @plan, @creditsBalance, @aiBillingMarkup, @aiBillingMinimum, @onboardingCompletedAt, @createdAt, @updatedAt
      )
    `);

    users.forEach((user) => {
      insertUser.run({
        id: text(user.id),
        email: text(user.email),
        name: text(user.name),
        passwordSalt: text(user.passwordSalt),
        passwordHash: text(user.passwordHash),
        role: text(user.role),
        plan: nullableText(user.plan),
        creditsBalance: integer(user.creditsBalance),
        aiBillingMarkup: user.aiBillingMarkup == null ? null : Number(user.aiBillingMarkup),
        aiBillingMinimum: user.aiBillingMinimum == null ? null : integer(user.aiBillingMinimum),
        onboardingCompletedAt: user.onboardingCompletedAt ? dateText(user.onboardingCompletedAt) : null,
        createdAt: dateText(user.createdAt),
        updatedAt: dateText(user.updatedAt)
      });
    });

    const insertSession = db.prepare(`
      INSERT INTO "Session" (
        "id", "userId", "token", "createdAt", "expiresAt", "lastSeenAt"
      ) VALUES (
        @id, @userId, @token, @createdAt, @expiresAt, @lastSeenAt
      )
    `);

    sessions.forEach((session) => {
      insertSession.run({
        id: text(session.id),
        userId: text(session.userId),
        token: text(session.token),
        createdAt: dateText(session.createdAt),
        expiresAt: dateText(session.expiresAt),
        lastSeenAt: dateText(session.lastSeenAt)
      });
    });

    const insertProject = db.prepare(`
      INSERT INTO "Project" (
        "id", "ownerUserId", "name", "type", "description", "genre", "status", "createdAt", "updatedAt"
      ) VALUES (
        @id, @ownerUserId, @name, @type, @description, @genre, @status, @createdAt, @updatedAt
      )
    `);

    projects.forEach((project) => {
      insertProject.run({
        id: text(project.id),
        ownerUserId: nullableText(project.ownerUserId),
        name: text(project.name),
        type: text(project.type),
        description: text(project.description),
        genre: text(project.genre),
        status: text(project.status),
        createdAt: dateText(project.createdAt),
        updatedAt: dateText(project.updatedAt)
      });
    });

    const insertSourceText = db.prepare(`
      INSERT INTO "SourceText" (
        "id", "projectId", "title", "content", "sourceType", "charCount", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @title, @content, @sourceType, @charCount, @createdAt, @updatedAt
      )
    `);

    sourceTexts.forEach((sourceText) => {
      insertSourceText.run({
        id: text(sourceText.id),
        projectId: text(sourceText.projectId),
        title: text(sourceText.title),
        content: text(sourceText.content),
        sourceType: text(sourceText.sourceType),
        charCount: integer(sourceText.charCount),
        createdAt: dateText(sourceText.createdAt),
        updatedAt: dateText(sourceText.updatedAt)
      });
    });

    const insertChapter = db.prepare(`
      INSERT INTO "Chapter" (
        "id", "projectId", "sourceTextId", "chapterNumber", "title", "content", "charCount", "orderIndex", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @sourceTextId, @chapterNumber, @title, @content, @charCount, @orderIndex, @createdAt, @updatedAt
      )
    `);

    chapters.forEach((chapter) => {
      insertChapter.run({
        id: text(chapter.id),
        projectId: text(chapter.projectId),
        sourceTextId: text(chapter.sourceTextId),
        chapterNumber: integer(chapter.chapterNumber),
        title: text(chapter.title),
        content: text(chapter.content),
        charCount: integer(chapter.charCount),
        orderIndex: integer(chapter.orderIndex),
        createdAt: dateText(chapter.createdAt),
        updatedAt: dateText(chapter.updatedAt)
      });
    });

    const insertChapterAnalysis = db.prepare(`
      INSERT INTO "ChapterAnalysis" (
        "id", "projectId", "chapterId", "summary", "mainEvent", "conflict", "pressurePoint", "payoff", "cliffhanger", "readerHook", "newInformation", "newCharacters", "stateChanges", "entityRelations", "pleasurePoints", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @chapterId, @summary, @mainEvent, @conflict, @pressurePoint, @payoff, @cliffhanger, @readerHook, @newInformation, @newCharacters, @stateChanges, @entityRelations, @pleasurePoints, @createdAt, @updatedAt
      )
    `);

    chapterAnalyses.forEach((analysis) => {
      insertChapterAnalysis.run({
        id: text(analysis.id),
        projectId: text(analysis.projectId),
        chapterId: text(analysis.chapterId),
        summary: text(analysis.summary),
        mainEvent: text(analysis.mainEvent),
        conflict: text(analysis.conflict),
        pressurePoint: text(analysis.pressurePoint),
        payoff: text(analysis.payoff),
        cliffhanger: text(analysis.cliffhanger),
        readerHook: text(analysis.readerHook),
        newInformation: jsonText(analysis.newInformation),
        newCharacters: jsonText(analysis.newCharacters),
        stateChanges: jsonText(analysis.stateChanges),
        entityRelations: jsonText(analysis.entityRelations),
        pleasurePoints: jsonText(analysis.pleasurePoints),
        createdAt: dateText(analysis.createdAt),
        updatedAt: dateText(analysis.updatedAt)
      });
    });

    const insertStoryAnalysis = db.prepare(`
      INSERT INTO "StoryAnalysis" (
        "id", "projectId", "genre", "protagonistModel", "openingModel", "goldenFingerMechanism", "villainFunction", "supportingRoles", "mapProgression", "usablePatterns", "avoidCopying", "openingHook", "mainLoop", "pacing", "topPleasureTypes", "formula", "migrationAdvice", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @genre, @protagonistModel, @openingModel, @goldenFingerMechanism, @villainFunction, @supportingRoles, @mapProgression, @usablePatterns, @avoidCopying, @openingHook, @mainLoop, @pacing, @topPleasureTypes, @formula, @migrationAdvice, @createdAt, @updatedAt
      )
    `);

    storyAnalyses.forEach((analysis) => {
      insertStoryAnalysis.run({
        id: text(analysis.id),
        projectId: text(analysis.projectId),
        genre: text(analysis.genre),
        protagonistModel: text(analysis.protagonistModel),
        openingModel: text(analysis.openingModel),
        goldenFingerMechanism: text(analysis.goldenFingerMechanism),
        villainFunction: text(analysis.villainFunction),
        supportingRoles: text(analysis.supportingRoles),
        mapProgression: text(analysis.mapProgression),
        usablePatterns: jsonText(analysis.usablePatterns),
        avoidCopying: jsonText(analysis.avoidCopying),
        openingHook: text(analysis.openingHook),
        mainLoop: text(analysis.mainLoop),
        pacing: text(analysis.pacing),
        topPleasureTypes: jsonText(analysis.topPleasureTypes),
        formula: text(analysis.formula),
        migrationAdvice: text(analysis.migrationAdvice),
        createdAt: dateText(analysis.createdAt),
        updatedAt: dateText(analysis.updatedAt)
      });
    });

    const insertTemplate = db.prepare(`
      INSERT INTO "Template" (
        "id", "ownerUserId", "sourceProjectId", "sourceStoryAnalysisId", "name", "genre", "description", "openingHook", "mainLoop", "chapterPacing", "formula", "migrationAdvice", "protagonistModel", "goldenFinger", "usablePatterns", "avoidCopying", "tags", "createdAt", "updatedAt"
      ) VALUES (
        @id, @ownerUserId, @sourceProjectId, @sourceStoryAnalysisId, @name, @genre, @description, @openingHook, @mainLoop, @chapterPacing, @formula, @migrationAdvice, @protagonistModel, @goldenFinger, @usablePatterns, @avoidCopying, @tags, @createdAt, @updatedAt
      )
    `);

    templates.forEach((template) => {
      insertTemplate.run({
        id: text(template.id),
        ownerUserId: nullableText(template.ownerUserId),
        sourceProjectId: existingText(template.sourceProjectId, projectIds),
        sourceStoryAnalysisId: existingText(template.sourceStoryAnalysisId, storyAnalysisIds),
        name: text(template.name),
        genre: text(template.genre),
        description: text(template.description),
        openingHook: text(template.openingHook),
        mainLoop: text(template.mainLoop),
        chapterPacing: text(template.chapterPacing),
        formula: text(template.formula),
        migrationAdvice: text(template.migrationAdvice),
        protagonistModel: text(template.protagonistModel),
        goldenFinger: text(template.goldenFinger),
        usablePatterns: jsonText(template.usablePatterns),
        avoidCopying: jsonText(template.avoidCopying),
        tags: jsonText(template.tags),
        createdAt: dateText(template.createdAt),
        updatedAt: dateText(template.updatedAt)
      });
    });

    const insertOutline = db.prepare(`
      INSERT INTO "Outline" (
        "id", "templateId", "variables", "titleOptions", "logline", "intro", "templateInheritance", "variableMapping", "coreSellingPoints", "worldSetting", "protagonist", "characters", "first10Chapters", "first100Pacing", "foreshadowingPlan", "pleasureDistribution", "createdAt", "updatedAt"
      ) VALUES (
        @id, @templateId, @variables, @titleOptions, @logline, @intro, @templateInheritance, @variableMapping, @coreSellingPoints, @worldSetting, @protagonist, @characters, @first10Chapters, @first100Pacing, @foreshadowingPlan, @pleasureDistribution, @createdAt, @updatedAt
      )
    `);

    outlines.forEach((outline) => {
      insertOutline.run({
        id: text(outline.id),
        templateId: text(outline.templateId),
        variables: jsonText(outline.variables),
        titleOptions: jsonText(outline.titleOptions),
        logline: text(outline.logline),
        intro: text(outline.intro),
        templateInheritance: jsonText(outline.templateInheritance),
        variableMapping: jsonText(outline.variableMapping),
        coreSellingPoints: jsonText(outline.coreSellingPoints),
        worldSetting: text(outline.worldSetting),
        protagonist: text(outline.protagonist),
        characters: jsonText(outline.characters),
        first10Chapters: jsonText(outline.first10Chapters),
        first100Pacing: text(outline.first100Pacing),
        foreshadowingPlan: jsonText(outline.foreshadowingPlan),
        pleasureDistribution: text(outline.pleasureDistribution),
        createdAt: dateText(outline.createdAt),
        updatedAt: dateText(outline.updatedAt)
      });
    });

    const insertWritingBible = db.prepare(`
      INSERT INTO "WritingBible" (
        "id", "projectId", "workType", "targetReader", "corePleasure", "protagonistDesire", "worldRules", "goldenFingerRules", "powerSystem", "narrativeTaboos", "immutableSettings", "styleGuide", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @workType, @targetReader, @corePleasure, @protagonistDesire, @worldRules, @goldenFingerRules, @powerSystem, @narrativeTaboos, @immutableSettings, @styleGuide, @createdAt, @updatedAt
      )
    `);

    writingBibles.forEach((bible) => {
      insertWritingBible.run({
        id: text(bible.id),
        projectId: text(bible.projectId),
        workType: text(bible.workType),
        targetReader: text(bible.targetReader),
        corePleasure: text(bible.corePleasure),
        protagonistDesire: text(bible.protagonistDesire),
        worldRules: text(bible.worldRules),
        goldenFingerRules: text(bible.goldenFingerRules),
        powerSystem: text(bible.powerSystem),
        narrativeTaboos: text(bible.narrativeTaboos),
        immutableSettings: text(bible.immutableSettings),
        styleGuide: text(bible.styleGuide),
        createdAt: dateText(bible.createdAt),
        updatedAt: dateText(bible.updatedAt)
      });
    });

    const insertCharacterProfile = db.prepare(`
      INSERT INTO "CharacterProfile" (
        "id", "projectId", "name", "identity", "currentGoal", "longTermGoal", "secret", "relationshipToProtagonist", "attitude", "abilityBoundary", "voice", "knownInformation", "unknownInformation", "lastAppearance", "currentState", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @name, @identity, @currentGoal, @longTermGoal, @secret, @relationshipToProtagonist, @attitude, @abilityBoundary, @voice, @knownInformation, @unknownInformation, @lastAppearance, @currentState, @createdAt, @updatedAt
      )
    `);

    characterProfiles.forEach((character) => {
      insertCharacterProfile.run({
        id: text(character.id),
        projectId: text(character.projectId),
        name: text(character.name),
        identity: text(character.identity),
        currentGoal: text(character.currentGoal),
        longTermGoal: text(character.longTermGoal),
        secret: text(character.secret),
        relationshipToProtagonist: text(character.relationshipToProtagonist),
        attitude: text(character.attitude),
        abilityBoundary: text(character.abilityBoundary),
        voice: text(character.voice),
        knownInformation: text(character.knownInformation),
        unknownInformation: text(character.unknownInformation),
        lastAppearance: text(character.lastAppearance),
        currentState: text(character.currentState),
        createdAt: dateText(character.createdAt),
        updatedAt: dateText(character.updatedAt)
      });
    });

    const insertForeshadowing = db.prepare(`
      INSERT INTO "Foreshadowing" (
        "id", "projectId", "name", "plantedChapter", "relatedCharacters", "relatedLocation", "status", "expectedRevealChapter", "revealMethod", "hiddenInformation", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @name, @plantedChapter, @relatedCharacters, @relatedLocation, @status, @expectedRevealChapter, @revealMethod, @hiddenInformation, @createdAt, @updatedAt
      )
    `);

    foreshadowings.forEach((item) => {
      insertForeshadowing.run({
        id: text(item.id),
        projectId: text(item.projectId),
        name: text(item.name),
        plantedChapter: text(item.plantedChapter),
        relatedCharacters: jsonText(item.relatedCharacters),
        relatedLocation: text(item.relatedLocation),
        status: text(item.status),
        expectedRevealChapter: text(item.expectedRevealChapter),
        revealMethod: text(item.revealMethod),
        hiddenInformation: text(item.hiddenInformation),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      });
    });

    const insertPlotState = db.prepare(`
      INSERT INTO "PlotState" (
        "id", "projectId", "currentVolume", "currentMap", "mainGoal", "shortTermGoal", "currentStage", "currentEnemy", "unresolvedQuestions", "openThreads", "resolvedThreads", "nextMilestones", "nextStageGoal", "powerSystemState", "mapAndForces", "resourceState", "relationshipChanges", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @currentVolume, @currentMap, @mainGoal, @shortTermGoal, @currentStage, @currentEnemy, @unresolvedQuestions, @openThreads, @resolvedThreads, @nextMilestones, @nextStageGoal, @powerSystemState, @mapAndForces, @resourceState, @relationshipChanges, @createdAt, @updatedAt
      )
    `);

    plotStates.forEach((item) => {
      insertPlotState.run({
        id: text(item.id),
        projectId: text(item.projectId),
        currentVolume: text(item.currentVolume),
        currentMap: text(item.currentMap),
        mainGoal: text(item.mainGoal),
        shortTermGoal: text(item.shortTermGoal),
        currentStage: text(item.currentStage),
        currentEnemy: text(item.currentEnemy),
        unresolvedQuestions: jsonText(item.unresolvedQuestions),
        openThreads: jsonText(item.openThreads),
        resolvedThreads: jsonText(item.resolvedThreads),
        nextMilestones: jsonText(item.nextMilestones),
        nextStageGoal: text(item.nextStageGoal),
        powerSystemState: text(item.powerSystemState),
        mapAndForces: text(item.mapAndForces),
        resourceState: text(item.resourceState),
        relationshipChanges: jsonText(item.relationshipChanges),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      });
    });

    const insertWritingTaskCard = db.prepare(`
      INSERT INTO "WritingTaskCard" (
        "id", "projectId", "chapterNumber", "title", "chapterGoal", "continuity", "mainPlotProgress", "requiredCharacters", "pleasurePoint", "foreshadowingTasks", "rulesNotToBreak", "endingHook", "status", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @chapterNumber, @title, @chapterGoal, @continuity, @mainPlotProgress, @requiredCharacters, @pleasurePoint, @foreshadowingTasks, @rulesNotToBreak, @endingHook, @status, @createdAt, @updatedAt
      )
    `);

    writingTaskCards.forEach((item) => {
      insertWritingTaskCard.run({
        id: text(item.id),
        projectId: text(item.projectId),
        chapterNumber: integer(item.chapterNumber),
        title: text(item.title),
        chapterGoal: text(item.chapterGoal),
        continuity: text(item.continuity),
        mainPlotProgress: text(item.mainPlotProgress),
        requiredCharacters: jsonText(item.requiredCharacters),
        pleasurePoint: text(item.pleasurePoint),
        foreshadowingTasks: jsonText(item.foreshadowingTasks),
        rulesNotToBreak: jsonText(item.rulesNotToBreak),
        endingHook: text(item.endingHook),
        status: text(item.status),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      });
    });

    const insertChapterDraft = db.prepare(`
      INSERT INTO "ChapterDraft" (
        "id", "projectId", "taskCardId", "chapterNumber", "title", "content", "status", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @taskCardId, @chapterNumber, @title, @content, @status, @createdAt, @updatedAt
      )
    `);

    chapterDrafts.forEach((item) => {
      insertChapterDraft.run({
        id: text(item.id),
        projectId: text(item.projectId),
        taskCardId: text(item.taskCardId),
        chapterNumber: integer(item.chapterNumber),
        title: text(item.title),
        content: text(item.content),
        status: text(item.status),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      });
    });

    const insertChapterLedger = db.prepare(`
      INSERT INTO "ChapterLedger" (
        "id", "projectId", "draftId", "chapterNumber", "title", "events", "newCharacters", "newClues", "payoff", "cliffhanger", "stateChanges", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @draftId, @chapterNumber, @title, @events, @newCharacters, @newClues, @payoff, @cliffhanger, @stateChanges, @createdAt, @updatedAt
      )
    `);

    chapterLedgers.forEach((item) => {
      insertChapterLedger.run({
        id: text(item.id),
        projectId: text(item.projectId),
        draftId: text(item.draftId),
        chapterNumber: integer(item.chapterNumber),
        title: text(item.title),
        events: jsonText(item.events),
        newCharacters: jsonText(item.newCharacters),
        newClues: jsonText(item.newClues),
        payoff: text(item.payoff),
        cliffhanger: text(item.cliffhanger),
        stateChanges: jsonText(item.stateChanges),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      });
    });

    const insertReviewReport = db.prepare(`
      INSERT INTO "ReviewReport" (
        "id", "projectId", "draftId", "chapterNumber", "overall", "issues", "shouldUpdateState", "stateUpdateSuggestions", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @draftId, @chapterNumber, @overall, @issues, @shouldUpdateState, @stateUpdateSuggestions, @createdAt, @updatedAt
      )
    `);

    reviewReports.forEach((item) => {
      insertReviewReport.run({
        id: text(item.id),
        projectId: text(item.projectId),
        draftId: text(item.draftId),
        chapterNumber: integer(item.chapterNumber),
        overall: text(item.overall),
        issues: jsonText(item.issues),
        shouldUpdateState: item.shouldUpdateState ? 1 : 0,
        stateUpdateSuggestions: jsonText(item.stateUpdateSuggestions),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      });
    });

    const insertEditReport = db.prepare(`
      INSERT INTO "EditReport" (
        "id", "projectId", "draftId", "mode", "originalText", "aiFlavorSentences", "diagnosis", "revisedText", "createdAt", "updatedAt"
      ) VALUES (
        @id, @projectId, @draftId, @mode, @originalText, @aiFlavorSentences, @diagnosis, @revisedText, @createdAt, @updatedAt
      )
    `);

    editReports.forEach((item) => {
      insertEditReport.run({
        id: text(item.id),
        projectId: text(item.projectId),
        draftId: item.draftId ? text(item.draftId) : null,
        mode: text(item.mode),
        originalText: text(item.originalText),
        aiFlavorSentences: jsonText(item.aiFlavorSentences),
        diagnosis: jsonText(item.diagnosis),
        revisedText: text(item.revisedText),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      });
    });

    const insertAiJob = db.prepare(`
      INSERT INTO "AiJob" (
        "id", "userId", "projectId", "type", "status", "input", "output", "error", "attempts", "model", "retryOfJobId", "createdAt", "updatedAt", "startedAt", "finishedAt"
      ) VALUES (
        @id, @userId, @projectId, @type, @status, @input, @output, @error, @attempts, @model, @retryOfJobId, @createdAt, @updatedAt, @startedAt, @finishedAt
      )
    `);

    aiJobs.forEach((job) => {
      insertAiJob.run({
        id: text(job.id),
        userId: nullableText(job.userId),
        projectId: nullableText(job.projectId),
        type: text(job.type),
        status: text(job.status),
        input: jsonText(job.input),
        output: jsonText(job.output),
        error: nullableText(job.error),
        attempts: integer(job.attempts),
        model: nullableText(job.model),
        retryOfJobId: nullableText(job.retryOfJobId),
        createdAt: dateText(job.createdAt),
        updatedAt: dateText(job.updatedAt),
        startedAt: job.startedAt ? dateText(job.startedAt) : null,
        finishedAt: job.finishedAt ? dateText(job.finishedAt) : null
      });
    });

    const insertAiSetting = db.prepare(`
        INSERT INTO "AiSetting" (
          "id", "userId", "providerName", "baseUrl", "apiKey", "model", "timeoutMs", "updatedAt"
        ) VALUES (
          @id, @userId, @providerName, @baseUrl, @apiKey, @model, @timeoutMs, @updatedAt
        )
      `);

    aiSettings.forEach((settings, index) => {
      insertAiSetting.run({
        id: text(settings.userId) || text(settings.id) || `${DEFAULT_STATE_ID}:${index}`,
        userId: nullableText(settings.userId),
        providerName: text(settings.providerName),
        baseUrl: text(settings.baseUrl),
        apiKey: text(settings.apiKey),
        model: text(settings.model),
        timeoutMs: integer(settings.timeoutMs),
        updatedAt: dateText(settings.updatedAt)
      });
    });

    const insertCreditTransaction = db.prepare(`
      INSERT INTO "CreditTransaction" (
        "id", "userId", "type", "amount", "balanceAfter", "reason", "relatedJobId", "orderId", "createdAt"
      ) VALUES (
        @id, @userId, @type, @amount, @balanceAfter, @reason, @relatedJobId, @orderId, @createdAt
      )
    `);

    creditTransactions.forEach((transaction) => {
      insertCreditTransaction.run({
        id: text(transaction.id),
        userId: text(transaction.userId),
        type: text(transaction.type),
        amount: integer(transaction.amount),
        balanceAfter: integer(transaction.balanceAfter),
        reason: text(transaction.reason),
        relatedJobId: nullableText(transaction.relatedJobId),
        orderId: nullableText(transaction.orderId),
        createdAt: dateText(transaction.createdAt)
      });
    });
  });

  try {
    sync();
  } finally {
    db.close();
  }
}

async function readStoreFile<T>(storePath: string, fallback: T) {
  try {
    const raw = await readFile(storePath, "utf8");
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

function readAppStateFromSqlite<T>(fallback: T) {
  const sqlitePath = resolveSqliteFilePath();

  if (!sqlitePath) {
    return null;
  }

  ensureSqliteSchema();
  const db = new Database(sqlitePath, { readonly: true });

  try {
    const row = db
      .prepare('SELECT "payload" FROM "AppState" WHERE "id" = ? LIMIT 1')
      .get(DEFAULT_STATE_ID) as { payload?: string } | undefined;

    if (!row?.payload) {
      return null;
    }

    return { ...fallback, ...(JSON.parse(row.payload) as Partial<T>) } as T;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function upsertAppStateInSqlite(payload: string) {
  const sqlitePath = resolveSqliteFilePath();

  if (!sqlitePath) {
    return;
  }

  ensureSqliteSchema();
  const db = new Database(sqlitePath);

  try {
    db.prepare(`
      INSERT INTO "AppState" ("id", "payload")
      VALUES (@id, @payload)
      ON CONFLICT("id") DO UPDATE SET
        "payload" = excluded."payload",
        "updatedAt" = CURRENT_TIMESTAMP
    `).run({
      id: DEFAULT_STATE_ID,
      payload
    });
  } finally {
    db.close();
  }
}

async function readAppStateFromPostgres<T>(
  sql: PostgresClient,
  fallback: T
) {
  await ensurePostgresSchema(sql);
  const rows = await sql`
    SELECT "payload"
    FROM "AppState"
    WHERE "id" = ${DEFAULT_STATE_ID}
    LIMIT 1
  ` as Array<{ payload?: string }>;
  const payload = rows[0]?.payload;

  if (!payload) {
    return null;
  }

  try {
    return { ...fallback, ...(JSON.parse(payload) as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

async function upsertAppStateInPostgres(
  sql: PostgresClient,
  payload: string
) {
  await ensurePostgresSchema(sql);
  await sql`
    INSERT INTO "AppState" ("id", "payload")
    VALUES (${DEFAULT_STATE_ID}, ${payload})
    ON CONFLICT ("id") DO UPDATE SET
      "payload" = EXCLUDED."payload",
      "updatedAt" = now()
  `;
}

async function ensureDataDir(storePath: string) {
  await mkdir(path.dirname(storePath), { recursive: true }).catch(() => {
    // Fallback path handling is intentionally best-effort.
  });
}

function rows<T extends Record<string, unknown>>(db: Database.Database, tableName: string) {
  return db.prepare(`SELECT * FROM "${tableName}"`).all() as T[];
}

function maybeString(value: unknown) {
  return value == null ? undefined : String(value);
}

function parseJsonValue(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonArray(value: unknown) {
  const parsed = parseJsonValue(value);
  return Array.isArray(parsed) ? parsed : [];
}

function parseJsonObject(value: unknown) {
  const parsed = parseJsonValue(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function readCoreStoreFromDb<T>(fallback: T) {
  const sqlitePath = resolveSqliteFilePath();

  if (!sqlitePath) {
    return null;
  }

  ensureSqliteSchema();
  const db = new Database(sqlitePath, { readonly: true });

  try {
    const coreRowCount = [
      "Project",
      "SourceText",
      "Chapter",
      "ChapterAnalysis",
      "StoryAnalysis",
      "Template",
      "Outline",
      "WritingBible",
      "CharacterProfile",
      "Foreshadowing",
      "PlotState",
      "WritingTaskCard",
      "ChapterDraft",
      "ChapterLedger",
      "ReviewReport",
      "EditReport",
      "AiJob",
      "AiSetting",
      "User",
      "Session",
      "CreditTransaction"
    ].reduce((total, tableName) => {
      const row = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as
        | { count: number | string }
        | undefined;

      return total + Number(row?.count ?? 0);
    }, 0);

    if (coreRowCount === 0) {
      return null;
    }

    const aiSettingRows = rows<Record<string, unknown>>(db, "AiSetting");

    return {
      ...fallback,
      projects: rows(db, "Project").map((item) => ({
        id: text(item.id),
        ownerUserId: maybeString(item.ownerUserId),
        name: text(item.name),
        type: text(item.type),
        description: text(item.description),
        genre: text(item.genre),
        status: text(item.status),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      sourceTexts: rows(db, "SourceText").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        title: text(item.title),
        content: text(item.content),
        sourceType: text(item.sourceType),
        charCount: integer(item.charCount),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      chapters: rows(db, "Chapter").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        sourceTextId: text(item.sourceTextId),
        chapterNumber: integer(item.chapterNumber),
        title: text(item.title),
        content: text(item.content),
        charCount: integer(item.charCount),
        orderIndex: integer(item.orderIndex),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      chapterAnalyses: rows(db, "ChapterAnalysis").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        chapterId: text(item.chapterId),
        summary: text(item.summary),
        mainEvent: text(item.mainEvent),
        conflict: text(item.conflict),
        pressurePoint: text(item.pressurePoint),
        payoff: text(item.payoff),
        cliffhanger: text(item.cliffhanger),
        readerHook: text(item.readerHook),
        newInformation: parseJsonArray(item.newInformation),
        newCharacters: parseJsonArray(item.newCharacters),
        stateChanges: parseJsonArray(item.stateChanges),
        entityRelations: parseJsonArray(item.entityRelations),
        pleasurePoints: parseJsonArray(item.pleasurePoints),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      storyAnalyses: rows(db, "StoryAnalysis").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        genre: text(item.genre),
        protagonistModel: text(item.protagonistModel),
        openingModel: text(item.openingModel),
        goldenFingerMechanism: text(item.goldenFingerMechanism),
        villainFunction: text(item.villainFunction),
        supportingRoles: text(item.supportingRoles),
        mapProgression: text(item.mapProgression),
        usablePatterns: parseJsonArray(item.usablePatterns),
        avoidCopying: parseJsonArray(item.avoidCopying),
        openingHook: text(item.openingHook),
        mainLoop: text(item.mainLoop),
        pacing: text(item.pacing),
        topPleasureTypes: parseJsonArray(item.topPleasureTypes),
        formula: text(item.formula),
        migrationAdvice: text(item.migrationAdvice),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      templates: rows(db, "Template").map((item) => ({
        id: text(item.id),
        ownerUserId: maybeString(item.ownerUserId),
        sourceProjectId: maybeString(item.sourceProjectId),
        sourceStoryAnalysisId: maybeString(item.sourceStoryAnalysisId),
        name: text(item.name),
        genre: text(item.genre),
        description: text(item.description),
        openingHook: text(item.openingHook),
        mainLoop: text(item.mainLoop),
        chapterPacing: text(item.chapterPacing),
        formula: text(item.formula),
        migrationAdvice: text(item.migrationAdvice),
        protagonistModel: text(item.protagonistModel),
        goldenFinger: text(item.goldenFinger),
        usablePatterns: parseJsonArray(item.usablePatterns),
        avoidCopying: parseJsonArray(item.avoidCopying),
        tags: parseJsonArray(item.tags),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      outlines: rows(db, "Outline").map((item) => ({
        id: text(item.id),
        templateId: text(item.templateId),
        variables: parseJsonObject(item.variables),
        titleOptions: parseJsonArray(item.titleOptions),
        logline: text(item.logline),
        intro: text(item.intro),
        templateInheritance: parseJsonArray(item.templateInheritance),
        variableMapping: parseJsonArray(item.variableMapping),
        coreSellingPoints: parseJsonArray(item.coreSellingPoints),
        worldSetting: text(item.worldSetting),
        protagonist: text(item.protagonist),
        characters: parseJsonArray(item.characters),
        first10Chapters: parseJsonArray(item.first10Chapters),
        first100Pacing: text(item.first100Pacing),
        foreshadowingPlan: parseJsonArray(item.foreshadowingPlan),
        pleasureDistribution: text(item.pleasureDistribution),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      writingBibles: rows(db, "WritingBible").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        workType: text(item.workType),
        targetReader: text(item.targetReader),
        corePleasure: text(item.corePleasure),
        protagonistDesire: text(item.protagonistDesire),
        worldRules: text(item.worldRules),
        goldenFingerRules: text(item.goldenFingerRules),
        powerSystem: text(item.powerSystem),
        narrativeTaboos: text(item.narrativeTaboos),
        immutableSettings: text(item.immutableSettings),
        styleGuide: text(item.styleGuide),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      characterProfiles: rows(db, "CharacterProfile").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        name: text(item.name),
        identity: text(item.identity),
        currentGoal: text(item.currentGoal),
        longTermGoal: text(item.longTermGoal),
        secret: text(item.secret),
        relationshipToProtagonist: text(item.relationshipToProtagonist),
        attitude: text(item.attitude),
        abilityBoundary: text(item.abilityBoundary),
        voice: text(item.voice),
        knownInformation: text(item.knownInformation),
        unknownInformation: text(item.unknownInformation),
        lastAppearance: text(item.lastAppearance),
        currentState: text(item.currentState),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      foreshadowings: rows(db, "Foreshadowing").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        name: text(item.name),
        plantedChapter: text(item.plantedChapter),
        relatedCharacters: parseJsonArray(item.relatedCharacters),
        relatedLocation: text(item.relatedLocation),
        status: text(item.status),
        expectedRevealChapter: text(item.expectedRevealChapter),
        revealMethod: text(item.revealMethod),
        hiddenInformation: text(item.hiddenInformation),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      plotStates: rows(db, "PlotState").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        currentVolume: text(item.currentVolume),
        currentMap: text(item.currentMap),
        mainGoal: text(item.mainGoal),
        shortTermGoal: text(item.shortTermGoal),
        currentStage: text(item.currentStage),
        currentEnemy: text(item.currentEnemy),
        unresolvedQuestions: parseJsonArray(item.unresolvedQuestions),
        openThreads: parseJsonArray(item.openThreads),
        resolvedThreads: parseJsonArray(item.resolvedThreads),
        nextMilestones: parseJsonArray(item.nextMilestones),
        nextStageGoal: text(item.nextStageGoal),
        powerSystemState: text(item.powerSystemState),
        mapAndForces: text(item.mapAndForces),
        resourceState: text(item.resourceState),
        relationshipChanges: parseJsonArray(item.relationshipChanges),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      writingTaskCards: rows(db, "WritingTaskCard").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        chapterNumber: integer(item.chapterNumber),
        title: text(item.title),
        chapterGoal: text(item.chapterGoal),
        continuity: text(item.continuity),
        mainPlotProgress: text(item.mainPlotProgress),
        requiredCharacters: parseJsonArray(item.requiredCharacters),
        pleasurePoint: text(item.pleasurePoint),
        foreshadowingTasks: parseJsonArray(item.foreshadowingTasks),
        rulesNotToBreak: parseJsonArray(item.rulesNotToBreak),
        endingHook: text(item.endingHook),
        status: text(item.status),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      chapterDrafts: rows(db, "ChapterDraft").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        taskCardId: text(item.taskCardId),
        chapterNumber: integer(item.chapterNumber),
        title: text(item.title),
        content: text(item.content),
        status: text(item.status),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      chapterLedgers: rows(db, "ChapterLedger").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        draftId: text(item.draftId),
        chapterNumber: integer(item.chapterNumber),
        title: text(item.title),
        events: parseJsonArray(item.events),
        newCharacters: parseJsonArray(item.newCharacters),
        newClues: parseJsonArray(item.newClues),
        payoff: text(item.payoff),
        cliffhanger: text(item.cliffhanger),
        stateChanges: parseJsonArray(item.stateChanges),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      reviewReports: rows(db, "ReviewReport").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        draftId: text(item.draftId),
        chapterNumber: integer(item.chapterNumber),
        overall: text(item.overall),
        issues: parseJsonArray(item.issues),
        shouldUpdateState: Boolean(item.shouldUpdateState),
        stateUpdateSuggestions: parseJsonArray(item.stateUpdateSuggestions),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      editReports: rows(db, "EditReport").map((item) => ({
        id: text(item.id),
        projectId: text(item.projectId),
        draftId: item.draftId ? text(item.draftId) : undefined,
        mode: text(item.mode),
        originalText: text(item.originalText),
        aiFlavorSentences: parseJsonArray(item.aiFlavorSentences),
        diagnosis: parseJsonArray(item.diagnosis),
        revisedText: text(item.revisedText),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      aiJobs: rows(db, "AiJob").map((item) => ({
        id: text(item.id),
        userId: maybeString(item.userId),
        projectId: maybeString(item.projectId),
        type: text(item.type),
        status: text(item.status),
        input: parseJsonValue(item.input) ?? undefined,
        output: parseJsonValue(item.output) ?? undefined,
        error: maybeString(item.error),
        attempts: integer(item.attempts),
        model: maybeString(item.model),
        retryOfJobId: maybeString(item.retryOfJobId),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt),
        startedAt: item.startedAt ? dateText(item.startedAt) : undefined,
        finishedAt: item.finishedAt ? dateText(item.finishedAt) : undefined
      })),
      aiSettings: aiSettingRows.map((aiSetting) => ({
        userId: maybeString(aiSetting.userId),
        providerName: text(aiSetting.providerName),
        baseUrl: text(aiSetting.baseUrl),
        apiKey: text(aiSetting.apiKey),
        model: text(aiSetting.model),
        timeoutMs: integer(aiSetting.timeoutMs),
        updatedAt: dateText(aiSetting.updatedAt)
      })),
      users: rows(db, "User").map((item) => ({
        id: text(item.id),
        email: text(item.email),
        name: text(item.name),
        passwordSalt: text(item.passwordSalt),
        passwordHash: text(item.passwordHash),
        role: text(item.role),
        plan: maybeString(item.plan),
        creditsBalance: integer(item.creditsBalance),
        aiBillingMarkup: item.aiBillingMarkup == null ? undefined : Number(item.aiBillingMarkup),
        aiBillingMinimum: item.aiBillingMinimum == null ? undefined : integer(item.aiBillingMinimum),
        onboardingCompletedAt: maybeString(item.onboardingCompletedAt),
        createdAt: dateText(item.createdAt),
        updatedAt: dateText(item.updatedAt)
      })),
      sessions: rows(db, "Session").map((item) => ({
        id: text(item.id),
        userId: text(item.userId),
        token: text(item.token),
        createdAt: dateText(item.createdAt),
        expiresAt: dateText(item.expiresAt),
        lastSeenAt: dateText(item.lastSeenAt)
      })),
      creditTransactions: rows(db, "CreditTransaction").map((item) => ({
        id: text(item.id),
        userId: text(item.userId),
        type: text(item.type),
        amount: integer(item.amount),
        balanceAfter: integer(item.balanceAfter),
        reason: text(item.reason),
        relatedJobId: maybeString(item.relatedJobId),
        orderId: maybeString(item.orderId),
        createdAt: dateText(item.createdAt)
      }))
    } as T;
  } finally {
    db.close();
  }
}

export async function loadPersistedStore<T>(storePath: string, fallback: T) {
  const postgresClient = await getPostgresClient();
  const storeRecordReadMode = process.env.STORE_RECORD_READ_MODE?.trim() || "auto";

  if (postgresClient) {
    if (storeRecordReadMode === "prefer") {
      const recordSnapshot = await readStoreRecordsFromPostgres(postgresClient, fallback);

      if (recordSnapshot) {
        await upsertAppStateInPostgres(postgresClient, JSON.stringify(recordSnapshot, null, 2));
        return recordSnapshot;
      }
    }

    const existing = await readAppStateFromPostgres(postgresClient, fallback);

    if (existing) {
      return existing;
    }

    if (storeRecordReadMode !== "appstate-only") {
      const recordSnapshot = await readStoreRecordsFromPostgres(postgresClient, fallback);

      if (recordSnapshot) {
        await upsertAppStateInPostgres(postgresClient, JSON.stringify(recordSnapshot, null, 2));
        await syncPostgresStoreRecords(postgresClient, recordSnapshot);
        return recordSnapshot;
      }
    }

    const fileSnapshot = await readStoreFile(storePath, fallback);
    await upsertAppStateInPostgres(postgresClient, JSON.stringify(fileSnapshot, null, 2));
    await syncPostgresStoreRecords(postgresClient, fileSnapshot);
    return fileSnapshot;
  }

  if (!hasDatabaseUrl()) {
    if (isProductionRuntime()) {
      throw new Error("生产环境缺少 DATABASE_URL，无法使用本地文件存储。请在 Vercel 环境变量中配置 PostgreSQL 连接串。");
    }

    return readStoreFile(storePath, fallback);
  }

  const coreStore = readCoreStoreFromDb(fallback);

  if (coreStore) {
    return coreStore;
  }

  const sqliteSnapshot = readAppStateFromSqlite(fallback);

  if (sqliteSnapshot) {
    return sqliteSnapshot;
  }

  const fileSnapshot = await readStoreFile(storePath, fallback);
  syncCoreTables(fileSnapshot);

  return fileSnapshot;
}

export async function savePersistedStore<T>(storePath: string, store: T) {
  const postgresClient = await getPostgresClient();
  const payload = JSON.stringify(store, null, 2);

  if (postgresClient) {
    await upsertAppStateInPostgres(postgresClient, payload);
    await syncPostgresStoreRecords(postgresClient, store);
    return;
  }

  if (!hasDatabaseUrl()) {
    if (isProductionRuntime()) {
      throw new Error("生产环境缺少 DATABASE_URL，无法保存数据。请在 Vercel 环境变量中配置 PostgreSQL 连接串。");
    }

    await ensureDataDir(storePath);
    await writeFile(storePath, payload, "utf8");
    return;
  }

  syncCoreTables(store);
}

export async function getPersistenceStatus() {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const readMode = process.env.STORE_RECORD_READ_MODE?.trim() || "auto";
  const postgresClient = await getPostgresClient();

  if (postgresClient) {
    const appStateRows = await postgresClient`
      SELECT COUNT(*)::int as count
      FROM "AppState"
    ` as Array<{ count: number }>;
    const storeRecordRows = await postgresClient`
      SELECT "entityType", COUNT(*)::int as count
      FROM "StoreRecord"
      GROUP BY "entityType"
      ORDER BY "entityType"
    ` as Array<{ entityType: string; count: number }>;

    return {
      mode: "postgres" as const,
      databaseUrlConfigured: Boolean(databaseUrl),
      readMode,
      appStateCount: Number(appStateRows[0]?.count ?? 0),
      storeRecordCount: storeRecordRows.reduce((total, row) => total + Number(row.count ?? 0), 0),
      storeRecordEntities: storeRecordRows.map((row) => ({
        entityType: row.entityType,
        count: Number(row.count ?? 0)
      }))
    };
  }

  const sqlitePath = resolveSqliteFilePath();

  if (sqlitePath) {
    ensureSqliteSchema();
    const db = new Database(sqlitePath, { readonly: true });

    try {
      const appStateRow = db.prepare('SELECT COUNT(*) as count FROM "AppState"').get() as
        | { count: number | string }
        | undefined;

      return {
        mode: "sqlite" as const,
        databaseUrlConfigured: true,
        readMode,
        sqlitePath,
        appStateCount: Number(appStateRow?.count ?? 0),
        storeRecordCount: 0,
        storeRecordEntities: []
      };
    } finally {
      db.close();
    }
  }

  return {
    mode: "file" as const,
    databaseUrlConfigured: Boolean(databaseUrl),
    readMode,
    appStateCount: 0,
    storeRecordCount: 0,
    storeRecordEntities: []
  };
}
