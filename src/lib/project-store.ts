import path from "node:path";
import { cache } from "react";
import type { AppStore } from "@/lib/project-types";
import { loadPersistedStore, savePersistedStore } from "@/lib/store-persistence";

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
  outlines: [],
  writingBibles: [],
  characterProfiles: [],
  foreshadowings: [],
  plotStates: [],
  customRelationGraphs: [],
  writingTaskCards: [],
  chapterDrafts: [],
  chapterLedgers: [],
  reviewReports: [],
  editReports: [],
  creditTransactions: [],
  licenseCodes: [],
  licenseActivationLogs: [],
  aiSettings: undefined
};

const dataDir = path.join(process.cwd(), "data");

export const storePath = process.env.APP_STORE_PATH
  ? path.resolve(process.env.APP_STORE_PATH)
  : path.join(dataDir, "app-db.json");

async function readStoreBase(): Promise<AppStore> {
  return loadPersistedStore(storePath, initialStore);
}

export const readStore = cache(readStoreBase);

export async function writeStore(store: AppStore) {
  await savePersistedStore(storePath, store);
}
