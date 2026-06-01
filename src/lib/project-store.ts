import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { AppStore, StoredChapter, StoredSourceText } from "@/lib/project-types";
import {
  appendImportedSourceTextToSqlite,
  loadPersistedStore,
  savePersistedStore
} from "@/lib/store-persistence";

export const initialStore: AppStore = {
  users: [],
  sessions: [],
  projects: [],
  sourceTexts: [],
  chapters: [],
  chapterAnalyses: [],
  storyAnalyses: [],
  aiJobs: [],
  templates: [],
  inspirations: [],
  outlines: [],
  writingBibles: [],
  characterProfiles: [],
  foreshadowings: [],
  plotStates: [],
  longFormPlans: [],
  customRelationGraphs: [],
  writingTaskCards: [],
  chapterDrafts: [],
  chapterLedgers: [],
  reviewReports: [],
  editReports: [],
  assistantThreads: [],
  assistantMessages: [],
  creditTransactions: [],
  licenseCodes: [],
  licenseActivationLogs: [],
  aiSettings: undefined,
  coverImageSettings: undefined,
  coverImageUsages: []
};

const dataDir = path.join(process.cwd(), "data");

export const storePath = process.env.APP_STORE_PATH
  ? path.resolve(process.env.APP_STORE_PATH)
  : path.join(dataDir, "app-db.json");

async function readStoreBase(): Promise<AppStore> {
  return loadPersistedStore(storePath, initialStore);
}

export async function readStore() {
  return readStoreBase();
}

export async function writeStore(store: AppStore) {
  await savePersistedStore(storePath, store);
}

export async function appendImportedSourceText(input: {
  sourceText: StoredSourceText;
  chapters: StoredChapter[];
  projectUpdatedAt: string;
}) {
  return appendImportedSourceTextToSqlite(input);
}

export async function backupStoreSnapshot(store: AppStore, reason = "manual") {
  const backupDir = path.join(path.dirname(storePath), "backups");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeReason = reason.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "backup";
  const backupPath = path.join(backupDir, `app-store-${safeReason}-${timestamp}.json`);

  await mkdir(backupDir, { recursive: true });
  await writeFile(backupPath, JSON.stringify(store, null, 2), "utf8");

  return backupPath;
}
