import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  analyzeChapter,
  buildStoryAnalysis
} from "@/lib/analysis";
import {
  combineAiTokenUsages,
  getAiTokenUsage,
  type AiTokenUsage
} from "@/lib/ai/client";
import { runWithAiModelOverride } from "@/lib/ai/config";
import {
  analyzeChapterWithAi,
  analyzeStoryWithAi,
  type AnalysisRunResult,
  type ChapterAnalysisResult
} from "@/lib/ai/novel-analysis";
import { generateOutlineWithAi, type OutlineVariables } from "@/lib/ai/outline";
import {
  polishInspirationWithAi,
  transformInspirationWithAi,
  type InspirationProjectContext
} from "@/lib/ai/inspiration";
import {
  generateProjectCreationAssistWithAi,
  type ProjectCreationAssistAction,
  type ProjectCreationAssistInput
} from "@/lib/ai/project-creation";
import {
  generateWritingAssistantReply,
  streamWritingAssistantReply,
  type WritingAssistantChatMessage
} from "@/lib/ai/writing-assistant";
import { novelTaxonomy, qidianTaxonomyByReader, type TargetReader } from "@/lib/novel-taxonomy";
import { formatReviewText } from "@/lib/review-display";
import {
  assertEditedTextComplete,
  compressChapterDraftToTarget,
  countDraftCharacters,
  editDraftTextWithAi,
  extractChapterStateUpdateWithAi,
  generateChapterDraftWithAi,
  generateLongFormPlanWithAi,
  generateWritingTaskCardWithAi,
  maximumDraftCharacters,
  minimumSavableDraftCharacters,
  reviewChapterDraftWithAi,
  prepareChapterDraftContentForSave,
  sanitizeChapterDraftDiction,
  type ChapterDraftContext,
  type ChapterStateUpdateContext,
  type ChapterStateUpdateResult,
  type CharacterStateUpdate,
  type ForeshadowingStateUpdate
} from "@/lib/ai/writing";
import {
  AI_TASK_PRICING_DEFINITIONS,
  estimateAiTaskCredits,
  normalizeAiTaskPricingOverrides,
  resolveAiTaskPricing,
  type AiTaskPricingOverrides
} from "@/lib/ai-task-pricing";
import {
  getActiveAiModel,
  getPrimaryAiSettings,
  getUserAiSettings,
  hasConfiguredAiSettings,
  listUserAiProfiles,
  mergeAiSettings,
  normalizeStoredAiSettings,
  setPrimaryAiSettings,
  setUserAiProfiles
} from "@/lib/ai-settings-store";
import {
  hashPassword,
  isAdminUser,
  toAuthUser,
} from "@/lib/auth-utils";
import {
  clearSessionCookie,
  getActiveSession,
  sessionExpiresAt,
  setSessionCookie
} from "@/lib/auth-session";
import {
  loginUserWithAuthService,
  logoutUserWithAuthService,
  registerUserWithAuthService,
  type AuthServiceHooks
} from "@/lib/auth-service";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getBillingMode, isSubscriptionBillingMode } from "@/lib/billing-mode";
import { clearDesktopActivationStatusCache } from "@/lib/desktop-license-status";
import {
  activationEmail,
  activateLicenseViaRemoteCenter,
  activateLicenseWithCenter,
  buildAdminLicenseCenter,
  createActivationCode,
  getDesktopLicenseCandidate,
  getLicenseServerUrl,
  hashActivationCode,
  normalizeActivationCode,
  normalizeLicenseText,
  normalizeMachineHash,
  previewActivationCode,
  refreshDesktopLicenseStateFromRemoteCenter,
  resolveDesktopLicenseState,
  syncLegacyConfiguredCodes,
  syncLocalLicenseSnapshot,
  type DesktopLicenseState,
  type LicenseActivationInput
} from "@/lib/license-service";
import { splitNovelText } from "@/lib/chapters";
import {
  appendImportedSourceText,
  backupStoreSnapshot,
  readStore,
  writeStore
} from "@/lib/project-store";
import type {
  PleasurePoint,
  EntityRelation,
  PlanKey,
  StoredProject,
  InitialProjectStateInput,
  StoredSourceText,
  StoredChapter,
  StoredAiJob,
  ChapterAnalysisScope,
  StoredChapterAnalysis,
  StoredStoryAnalysis,
  StoredAiSettings,
  StoredTemplate,
  StoredInspiration,
  InspirationType,
  InspirationStatus,
  InspirationPolishMode,
  InspirationAiOutput,
  InspirationTransformDraft,
  InspirationTransformTarget,
  StoredOutline,
  StoredWritingBible,
  StoredCharacterProfile,
  StoredForeshadowing,
  StoredPlotState,
  StoredLongFormPlan,
  CustomRelationGraphNodeType,
  CustomRelationGraphTone,
  StoredCustomRelationGraphNode,
  StoredCustomRelationGraphEdge,
  StoredCustomRelationGraph,
  StoredWritingTaskCard,
  StoredChapterDraft,
  StoredChapterLedger,
  ReviewIssue,
  StoredReviewReport,
  StoredEditReport,
  StoredAssistantThread,
  StoredAssistantMessage,
  StoredUser,
  StoredCreditTransaction,
  StoredLicenseCode,
  StoredLicenseActivationLog,
  StoredSession,
  AppStore,
  ProjectWithCounts,
  DashboardStat,
  AdminUserSummary,
  AdminAiUsageTypeSummary,
  AdminAiUsageSummary,
  AdminDashboardSummary,
  AdminLicenseSummary,
  AdminLicenseCenterSummary
} from "@/lib/project-types";
export type {
  PleasurePoint,
  EntityRelation,
  PlanKey,
  StoredProject,
  InitialProjectStateInput,
  StoredSourceText,
  StoredChapter,
  StoredAiJob,
  ChapterAnalysisScope,
  StoredChapterAnalysis,
  StoredStoryAnalysis,
  StoredAiSettings,
  StoredTemplate,
  StoredInspiration,
  InspirationType,
  InspirationStatus,
  InspirationPolishMode,
  InspirationAiOutput,
  InspirationTransformDraft,
  InspirationTransformTarget,
  StoredOutline,
  StoredWritingBible,
  StoredCharacterProfile,
  StoredForeshadowing,
  StoredPlotState,
  StoredLongFormPlan,
  CustomRelationGraphNodeType,
  CustomRelationGraphTone,
  StoredCustomRelationGraphNode,
  StoredCustomRelationGraphEdge,
  StoredCustomRelationGraph,
  StoredWritingTaskCard,
  StoredChapterDraft,
  StoredChapterLedger,
  ReviewIssue,
  StoredReviewReport,
  StoredEditReport,
  StoredAssistantThread,
  StoredAssistantMessage,
  StoredUser,
  StoredCreditTransaction,
  StoredLicenseCode,
  StoredLicenseActivationLog,
  StoredSession,
  AppStore,
  ProjectWithCounts,
  DashboardStat,
  AdminUserSummary,
  AdminAiUsageTypeSummary,
  AdminAiUsageSummary,
  AdminDashboardSummary,
  AdminLicenseSummary,
  AdminLicenseCenterSummary
} from "@/lib/project-types";
export {
  activateLicenseWithCenter,
  verifyLicenseWithCenter
} from "@/lib/license-service";

function normalizeCoverImageUrl(value?: string) {
  const coverImageUrl = String(value ?? "").trim();

  if (!coverImageUrl) {
    return "";
  }

  if (coverImageUrl.startsWith("blob:")) {
    throw new Error("封面链接无效，请重新上传");
  }

  if (
    coverImageUrl.startsWith("data:image/") ||
    coverImageUrl.startsWith("http://") ||
    coverImageUrl.startsWith("https://") ||
    coverImageUrl.startsWith("/")
  ) {
    return coverImageUrl;
  }

  throw new Error("封面地址格式不正确");
}

const MAX_ANALYSIS_CHAPTERS = 30;
const userContextStorage = new AsyncLocalStorage<string>();


export const PLAN_LIMITS: Record<
  PlanKey,
  {
    name: string;
    monthlyAiJobs: number;
    projects: number;
    templates: number;
    importedCharacters: number;
  }
> = {
  trial: {
    name: "免费内测版",
    monthlyAiJobs: 500,
    projects: 20,
    templates: 50,
    importedCharacters: 2_000_000
  },
  creator: {
    name: "作者版",
    monthlyAiJobs: 3000,
    projects: 100,
    templates: 300,
    importedCharacters: 20_000_000
  },
  studio: {
    name: "工作室版",
    monthlyAiJobs: 20000,
    projects: 1000,
    templates: 3000,
    importedCharacters: 200_000_000
  }
};

async function requireAdminUser(store?: AppStore) {
  const currentStore = store ?? (await readStore());
  const user = await requireCurrentUser(currentStore);

  if (!isAdminUser(currentStore, user)) {
    throw new Error("需要管理员权限");
  }

  return user;
}

async function getCurrentUserFromStore(store: AppStore) {
  const contextUserId = userContextStorage.getStore();

  if (contextUserId) {
    return store.users.find((item) => item.id === contextUserId) ?? null;
  }

  const session = await getActiveSession(store);

  if (!session) {
    return null;
  }

  const user = store.users.find((item) => item.id === session.userId);

  if (!user) {
    return null;
  }

  const licenseState = resolveDesktopLicenseState(store, user);

  if (licenseState.changed) {
    await writeStore(store);
  }

  if (!user.licenseCodePurpose && user.licenseCodeHash) {
    const license = store.licenseCodes.find((item) => item.codeHash === user.licenseCodeHash);
    if (license?.purpose) {
      user.licenseCodePurpose = license.purpose;
      await writeStore(store);
    }
  }

  if (licenseState.status !== "active") {
    store.sessions = store.sessions.filter((item) => item.userId !== user.id);
    await writeStore(store);
    return null;
  }

  session.lastSeenAt = now();
  return user;
}

async function requireCurrentUser(store?: AppStore) {
  const currentStore = store ?? (await readStore());
  const user = await getCurrentUserFromStore(currentStore);

  if (!user) {
    throw new Error("请先登录");
  }

  return user;
}

function runAsUser<T>(userId: string, callback: () => Promise<T>) {
  return userContextStorage.run(userId, callback);
}

function ensureProjectOwner(project: StoredProject, userId: string) {
  if (project.ownerUserId && project.ownerUserId !== userId) {
    throw new Error("无权访问该项目");
  }
}

function ensureTemplateOwner(template: StoredTemplate, userId: string) {
  if (template.ownerUserId && template.ownerUserId !== userId) {
    throw new Error("无权访问该模板");
  }
}

function ensureInspirationOwner(inspiration: StoredInspiration, userId: string) {
  if (inspiration.ownerUserId !== userId) {
    throw new Error("无权访问该灵感");
  }
}

function now() {
  return new Date().toISOString();
}

function isRunnableAiJob(job: StoredAiJob) {
  if (job.status === "pending") {
    return true;
  }

  if (job.type !== "analyze_chapters" || job.status !== "running") {
    return false;
  }

  const updatedAt = Date.parse(job.updatedAt);
  return Number.isFinite(updatedAt) && Date.now() - updatedAt < 10 * 60 * 1000;
}

function claimLegacyWorkspace(store: AppStore, userId: string) {
  const timestamp = now();

  store.projects.forEach((project) => {
    if (!project.ownerUserId) {
      project.ownerUserId = userId;
      project.updatedAt = timestamp;
    }
  });

  store.templates.forEach((template) => {
    if (!template.ownerUserId) {
      template.ownerUserId = userId;
      template.updatedAt = timestamp;
    }
  });

  store.inspirations = (store.inspirations ?? []).map((inspiration) =>
    inspiration.ownerUserId ? inspiration : { ...inspiration, ownerUserId: userId, updatedAt: timestamp }
  );

  store.aiSettings = normalizeStoredAiSettings(store.aiSettings).map((item) =>
    item.userId ? item : { ...item, userId, updatedAt: item.updatedAt ?? timestamp }
  );
}

function createAuthServiceHooks(): AuthServiceHooks {
  return {
    claimLegacyWorkspace
  };
}

export async function getCurrentUser() {
  const store = await readStore();
  const user = await getCurrentUserFromStore(store);
  return user ? toAuthUser(user) : null;
}

export async function getCurrentUserAccess() {
  const store = await readStore();
  const user = await getCurrentUserFromStore(store);

  return {
    user: user ? toAuthUser(user) : null,
    isAdmin: Boolean(user && isAdminUser(store, user))
  };
}

export async function isCurrentUserAdmin() {
  const store = await readStore();
  const user = await getCurrentUserFromStore(store);
  return Boolean(user && isAdminUser(store, user));
}

export async function getCurrentUserOrThrow() {
  const store = await readStore();
  const user = await getCurrentUserFromStore(store);

  if (!user) {
    throw new Error("请先登录");
  }

  return toAuthUser(user);
}

export async function restoreSubscriptionSession() {
  if (!isDesktopRuntime() || !isSubscriptionBillingMode()) {
    return { user: null, reason: "inactive" as const };
  }

  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (currentUser) {
    return { user: toAuthUser(currentUser) };
  }

  const candidate = getDesktopLicenseCandidate(store);
  const user = candidate.user;

  if (!user) {
    return { user: null, reason: "missing" as const };
  }

  const licenseState = await refreshDesktopLicenseStateFromRemoteCenter(store, user, candidate.state);

  if (candidate.changed || licenseState.changed) {
    await writeStore(store);
  }

  if (licenseState.status !== "active") {
    return {
      user: null,
      reason: licenseState.status === "expired" ? ("expired" as const) : ("disabled" as const)
    };
  }

  const timestamp = now();
  const token = randomUUID();
  store.sessions = store.sessions.filter((item) => item.userId !== user.id || item.expiresAt > timestamp);
  store.sessions.push({
    id: randomUUID(),
    userId: user.id,
    token,
    createdAt: timestamp,
    expiresAt: sessionExpiresAt(),
    lastSeenAt: timestamp
  });

  await writeStore(store);
  await setSessionCookie(token);
  clearDesktopActivationStatusCache();
  return { user: toAuthUser(user) };
}

export async function activateSubscriptionLicense(
  input: LicenseActivationInput,
  options?: { replaceExisting?: boolean }
) {
  if (!isSubscriptionBillingMode()) {
    throw new Error("当前不是一次性授权模式");
  }

  const normalizedCode = normalizeActivationCode(input.activationCode);

  if (!normalizedCode) {
    throw new Error("请填写激活码");
  }

  let license = await activateLicenseViaRemoteCenter(input);

  if (!license) {
    if (isDesktopRuntime()) {
      const hint = getLicenseServerUrl() ? "请检查网络后重试" : "请检查打包配置是否写入授权中心地址";
      throw new Error(`客户端未连接授权中心，${hint}`);
    }

    license = await activateLicenseWithCenter(input);
  }

  const store = await readStore();
  const timestamp = now();
  const codeHash = hashActivationCode(normalizedCode);
  const machineHash = normalizeMachineHash(input.machineHash);
  syncLocalLicenseSnapshot(store, { license, codeHash, machineHash });
  const currentUser = options?.replaceExisting ? await getCurrentUserFromStore(store) : null;
  const reusableUser = options?.replaceExisting ? currentUser ?? getDesktopLicenseCandidate(store).user : null;
  let user = reusableUser ?? store.users.find((item) => item.licenseCodeHash === codeHash || item.licenseCustomerId === license.customerId);

  if (!user) {
    const { salt, hash } = hashPassword(randomUUID());
    user = {
      id: randomUUID(),
      email: activationEmail(license.customerId),
      name: license.customerName || `授权客户 ${license.codePreview}`,
      passwordSalt: salt,
      passwordHash: hash,
      role: "user",
      plan: "studio",
      creditsBalance: 0,
      licenseCustomerId: license.customerId,
      licenseCodeHash: codeHash,
      licenseCodePurpose: "desktop",
      licenseMachineHash: machineHash,
      licenseActivatedAt: license.activatedAt || timestamp,
      licenseExpiresAt: license.expiresAt || undefined,
      onboardingCompletedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.users.push(user);
  } else {
    user.licenseCustomerId = options?.replaceExisting ? license.customerId : user.licenseCustomerId || license.customerId;
    user.licenseCodeHash = options?.replaceExisting ? codeHash : user.licenseCodeHash || codeHash;
    user.licenseCodePurpose = "desktop";
    user.licenseMachineHash = options?.replaceExisting ? machineHash : user.licenseMachineHash || machineHash;
    user.licenseActivatedAt = options?.replaceExisting ? license.activatedAt || timestamp : user.licenseActivatedAt || license.activatedAt || timestamp;
    user.licenseExpiresAt = license.expiresAt || undefined;
    if (license.customerName) {
      user.name = license.customerName;
    }
    user.plan = "studio";
    user.updatedAt = timestamp;
  }

  user.licenseSignedOutAt = undefined;

  if (store.projects.every((item) => !item.ownerUserId)) {
    claimLegacyWorkspace(store, user.id);
  }

  const token = randomUUID();
  store.sessions = store.sessions.filter((item) => item.userId !== user.id || item.expiresAt > timestamp);
  store.sessions.push({
    id: randomUUID(),
    userId: user.id,
    token,
    createdAt: timestamp,
    expiresAt: sessionExpiresAt(),
    lastSeenAt: timestamp
  });

  await writeStore(store);
  await setSessionCookie(token);
  clearDesktopActivationStatusCache();
  return toAuthUser(user);
}

function webLicenseEmail(license: { customerContact?: string; customerId: string }) {
  const contact = normalizeLicenseText(license.customerContact).toLowerCase();

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return contact;
  }

  return activationEmail(license.customerId);
}

export async function activateWebLicenseSession(input: LicenseActivationInput) {
  const normalizedCode = normalizeActivationCode(input.activationCode);
  const machineHash = normalizeMachineHash(input.machineHash);

  if (!normalizedCode) {
    throw new Error("请填写授权码");
  }

  if (!machineHash) {
    throw new Error("缺少网页设备标识，请刷新后重试");
  }

  const codeHash = hashActivationCode(normalizedCode);
  const license = await activateLicenseWithCenter({
    activationCode: normalizedCode,
    machineHash,
    clientName: normalizeLicenseText([input.clientName, "网页授权登录"].filter(Boolean).join(" | ")),
    purpose: "web"
  });
  const store = await readStore();
  const timestamp = now();
  let user = store.users.find(
    (item) => item.licenseCodeHash === codeHash || item.licenseCustomerId === license.customerId
  );

  if (!user) {
    const { salt, hash } = hashPassword(randomUUID());
    user = {
      id: randomUUID(),
      email: webLicenseEmail(license),
      name: license.customerName || `授权客户 ${license.codePreview}`,
      passwordSalt: salt,
      passwordHash: hash,
      role: "user",
      plan: "studio",
      creditsBalance: 0,
      licenseCustomerId: license.customerId,
      licenseCodeHash: codeHash,
      licenseCodePurpose: "web",
      licenseMachineHash: machineHash,
      licenseActivatedAt: license.activatedAt || timestamp,
      licenseExpiresAt: license.expiresAt || undefined,
      onboardingCompletedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.users.push(user);
  } else {
    user.licenseCustomerId = license.customerId;
    user.licenseCodeHash = codeHash;
    user.licenseCodePurpose = "web";
    user.licenseMachineHash = machineHash;
    user.licenseActivatedAt = user.licenseActivatedAt || license.activatedAt || timestamp;
    user.licenseExpiresAt = license.expiresAt || undefined;
    user.licenseSignedOutAt = undefined;
    user.plan = "studio";
    if (license.customerName) {
      user.name = license.customerName;
    }
    user.updatedAt = timestamp;
  }

  if (store.projects.every((item) => !item.ownerUserId)) {
    claimLegacyWorkspace(store, user.id);
  }

  const token = randomUUID();
  store.sessions = store.sessions.filter((item) => item.userId !== user.id || item.expiresAt > timestamp);
  store.sessions.push({
    id: randomUUID(),
    userId: user.id,
    token,
    createdAt: timestamp,
    expiresAt: sessionExpiresAt(),
    lastSeenAt: timestamp
  });

  await writeStore(store);
  await setSessionCookie(token);
  return toAuthUser(user);
}

export async function clearLocalLicenseSession() {
  if (!isDesktopRuntime()) {
    return { ok: false, reason: "cloud" as const };
  }

  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);
  const timestamp = now();

  if (currentUser) {
    store.sessions = store.sessions.filter((item) => item.userId !== currentUser.id);
    currentUser.licenseSignedOutAt = timestamp;
    currentUser.updatedAt = timestamp;
  } else {
    store.sessions = [];
    store.users.forEach((user) => {
      if (user.licenseCustomerId || user.licenseCodeHash) {
        user.licenseSignedOutAt = timestamp;
        user.updatedAt = timestamp;
      }
    });
  }

  await writeStore(store);
  await clearSessionCookie();
  clearDesktopActivationStatusCache();
  return { ok: true as const };
}

function normalizePenName(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function normalizeAssistantName(value?: string) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

export async function updateCurrentUserPenName(input: { penName: string; assistantName?: string }) {
  const penName = normalizePenName(input.penName);
  const assistantName = normalizeAssistantName(input.assistantName);

  if (!penName) {
    throw new Error("请先给自己起一个笔名");
  }

  if (penName.length < 2 || penName.length > 20) {
    throw new Error("笔名建议 2-20 个字");
  }

  if (!/^[\p{Script=Han}A-Za-z0-9_·]+$/u.test(penName)) {
    throw new Error("笔名只能包含中文、字母、数字、下划线或间隔号");
  }

  if (assistantName) {
    if (assistantName.length > 5) {
      throw new Error("小助手名称最多 5 个字");
    }

    if (!/^[\p{Script=Han}A-Za-z0-9_·]+$/u.test(assistantName)) {
      throw new Error("小助手名称只能包含中文、字母、数字、下划线或间隔号");
    }
  }

  const store = await readStore();
  const user = await requireCurrentUser(store);
  const timestamp = now();

  user.penName = penName;
  user.penNameSetAt = user.penNameSetAt || timestamp;
  user.assistantName = assistantName || undefined;
  user.updatedAt = timestamp;
  await writeStore(store);

  return { user: toAuthUser(user) };
}

export async function registerUser(input: { email: string; password: string; name: string }) {
  return registerUserWithAuthService(input, createAuthServiceHooks());
}

export async function loginUser(input: { email: string; password: string }) {
  return loginUserWithAuthService(input, createAuthServiceHooks());
}

export async function logoutUser() {
  await logoutUserWithAuthService();
}

export async function getAccountOverview(options?: { creditTransactionLimit?: number; creditTransactionOffset?: number }) {
  const store = await readStore();
  const user = await requireCurrentUser(store);
  const localLicenseState = resolveDesktopLicenseState(store, user);
  const licenseState = await refreshDesktopLicenseStateFromRemoteCenter(store, user, localLicenseState);

  if (localLicenseState.changed || licenseState.changed) {
    await writeStore(store);
  }

  const overview = buildAccountOverview(store, user, options, licenseState);

  if (!overview) {
    throw new Error("用户不存在");
  }

  return overview;
}

export async function completeOnboarding() {
  const store = await readStore();
  const user = await requireCurrentUser(store);
  const timestamp = now();
  user.onboardingCompletedAt = timestamp;
  user.updatedAt = timestamp;
  await writeStore(store);
  return buildAccountOverview(store, user);
}

export async function exportCurrentUserData() {
  const store = await readStore();
  const user = await requireCurrentUser(store);
  const payload = createDomainReadRepository(store).getExportPayloadForUser(user.id);

  if (!payload) {
    throw new Error("用户不存在");
  }

  return payload;
}

function arrayFromBackup<T>(payload: Record<string, unknown>, key: string): T[] {
  const value = payload[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function isBackupArray(payload: Record<string, unknown>, key: string) {
  return Array.isArray(payload[key]);
}

function objectFromBackup<T>(payload: Record<string, unknown>, key: string): Partial<T> | null {
  const value = payload[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Partial<T> : null;
}

function sameBackupUser(candidate: Partial<StoredUser>, user: StoredUser) {
  return Boolean(
    candidate.id === user.id ||
      (candidate.email && candidate.email === user.email) ||
      (candidate.licenseCustomerId && candidate.licenseCustomerId === user.licenseCustomerId) ||
      (candidate.licenseCodeHash && candidate.licenseCodeHash === user.licenseCodeHash)
  );
}

function pickBackupSourceUser(payload: Record<string, unknown>, user: StoredUser) {
  const exportedUser = objectFromBackup<StoredUser>(payload, "user");

  if (exportedUser) {
    return exportedUser;
  }

  const users = arrayFromBackup<StoredUser>(payload, "users");

  if (users.length === 0) {
    return null;
  }

  const projects = arrayFromBackup<StoredProject>(payload, "projects");
  return users.find((candidate) => sameBackupUser(candidate, user)) ??
    users.find((candidate) => candidate.role !== "admin" && projects.some((project) => project.ownerUserId === candidate.id)) ??
    users.find((candidate) => candidate.role !== "admin") ??
    users[0];
}

function pickBackupAiSettings(payload: Record<string, unknown>, user: StoredUser, sourceUser: Partial<StoredUser> | null) {
  const settings = normalizeStoredAiSettings(payload.aiSettings as StoredAiSettings | StoredAiSettings[] | undefined);

  if (settings.length === 0) {
    return null;
  }

  return settings.find((item) => sourceUser?.id && item.userId === sourceUser.id) ??
    settings.find((item) => item.userId === user.id) ??
    settings.find((item) => item.active) ??
    settings[0];
}

const backupCountKeys = [
  "projects",
  "sourceTexts",
  "chapters",
  "chapterAnalyses",
  "storyAnalyses",
  "templates",
  "inspirations",
  "outlines",
  "writingBibles",
  "characterProfiles",
  "foreshadowings",
  "plotStates",
  "longFormPlans",
  "customRelationGraphs",
  "writingTaskCards",
  "chapterDrafts",
  "chapterLedgers",
  "reviewReports",
  "editReports",
  "assistantThreads",
  "assistantMessages",
  "aiJobs"
] as const;

function backupPayloadCounts(payload: Record<string, unknown>) {
  return Object.fromEntries(
    backupCountKeys.map((key) => [key, Array.isArray(payload[key]) ? payload[key].length : 0])
  ) as Record<(typeof backupCountKeys)[number], number>;
}

function projectScopedBackupCount<T extends { projectId?: string }>(
  payload: Record<string, unknown>,
  key: string,
  projectIds: Set<string>
) {
  return arrayFromBackup<T>(payload, key).filter((item) => item.projectId && projectIds.has(item.projectId)).length;
}

function restoreBackupWarnings(payload: Record<string, unknown>, counts: Record<string, number>) {
  const warnings: string[] = [];
  const watchedSections = [
    ["plotStates", "主线状态"],
    ["characterProfiles", "人物档案"],
    ["foreshadowings", "伏笔表"],
    ["customRelationGraphs", "自定义图谱"],
    ["chapterLedgers", "章节台账"]
  ] as const;

  watchedSections.forEach(([key, label]) => {
    if (!Array.isArray(payload[key])) {
      warnings.push(`备份文件缺少${label}数据段，可能是旧版本导出的文件。`);
      return;
    }

    if ((counts[key] ?? 0) === 0) {
      warnings.push(`备份文件中没有${label}记录。`);
    }
  });

  return warnings;
}

function removeUserWorkspaceData(store: AppStore, userId: string) {
  const ownedProjectIds = getOwnedProjectIds(store, userId);
  const ownedTemplateIds = store.templates
    .filter((template) => !template.ownerUserId || template.ownerUserId === userId)
    .map((template) => template.id);
  const removedAssistantThreadIds = new Set(
    (store.assistantThreads ?? [])
      .filter((thread) => thread.ownerUserId === userId || (thread.projectId && ownedProjectIds.has(thread.projectId)))
      .map((thread) => thread.id)
  );

  store.sourceTexts = store.sourceTexts.filter((item) => !ownedProjectIds.has(item.projectId));
  store.chapters = store.chapters.filter((item) => !ownedProjectIds.has(item.projectId));
  store.chapterAnalyses = store.chapterAnalyses.filter((item) => !ownedProjectIds.has(item.projectId));
  store.storyAnalyses = store.storyAnalyses.filter((item) => !ownedProjectIds.has(item.projectId));
  store.writingBibles = store.writingBibles.filter((item) => !ownedProjectIds.has(item.projectId));
  store.characterProfiles = store.characterProfiles.filter((item) => !ownedProjectIds.has(item.projectId));
  store.foreshadowings = store.foreshadowings.filter((item) => !ownedProjectIds.has(item.projectId));
  store.plotStates = store.plotStates.filter((item) => !ownedProjectIds.has(item.projectId));
  store.longFormPlans = (store.longFormPlans ?? []).filter((item) => !ownedProjectIds.has(item.projectId));
  store.customRelationGraphs = (store.customRelationGraphs ?? []).filter((item) => !ownedProjectIds.has(item.projectId));
  store.writingTaskCards = store.writingTaskCards.filter((item) => !ownedProjectIds.has(item.projectId));
  store.chapterDrafts = store.chapterDrafts.filter((item) => !ownedProjectIds.has(item.projectId));
  store.chapterLedgers = store.chapterLedgers.filter((item) => !ownedProjectIds.has(item.projectId));
  store.reviewReports = store.reviewReports.filter((item) => !ownedProjectIds.has(item.projectId));
  store.editReports = store.editReports.filter((item) => !ownedProjectIds.has(item.projectId));
  store.inspirations = (store.inspirations ?? []).filter((item) => item.ownerUserId !== userId);
  store.assistantThreads = (store.assistantThreads ?? []).filter((item) => !removedAssistantThreadIds.has(item.id));
  store.assistantMessages = (store.assistantMessages ?? []).filter((item) => !removedAssistantThreadIds.has(item.threadId));
  store.outlines = store.outlines.filter((item) => !ownedTemplateIds.includes(item.templateId));
  store.templates = store.templates.filter(
    (item) => item.ownerUserId !== userId && (!item.sourceProjectId || !ownedProjectIds.has(item.sourceProjectId))
  );
  store.projects = store.projects.filter((item) => !ownedProjectIds.has(item.id));
  store.aiJobs = store.aiJobs.filter((item) => item.userId !== userId && !(item.projectId && ownedProjectIds.has(item.projectId)));
  store.creditTransactions = store.creditTransactions.filter((item) => item.userId !== userId);
  store.aiSettings = normalizeStoredAiSettings(store.aiSettings).filter((item) => item.userId !== userId);
}

export async function restoreCurrentUserDataFromBackup(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("备份文件格式不正确");
  }

  const data = payload as Record<string, unknown>;

  if (!isBackupArray(data, "projects")) {
    throw new Error("备份文件缺少项目数据");
  }

  const projects = arrayFromBackup<StoredProject>(data, "projects");
  const store = await readStore();
  const user = await requireCurrentUser(store);
  const sourceUser = pickBackupSourceUser(data, user);
  const backupPath = await backupStoreSnapshot(store, "before-restore");

  removeUserWorkspaceData(store, user.id);

  const exportedPenName = typeof sourceUser?.penName === "string" ? sourceUser.penName.trim() : "";
  const exportedAssistantName = typeof sourceUser?.assistantName === "string" ? sourceUser.assistantName.trim() : "";

  if (exportedPenName) {
    user.penName = exportedPenName;
    user.penNameSetAt = typeof sourceUser?.penNameSetAt === "string" ? sourceUser.penNameSetAt : user.penNameSetAt || now();
  }

  if (exportedAssistantName) {
    user.assistantName = exportedAssistantName;
  }

  if (typeof data.onboardingCompletedAt === "string") {
    user.onboardingCompletedAt = data.onboardingCompletedAt;
  }

  user.updatedAt = now();

  const importedProjectIds = new Set(projects.map((project) => project.id));
  const templates = arrayFromBackup<StoredTemplate>(data, "templates");
  const importedTemplateIds = new Set(templates.map((template) => template.id));
  const assistantThreads = arrayFromBackup<StoredAssistantThread>(data, "assistantThreads")
    .filter((thread) => !thread.projectId || importedProjectIds.has(thread.projectId))
    .map((thread) => ({ ...thread, ownerUserId: user.id }));
  const importedAssistantThreadIds = new Set(assistantThreads.map((thread) => thread.id));

  store.projects.push(...projects.map((project) => ({ ...project, ownerUserId: user.id })));
  store.sourceTexts.push(...arrayFromBackup<StoredSourceText>(data, "sourceTexts").filter((item) => importedProjectIds.has(item.projectId)));
  store.chapters.push(...arrayFromBackup<StoredChapter>(data, "chapters").filter((item) => importedProjectIds.has(item.projectId)));
  store.chapterAnalyses.push(...arrayFromBackup<StoredChapterAnalysis>(data, "chapterAnalyses").filter((item) => importedProjectIds.has(item.projectId)));
  store.storyAnalyses.push(...arrayFromBackup<StoredStoryAnalysis>(data, "storyAnalyses").filter((item) => importedProjectIds.has(item.projectId)));
  store.writingBibles.push(...arrayFromBackup<StoredWritingBible>(data, "writingBibles").filter((item) => importedProjectIds.has(item.projectId)));
  store.characterProfiles.push(...arrayFromBackup<StoredCharacterProfile>(data, "characterProfiles").filter((item) => importedProjectIds.has(item.projectId)));
  store.foreshadowings.push(...arrayFromBackup<StoredForeshadowing>(data, "foreshadowings").filter((item) => importedProjectIds.has(item.projectId)));
  store.plotStates.push(...arrayFromBackup<StoredPlotState>(data, "plotStates").filter((item) => importedProjectIds.has(item.projectId)));
  store.longFormPlans ??= [];
  store.longFormPlans.push(...arrayFromBackup<StoredLongFormPlan>(data, "longFormPlans").filter((item) => importedProjectIds.has(item.projectId)));
  store.customRelationGraphs = [
    ...(store.customRelationGraphs ?? []),
    ...arrayFromBackup<StoredCustomRelationGraph>(data, "customRelationGraphs").filter((item) => importedProjectIds.has(item.projectId))
  ];
  store.writingTaskCards.push(...arrayFromBackup<StoredWritingTaskCard>(data, "writingTaskCards").filter((item) => importedProjectIds.has(item.projectId)));
  store.chapterDrafts.push(...arrayFromBackup<StoredChapterDraft>(data, "chapterDrafts").filter((item) => importedProjectIds.has(item.projectId)));
  store.chapterLedgers.push(...arrayFromBackup<StoredChapterLedger>(data, "chapterLedgers").filter((item) => importedProjectIds.has(item.projectId)));
  store.reviewReports.push(...arrayFromBackup<StoredReviewReport>(data, "reviewReports").filter((item) => importedProjectIds.has(item.projectId)));
  store.editReports.push(...arrayFromBackup<StoredEditReport>(data, "editReports").filter((item) => importedProjectIds.has(item.projectId)));
  store.inspirations = [
    ...(store.inspirations ?? []),
    ...arrayFromBackup<StoredInspiration>(data, "inspirations")
      .filter((item) => !item.projectId || importedProjectIds.has(item.projectId))
      .map((item) => ({
        ...item,
        ownerUserId: user.id,
        tags: normalizeInspirationTags(item.tags),
        status: normalizeInspirationStatus(item.status),
        type: normalizeInspirationType(item.type),
        aiOutputs: normalizeInspirationOutputs(item.aiOutputs)
      }))
  ];
  store.assistantThreads.push(...assistantThreads);
  store.assistantMessages.push(
    ...arrayFromBackup<StoredAssistantMessage>(data, "assistantMessages").filter((item) =>
      importedAssistantThreadIds.has(item.threadId)
    )
  );
  store.templates.push(...templates.map((template) => ({ ...template, ownerUserId: user.id })));
  store.outlines.push(...arrayFromBackup<StoredOutline>(data, "outlines").filter((item) => importedTemplateIds.has(item.templateId)));
  store.aiJobs.push(
    ...arrayFromBackup<StoredAiJob>(data, "aiJobs")
      .filter((item) => !item.projectId || importedProjectIds.has(item.projectId))
      .map((item) => ({ ...item, userId: user.id }))
  );
  store.creditTransactions.push(
    ...arrayFromBackup<StoredCreditTransaction>(data, "creditTransactions").map((item) => ({ ...item, userId: user.id }))
  );

  const restoredAiSettings = pickBackupAiSettings(data, user, sourceUser);
  const aiSettings = restoredAiSettings
    ? {
      ...restoredAiSettings,
      id: restoredAiSettings.userId === user.id
        ? restoredAiSettings.id
        : `${user.id}:${restoredAiSettings.id || "restored"}`,
      userId: user.id,
      updatedAt: now()
    }
    : null;

  if (aiSettings) {
    store.aiSettings = [...normalizeStoredAiSettings(store.aiSettings), aiSettings];
  }

  await writeStore(store);

  const restoredCounts = {
    projects: projects.length,
    templates: templates.length,
    chapters: projectScopedBackupCount<StoredChapter>(data, "chapters", importedProjectIds),
    drafts: projectScopedBackupCount<StoredChapterDraft>(data, "chapterDrafts", importedProjectIds),
    writingBibles: projectScopedBackupCount<StoredWritingBible>(data, "writingBibles", importedProjectIds),
    characterProfiles: projectScopedBackupCount<StoredCharacterProfile>(data, "characterProfiles", importedProjectIds),
    foreshadowings: projectScopedBackupCount<StoredForeshadowing>(data, "foreshadowings", importedProjectIds),
    plotStates: projectScopedBackupCount<StoredPlotState>(data, "plotStates", importedProjectIds),
    longFormPlans: projectScopedBackupCount<StoredLongFormPlan>(data, "longFormPlans", importedProjectIds),
    customRelationGraphs: projectScopedBackupCount<StoredCustomRelationGraph>(data, "customRelationGraphs", importedProjectIds),
    writingTaskCards: projectScopedBackupCount<StoredWritingTaskCard>(data, "writingTaskCards", importedProjectIds),
    chapterLedgers: projectScopedBackupCount<StoredChapterLedger>(data, "chapterLedgers", importedProjectIds),
    reviewReports: projectScopedBackupCount<StoredReviewReport>(data, "reviewReports", importedProjectIds),
    editReports: projectScopedBackupCount<StoredEditReport>(data, "editReports", importedProjectIds)
  };

  return {
    restoredAt: now(),
    backupPath,
    counts: restoredCounts,
    backupCounts: backupPayloadCounts(data),
    warnings: restoreBackupWarnings(data, restoredCounts)
  };
}

function projectCounts(store: AppStore, projectId: string) {
  return {
    chapters: store.chapters.filter((chapter) => chapter.projectId === projectId).length,
    chapterAnalyses: store.chapterAnalyses.filter((analysis) => analysis.projectId === projectId)
      .length,
    storyAnalyses: store.storyAnalyses.filter((analysis) => analysis.projectId === projectId)
      .length,
    sourceTexts: store.sourceTexts.filter((sourceText) => sourceText.projectId === projectId).length,
    writingTaskCards: store.writingTaskCards.filter((card) => card.projectId === projectId).length,
    chapterDrafts: store.chapterDrafts.filter((draft) => draft.projectId === projectId).length,
    chapterLedgers: store.chapterLedgers.filter((ledger) => ledger.projectId === projectId).length,
    reviewReports: store.reviewReports.filter((review) => review.projectId === projectId).length,
    aiJobs: store.aiJobs.filter((job) => job.projectId === projectId).length
  };
}

function withProjectCounts(store: AppStore, project: StoredProject): ProjectWithCounts {
  return {
    ...project,
    _count: projectCounts(store, project.id)
  };
}

function canReadProject(project: StoredProject, userId: string) {
  return !project.ownerUserId || project.ownerUserId === userId;
}

function canReadTemplate(template: StoredTemplate, userId: string) {
  return !template.ownerUserId || template.ownerUserId === userId;
}

function canReadInspiration(inspiration: StoredInspiration, userId: string) {
  return inspiration.ownerUserId === userId;
}

function getOwnedProjects(store: AppStore, userId: string) {
  return store.projects.filter((project) => canReadProject(project, userId));
}

function getOwnedProjectIds(store: AppStore, userId: string) {
  return new Set(getOwnedProjects(store, userId).map((project) => project.id));
}

function getOwnedInspirations(store: AppStore, userId: string) {
  return (store.inspirations ?? []).filter((inspiration) => canReadInspiration(inspiration, userId));
}

function createDomainReadRepository(store: AppStore) {
  const getProjectRecordForUser = (projectId: string, userId: string) => {
    const project = store.projects.find((item) => item.id === projectId);

    return project && canReadProject(project, userId) ? project : null;
  };
  const getTemplateForUser = (templateId: string, userId: string) => {
    const template = store.templates.find((item) => item.id === templateId) ?? null;

    return template && canReadTemplate(template, userId) ? template : null;
  };
  const getInspirationForUser = (inspirationId: string, userId: string) => {
    const inspiration = (store.inspirations ?? []).find((item) => item.id === inspirationId) ?? null;

    return inspiration && canReadInspiration(inspiration, userId) ? inspiration : null;
  };
  const listChaptersForProjectForUser = (projectId: string, userId: string) => {
    const project = getProjectRecordForUser(projectId, userId);

    if (!project) {
      return [];
    }

    return store.chapters
      .filter((chapter) => chapter.projectId === projectId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  };
  const getLatestStoryAnalysisForProjectForUser = (projectId: string, userId: string) => {
    const project = getProjectRecordForUser(projectId, userId);

    if (!project) {
      return null;
    }

    return (
      store.storyAnalyses
        .filter((analysis) => analysis.projectId === projectId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    );
  };
  const getLatestOutlineForTemplateForUser = (templateId: string, userId: string) => {
    const template = getTemplateForUser(templateId, userId);

    if (!template) {
      return null;
    }

    return (
      store.outlines
        .filter((outline) => outline.templateId === templateId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    );
  };

  return {
    getProjectRecord(projectId: string) {
      return store.projects.find((item) => item.id === projectId) ?? null;
    },
    requireProjectForUser(projectId: string, userId: string) {
      return getProjectRecordForUser(projectId, userId);
    },
    listProjectsForUser(userId: string) {
      return getOwnedProjects(store, userId)
        .map((project) => withProjectCounts(store, project))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    getProjectForUser(projectId: string, userId: string) {
      const project = store.projects.find((item) => item.id === projectId);

      if (!project || !canReadProject(project, userId)) {
        return null;
      }

      return withProjectCounts(store, project);
    },
    getProjectRecordForUser(projectId: string, userId: string) {
      return getProjectRecordForUser(projectId, userId);
    },
    listTemplatesForUser(userId: string) {
      return store.templates
        .filter((template) => canReadTemplate(template, userId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    getTemplateForUser(templateId: string, userId: string) {
      return getTemplateForUser(templateId, userId);
    },
    listInspirationsForUser(userId: string) {
      return getOwnedInspirations(store, userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    getInspirationForUser(inspirationId: string, userId: string) {
      return getInspirationForUser(inspirationId, userId);
    },
    getProjectIdsForUser(userId: string) {
      return new Set(getOwnedProjects(store, userId).map((project) => project.id));
    },
    getDashboardStatsForUser(userId: string): DashboardStat[] {
      const ownedProjects = getOwnedProjects(store, userId);
      const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));
      const activeProjects = ownedProjects.filter((project) => project.status !== "draft").length;
      const visibleTaskCount = store.aiJobs.filter((item) => {
        const belongsToUser = item.projectId ? ownedProjectIds.has(item.projectId) : item.userId === userId;
        return belongsToUser && ["pending", "running", "failed"].includes(item.status);
      }).length;

      return [
        { label: "进行中项目", value: String(activeProjects) },
        {
          label: "已导入章节",
          value: String(store.chapters.filter((item) => ownedProjectIds.has(item.projectId)).length)
        },
        {
          label: "已写正文",
          value: String(
            store.chapterDrafts.filter((item) => ownedProjectIds.has(item.projectId)).length
          )
        },
        {
          label: "待处理任务",
          value: String(visibleTaskCount)
        }
      ];
    },
    listJobsForUser(userId: string) {
      const projectIds = getOwnedProjects(store, userId).map((project) => project.id);

      return store.aiJobs.filter((job) =>
        job.projectId ? projectIds.includes(job.projectId) : job.userId === userId
      );
    },
    listProjectJobsForUser(projectId: string, userId: string) {
      const project = getProjectRecordForUser(projectId, userId);

      if (!project) {
        return [];
      }

      return store.aiJobs
        .filter((job) => job.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    getJobForUser(jobId: string, userId: string) {
      const job = store.aiJobs.find((item) => item.id === jobId) ?? null;

      if (!job) {
        return null;
      }

      if (job.projectId) {
        return getOwnedProjects(store, userId).some((project) => project.id === job.projectId)
          ? job
          : null;
      }

      return job.userId === userId ? job : null;
    },
    getJobRecord(jobId: string) {
      return store.aiJobs.find((item) => item.id === jobId) ?? null;
    },
    listPendingJobIdsForUser(userId: string, limit = 5) {
      const ownedProjectIds = new Set(getOwnedProjects(store, userId).map((project) => project.id));

      return store.aiJobs
        .filter((job) => {
          if (!isRunnableAiJob(job)) {
            return false;
          }

          if (job.userId && job.userId !== userId) {
            return false;
          }

          return job.projectId ? ownedProjectIds.has(job.projectId) : job.userId === userId;
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, Math.max(1, limit))
        .map((job) => job.id);
    },
    listPendingJobIds(limit = 10) {
      return store.aiJobs
        .filter((job) => isRunnableAiJob(job))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, Math.max(1, Math.min(limit, 50)))
        .map((job) => job.id);
    },
    listChaptersForProjectForUser(projectId: string, userId: string) {
      return listChaptersForProjectForUser(projectId, userId);
    },
    getLatestStoryAnalysisForProjectForUser(projectId: string, userId: string) {
      return getLatestStoryAnalysisForProjectForUser(projectId, userId);
    },
    getLatestOutlineForTemplateForUser(templateId: string, userId: string) {
      return getLatestOutlineForTemplateForUser(templateId, userId);
    },
    getAccountOverviewForUser(
      userId: string,
      options?: { creditTransactionLimit?: number; creditTransactionOffset?: number }
    ) {
      const user = store.users.find((item) => item.id === userId);
      return user ? buildAccountOverview(store, user, options) : null;
    },
    getExportPayloadForUser(userId: string) {
      const user = store.users.find((item) => item.id === userId);
      return user ? buildExportPayload(store, user) : null;
    },
    getAdminDashboard() {
      return buildAdminDashboard(store);
    },
    getProjectAnalysisForUser(projectId: string, userId: string) {
      const project = getProjectRecordForUser(projectId, userId);

      if (!project) {
        return null;
      }

      const chapters = listChaptersForProjectForUser(projectId, userId);
      const chapterAnalyses = store.chapterAnalyses
        .filter((analysis) => analysis.projectId === projectId)
        .sort((a, b) => {
          const chapterA = chapters.find((chapter) => chapter.id === a.chapterId);
          const chapterB = chapters.find((chapter) => chapter.id === b.chapterId);
          return (chapterA?.orderIndex ?? 0) - (chapterB?.orderIndex ?? 0);
        });
      const storyAnalysis = getLatestStoryAnalysisForProjectForUser(projectId, userId);

      return {
        project,
        chapters,
        chapterAnalyses,
        storyAnalysis
      };
    },
    getProjectWritingStateForUser(projectId: string, userId: string) {
      const project = getProjectRecordForUser(projectId, userId);

      if (!project) {
        return null;
      }

      const bible = store.writingBibles.find((item) => item.projectId === projectId);
      const plotState = store.plotStates.find((item) => item.projectId === projectId);

      if (!bible || !plotState) {
        return null;
      }

      return {
        project,
        bible,
        plotState,
        characters: store.characterProfiles
          .filter((item) => item.projectId === projectId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        foreshadowings: store.foreshadowings
          .filter((item) => item.projectId === projectId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        longFormPlans: (store.longFormPlans ?? [])
          .filter((item) => item.projectId === projectId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        customRelationGraphs: (store.customRelationGraphs ?? [])
          .filter((item) => item.projectId === projectId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        taskCards: store.writingTaskCards
          .filter((item) => item.projectId === projectId)
          .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt)),
        drafts: store.chapterDrafts
          .filter((item) => item.projectId === projectId)
          .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt)),
        ledgers: store.chapterLedgers
          .filter((item) => item.projectId === projectId)
          .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt)),
        reviews: store.reviewReports
          .filter((item) => item.projectId === projectId)
          .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt)),
        editReports: store.editReports
          .filter((item) => item.projectId === projectId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      };
    }
  };
}

function createDomainWriteRepository(store: AppStore) {
  const reader = createDomainReadRepository(store);

  return {
    requireProjectForUser(projectId: string, userId: string, message = "项目不存在") {
      const project = reader.getProjectRecordForUser(projectId, userId);

      if (!project) {
        throw new Error(message);
      }

      return project;
    },
    requireTemplateForUser(templateId: string, userId: string, message = "模板不存在") {
      const template = reader.getTemplateForUser(templateId, userId);

      if (!template) {
        throw new Error(message);
      }

      return template;
    },
    requireInspirationForUser(inspirationId: string, userId: string, message = "灵感不存在") {
      const inspiration = reader.getInspirationForUser(inspirationId, userId);

      if (!inspiration) {
        throw new Error(message);
      }

      return inspiration;
    },
    requireJobForUser(jobId: string, userId: string, message = "任务不存在") {
      const job = reader.getJobForUser(jobId, userId);

      if (!job) {
        throw new Error(message);
      }

      return job;
    },
    requireProjectStateForUser(projectId: string, userId: string, message = "项目不存在") {
      const project = reader.getProjectRecordForUser(projectId, userId);

      if (!project) {
        throw new Error(message);
      }

      const state = reader.getProjectWritingStateForUser(projectId, userId);

      if (!state) {
        throw new Error("写作状态不存在");
      }

      return { project, state };
    },
    createProject(userId: string, input: {
      name: string;
      type: "analysis" | "writing";
      genre?: string;
      description?: string;
      coverImageUrl?: string;
    }) {
      const timestamp = now();
      const project: StoredProject = {
        id: randomUUID(),
        ownerUserId: userId,
        name: input.name.trim(),
        type: input.type,
        description: input.description?.trim() ?? "",
        genre: input.genre?.trim() ?? "",
        coverImageUrl: normalizeCoverImageUrl(input.coverImageUrl),
        status: input.type === "writing" ? "writing" : "draft",
        createdAt: timestamp,
        updatedAt: timestamp
      };

      store.projects.push(project);
      return project;
    },
    addTemplate(template: StoredTemplate) {
      store.templates.push(template);
      return template;
    },
    addInspiration(inspiration: StoredInspiration) {
      store.inspirations = store.inspirations ?? [];
      store.inspirations.push(inspiration);
      return inspiration;
    },
    purgeUser(userId: string) {
      return purgeUserAccount(store, userId);
    }
  };
}

function getCurrentMonthStart() {
  const nowDate = new Date();
  return new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1)).toISOString();
}

function getPlanKey(plan?: string): PlanKey {
  return plan === "creator" || plan === "studio" ? plan : "trial";
}

function getPlanLimitsForUser(user?: StoredUser) {
  return PLAN_LIMITS[getPlanKey(user?.plan)];
}

function getUserUsage(store: AppStore, user: StoredUser) {
  const ownedProjectIds = getOwnedProjectIds(store, user.id);
  const ownedTemplateIds = store.templates
    .filter((template) => !template.ownerUserId || template.ownerUserId === user.id)
    .map((template) => template.id);
  const aiJobsThisMonth = store.aiJobs.filter(
    (job) => job.userId === user.id && job.createdAt >= getCurrentMonthStart()
  ).length;
  const importedCharacters = store.chapters
    .filter((chapter) => ownedProjectIds.has(chapter.projectId))
    .reduce((total, chapter) => total + chapter.charCount, 0);

  return {
    projects: getOwnedProjects(store, user.id).length,
    templates: ownedTemplateIds.length,
    aiJobsThisMonth,
    importedCharacters
  };
}

function getUserCreditBalance(user: StoredUser) {
  return Math.max(0, Math.floor(Number(user.creditsBalance ?? 0)));
}

function setUserCreditBalance(user: StoredUser, balance: number) {
  user.creditsBalance = Math.max(0, Math.floor(balance));
  user.updatedAt = now();
}

function addCreditTransaction(
  store: AppStore,
  user: StoredUser,
  input: {
    type: StoredCreditTransaction["type"];
    amount: number;
    reason: string;
    relatedJobId?: string;
    orderId?: string;
  }
) {
  const amount = Math.trunc(input.amount);
  const nextBalance = getUserCreditBalance(user) + amount;

  setUserCreditBalance(user, nextBalance);
  store.creditTransactions.push({
    id: randomUUID(),
    userId: user.id,
    type: input.type,
    amount,
    balanceAfter: getUserCreditBalance(user),
    reason: input.reason,
    relatedJobId: input.relatedJobId,
    orderId: input.orderId,
    createdAt: now()
  });
}

function estimateAiJobCredits(type: string, payload?: unknown, user?: StoredUser | null) {
  return estimateAiTaskCredits(type, payload, user?.aiTaskPricingOverrides);
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getDefaultAiPriceConfig(modelName?: string) {
  const model = (modelName || process.env.AI_MODEL || "").toLowerCase();

  if (model.includes("pro")) {
    return {
      cacheHitUsdPer1m: 0.0145,
      cacheMissUsdPer1m: 1.74,
      outputUsdPer1m: 3.48
    };
  }

  return {
    cacheHitUsdPer1m: 0.0028,
    cacheMissUsdPer1m: 0.14,
    outputUsdPer1m: 0.28
  };
}

function getUserAiBillingMarkup(user?: StoredUser | null) {
  return readPositiveNumber(
    user?.aiBillingMarkup == null ? undefined : String(user.aiBillingMarkup),
    readPositiveNumber(process.env.AI_CREDIT_MARKUP, 3)
  );
}

function getUserAiBillingMinimum(user?: StoredUser | null) {
  return Math.floor(
    readPositiveNumber(
      user?.aiBillingMinimum == null ? undefined : String(user.aiBillingMinimum),
      readPositiveNumber(process.env.AI_CREDIT_MINIMUM_ACTUAL, 3)
    )
  );
}

function calculateTokenUsageCredits(
  usage?: AiTokenUsage,
  input?: {
    model?: string;
    user?: StoredUser | null;
  }
) {
  if (!usage || usage.totalTokens <= 0) {
    return 0;
  }

  const defaultPrice = getDefaultAiPriceConfig(input?.model);
  const cacheHitUsdPer1m = readPositiveNumber(
    process.env.AI_PRICE_CACHE_HIT_USD_PER_1M,
    defaultPrice.cacheHitUsdPer1m
  );
  const cacheMissUsdPer1m = readPositiveNumber(
    process.env.AI_PRICE_CACHE_MISS_USD_PER_1M,
    defaultPrice.cacheMissUsdPer1m
  );
  const outputUsdPer1m = readPositiveNumber(
    process.env.AI_PRICE_OUTPUT_USD_PER_1M,
    defaultPrice.outputUsdPer1m
  );
  const usdCny = readPositiveNumber(process.env.AI_USD_CNY, 7.25);
  const creditsPerCny = readPositiveNumber(process.env.AI_CREDITS_PER_CNY, 1000);
  const markup = getUserAiBillingMarkup(input?.user);
  const minimum = getUserAiBillingMinimum(input?.user);
  const inputCacheMissTokens =
    usage.promptCacheMissTokens > 0
      ? usage.promptCacheMissTokens
      : Math.max(0, usage.promptTokens - usage.promptCacheHitTokens);
  const rawUsd =
    (usage.promptCacheHitTokens / 1_000_000) * cacheHitUsdPer1m +
    (inputCacheMissTokens / 1_000_000) * cacheMissUsdPer1m +
    (usage.completionTokens / 1_000_000) * outputUsdPer1m;
  const rawCredits = rawUsd * usdCny * creditsPerCny * markup;

  return Math.max(minimum, Math.ceil(rawCredits));
}

function getConsumedCreditsForJob(store: AppStore, jobId: string) {
  return store.creditTransactions
    .filter((item) => item.relatedJobId === jobId && item.type === "consume")
    .reduce((total, item) => total + Math.abs(item.amount), 0);
}

function getRefundedCreditsForJob(store: AppStore, jobId: string) {
  return store.creditTransactions
    .filter((item) => item.relatedJobId === jobId && item.type === "refund")
    .reduce((total, item) => total + item.amount, 0);
}

function settleAiJobCredits(
  store: AppStore,
  job: StoredAiJob,
  input: {
    tokenUsage?: AiTokenUsage;
    usedAi?: boolean;
    usedFallback?: boolean;
  }
) {
  void store;
  void job;
  void input;

  return {
    mode: "disabled",
    estimatedCredits: 0,
    actualCredits: 0,
    adjustmentCredits: 0
  };
}

function withAiBillingOutput(
  store: AppStore,
  job: StoredAiJob,
  output: Record<string, unknown>,
  tokenUsage?: AiTokenUsage
) {
  settleAiJobCredits(store, job, {
    tokenUsage,
    usedAi: output.usedAi === true,
    usedFallback: output.usedFallback === true
  });

  return {
    ...output,
    tokenUsage
  };
}

function normalizeChapterAnalysisScope(scope?: ChapterAnalysisScope): Required<ChapterAnalysisScope> {
  const mode = scope?.mode === "all" || scope?.mode === "range" || scope?.mode === "single" ? scope.mode : "first";
  const toPositiveInt = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  };
  const limit = Math.min(MAX_ANALYSIS_CHAPTERS, toPositiveInt(scope?.limit, 30));
  const startChapter = toPositiveInt(scope?.startChapter, 1);
  const endChapter = toPositiveInt(scope?.endChapter, mode === "single" ? startChapter : startChapter + limit - 1);

  if (mode === "all") {
    return { mode, startChapter: 1, endChapter: Number.MAX_SAFE_INTEGER, limit: MAX_ANALYSIS_CHAPTERS };
  }

  if (mode === "single") {
    return { mode, startChapter, endChapter: startChapter, limit: 1 };
  }

  if (mode === "range") {
    return {
      mode,
      startChapter: Math.min(startChapter, endChapter),
      endChapter: Math.max(startChapter, endChapter),
      limit
    };
  }

  return { mode: "first", startChapter: 1, endChapter: limit, limit };
}

function selectChaptersForAnalysis(chapters: StoredChapter[], scope?: ChapterAnalysisScope) {
  const normalized = normalizeChapterAnalysisScope(scope);
  const ordered = chapters.slice().sort((a, b) => a.orderIndex - b.orderIndex);

  if (normalized.mode === "all") {
    return ordered.slice(0, MAX_ANALYSIS_CHAPTERS);
  }

  if (normalized.mode === "first") {
    return ordered.slice(0, normalized.limit);
  }

  return ordered
    .filter(
      (chapter) =>
        chapter.chapterNumber >= normalized.startChapter &&
        chapter.chapterNumber <= normalized.endChapter
    )
    .slice(0, MAX_ANALYSIS_CHAPTERS);
}

function describeChapterAnalysisScope(chapters: StoredChapter[], scope?: ChapterAnalysisScope) {
  const selected = selectChaptersForAnalysis(chapters, scope);
  const first = selected[0]?.chapterNumber;
  const last = selected.at(-1)?.chapterNumber;

  return {
    scope: normalizeChapterAnalysisScope(scope),
    selectedChapters: selected,
    selectedCount: selected.length,
    fromChapter: first,
    toChapter: last
  };
}

function consumeCreditsForAiJob(
  store: AppStore,
  user: StoredUser,
  job: Pick<StoredAiJob, "id" | "type" | "input">
) {
  void store;
  void user;
  void job;
  return 0;
}

function refundAiJobCredits(store: AppStore, job: StoredAiJob, reason: string) {
  void store;
  void job;
  void reason;
}

function normalizeCreditTransactionLimit(limit: number | undefined) {
  const parsed = Math.floor(Number(limit ?? 40));

  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 40;
}

function normalizeCreditTransactionOffset(offset: number | undefined) {
  const parsed = Math.floor(Number(offset ?? 0));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getCreditTransactionCount(store: AppStore, userId: string) {
  return store.creditTransactions.filter((item) => item.userId === userId).length;
}

function getRecentCreditTransactions(store: AppStore, userId: string, limit = 40, offset = 0) {
  const normalizedLimit = normalizeCreditTransactionLimit(limit);
  const normalizedOffset = normalizeCreditTransactionOffset(offset);

  return store.creditTransactions
    .filter((item) => item.userId === userId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(normalizedOffset, normalizedOffset + normalizedLimit);
}

function metricNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getJobObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getJobTokenUsage(job: StoredAiJob) {
  const output = getJobObject(job.output);
  return getJobObject(output.tokenUsage);
}

function getJobBilling(job: StoredAiJob) {
  const output = getJobObject(job.output);
  return getJobObject(output.billing);
}

function getAiJobUnitCount(job: StoredAiJob) {
  const input = getJobObject(job.input);
  const output = getJobObject(job.output);

  switch (job.type) {
    case "analyze_chapters":
      return Math.max(
        1,
        metricNumber(output.chapterAnalysisCount) ||
          metricNumber(output.totalChapters) ||
          metricNumber(input.chapterCount)
      );
    case "generate_task_card":
    case "generate_chapter":
    case "review_chapter":
    case "edit_second_draft":
    case "generate_outline":
      return 1;
    default:
      return 1;
  }
}

function buildAdminAiUsageSummary(jobs: StoredAiJob[]): AdminAiUsageSummary {
  const rows = jobs.map((job) => {
    const output = getJobObject(job.output);
    const usage = getJobTokenUsage(job);
    const billing = getJobBilling(job);
    const hasBilledActualCredits = Object.prototype.hasOwnProperty.call(billing, "actualCredits");

    return {
      type: job.type,
      usedAi: output.usedAi === true,
      usedFallback: output.usedFallback === true,
      units: getAiJobUnitCount(job),
      totalTokens: metricNumber(usage.totalTokens),
      promptTokens: metricNumber(usage.promptTokens),
      completionTokens: metricNumber(usage.completionTokens),
      cacheHitTokens: metricNumber(usage.promptCacheHitTokens),
      cacheMissTokens: metricNumber(usage.promptCacheMissTokens),
      reasoningTokens: metricNumber(usage.reasoningTokens),
      actualCredits: hasBilledActualCredits
        ? metricNumber(billing.actualCredits)
        : usage.totalTokens
          ? calculateTokenUsageCredits(usage as unknown as AiTokenUsage, { model: job.model })
          : 0,
      estimatedCredits: metricNumber(billing.estimatedCredits)
    };
  });
  const total = rows.reduce(
    (sum, row) => ({
      jobs: sum.jobs + 1,
      aiJobs: sum.aiJobs + (row.usedAi ? 1 : 0),
      fallbackJobs: sum.fallbackJobs + (row.usedFallback ? 1 : 0),
      units: sum.units + row.units,
      totalTokens: sum.totalTokens + row.totalTokens,
      promptTokens: sum.promptTokens + row.promptTokens,
      completionTokens: sum.completionTokens + row.completionTokens,
      cacheHitTokens: sum.cacheHitTokens + row.cacheHitTokens,
      cacheMissTokens: sum.cacheMissTokens + row.cacheMissTokens,
      reasoningTokens: sum.reasoningTokens + row.reasoningTokens,
      actualCredits: sum.actualCredits + row.actualCredits,
      estimatedCredits: sum.estimatedCredits + row.estimatedCredits
    }),
    {
      jobs: 0,
      aiJobs: 0,
      fallbackJobs: 0,
      units: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      reasoningTokens: 0,
      actualCredits: 0,
      estimatedCredits: 0
    }
  );
  const byType = Array.from(
    rows
      .reduce((map, row) => {
        const current = map.get(row.type) ?? {
          type: row.type,
          jobs: 0,
          units: 0,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          reasoningTokens: 0,
          actualCredits: 0,
          estimatedCredits: 0,
          fallbackJobs: 0
        };
        current.jobs += 1;
        current.units += row.units;
        current.totalTokens += row.totalTokens;
        current.promptTokens += row.promptTokens;
        current.completionTokens += row.completionTokens;
        current.reasoningTokens += row.reasoningTokens;
        current.actualCredits += row.actualCredits;
        current.estimatedCredits += row.estimatedCredits;
        current.fallbackJobs += row.usedFallback ? 1 : 0;
        map.set(row.type, current);
        return map;
      }, new Map<string, AdminAiUsageTypeSummary>())
      .values()
  ).sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    ...total,
    byType
  };
}

function buildAccountOverview(
  store: AppStore,
  user: StoredUser,
  options?: { creditTransactionLimit?: number; creditTransactionOffset?: number },
  resolvedLicenseState?: DesktopLicenseState
) {
  const limits = getPlanLimitsForUser(user);
  const usage = getUserUsage(store, user);
  const license = user.licenseCodeHash
    ? store.licenseCodes.find((item) => item.codeHash === user.licenseCodeHash)
    : null;
  const licenseState = resolvedLicenseState ?? resolveDesktopLicenseState(store, user);
  void options;

  return {
    user: toAuthUser(user),
    license: {
      status: licenseState.status,
      message: licenseState.message ?? "",
      customerId: user.licenseCustomerId ?? "",
      codePreview: license?.codePreview ?? "",
      codePurpose: user.licenseCodePurpose ?? license?.purpose ?? undefined,
      machineHash: user.licenseMachineHash ?? license?.machineHash ?? "",
      activatedAt: user.licenseActivatedAt ?? license?.activatedAt ?? "",
      lastVerifiedAt: license?.lastVerifiedAt ?? "",
      expiresAt: licenseState.expiresAt ?? user.licenseExpiresAt ?? license?.expiresAt ?? "",
      isTrial: Boolean(licenseState.expiresAt ?? user.licenseExpiresAt ?? license?.expiresAt)
    },
    billingMode: getBillingMode(),
    planName: limits.name,
    usage,
    limits,
    onboardingCompletedAt: user.onboardingCompletedAt ?? null,
    aiSettings: getUserAiSettings(store, user.id),
    billing: {
      creditsBalance: 0,
      packages: [],
      recentTransactions: [],
      transactionTotalCount: 0,
      transactionLimit: 0,
      transactionOffset: 0
    }
  };
}

function buildUserAiTaskPricing(user: StoredUser) {
  return AI_TASK_PRICING_DEFINITIONS.map((definition) => {
    const pricing = resolveAiTaskPricing(definition.type, user.aiTaskPricingOverrides);

    return {
      type: pricing.type,
      label: pricing.label,
      unitLabel: pricing.unitLabel,
      baseCredits: pricing.baseCredits,
      unitCredits: pricing.unitCredits,
      multiplier: pricing.multiplier,
      isCustom: pricing.isCustom
    };
  });
}

function buildAdminDashboard(store: AppStore): AdminDashboardSummary {
  const aiUsage = buildAdminAiUsageSummary(store.aiJobs);
  const users = store.users
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((user) => {
      const ownedProjectIds = getOwnedProjectIds(store, user.id);
      const userJobs = store.aiJobs.filter(
        (job) => job.userId === user.id || (job.projectId ? ownedProjectIds.has(job.projectId) : false)
      );
      const userAiUsage = buildAdminAiUsageSummary(userJobs);
      const lastJobAt = userJobs
        .map((job) => job.updatedAt || job.createdAt)
        .sort()
        .at(-1);
      const session = store.sessions
        .filter((item) => item.userId === user.id)
        .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))[0];

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: isAdminUser(store, user) ? "admin" : user.role,
        plan: getPlanKey(user.plan),
        licenseCustomerId: user.licenseCustomerId,
        licenseActivatedAt: user.licenseActivatedAt,
        creditsBalance: 0,
        aiModel: getUserAiSettings(store, user.id).model || process.env.AI_MODEL || "未配置",
        aiBillingMarkup: getUserAiBillingMarkup(user),
        aiBillingMinimum: getUserAiBillingMinimum(user),
        aiTaskPricing: buildUserAiTaskPricing(user),
        projectCount: ownedProjectIds.size,
        aiJobCount: userJobs.length,
        aiTokenTotal: userAiUsage.totalTokens,
        aiCreditActual: 0,
        creditConsumed: 0,
        creditRecharged: 0,
        lastActiveAt: session?.lastSeenAt ?? lastJobAt ?? user.updatedAt ?? user.createdAt
      };
    });

  return {
    totalUsers: store.users.length,
    adminUsers: users.filter((user) => user.role === "admin").length,
    totalCreditsBalance: 0,
    totalConsumed: 0,
    totalRecharged: 0,
    totalAiJobs: store.aiJobs.length,
    aiUsage,
    users
  };
}

export async function getAdminDashboard() {
  const store = await readStore();
  await requireAdminUser(store);
  return createDomainReadRepository(store).getAdminDashboard();
}

export async function getAdminLicenseCenter(options?: { recentLogLimit?: number; recentLogOffset?: number }) {
  const store = await readStore();
  await requireAdminUser(store);

  const center = buildAdminLicenseCenter(store, options);
  await writeStore(store);
  return center;
}

export async function generateAdminLicenseCodes(input: {
  quantity: number;
  customerName?: string;
  customerContact?: string;
  durationMinutes?: number;
  durationHours?: number;
  expiresAt?: string;
  notes?: string;
  purpose?: "desktop" | "web";
}) {
  const store = await readStore();
  await requireAdminUser(store);
  syncLegacyConfiguredCodes(store);

  const quantity = Math.max(1, Math.min(50, Math.floor(Number(input.quantity) || 1)));
  const timestamp = now();
  const generated: string[] = [];
  const existingHashes = new Set(store.licenseCodes.map((item) => item.codeHash));
  const durationMinutes = Number(input.durationMinutes);
  const durationHours = Number(input.durationHours);
  const activationDurationMinutes =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? Math.floor(durationMinutes)
      : Number.isFinite(durationHours) && durationHours > 0
        ? Math.floor(durationHours * 60)
        : 0;
  const expiresAt = activationDurationMinutes <= 0 && input.expiresAt
    ? new Date(input.expiresAt)
    : null;

  for (let index = 0; index < quantity; index += 1) {
    let code = createActivationCode();
    let codeHash = hashActivationCode(code);

    while (existingHashes.has(codeHash)) {
      code = createActivationCode();
      codeHash = hashActivationCode(code);
    }

    existingHashes.add(codeHash);
    generated.push(code);
    const license: StoredLicenseCode = {
      id: randomUUID(),
      codeHash,
      plainCode: code,
      codePreview: previewActivationCode(code),
      purpose: input.purpose === "web" ? "web" : "desktop",
      customerName: normalizeLicenseText(input.customerName),
      customerContact: normalizeLicenseText(input.customerContact),
      status: "unused",
      maxActivations: 1,
      activationCount: 0,
      durationMinutes: activationDurationMinutes > 0 ? activationDurationMinutes : undefined,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.toISOString() : undefined,
      notes: normalizeLicenseText(input.notes),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    store.licenseCodes.unshift(license);
  }

  await writeStore(store);
  console.info(
    `[admin/licenses] generated purpose=${input.purpose === "web" ? "web" : "desktop"} quantity=${generated.length} codes=${generated.join(",")}`
  );
  return { codes: generated, center: buildAdminLicenseCenter(store) };
}

export async function updateAdminLicenseCode(input: {
  licenseId: string;
  action: "disable" | "delete" | "resetMachine" | "setWebPurpose" | "setDesktopPurpose";
}) {
  const store = await readStore();
  await requireAdminUser(store);

  const license = store.licenseCodes.find((item) => item.id === input.licenseId);

  if (!license) {
    throw new Error("授权码不存在");
  }

  const timestamp = now();

  if (input.action === "delete") {
    store.licenseCodes = store.licenseCodes.filter((item) => item.id !== input.licenseId);
    store.licenseActivationLogs = store.licenseActivationLogs.filter((item) => item.licenseCodeId !== input.licenseId);
    await writeStore(store);
    return buildAdminLicenseCenter(store);
  }

  if (input.action === "disable") {
    license.status = "disabled";
    license.disabledAt = timestamp;
  }

  if (input.action === "resetMachine") {
    if (license.status === "disabled") {
      throw new Error("授权码已作废，不能重置设备");
    }

    if (license.status === "expired" || (license.expiresAt && Date.parse(license.expiresAt) <= Date.now())) {
      license.status = "expired";
      license.updatedAt = timestamp;
      throw new Error("授权码已过期，不能重置设备");
    }

    license.status = "unused";
    license.activationCount = 0;
    license.machineHash = undefined;
    license.activatedAt = undefined;
    license.lastVerifiedAt = undefined;
    store.licenseActivationLogs.unshift({
      id: randomUUID(),
      licenseCodeId: license.id,
      codeHash: license.codeHash,
      machineHash: "",
      result: "success",
      reason: "machine_reset",
      clientName: "管理员重置设备",
      createdAt: timestamp
    });
    store.licenseActivationLogs = store.licenseActivationLogs.slice(0, 300);
  }

  if (input.action === "setWebPurpose" || input.action === "setDesktopPurpose") {
    license.purpose = input.action === "setWebPurpose" ? "web" : "desktop";
  }

  if (!["disable", "delete", "resetMachine"].includes(input.action)) {
    throw new Error("未知授权码操作");
  }

  license.updatedAt = timestamp;
  await writeStore(store);
  return buildAdminLicenseCenter(store);
}

export async function grantCreditsToUser(input: {
  userId: string;
  amount: number;
  reason: string;
}) {
  void input;
  throw new Error("积分计费已经下线，当前版本只支持一次性授权和用户自带 AI Key。");
}

export async function updateUserAiControls(input: {
  userId: string;
  model: string;
  aiBillingMarkup: number;
  aiBillingMinimum: number;
  aiTaskPricingOverrides?: unknown;
}) {
  const store = await readStore();
  await requireAdminUser(store);
  const target = store.users.find((user) => user.id === input.userId);

  if (!target) {
    throw new Error("用户不存在");
  }

  const model = input.model.trim();
  const allowedModels = new Set(["platform-fast", "platform-quality"]);

  if (!allowedModels.has(model)) {
    throw new Error("模型只能选择 platform-fast 或 platform-quality");
  }

  const markup = Number(input.aiBillingMarkup);
  const minimum = Math.floor(Number(input.aiBillingMinimum));

  const current = getPrimaryAiSettings(store, target.id);
  setPrimaryAiSettings(store, {
    userId: target.id,
    providerName: current?.providerName || "",
    baseUrl: current?.baseUrl || "",
    apiKey: current?.apiKey || "",
    model,
    timeoutMs: current?.timeoutMs || Number(process.env.AI_TIMEOUT_MS ?? 60000),
    updatedAt: now()
  });

  void markup;
  void minimum;
  target.aiBillingMarkup = undefined;
  target.aiBillingMinimum = undefined;
  target.aiTaskPricingOverrides = undefined;
  target.updatedAt = now();

  await writeStore(store);
  return buildAdminDashboard(store);
}

function buildExportPayload(store: AppStore, user: StoredUser) {
  const ownedProjects = getOwnedProjects(store, user.id);
  const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));
  const ownedTemplateIds = store.templates
    .filter((template) => !template.ownerUserId || template.ownerUserId === user.id)
    .map((template) => template.id);
  const assistantThreads = (store.assistantThreads ?? []).filter(
    (item) => item.ownerUserId === user.id && (!item.projectId || ownedProjectIds.has(item.projectId))
  );
  const assistantThreadIds = new Set(assistantThreads.map((thread) => thread.id));

  const payload = {
    exportedAt: now(),
    backupVersion: 2,
    backupScope: "account-workspace",
    user: toAuthUser(user),
    plan: user.plan ?? "trial",
    onboardingCompletedAt: user.onboardingCompletedAt ?? null,
    projects: ownedProjects,
    sourceTexts: store.sourceTexts.filter((item) => ownedProjectIds.has(item.projectId)),
    chapters: store.chapters.filter((item) => ownedProjectIds.has(item.projectId)),
    chapterAnalyses: store.chapterAnalyses.filter((item) => ownedProjectIds.has(item.projectId)),
    storyAnalyses: store.storyAnalyses.filter((item) => ownedProjectIds.has(item.projectId)),
    aiJobs: store.aiJobs.filter((item) => item.userId === user.id || (item.projectId ? ownedProjectIds.has(item.projectId) : false)),
    templates: store.templates.filter((item) => ownedTemplateIds.includes(item.id)),
    inspirations: (store.inspirations ?? []).filter(
      (item) => item.ownerUserId === user.id && (!item.projectId || ownedProjectIds.has(item.projectId))
    ),
    outlines: store.outlines.filter((item) => ownedTemplateIds.includes(item.templateId)),
    writingBibles: store.writingBibles.filter((item) => ownedProjectIds.has(item.projectId)),
    characterProfiles: store.characterProfiles.filter((item) => ownedProjectIds.has(item.projectId)),
    foreshadowings: store.foreshadowings.filter((item) => ownedProjectIds.has(item.projectId)),
    plotStates: store.plotStates.filter((item) => ownedProjectIds.has(item.projectId)),
    longFormPlans: (store.longFormPlans ?? []).filter((item) => ownedProjectIds.has(item.projectId)),
    customRelationGraphs: (store.customRelationGraphs ?? []).filter((item) => ownedProjectIds.has(item.projectId)),
    writingTaskCards: store.writingTaskCards.filter((item) => ownedProjectIds.has(item.projectId)),
    chapterDrafts: store.chapterDrafts.filter((item) => ownedProjectIds.has(item.projectId)),
    chapterLedgers: store.chapterLedgers.filter((item) => ownedProjectIds.has(item.projectId)),
    reviewReports: store.reviewReports.filter((item) => ownedProjectIds.has(item.projectId)),
    editReports: store.editReports.filter((item) => ownedProjectIds.has(item.projectId)),
    assistantThreads,
    assistantMessages: (store.assistantMessages ?? []).filter((item) => assistantThreadIds.has(item.threadId)),
    creditTransactions: store.creditTransactions.filter((item) => item.userId === user.id),
    creditsBalance: getUserCreditBalance(user),
    aiSettings: getPrimaryAiSettings(store, user.id)
  };

  return {
    ...payload,
    counts: backupPayloadCounts(payload)
  };
}

async function purgeUserAccount(store: AppStore, userId: string) {
  const timestamp = now();
  const ownedProjectIds = getOwnedProjectIds(store, userId);
  const ownedTemplateIds = store.templates
    .filter((template) => !template.ownerUserId || template.ownerUserId === userId)
    .map((template) => template.id);
  const removedAssistantThreadIds = new Set(
    (store.assistantThreads ?? [])
      .filter((thread) => thread.ownerUserId === userId || (thread.projectId && ownedProjectIds.has(thread.projectId)))
      .map((thread) => thread.id)
  );

  store.sourceTexts = store.sourceTexts.filter((item) => !ownedProjectIds.has(item.projectId));
  store.chapters = store.chapters.filter((item) => !ownedProjectIds.has(item.projectId));
  store.chapterAnalyses = store.chapterAnalyses.filter((item) => !ownedProjectIds.has(item.projectId));
  store.storyAnalyses = store.storyAnalyses.filter((item) => !ownedProjectIds.has(item.projectId));
  store.writingBibles = store.writingBibles.filter((item) => !ownedProjectIds.has(item.projectId));
  store.characterProfiles = store.characterProfiles.filter((item) => !ownedProjectIds.has(item.projectId));
  store.foreshadowings = store.foreshadowings.filter((item) => !ownedProjectIds.has(item.projectId));
  store.plotStates = store.plotStates.filter((item) => !ownedProjectIds.has(item.projectId));
  store.longFormPlans = (store.longFormPlans ?? []).filter((item) => !ownedProjectIds.has(item.projectId));
  store.customRelationGraphs = (store.customRelationGraphs ?? []).filter((item) => !ownedProjectIds.has(item.projectId));
  store.writingTaskCards = store.writingTaskCards.filter((item) => !ownedProjectIds.has(item.projectId));
  store.chapterDrafts = store.chapterDrafts.filter((item) => !ownedProjectIds.has(item.projectId));
  store.chapterLedgers = store.chapterLedgers.filter((item) => !ownedProjectIds.has(item.projectId));
  store.reviewReports = store.reviewReports.filter((item) => !ownedProjectIds.has(item.projectId));
  store.editReports = store.editReports.filter((item) => !ownedProjectIds.has(item.projectId));
  store.inspirations = (store.inspirations ?? []).filter((item) => item.ownerUserId !== userId);
  store.assistantThreads = (store.assistantThreads ?? []).filter((item) => !removedAssistantThreadIds.has(item.id));
  store.assistantMessages = (store.assistantMessages ?? []).filter((item) => !removedAssistantThreadIds.has(item.threadId));
  store.outlines = store.outlines.filter((item) => !ownedTemplateIds.includes(item.templateId));
  store.templates = store.templates.filter(
    (item) => item.ownerUserId !== userId && (!item.sourceProjectId || !ownedProjectIds.has(item.sourceProjectId))
  );
  store.projects = store.projects.filter((item) => !ownedProjectIds.has(item.id));
  store.aiJobs = store.aiJobs.filter((item) => item.userId !== userId && !(item.projectId && ownedProjectIds.has(item.projectId)));
  store.creditTransactions = store.creditTransactions.filter((item) => item.userId !== userId);
  store.aiSettings = normalizeStoredAiSettings(store.aiSettings).filter((item) => item.userId !== userId);
  store.sessions = store.sessions.filter((item) => item.userId !== userId);
  store.users = store.users.filter((item) => item.id !== userId);

  await writeStore(store);
  await clearSessionCookie();

  return { deletedAt: timestamp };
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|，|、/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureDefaultWritingState(store: AppStore, project: StoredProject) {
  const timestamp = now();
  let changed = false;

  if (!store.writingBibles.some((item) => item.projectId === project.id)) {
    store.writingBibles.push({
      id: randomUUID(),
      projectId: project.id,
      workType: project.type === "writing" ? "长篇连载" : "结构拆解",
      targetReader: "网文读者",
      corePleasure: "高频爽点、清晰反馈、持续期待",
      protagonistDesire: "逆袭、解决危机、获得地位与资源",
      worldRules: "信息差、资源差、身份差共同驱动冲突升级",
      goldenFingerRules: "早期给方向，中期给资源，后期加门槛",
      powerSystem: "以阶段性成长和代价约束为核心",
      narrativeTaboos: "不提前泄露未接触真相，不让人物突然透视全局",
      immutableSettings: "主角底层诉求、核心冲突、世界规则必须稳定",
      styleGuide: "快节奏、强反馈、章节末留钩子",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    changed = true;
  }

  if (!store.plotStates.some((item) => item.projectId === project.id)) {
    store.plotStates.push({
      id: randomUUID(),
      projectId: project.id,
      currentVolume: "",
      currentMap: "",
      mainGoal: "建立主角的第一轮逆袭循环",
      shortTermGoal: "完成当前章节任务并保留下一章钩子",
      currentStage: "开局压制与第一次反击",
      currentEnemy: "待明确的第一阶段对手",
      unresolvedQuestions: ["主角隐藏身份", "金手指限制"],
      openThreads: ["主角隐藏身份", "金手指限制"],
      resolvedThreads: [],
      nextMilestones: ["完成第一次大爽点", "引出更高层敌人"],
      nextStageGoal: "把个人冲突推进到更高层势力或更大地图",
      powerSystemState: "",
      mapAndForces: "",
      resourceState: "",
      relationshipChanges: [],
      createdAt: timestamp,
      updatedAt: timestamp
    });
    changed = true;
  }

  if (changed) {
    return true;
  }

  return false;
}

function cleanList(values?: string[]) {
  return Array.from(
    new Set((values ?? []).map((item) => item.trim()).filter(Boolean))
  );
}

function getCustomRelationGraphs(store: AppStore) {
  store.customRelationGraphs ??= [];
  return store.customRelationGraphs;
}

function customGraphNodeType(value: unknown): CustomRelationGraphNodeType {
  const type = String(value ?? "");
  return type === "person" ||
    type === "place" ||
    type === "force" ||
    type === "thread" ||
    type === "core" ||
    type === "power" ||
    type === "resource" ||
    type === "knowledge" ||
    type === "event"
    ? type
    : "event";
}

function customGraphTone(value: unknown): CustomRelationGraphTone {
  const tone = String(value ?? "");
  return tone === "success" ||
    tone === "danger" ||
    tone === "warning" ||
    tone === "core"
    ? tone
    : "neutral";
}

function customGraphEdgeTone(value: unknown): StoredCustomRelationGraphEdge["tone"] {
  const tone = customGraphTone(value);
  return tone === "core" ? "neutral" : tone;
}

function resolveTargetReader(value: string): TargetReader | null {
  return value === "男频" || value === "女频" ? value : null;
}

function getCategoryDescription(targetReader: string, genre: string, tagTaxonomyStyle?: string) {
  const reader = resolveTargetReader(targetReader);

  if (!reader) {
    return "";
  }

  if (tagTaxonomyStyle === "qidian") {
    return qidianTaxonomyByReader[reader].find((category) => category.name === genre)?.description ?? "";
  }

  return novelTaxonomy[reader].mainCategories.find((category) => category.name === genre)?.description ?? "";
}

function buildGenreBoundaryRules(input: {
  targetReader: string;
  genre: string;
  categoryDescription?: string;
  tags: string[];
}) {
  return [
    input.targetReader ? `目标读者频道固定为：${input.targetReader}。` : "",
    input.genre ? `主分类固定为：${input.genre}。` : "",
    input.categoryDescription ? `主分类定义：${input.categoryDescription}` : "",
    input.tags.length ? `作品主题/角色标签固定为：${input.tags.join("、")}。` : "",
    input.genre
      ? `后续任务卡、正文、人物、地图、能力体系和爽点设计必须优先服务「${input.genre}」这个主分类，不得擅自切换到不相干题材。`
      : "",
    input.tags.length
      ? "可以扩展细节，但不能把已选主题/角色标签写反、写丢，或引入与这些标签明显冲突的核心设定。"
      : ""
  ].filter(Boolean);
}

function removeLegacyPlacedLines(value: string, prefixes: string[]) {
  const lines = value.split(/\r?\n/);
  const cleaned: string[] = [];
  let skippingNumberedBlock = false;

  lines.forEach((line) => {
    const text = line.trim();

    if (!text) {
      skippingNumberedBlock = false;
      return;
    }

    if (prefixes.some((prefix) => text.startsWith(prefix))) {
      skippingNumberedBlock = text.startsWith("前10章大纲");
      return;
    }

    if (skippingNumberedBlock && /^\d+[.、]/.test(text)) {
      return;
    }

    skippingNumberedBlock = false;
    cleaned.push(text);
  });

  return cleanList(cleaned).join("\n");
}

function extractLabeledLine(value: string, label: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith(label))
    ?.replace(label, "")
    .trim() ?? "";
}

function sanitizeLegacyStatePlacement(
  store: AppStore,
  project: StoredProject
) {
  const bible = store.writingBibles.find((item) => item.projectId === project.id);
  const plotState = store.plotStates.find((item) => item.projectId === project.id);
  let changed = false;

  if (bible) {
    if (bible.targetReader === "小红书读者" || bible.targetReader === "公众号读者") {
      bible.targetReader = "网文读者";
      bible.updatedAt = now();
      changed = true;
    }

    const nextImmutableSettings = removeLegacyPlacedLines(bible.immutableSettings, [
      "作品简介：",
      "大纲一句话卖点：",
      "来源大纲：",
      "主分类：",
      "作品标签：",
      "开局钩子：",
      "前10章大纲："
    ]) || "不改变主角核心身份、世界规则、金手指限制和已公开事实。";
    const nextProtagonistDesire = removeLegacyPlacedLines(bible.protagonistDesire, [
      "项目目标：",
      "一句话卖点：",
      "前100章节奏：",
      "爽点分布："
    ]) || bible.protagonistDesire;

    if (nextImmutableSettings !== bible.immutableSettings) {
      bible.immutableSettings = nextImmutableSettings;
      bible.updatedAt = now();
      changed = true;
    }

    if (nextProtagonistDesire !== bible.protagonistDesire) {
      bible.protagonistDesire = nextProtagonistDesire;
      bible.updatedAt = now();
      changed = true;
    }
  }

  if (plotState) {
    if (plotState.currentVolume === "第一卷") {
      plotState.currentVolume = "";
      plotState.updatedAt = now();
      changed = true;
    }

    if (plotState.currentMap === "初始地图") {
      plotState.currentMap = "";
      plotState.updatedAt = now();
      changed = true;
    }

    const extractedGoal =
      extractLabeledLine(plotState.mainGoal, "一句话卖点：") ||
      extractLabeledLine(plotState.mainGoal, "当前主线目标：");
    const isDescriptionDump =
      /基于已生成的新书大纲|前100章节奏|爽点分布|作品简介|围绕作品设想推进/.test(plotState.mainGoal) ||
      plotState.mainGoal.length > 180;
    const nextMainGoal = isDescriptionDump
      ? extractedGoal || "完成第一阶段主线：建立压制、反击和持续悬念。"
      : plotState.mainGoal;

    if (nextMainGoal !== plotState.mainGoal) {
      plotState.mainGoal = nextMainGoal;
      plotState.updatedAt = now();
      changed = true;
    }

    const nextMapAndForces = cleanMapAndForceEntries(splitLines(plotState.mapAndForces), 8).join("\n");

    if (nextMapAndForces && nextMapAndForces !== plotState.mapAndForces) {
      plotState.mapAndForces = nextMapAndForces;
      plotState.updatedAt = now();
      changed = true;
    }
  }

  return changed;
}

function normalizeInitialCharacters(input: InitialProjectStateInput) {
  const supportedRoles = new Set(["男主", "女主", "男配", "女配"]);
  const fromCharacters = Array.isArray(input.protagonistCharacters)
    ? input.protagonistCharacters
        .map((item) => {
          const name = item?.name?.trim() ?? "";
          const role = item?.role?.trim() ?? "";

          return name
            ? {
                name,
                role: supportedRoles.has(role) ? role : "主要人物"
              }
            : null;
        })
        .filter((item): item is { name: string; role: string } => Boolean(item))
    : [];

  if (fromCharacters.length > 0) {
    return fromCharacters;
  }

  return cleanList(input.protagonistNames).map((name, index) => ({
    name,
    role: index === 0 ? "男主" : index === 1 ? "女主" : "主要人物"
  }));
}

function buildProjectPromiseText(project: StoredProject) {
  return compactStateText(
    [project.name, project.description].map((item) => item.trim()).filter(Boolean).join("｜"),
    260
  );
}

function extractMechanismPromiseFromText(value: string) {
  const sentences = value
    .replace(/【[^】]+】/g, "")
    .split(/(?<=[。！？!?；;])|[｜\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const mechanismSentence = sentences.find((sentence) =>
    /系统|金手指|机制|规则|绑定|对应|兑换|自动|触发|条件|靠|凭|通过|升级|变强|收益|奖励/.test(sentence)
  );

  return mechanismSentence ? compactStateText(mechanismSentence, 180) : "";
}

function normalizeWorkLengthPlan(input: InitialProjectStateInput) {
  const type = input.workLengthType === "short" || input.workLengthType === "medium" || input.workLengthType === "long" || input.workLengthType === "epic"
    ? input.workLengthType
    : "medium";
  const labels: Record<NonNullable<InitialProjectStateInput["workLengthType"]>, string> = {
    short: "短篇",
    medium: "中篇",
    long: "长篇",
    epic: "超长篇"
  };
  const guidance: Record<NonNullable<InitialProjectStateInput["workLengthType"]>, string> = {
    short: "短篇节奏：主线集中，少开支线，尽早埋结局条件，避免无限升级。",
    medium: "中篇节奏：主线完整，支线克制，每一阶段都要推进结局所需条件。",
    long: "长篇节奏：允许多阶段升级和地图推进，但每卷都要服务终局目标。",
    epic: "超长篇节奏：需要多卷结构、长期悬念和阶段性收束，避免只扩张不回收。"
  };
  const numberValue = Number(input.targetTotalWords);
  const targetTotalWords = Number.isFinite(numberValue) && numberValue > 0
    ? Math.min(5000000, Math.max(50000, Math.round(numberValue)))
    : 500000;
  const targetWan = Math.round(targetTotalWords / 10000);

  return {
    type,
    label: labels[type],
    targetTotalWords,
    display: `${targetWan}万字左右`,
    guidance: guidance[type]
  };
}

function inferTargetTotalWordsFromState(project: StoredProject, bible: StoredWritingBible, explicitValue?: number) {
  const explicit = Number(explicitValue);

  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.min(5_000_000, Math.max(50_000, Math.round(explicit)));
  }

  const text = [
    project.description,
    bible.workType,
    bible.corePleasure,
    bible.styleGuide,
    bible.immutableSettings
  ].join("\n");
  const wanMatch = text.match(/目标约\s*(\d+(?:\.\d+)?)\s*万字|(\d+(?:\.\d+)?)\s*万字左右|(\d+(?:\.\d+)?)\s*万字/);

  if (wanMatch) {
    const wan = Number(wanMatch[1] ?? wanMatch[2] ?? wanMatch[3]);
    if (Number.isFinite(wan) && wan > 0) {
      return Math.min(5_000_000, Math.max(50_000, Math.round(wan * 10_000)));
    }
  }

  if (/30万/.test(text)) {
    return 300_000;
  }

  if (/超长篇|百万|100万/.test(text)) {
    return 1_000_000;
  }

  if (/长篇|50万/.test(text)) {
    return 500_000;
  }

  if (/短篇|10万/.test(text)) {
    return 100_000;
  }

  return 300_000;
}

function estimateChapterCount(targetTotalWords: number) {
  return Math.max(20, Math.ceil(targetTotalWords / 1800));
}

function buildDefaultLongFormProgressionRules(targetTotalWords: number, estimatedChapters: number) {
  const isMediumOrLong = targetTotalWords >= 100_000 || estimatedChapters >= 60;
  const isLong = targetTotalWords >= 300_000 || estimatedChapters >= 120;

  if (!isMediumOrLong) {
    return [
      "前10章先建立机制可信度和第一阶段压力，不要用连续突破替代剧情推进。"
    ];
  }

  return [
    "长期阶梯口径：简介或创作圣经里的等级、阈值、奖励、职位、地图、势力、权限、关系或目标清单，默认是全书长期规则/上限表，不是第一卷进度表；不得按列出顺序自动排进前期章节。",
    "默认节奏：除非用户明确选择短篇、开局满级、快穿、极限快节奏等特殊模式，前10章最多允许一次正式大阶段跨档，不要连续两次正式大突破。",
    "默认节奏：多个命名成长阶段应按目标篇幅拉开距离；如果提前触碰下一阶段门槛，只能写成接近门槛、资格、临时收益、风险预告或下一章目标。",
    "收益口径：一次性收获、短期任务、预期收益、临时合作或试用资格不能直接等同稳定指标/长期权限/永久资源，只能作为进度、资格、临时助力或后续目标。",
    "章节功能：前10章不能每章都安排数值上涨或正式跨档，必须穿插日常压力、关系铺垫、机制限制、误判、信息差和下一步目标。",
    "突破口径：凡是正式提升成长层级、身份、地图、权限或核心资源，必须有稳定来源、触发条件、结算周期或代价后果；否则降级为小收益或线索。"
  ].concat(
    isLong
      ? [
          "长篇预算：前30章默认仍是第一阶段主循环建立期，重点是验证机制、稳定读者期待和制造第一阶段压力，不是快速兑现核心成长表。",
          "长篇预算：第一卷默认只消耗长期成长阶梯的前段资源；中后期档位、终局目标或高阶敌人不得直接设为第一卷完成目标，除非用户明确要求极快节奏。",
          "大阶段跨档应按卷或阶段收束安排；小收益可以较高频，中收益需要铺垫，大阶段不要靠阈值表或任务清单自动连跳。"
        ]
      : []
  );
}

function applyInitialProjectState(
  store: AppStore,
  project: StoredProject,
  input?: InitialProjectStateInput
) {
  if (project.type !== "writing" || !input) {
    return false;
  }

  ensureDefaultWritingState(store, project);

  const timestamp = now();
  const tags = cleanList(input.tags);
  const protagonistCharacters = normalizeInitialCharacters(input).slice(0, 8);
  const protagonists = protagonistCharacters.map((character) => character.name);
  const projectPromise = buildProjectPromiseText(project);
  const coreSellingPoint = input.coreSellingPoint?.trim() ?? "";
  const openingHook = input.openingHook?.trim() ?? "";
  const goldenFinger = input.goldenFinger?.trim() ?? "";
  const effectiveCoreSellingPoint = coreSellingPoint || projectPromise;
  const effectiveGoldenFinger = goldenFinger || extractMechanismPromiseFromText(projectPromise);
  const writingGoal = input.writingGoal?.trim() ?? "";
  const workLengthPlan = normalizeWorkLengthPlan(input);
  const outlineId = input.outlineId?.trim() ?? "";
  const outlineLogline = input.outlineLogline?.trim() ?? "";
  const worldSetting = input.worldSetting?.trim() ?? "";
  const outlineChapters = cleanList(input.outlineChapters).slice(0, 10);
  const first100Pacing = input.first100Pacing?.trim() ?? "";
  const foreshadowingPlan = cleanList(input.foreshadowingPlan).slice(0, 12);
  const pleasureDistribution = input.pleasureDistribution?.trim() ?? "";
  const targetReader = input.targetReader?.trim() ?? "";
  const tagTaxonomyStyle = input.tagTaxonomyStyle === "qidian" ? "qidian" : "fanqie";
  const categoryDescription = getCategoryDescription(targetReader, project.genre, tagTaxonomyStyle);
  const genreBoundaryRules = buildGenreBoundaryRules({
    targetReader,
    genre: project.genre,
    categoryDescription,
    tags
  });
  const bible = store.writingBibles.find((item) => item.projectId === project.id);
  const plotState = store.plotStates.find((item) => item.projectId === project.id);

  if (!bible || !plotState) {
    return false;
  }

  bible.workType = project.genre ? `${project.genre}${workLengthPlan.label}` : workLengthPlan.label;
  bible.targetReader = targetReader || bible.targetReader;
  bible.corePleasure = [
    project.genre ? `主分类：${project.genre}` : "",
    categoryDescription ? `题材边界：${categoryDescription}` : "",
    `作品体量：${workLengthPlan.label}，目标约${workLengthPlan.display}`,
    effectiveCoreSellingPoint ? `核心承诺：${effectiveCoreSellingPoint}` : "",
    tags.length ? `作品标签：${tags.join("、")}` : "",
    openingHook ? `开局情绪：${openingHook}` : ""
  ].filter(Boolean).join("\n") || bible.corePleasure;
  bible.protagonistDesire = [
    protagonistCharacters.length
      ? `主要人物：${protagonistCharacters.map((character) => `${character.role}：${character.name}`).join("、")}`
      : "",
    "后续需要继续补充关键人物真正想要什么、害怕失去什么、愿意付出什么代价。"
  ].filter(Boolean).join("\n");
  bible.worldRules = worldSetting || bible.worldRules;
  bible.goldenFingerRules = effectiveGoldenFinger || bible.goldenFingerRules;
  bible.immutableSettings = [
    "不改变主角核心身份、底层欲望和已公开事实。",
    projectPromise ? `作品承诺：${projectPromise}` : "",
    "不改变项目简介、核心卖点、金手指机制和开局承诺；后续支线必须服务这些核心承诺。",
    "不让人物提前知道未揭露真相。",
    ...genreBoundaryRules,
    worldSetting ? "世界规则以「世界规则」字段为准，不随章节临时改写。" : "",
    effectiveGoldenFinger ? `关键机制：${effectiveGoldenFinger}` : "",
    openingHook ? `开局钩子必须被承接：${openingHook}` : "",
    "收益合规：能力、境界、财富、资源、地位、权限、情报或关系收益必须写清来源、触发条件、代价/限制，并符合关键机制。",
    "禁止机制偷换：不能只保留机制名词，却让主角实际靠另一套资源、奇遇、副本或外力完成核心成长。",
    "早期节奏：前 5 章优先建立机制、压力和第一轮小台阶；10 万字以上作品不要过早连续大境界突破，可先写资格、试用、预期收益、小额增长或机制验证。",
    "章节功能允许轮换：可写日常经营、关系铺垫、机制试错、小收益和低强度压力；不要每章都强行新敌人、新地图、大战斗或大突破。",
    `体量边界：按${workLengthPlan.label} ${workLengthPlan.display}规划节奏，不要无限开新地图、新体系或新支线；接近后期时主动收束主线、回收伏笔并准备完结。`
  ].filter(Boolean).join("\n") || bible.immutableSettings;
  bible.narrativeTaboos = cleanList([
    bible.narrativeTaboos,
    project.genre ? `禁止偏离主分类：${project.genre}` : "",
    tags.length ? `禁止无视或反向改写作品标签：${tags.join("、")}` : "",
    "禁止用通用副本、通用秘境、通用组织替代书名和简介已经承诺的核心看点。",
    "禁止让连续支线、新地图、新组织或新危机取代项目简介中的核心卖点和主线承诺。",
    "禁止为了制造爽点临时改换目标读者、题材频道、核心人设或力量体系。"
  ]).join("\n") || bible.narrativeTaboos;
  bible.styleGuide = [
    bible.styleGuide,
    project.genre ? `题材口味：${project.genre}${categoryDescription ? `，${categoryDescription}` : ""}` : "",
    `体量节奏：${workLengthPlan.guidance}`,
    tags.length ? `标签口味：${tags.join("、")}` : "",
    first100Pacing ? `前100章节奏：${first100Pacing}` : "",
    pleasureDistribution ? `爽点分布：${pleasureDistribution}` : ""
  ].filter(Boolean).join("\n");
  bible.updatedAt = timestamp;

  plotState.mainGoal = outlineLogline || effectiveCoreSellingPoint || `完成${workLengthPlan.label} ${workLengthPlan.display}的完整主线：建立压制、反击、升级、终局回收和完结路径。`;
  plotState.shortTermGoal = outlineChapters[0] || openingHook || "补齐开局压制、第一次反击和章末钩子。";
  plotState.currentStage = outlineChapters[0] ? `大纲第1章：${outlineChapters[0]}` : openingHook || "新书开局设定阶段";
  plotState.currentEnemy = "待明确的第一阶段压力源";
  plotState.mapAndForces = worldSetting || plotState.mapAndForces;
  plotState.openThreads = cleanList([
    ...plotState.openThreads,
    openingHook ? `开局钩子：${openingHook}` : "",
    effectiveGoldenFinger ? `金手指限制：${effectiveGoldenFinger}` : "",
    ...foreshadowingPlan.map((item) => `大纲伏笔：${item}`)
  ]);
  plotState.unresolvedQuestions = cleanList([
    ...plotState.unresolvedQuestions,
    "主角真实底层欲望",
    "第一阶段反派或压力源",
    ...foreshadowingPlan
  ]);
  plotState.nextMilestones = cleanList([
    ...outlineChapters.map((chapter, index) => `大纲第${index + 1}章：${chapter}`),
    `按${workLengthPlan.label} ${workLengthPlan.display}规划阶段节奏，避免无边界扩写`,
    openingHook ? "兑现开局钩子的第一轮情绪回报" : "",
    effectiveCoreSellingPoint ? `围绕核心承诺设计前 10 章节奏：${compactStateText(effectiveCoreSellingPoint, 100)}` : "",
    ...plotState.nextMilestones
  ]);
  plotState.nextStageGoal = outlineChapters[0] || effectiveCoreSellingPoint || plotState.nextStageGoal;
  plotState.updatedAt = timestamp;

  protagonistCharacters.forEach((character, index) => {
    if (store.characterProfiles.some((item) => item.projectId === project.id && item.name === character.name)) {
      return;
    }

    store.characterProfiles.push({
      id: randomUUID(),
      projectId: project.id,
      name: character.name,
      identity: character.role,
      currentGoal: writingGoal || "等待补充当前目标",
      longTermGoal: "等待补充长期目标",
      secret: effectiveGoldenFinger ? `可能与关键机制相关：${effectiveGoldenFinger}` : "",
      relationshipToProtagonist: index === 0 ? "本人" : `${character.role} / 重要关系人`,
      attitude: "待补充",
      abilityBoundary: effectiveGoldenFinger || "待补充能力边界",
      voice: "待补充说话习惯",
      knownInformation: "只知道开局阶段已经明确的信息，不能提前知道未揭露真相。",
      unknownInformation: "第一阶段反派真相、伏笔答案、后续地图信息。",
      lastAppearance: "新建作品",
      currentState: openingHook || "新书开局待写",
      createdAt: timestamp,
      updatedAt: timestamp
    });
  });

  foreshadowingPlan.forEach((plan, index) => {
    const cleanPlan = compactStateText(plan, 120);
    const name = normalizeForeshadowingName(cleanPlan);

    if (!name || !isValidForeshadowingName(name)) {
      return;
    }

    const exists = store.foreshadowings.some(
      (item) => item.projectId === project.id && (item.name === name || cleanPlan.includes(item.name))
    );

    if (exists) {
      return;
    }

    store.foreshadowings.push({
      id: randomUUID(),
      projectId: project.id,
      name,
      plantedChapter: index === 0 ? "开局规划" : "大纲规划",
      relatedCharacters: protagonists,
      relatedLocation: worldSetting ? "大纲世界观" : "",
      status: "open",
      expectedRevealChapter: "按大纲节奏回收",
      revealMethod: "后续生成章节任务卡时逐步安排",
      hiddenInformation: cleanPlan,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  });

  project.updatedAt = timestamp;
  return true;
}

function getLatestWritingTaskCard(store: AppStore, projectId: string) {
  return store.writingTaskCards
    .filter((card) => card.projectId === projectId)
    .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt))[0]
    ?? null;
}

function getLatestLongFormPlan(store: AppStore, projectId: string) {
  store.longFormPlans ??= [];
  return store.longFormPlans
    .filter((plan) => plan.projectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    ?? null;
}

function getLatestChapterDraft(store: AppStore, projectId: string) {
  return store.chapterDrafts
    .filter((draft) => draft.projectId === projectId)
    .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt))[0]
    ?? null;
}

function getLatestChapterLedgerBefore(store: AppStore, projectId: string, chapterNumber: number) {
  return store.chapterLedgers
    .filter((ledger) => ledger.projectId === projectId && ledger.chapterNumber < chapterNumber)
    .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt))[0]
    ?? null;
}

function getLatestChapterDraftBefore(store: AppStore, projectId: string, chapterNumber: number) {
  return store.chapterDrafts
    .filter((draft) => draft.projectId === projectId && draft.chapterNumber < chapterNumber)
    .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt))[0]
    ?? null;
}

function buildFallbackChapterDraftContent(taskCard: StoredWritingTaskCard) {
  return [
    `${taskCard.title}`,
    "",
    `上一章留下的压力没有消失。${taskCard.continuity}`,
    "",
    `这一章的核心不是让主角轻松赢，而是先把误判和压制摆出来。${taskCard.requiredCharacters.join("、")}陆续进入场面，每个人都带着自己的算盘，主角只能从最细的缝隙里找机会。`,
    "",
    `${taskCard.chapterGoal}他没有急着解释，而是等对方把话说满、把局做死。等所有人都以为结果已经确定时，主角才抛出真正的证据或能力边界，让局面第一次反转。`,
    "",
    `爽点释放在这里：${taskCard.pleasurePoint}读者得到的不是空泛胜利，而是“刚才压得越狠，现在反弹越清楚”的回报。`,
    "",
    `同时，本章必须处理伏笔：${taskCard.foreshadowingTasks.join("；")}这些信息只露出一角，不能提前把真相讲透。`,
    "",
    `章末，${taskCard.endingHook}`
  ].join("\n");
}

function normalizeDraftTargetWordCount(value?: number) {
  if (!Number.isFinite(value)) {
    return 2500;
  }

  return Math.min(3000, Math.max(800, Math.floor(Number(value))));
}

function diagnoseAiFlavor(originalText: string) {
  const sentences = originalText
    .split(/(?<=[。！？!?])/)
    .map((item) => item.trim())
    .filter(Boolean);
  const aiFlavorSentences = sentences.filter((sentence) =>
    /通过|体现|整体|较为|具有|展现了|进一步|有效地|重要意义/.test(sentence)
  );

  return {
    aiFlavorSentences,
    diagnosis: [
      "减少抽象总结句，多写具体动作和反应。",
      "保留明确判断，不要把所有评价写成中立报告口吻。",
      "打破句长过于平均的问题，让关键句更短、更狠。"
    ]
  };
}

function buildFallbackEditedText(mode: string, originalText: string) {
  return mode === "毒舌点评版"
    ? originalText
        .replace(/本章通过/g, "这章最该看的不是")
        .replace(/体现了/g, "而是把")
        .replace(/整体节奏较为平稳/g, "节奏还不够狠，压制没有压到读者想看反击")
    : originalText
        .replace(/本章通过/g, "这一章先用")
        .replace(/体现了/g, "把")
        .replace(/整体节奏较为/g, "节奏")
        .replace(/具有重要意义/g, "能真正推着读者往下看");
}

function createAiJob(
  store: AppStore,
  input: {
    userId: string;
    projectId?: string;
    type: string;
    payload?: unknown;
    model: string;
    retryOfJobId?: string;
  }
) {
  const timestamp = now();
  const user = store.users.find((item) => item.id === input.userId);
  const job: StoredAiJob = {
    id: randomUUID(),
    userId: input.userId,
    projectId: input.projectId,
    type: input.type,
    status: "pending",
    input: input.payload,
    attempts: 1,
    model: input.model,
    retryOfJobId: input.retryOfJobId,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (user) {
    const usage = getUserUsage(store, user);
    const limits = getPlanLimitsForUser(user);

    if (usage.aiJobsThisMonth + 1 > limits.monthlyAiJobs) {
      throw new Error("当前套餐本月 AI 任务额度已用完，请稍后再试或升级套餐");
    }

    consumeCreditsForAiJob(store, user, {
      id: job.id,
      type: input.type,
      input: input.payload
    });
  }

  store.aiJobs.push(job);
  return job;
}

function startAiJob(job: StoredAiJob) {
  const timestamp = now();
  job.status = "running";
  job.updatedAt = timestamp;
  job.startedAt = timestamp;
}

function getJobInputRecord(job: StoredAiJob) {
  if (!job.input || typeof job.input !== "object") {
    return null;
  }

  return job.input as Record<string, unknown>;
}

function finishAiJob(job: StoredAiJob, output?: unknown) {
  const timestamp = now();
  job.status = "succeeded";
  job.output = output;
  job.updatedAt = timestamp;
  job.finishedAt = timestamp;
}

function failAiJob(job: StoredAiJob, error: string, output?: unknown) {
  const timestamp = now();
  job.status = "failed";
  job.error = error;
  job.output = output;
  job.updatedAt = timestamp;
  job.finishedAt = timestamp;
}

function normalizeProjectChapterOrder(store: AppStore, projectId: string) {
  store.chapters
    .filter((chapter) => chapter.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
    .forEach((chapter, index) => {
      chapter.orderIndex = index;
      chapter.chapterNumber = index + 1;
    });
}

function uniqueList(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

const CHINESE_NUMBER_MAP: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

function parseChineseInteger(value: string) {
  const text = value.trim();

  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  if (text === "十") {
    return 10;
  }

  if (text.includes("十")) {
    const [tensText, onesText = ""] = text.split("十");
    const tens = tensText ? CHINESE_NUMBER_MAP[tensText] ?? 0 : 1;
    const ones = onesText ? CHINESE_NUMBER_MAP[onesText] ?? 0 : 0;
    return tens * 10 + ones;
  }

  return CHINESE_NUMBER_MAP[text] ?? NaN;
}

function extractChapterNumbers(value: string) {
  const matches = value.matchAll(/第?\s*([0-9]+|[零一二两三四五六七八九十]{1,4})\s*章/g);
  return Array.from(matches)
    .map((match) => parseChineseInteger(match[1]))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function hasChapterRefAtOrAfter(value: string, chapterNumber: number) {
  return extractChapterNumbers(value).some((item) => item >= chapterNumber);
}

function stripChapterRefsAtOrAfter(value: string, chapterNumber: number) {
  const lines = splitLines(value).filter((line) => !hasChapterRefAtOrAfter(line, chapterNumber));

  if (lines.length > 0) {
    return lines.join("\n");
  }

  return hasChapterRefAtOrAfter(value, chapterNumber) ? "" : value;
}

function characterForChapterContext(character: StoredCharacterProfile, chapterNumber: number) {
  const touchedCurrentOrFutureChapter = [
    character.lastAppearance,
    character.currentState,
    character.knownInformation,
    character.currentGoal,
    character.relationshipToProtagonist
  ].some((value) => hasChapterRefAtOrAfter(value, chapterNumber));

  if (!touchedCurrentOrFutureChapter) {
    return character;
  }

  return {
    ...character,
    currentGoal:
      stripChapterRefsAtOrAfter(character.currentGoal, chapterNumber) ||
      (chapterNumber === 1 ? "待根据第一章更新" : character.currentGoal),
    relationshipToProtagonist:
      stripChapterRefsAtOrAfter(character.relationshipToProtagonist, chapterNumber) ||
      character.relationshipToProtagonist,
    knownInformation:
      stripChapterRefsAtOrAfter(character.knownInformation, chapterNumber) ||
      (chapterNumber === 1
        ? "只知道开局阶段已经明确的信息，不能提前知道未揭露真相。"
        : character.knownInformation),
    lastAppearance: chapterNumber === 1 ? "新建作品" : "",
    currentState:
      stripChapterRefsAtOrAfter(character.currentState, chapterNumber) ||
      (chapterNumber === 1 ? "新书开局待写" : "")
  };
}

function inferCharacterGenderFromProjectEvidence(
  store: AppStore,
  projectId: string,
  character: StoredCharacterProfile,
  chapterNumber: number,
  currentDraftContent = ""
) {
  const name = baseCharacterName(character.name);

  if (!name) {
    return null;
  }

  const profileText = [
    character.name,
    stripAutoGenderConstraints(character.identity),
    character.relationshipToProtagonist,
    character.currentGoal,
    character.longTermGoal,
    character.secret,
    character.attitude,
    character.abilityBoundary,
    character.voice,
    character.knownInformation,
    character.unknownInformation,
    character.currentState
  ].join("\n");
  const taskText = store.writingTaskCards
    .filter((item) => item.projectId === projectId && item.chapterNumber <= chapterNumber)
    .flatMap((item) => snippetsAroundName(JSON.stringify(item), name))
    .join("\n");
  const ledgerText = store.chapterLedgers
    .filter((item) => item.projectId === projectId && item.chapterNumber < chapterNumber)
    .flatMap((item) => snippetsAroundName(JSON.stringify(item), name))
    .join("\n");
  const draftText = store.chapterDrafts
    .filter((item) => item.projectId === projectId && item.chapterNumber < chapterNumber)
    .flatMap((item) => snippetsAroundName(item.content, name))
    .join("\n");
  const currentDraftText = currentDraftContent
    ? snippetsAroundName(currentDraftContent, name, 100, 20).join("\n")
    : "";

  return inferCharacterGenderFromText(name, [profileText, taskText, ledgerText, draftText, currentDraftText].join("\n"));
}

function charactersForChapterContext(
  store: AppStore,
  projectId: string,
  chapterNumber: number
) {
  return store.characterProfiles
    .filter((item) => item.projectId === projectId)
    .map((character) => {
      const cleaned = characterForChapterContext(character, chapterNumber);
      const gender = inferCharacterGenderFromProjectEvidence(store, projectId, cleaned, chapterNumber);
      return withCharacterGenderConstraint(cleaned, gender);
    });
}

function foreshadowingsForChapterContext(
  store: AppStore,
  projectId: string,
  chapterNumber: number
) {
  return store.foreshadowings.filter(
    (item) =>
      item.projectId === projectId &&
      !hasChapterRefAtOrAfter(item.plantedChapter, chapterNumber)
  );
}

function plotStateForChapterContext(
  plotState: StoredPlotState,
  foreshadowings: StoredForeshadowing[],
  chapterNumber: number,
  lastLedger: StoredChapterLedger | null
) {
  const openForeshadowingNames = foreshadowings
    .filter((item) => item.status !== "closed")
    .map((item) => item.name)
    .slice(0, 12);

  if (chapterNumber === 1 && !lastLedger) {
    return {
      ...plotState,
      shortTermGoal: "承接开局设定，生成第一章任务卡。",
      currentStage: "新书开局阶段",
      unresolvedQuestions: openForeshadowingNames,
      openThreads: openForeshadowingNames,
      resolvedThreads: [],
      relationshipChanges: [],
      nextStageGoal: "推进第一章主线。",
      nextMilestones: stripChapterRefsAtOrAfter(plotState.nextMilestones.join("\n"), chapterNumber)
        .split("\n")
        .filter(Boolean)
    };
  }

  return {
    ...plotState,
    shortTermGoal:
      stripChapterRefsAtOrAfter(plotState.shortTermGoal, chapterNumber) ||
      (lastLedger ? `承接第 ${lastLedger.chapterNumber} 章钩子：${lastLedger.cliffhanger}` : plotState.shortTermGoal),
    currentStage:
      stripChapterRefsAtOrAfter(plotState.currentStage, chapterNumber) ||
      lastLedger?.stateChanges[0] ||
      plotState.currentStage,
    unresolvedQuestions: plotState.unresolvedQuestions.filter(
      (item) => !hasChapterRefAtOrAfter(item, chapterNumber)
    ),
    openThreads: plotState.openThreads.filter((item) => !hasChapterRefAtOrAfter(item, chapterNumber)),
    resolvedThreads: plotState.resolvedThreads.filter((item) => !hasChapterRefAtOrAfter(item, chapterNumber)),
    nextMilestones: plotState.nextMilestones.filter((item) => !hasChapterRefAtOrAfter(item, chapterNumber)),
    relationshipChanges: plotState.relationshipChanges.filter(
      (item) => !hasChapterRefAtOrAfter(item, chapterNumber)
    )
  };
}

function isCharacterScheduledForChapter(character: StoredCharacterProfile, chapterNumber: number) {
  const scheduledNumbers = extractChapterNumbers(
    [
      character.lastAppearance,
      character.currentState,
      character.currentGoal,
      character.relationshipToProtagonist
    ].join("\n")
  );

  return scheduledNumbers.includes(chapterNumber);
}

function buildCharacterTaskInstruction(character: StoredCharacterProfile) {
  return [
    `${character.name}`,
    character.identity ? `身份：${character.identity}` : "",
    character.relationshipToProtagonist ? `与主角关系：${character.relationshipToProtagonist}` : "",
    character.currentGoal ? `当前目标：${character.currentGoal}` : "",
    character.lastAppearance ? `近期出场：${character.lastAppearance}` : "",
    character.currentState ? `当前状态：${character.currentState}` : "",
    character.knownInformation ? `已知：${character.knownInformation}` : "",
    character.unknownInformation ? `未知：${character.unknownInformation}` : ""
  ]
    .filter(Boolean)
    .join("；");
}

function withCharacterTaskRequirement(value: string, constraints: string[]) {
  if (constraints.length === 0) {
    return value;
  }

  const missing = constraints.filter((constraint) => !value.includes(constraint.split("；")[0]));

  if (missing.length === 0) {
    return value;
  }

  return `${value} 本章必须落实人物状态：${missing.join("；")}。`;
}

function compactStateText(value: string, maxLength = 90) {
  const normalized = value
    .replace(/\s+/g, "")
    .replace(/[“”"]/g, "")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}

function isNoisyStateText(value: string) {
  const text = value.trim();

  return (
    text.length < 4 ||
    text.length > 140 ||
    /这些信息只露出一角|不要提前|不能提前把真相讲透|等所有人都以为|爽点释放在这里|这一章的核心|上一章留下的压力/.test(text)
  );
}

function cleanStateEntries(values: string[], limit = 8, maxLength = 90) {
  return uniqueList(
    values
      .map((item) => compactStateText(item, maxLength))
      .filter((item) => !isNoisyStateText(item))
  ).slice(0, limit);
}

function normalizeMapAndForceEntry(value: string) {
  const raw = value.trim();

  if (
    !raw ||
    /待补充|未详细展开|记录当前地图|初始地图与势力关系待补充|大纲世界观|有旧|关系|关联|可能关联|态度|伏笔/.test(raw)
  ) {
    return "";
  }

  let text = raw
    .replace(/^(地点|势力|地图|组织|阵营|场景|当前地图)[：:]\s*/, "")
    .replace(/^与/, "")
    .trim();

  text = text
    .split(/——|--|，|。|；|;|\(|（/)
    .map((item) => item.trim())
    .find(Boolean) ?? "";
  text = text.replace(/等具体场景.*$/, "").replace(/关系.*$/, "").trim();

  if (
    !text ||
    /^(她|他|它|我|你|这里|那里|那边|这边|前面|后面|开始|随后|然后|再|又|便|却|就|于是|忽然|突然|慢慢|轻轻|缓缓|沉默|闭上眼|转身|抬头|低头|看向|走向|停下)$/.test(text)
  ) {
    return "";
  }

  if (/^(前厅|大厅|正厅|后山|枯井|后山枯井|房间|院子|庭院|密室|屋顶|书房|厢房|后院|大门|演武场|训练场|广场|山门|内院|外院)$/.test(text)) {
    return "";
  }

  const matched = text.match(/[\u4e00-\u9fa5A-Za-z0-9]{1,12}(家族|宗门|公司|学院|基地|黑市|码头|组织|阵营|联盟|商会|王朝|帝国|宗|家|府|城|楼|局|阁|门|派|宫|谷|村|镇|堂|殿|司|营|军|盟|会|馆|塔|岛|湖|河|国)/);
  const normalized = matched?.[0] ?? text;

  if (
    !matched ||
    normalized.length > 14 ||
    /^(地点|势力|地图|组织|阵营|场景)$/.test(normalized) ||
    /^(前厅|大厅|正厅|后山|枯井|后山枯井|房间|院子|庭院|密室|屋顶|书房|厢房|后院|大门|演武场|训练场|广场|山门|内院|外院)$/.test(normalized)
  ) {
    return "";
  }

  return normalized;
}

function normalizePowerSystemEntry(value: string) {
  const raw = compactStateText(value, 90);

  if (!raw || /待补充|未建立|暂无|不涉及|没有|未出现|仍未|尚未/.test(raw)) {
    return "";
  }

  if (
    !/(战力|修为|境界|实力|能力边界|能力上限|天赋|异能|灵根|血脉|真气|灵力|灵气|内力|气劲|斗气|法力|神识|系统|金手指|升级|突破|觉醒|代价|限制|技能|功法|等级)/.test(raw)
  ) {
    return "";
  }

  const text = raw
    .replace(/^(战力|修为|境界|实力|能力边界|能力上限|系统|金手指|等级|限制|代价)[：:]\s*/, "")
    .split(/——|--|，|。|；|;|\(|（/)
    .map((item) => item.trim())
    .find(Boolean) ?? "";

  if (
    !text ||
    /^(她|他|它|我|你|这里|那里|然后|随后|开始|于是|忽然|突然|慢慢|轻轻|缓缓|闭上眼|转身|抬头|低头|看向|走向|停下)$/.test(text)
  ) {
    return "";
  }

  return text;
}

function normalizeResourceEntry(value: string) {
  const raw = compactStateText(value, 90);

  if (!raw || /待补充|未记录|暂无|不涉及|没有|未出现|仍未|尚未/.test(raw)) {
    return "";
  }

  if (
    !/(获得|拿到|得到|领取|兑换|缴获|赢得|收获|失去|消耗|奖励|资源|道具|装备|丹药|灵石|功法|合同|股份|名额|钥匙|证据|账本|令牌|宝物|法器|武器|药材|钱财|银票|金币|权限|身份|线索|情报|筹码|配方|秘籍|地图碎片)/.test(raw)
  ) {
    return "";
  }

  const text = raw
    .replace(/^(资源|道具|装备|奖励|线索|情报|身份|权限)[：:]\s*/, "")
    .split(/——|--|，|。|；|;|\(|（/)
    .map((item) => item.trim())
    .find(Boolean) ?? "";

  if (
    !text ||
    /^(她|他|它|我|你|这里|那里|然后|随后|开始|于是|忽然|突然|慢慢|轻轻|缓缓|闭上眼|转身|抬头|低头|看向|走向|停下)$/.test(text)
  ) {
    return "";
  }

  return text;
}

function cleanMapAndForceEntries(values: string[], limit = 8) {
  return uniqueList(values.map(normalizeMapAndForceEntry).filter(Boolean)).slice(0, limit);
}

function cleanPowerSystemEntries(values: string[], limit = 8) {
  return uniqueList(values.map(normalizePowerSystemEntry).filter(Boolean)).slice(0, limit);
}

function cleanResourceEntries(values: string[], limit = 8) {
  return uniqueList(values.map(normalizeResourceEntry).filter(Boolean)).slice(0, limit);
}

function baseCharacterName(name: string) {
  return name.replace(/[（(].*?[）)]/g, "").trim();
}

type CharacterGender = "female" | "male";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAutoGenderConstraints(value: string) {
  return value
    .replace(/[；;，,。\s]*性别[:：](?:女性|男性)[；;，,\s]*叙述代词固定用[“"]?[她他]\/[她他]的[”"]?[；;，,\s]*禁止写成[“"]?[她他]\/[她他]的[”"]?/g, "")
    .replace(/[；;，,。\s]*叙述代词(?:必须|固定)用[“"]?[她他]\/[她他]的[”"]?[；;，,\s]*禁止写成[“"]?[她他]\/[她他]的[”"]?/g, "")
    .replace(/[；;，,。\s]*人物性别和代词是硬约束[:：][^。；;\n]*/g, "")
    .trim();
}

function snippetsAroundName(text: string, name: string, radius = 80, limit = 8) {
  const snippets: string[] = [];
  let index = text.indexOf(name);

  while (index >= 0 && snippets.length < limit) {
    snippets.push(text.slice(Math.max(0, index - radius), index + name.length + radius));
    index = text.indexOf(name, index + name.length);
  }

  return snippets;
}

function countPatternMatches(text: string, pattern: RegExp) {
  return Array.from(text.matchAll(pattern)).length;
}

function scoreCharacterGenderEvidence(name: string, text: string) {
  const baseName = baseCharacterName(name);

  if (!baseName) {
    return { female: 0, male: 0 };
  }

  const escaped = escapeRegExp(baseName);
  const cleaned = stripAutoGenderConstraints(text);
  const explicitFemalePatterns = [
    new RegExp(`(?:性别[:：]?\\s*女性|女性角色|女主|女业主|女修士|女修).{0,12}${escaped}`, "g"),
    new RegExp(`${escaped}.{0,16}(?:性别[:：]?\\s*女性|女性角色|女主|女业主|女修士|女修)`, "g"),
    new RegExp(`${escaped}[（(][^）)]*(?:女性|女主|女业主|女修士|女修)[）)]`, "g")
  ];
  const explicitMalePatterns = [
    new RegExp(`(?:性别[:：]?\\s*男性|男性角色|男主|男业主|男修士|男修|男保安).{0,12}${escaped}`, "g"),
    new RegExp(`${escaped}.{0,16}(?:性别[:：]?\\s*男性|男性角色|男主|男业主|男修士|男修|男保安)`, "g"),
    new RegExp(`${escaped}[（(][^）)]*(?:男性|男主|男业主|男修士|男修|男保安)[）)]`, "g")
  ];
  const pronounFemalePatterns = [
    new RegExp(`(?:她|她的).{0,16}${escaped}`, "g"),
    new RegExp(`${escaped}.{0,16}(?:她|她的)`, "g")
  ];
  const pronounMalePatterns = [
    new RegExp(`(?:他|他的).{0,16}${escaped}`, "g"),
    new RegExp(`${escaped}.{0,16}(?:他|他的)`, "g")
  ];
  const female =
    explicitFemalePatterns.reduce((score, pattern) => score + countPatternMatches(cleaned, pattern) * 4, 0) +
    pronounFemalePatterns.reduce((score, pattern) => score + countPatternMatches(cleaned, pattern), 0);
  const male =
    explicitMalePatterns.reduce((score, pattern) => score + countPatternMatches(cleaned, pattern) * 4, 0) +
    pronounMalePatterns.reduce((score, pattern) => score + countPatternMatches(cleaned, pattern), 0);

  return { female, male };
}

function inferCharacterGenderFromText(name: string, text: string): CharacterGender | null {
  const { female: femaleScore, male: maleScore } = scoreCharacterGenderEvidence(name, text);

  if (femaleScore >= maleScore + 2) {
    return "female";
  }

  if (maleScore >= femaleScore + 2) {
    return "male";
  }

  return null;
}

function characterGenderConstraintText(name: string, gender: CharacterGender) {
  return gender === "female"
    ? `${name}：性别女性，叙述代词必须用“她/她的”，禁止写成“他/他的”。`
    : `${name}：性别男性，叙述代词必须用“他/他的”，禁止写成“她/她的”。`;
}

function withCharacterGenderConstraint(character: StoredCharacterProfile, gender: CharacterGender | null) {
  const cleanIdentity = stripAutoGenderConstraints(character.identity);

  if (!gender) {
    return cleanIdentity === character.identity ? character : { ...character, identity: cleanIdentity };
  }

  const baseName = baseCharacterName(character.name);
  const constraint = gender === "female"
    ? "性别：女性；叙述代词固定用“她/她的”，禁止写成“他/他的”"
    : "性别：男性；叙述代词固定用“他/他的”，禁止写成“她/她的”";

  return {
    ...character,
    identity: `${cleanIdentity || baseName}；${constraint}`
  };
}

function isValidAutoCharacterName(name: string) {
  const compact = baseCharacterName(name);

  return (
    compact.length >= 2 &&
    compact.length <= 4 &&
    !/主角|主要|对手|新人物|人物|同门|周围|那些|陆续|进入|带领|收到|收|与|站|袍|从|在|被|将|却|也|一人/.test(compact)
  );
}

function normalizeForeshadowingName(value: string) {
  const text = compactStateText(
    value
      .replace(/^埋下|^暗示|^围绕未解悬念继续埋设：/, "")
      .replace(/。$/, ""),
    42
  );

  return text;
}

function characterSpecificEntries(name: string, ledgers: StoredChapterLedger[]) {
  const base = baseCharacterName(name);

  if (!base) {
    return [];
  }

  return cleanStateEntries(
    ledgers.flatMap((ledger) => [
      ...ledger.events,
      ...ledger.newClues,
      ...ledger.stateChanges,
      ledger.cliffhanger
    ]).filter((entry) => entry.includes(base)),
    4,
    80
  );
}

function isValidForeshadowingName(value: string) {
  const text = value.trim();

  return (
    text.length >= 4 &&
    text.length <= 32 &&
    !/，|。|；|：|！|……|他要活着|很快|这些信息|本章|开始首次修炼|阻挠|成长|展现潜力/.test(text)
  );
}

function splitDraftSentences(content: string) {
  return content
    .split(/(?<=[。！？!?])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function endingDraftExcerpt(content: string) {
  const paragraphs = content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const lastParagraph = paragraphs.at(-1) ?? "";

  if (lastParagraph.length <= 180) {
    return lastParagraph;
  }

  const sentences = splitDraftSentences(lastParagraph);
  const lastSentences = sentences.slice(-2).join("");
  return lastSentences.length <= 180 ? lastSentences : lastSentences.slice(-180);
}

function hookKeywordGrams(value: string) {
  const stopGrams = new Set([
    "一个",
    "这些",
    "什么",
    "怎么",
    "不会",
    "不是",
    "已经",
    "开始",
    "突然",
    "发现",
    "方向",
    "处理",
    "需要",
    "明确",
    "承接",
    "结尾"
  ]);
  const compact = value.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "");
  const grams = new Set<string>();

  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      const gram = compact.slice(index, index + size);

      if (!stopGrams.has(gram)) {
        grams.add(gram);
      }
    }
  }

  return Array.from(grams);
}

function draftEndingAppearsToCarryHook(content: string, endingHook: string) {
  const hook = endingHook.trim();

  if (!hook) {
    return true;
  }

  if (content.includes(hook.slice(0, 12))) {
    return true;
  }

  const endingSection = content.slice(-700);
  const hitCount = hookKeywordGrams(hook)
    .filter((gram) => endingSection.includes(gram))
    .slice(0, 4)
    .length;

  return hitCount >= 3;
}

function buildEndingHookSuggestion(content: string, endingHook: string) {
  const original = endingDraftExcerpt(content);
  const hook = endingHook.trim();

  if (!original || !hook) {
    return `结尾需要更明确承接任务卡钩子：${hook}`;
  }

  const replacement = original.includes(hook) ? original : `${original}\n\n${hook}`;
  return `将结尾段“${original}”改为“${replacement}”。`;
}

function findAiFlavorFallbackSentence(content: string) {
  const patterns = [/通过.*体现/, /整体.*较为/, /具有.*意义/, /展现了/];

  return splitDraftSentences(content).find((sentence) =>
    patterns.some((pattern) => pattern.test(sentence))
  ) ?? "";
}

function buildAiFlavorFallbackSuggestion(sentence: string) {
  const original = sentence.trim();

  if (!original) {
    return "删掉抽象评价，改成具体动作、具体反应和具体代价。";
  }

  const revised = original
    .replace(/通过([^，。！？!?]{1,60})体现(?:出|了)?/g, "$1落到动作和对话里")
    .replace(/整体(?:上)?较为/g, "")
    .replace(/具有([^，。！？!?]{1,40})意义/g, "带来具体后果")
    .replace(/展现了/g, "让读者看见")
    .replace(/，{2,}/g, "，")
    .replace(/^，|，$/g, "")
    .trim();

  if (revised && revised !== original) {
    return `将“${original}”改为“${revised}”。如果改后仍偏虚，请补一个可见动作、对话或具体代价。`;
  }

  return `请定位“${original}”，删掉抽象评价，改成具体动作、具体反应和具体代价。`;
}

function findCharacterPronounMismatch(
  content: string,
  character: StoredCharacterProfile,
  gender: CharacterGender
) {
  const name = baseCharacterName(character.name);

  if (!name) {
    return null;
  }

  const escaped = escapeRegExp(name);
  const wrongPronoun = gender === "female" ? "他" : "她";
  const rightPronoun = gender === "female" ? "她" : "他";
  const pattern = new RegExp(
    `(${escaped}[。！？!?；;：:\\s”“’"'）】》-]{0,16})${wrongPronoun}(?=[的也却在是有从把被对向看说问低抬缓微嘴眼身手脚])`
  );
  const match = content.match(pattern);

  if (!match) {
    return null;
  }

  const start = Math.max(0, (match.index ?? 0) - 40);
  const end = Math.min(content.length, (match.index ?? 0) + match[0].length + 80);
  const snippet = content.slice(start, end).replace(/\s+/g, " ").trim();

  return {
    location: snippet,
    suggestion: `将“${snippet}”中指代${name}的“${wrongPronoun}”改为“${rightPronoun}”。${characterGenderConstraintText(name, gender)}`
  };
}

function isPronounOrGenderReviewIssue(issue: ReviewIssue) {
  const text = [issue.type, issue.problem ?? "", issue.location, issue.suggestion].join("\n");

  return /代词|性别|她\/她的|他\/他的|改为[“"']?[她他]|女性|男性/.test(text);
}

function uniqueReviewIssues(issues: ReviewIssue[]) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = [issue.type, issue.location, issue.suggestion].join("\n");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mergeReviewIssues(currentIssues: ReviewIssue[], previousIssues: ReviewIssue[]) {
  return uniqueReviewIssues([...currentIssues, ...previousIssues]);
}

function sanitizeReviewIssueText(issue: ReviewIssue): ReviewIssue {
  return {
    ...issue,
    type: formatReviewText(issue.type),
    location: formatReviewText(issue.location),
    suggestion: formatReviewText(issue.suggestion),
    problem: issue.problem ? formatReviewText(issue.problem) : undefined
  };
}

function extractLinesByKeywords(content: string, keywords: string[], limit = 6) {
  return cleanStateEntries(
    splitDraftSentences(content).filter((sentence) =>
      keywords.some((keyword) => sentence.includes(keyword))
    ),
    limit
  );
}

function ledgerToReviewEvidence(ledger?: StoredChapterLedger | null) {
  if (!ledger) {
    return "";
  }

  return [
    ledger.title,
    ledger.events.join("\n"),
    ledger.newCharacters.join("\n"),
    ledger.newClues.join("\n"),
    ledger.payoff,
    ledger.cliffhanger,
    ledger.stateChanges.join("\n")
  ].join("\n");
}

function normalizeReviewEvidence(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/[，,。！？!?；;：:“”"'‘’（）()【】\[\]《》<>—\-_/\\|、]/g, "")
    .trim();
}

function settingEvidenceFragments(value: string) {
  const genericWords = new Set([
    "规则",
    "等级",
    "宗门",
    "家族",
    "公司",
    "黑市",
    "地图",
    "势力",
    "系统",
    "境界",
    "要求",
    "详情",
    "一名"
  ]);

  return uniqueList(
    value
      .split(/\s+|[，,。！？!?；;：:“”"'‘’（）()【】\[\]《》<>—\-_/\\|、]/)
      .map(normalizeReviewEvidence)
      .filter((item) => item.length >= 4 && !genericWords.has(item))
  );
}

function isSettingLineRecorded(line: string, knownText: string) {
  const normalizedKnownText = normalizeReviewEvidence(knownText);
  const normalizedLine = normalizeReviewEvidence(line);

  if (!normalizedKnownText || !normalizedLine) {
    return false;
  }

  if (normalizedKnownText.includes(normalizedLine)) {
    return true;
  }

  const lineAnchors = [
    ...settingEvidenceFragments(line),
    normalizedLine.length >= 16 ? normalizedLine.slice(0, 16) : "",
    normalizedLine.length >= 16 ? normalizedLine.slice(-16) : ""
  ].filter((item) => item.length >= 6);

  return lineAnchors.some((anchor) => normalizedKnownText.includes(anchor));
}

function appendStateText(current: string, additions: string[], limit = 8) {
  const lines = cleanStateEntries([...splitLines(current), ...additions], limit);
  return lines.join("\n");
}

function appendMapAndForceStateText(current: string, additions: string[], limit = 8) {
  const lines = cleanMapAndForceEntries([...splitLines(current), ...additions], limit);
  return lines.join("\n");
}

function getPreviousChapterDraft(store: AppStore, projectId: string, chapterNumber: number) {
  return getLatestChapterDraftBefore(store, projectId, chapterNumber);
}

function getPreviousDraftTail(store: AppStore, projectId: string, chapterNumber: number) {
  const previousDraft = getPreviousChapterDraft(store, projectId, chapterNumber);

  if (!previousDraft) {
    return "";
  }

  const text = previousDraft.content.trim();
  return text.length > 1400 ? text.slice(-1400) : text;
}

function buildLedgerFromDraft(
  draft: StoredChapterDraft,
  taskCard: StoredWritingTaskCard | undefined
) {
  const sentences = splitDraftSentences(draft.content);
  const events = cleanStateEntries([
    ...sentences.slice(0, 3),
    taskCard?.chapterGoal ?? "",
    taskCard?.mainPlotProgress ?? ""
  ], 5);
  const resourceLines = extractLinesByKeywords(
    draft.content,
    ["获得", "拿到", "奖励", "资源", "丹药", "灵石", "功法", "合同", "股份", "名额", "钥匙"],
    4
  );
  const powerLines = extractLinesByKeywords(
    draft.content,
    ["突破", "境界", "战力", "实力", "气劲", "系统", "金手指", "等级", "限制", "代价", "修为", "异能", "灵根", "血脉"],
    4
  );
  const mapLines = extractLinesByKeywords(
    draft.content,
    ["城", "镇", "宗门", "家族", "公司", "黑市", "码头", "学院", "势力", "地图"],
    4
  );
  const clueLines = extractLinesByKeywords(
    draft.content,
    ["线索", "账本", "令牌", "名单", "暗纹", "真相", "伏笔", "秘密", "父亲", "幕后", "规则", "地图", "势力"],
    8
  );
  const endingSentence = sentences.at(-1) ?? taskCard?.endingHook ?? "新的高层冲突出现";

  return {
    events,
    newCharacters: uniqueList(
      (taskCard?.requiredCharacters ?? [])
        .map((item) => item.trim())
        .filter((item) => !item.includes("主角") && isValidAutoCharacterName(item))
    ).slice(0, 6),
    newClues: cleanStateEntries([...(taskCard?.foreshadowingTasks ?? []), ...clueLines], 8),
    payoff: compactStateText(resourceLines[0] || taskCard?.pleasurePoint || "完成一次情绪回报"),
    cliffhanger: compactStateText(taskCard?.endingHook || endingSentence, 110),
    stateChanges: cleanStateEntries([
      taskCard?.mainPlotProgress ?? "",
      ...resourceLines,
      ...powerLines,
      ...mapLines,
      endingSentence
    ], 8)
  };
}

function matchKnownCharactersInText(text: string, characters: StoredCharacterProfile[]) {
  return characters.filter((character) => {
    const name = baseCharacterName(character.name);

    return name && text.includes(name);
  });
}

function buildLocalStateGraphUpdates(
  context: ChapterStateUpdateContext,
  fallback: ReturnType<typeof buildLedgerFromDraft>
) {
  const chapterLabel = `第 ${context.draft.chapterNumber} 章`;
  const sentences = splitDraftSentences(context.draft.content);
  const requiredCharacters = uniqueList([
    ...(context.taskCard?.requiredCharacters ?? []),
    ...fallback.newCharacters
  ]).filter(isValidAutoCharacterName);
  const knownCharacters = context.characters.filter((character) =>
    requiredCharacters.some((name) => baseCharacterName(name) === baseCharacterName(character.name)) ||
    context.draft.content.includes(baseCharacterName(character.name))
  );
  const relationSentences = sentences.filter((sentence) => {
    const mentioned = matchKnownCharactersInText(sentence, context.characters);

    return mentioned.length >= 2 && /关系|合作|联手|保护|救|信任|怀疑|试探|威胁|压制|打压|追杀|敌|师|弟子|收徒|邀请|背叛|交锋|对话/.test(sentence);
  });
  const relationshipChanges = cleanStateEntries([
    ...relationSentences.map((sentence) => {
      const mentioned = matchKnownCharactersInText(sentence, context.characters).slice(0, 3);
      const names = mentioned.map((character) => character.name).join(" 与 ");

      return `${chapterLabel}：${names} 因本章事件产生关系推进：${compactStateText(sentence, 70)}`;
    })
  ], 8);
  const characterUpdates: CharacterStateUpdate[] = knownCharacters.slice(0, 8).map((character) => ({
    name: character.name,
    identity: character.identity,
    currentGoal: character.currentGoal,
    longTermGoal: character.longTermGoal,
    secret: character.secret,
    relationshipToProtagonist: character.relationshipToProtagonist,
    attitude: character.attitude,
    abilityBoundary: character.abilityBoundary,
    voice: character.voice,
    knownInformation: cleanStateEntries([
      ...fallback.events,
      ...fallback.newClues
    ].filter((item) => item.includes(baseCharacterName(character.name))), 3, 80).join("\n"),
    unknownInformation: character.unknownInformation,
    lastAppearance: chapterLabel,
    currentState: `${chapterLabel}《${context.draft.title}》出场：${compactStateText(fallback.events[0] || fallback.cliffhanger, 70)}`
  }));
  const taskForeshadowingUpdates: ForeshadowingStateUpdate[] = (context.taskCard?.foreshadowingTasks ?? [])
    .map((task) => ({
      name: normalizeForeshadowingName(task),
      status: "open" as const,
      relatedCharacters: requiredCharacters.slice(0, 5),
      relatedLocation: context.plotState.currentMap || undefined,
      expectedRevealChapter: "后续章节",
      revealMethod: "按任务卡继续埋设或回收",
      hiddenInformation: compactStateText(task, 90)
    }))
    .filter((item) => item.name && isValidForeshadowingName(item.name));

  return {
    characterUpdates,
    foreshadowingUpdates: taskForeshadowingUpdates.slice(0, 8),
    relationshipChanges,
    mapAndForceUpdates: cleanMapAndForceEntries(fallback.stateChanges.filter((item) =>
      /城|镇|宗门|家族|公司|黑市|码头|学院|势力|地图|组织|阵营|基地|秘境/.test(item)
    ), 8),
    powerSystemUpdates: cleanPowerSystemEntries(fallback.stateChanges.filter((item) =>
      /突破|境界|战力|实力|气劲|系统|金手指|等级|限制|代价|修为|功法|异能|灵根|血脉/.test(item)
    ), 8),
    resourceUpdates: cleanResourceEntries(fallback.stateChanges.filter((item) =>
      /获得|拿到|奖励|资源|丹药|灵石|功法|合同|股份|名额|钥匙|线索|证据|道具|装备|令牌|宝物|法器/.test(item)
    ), 8)
  };
}

type ChapterStateUpdateExtraction = ReturnType<typeof buildLedgerFromDraft> & {
  characterUpdates: CharacterStateUpdate[];
  foreshadowingUpdates: ForeshadowingStateUpdate[];
  relationshipChanges: string[];
  mapAndForceUpdates: string[];
  powerSystemUpdates: string[];
  resourceUpdates: string[];
  tokenUsage?: AiTokenUsage;
  usedAi: boolean;
  error?: string;
};

function mergeAiLedgerFields(
  fallback: ReturnType<typeof buildLedgerFromDraft>,
  aiUpdate: ChapterStateUpdateResult
) {
  return {
    events: cleanStateEntries(aiUpdate.events.length > 0 ? aiUpdate.events : fallback.events, 8),
    newCharacters: uniqueList(
      (aiUpdate.newCharacters.length > 0 ? aiUpdate.newCharacters : fallback.newCharacters)
        .filter((item) => isValidAutoCharacterName(item))
    ).slice(0, 8),
    newClues: cleanStateEntries(aiUpdate.newClues.length > 0 ? aiUpdate.newClues : fallback.newClues, 10),
    payoff: compactStateText(aiUpdate.payoff || fallback.payoff, 110),
    cliffhanger: compactStateText(aiUpdate.cliffhanger || fallback.cliffhanger, 130),
    stateChanges: cleanStateEntries([
      ...(aiUpdate.stateChanges.length > 0 ? aiUpdate.stateChanges : fallback.stateChanges),
      ...aiUpdate.relationshipChanges,
      ...aiUpdate.mapAndForceUpdates,
      ...aiUpdate.powerSystemUpdates,
      ...aiUpdate.resourceUpdates
    ], 14)
  };
}

async function extractChapterStateUpdate(
  context: ChapterStateUpdateContext,
  useAi: boolean
): Promise<ChapterStateUpdateExtraction> {
  const fallback = buildLedgerFromDraft(context.draft, context.taskCard);
  const localUpdate = buildLocalStateGraphUpdates(context, fallback);

  if (!useAi) {
    return {
      ...fallback,
      ...localUpdate,
      usedAi: false
    };
  }

  try {
    const aiUpdate = await extractChapterStateUpdateWithAi(context);

    return {
      ...mergeAiLedgerFields(fallback, aiUpdate),
      characterUpdates: aiUpdate.characterUpdates.length > 0 ? aiUpdate.characterUpdates : localUpdate.characterUpdates,
      foreshadowingUpdates: aiUpdate.foreshadowingUpdates.length > 0
        ? aiUpdate.foreshadowingUpdates
        : localUpdate.foreshadowingUpdates,
      relationshipChanges: cleanStateEntries(
        aiUpdate.relationshipChanges.length > 0 ? aiUpdate.relationshipChanges : localUpdate.relationshipChanges,
        10
      ),
      mapAndForceUpdates: cleanMapAndForceEntries(
        aiUpdate.mapAndForceUpdates.length > 0 ? aiUpdate.mapAndForceUpdates : localUpdate.mapAndForceUpdates,
        10
      ),
      powerSystemUpdates: cleanStateEntries(
        aiUpdate.powerSystemUpdates.length > 0 ? aiUpdate.powerSystemUpdates : localUpdate.powerSystemUpdates,
        10
      ),
      resourceUpdates: cleanStateEntries(
        aiUpdate.resourceUpdates.length > 0 ? aiUpdate.resourceUpdates : localUpdate.resourceUpdates,
        10
      ),
      tokenUsage: getAiTokenUsage(aiUpdate),
      usedAi: true
    };
  } catch (error) {
    return {
      ...fallback,
      ...localUpdate,
      usedAi: false,
      error: error instanceof Error ? error.message : "AI 状态抽取失败，已使用本地规则"
    };
  }
}

function createLedgerRecord(
  projectId: string,
  draft: StoredChapterDraft,
  extracted: ChapterStateUpdateExtraction,
  timestamp: string
): StoredChapterLedger {
  return {
    id: randomUUID(),
    projectId,
    draftId: draft.id,
    chapterNumber: draft.chapterNumber,
    title: draft.title,
    events: extracted.events,
    newCharacters: extracted.newCharacters,
    newClues: extracted.newClues,
    payoff: extracted.payoff,
    cliffhanger: extracted.cliffhanger,
    stateChanges: extracted.stateChanges,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function upsertCharacterFromUpdate(
  store: AppStore,
  projectId: string,
  update: CharacterStateUpdate,
  chapterNumber: number,
  timestamp: string
) {
  const name = update.name.trim();

  if (!name || !isValidAutoCharacterName(name)) {
    return;
  }

  const existing = store.characterProfiles.find(
    (item) => item.projectId === projectId && item.name === name
  );
  const lastAppearance = update.lastAppearance || `第 ${chapterNumber} 章`;

  if (existing) {
    existing.identity = update.identity || existing.identity;
    existing.currentGoal = update.currentGoal || existing.currentGoal;
    existing.longTermGoal = update.longTermGoal || existing.longTermGoal;
    existing.secret = update.secret || existing.secret;
    existing.relationshipToProtagonist =
      update.relationshipToProtagonist || existing.relationshipToProtagonist;
    existing.attitude = update.attitude || existing.attitude;
    existing.abilityBoundary = update.abilityBoundary || existing.abilityBoundary;
    existing.voice = update.voice || existing.voice;
    existing.knownInformation = update.knownInformation
      ? appendStateText(existing.knownInformation, [update.knownInformation], 10)
      : existing.knownInformation;
    existing.unknownInformation = update.unknownInformation || existing.unknownInformation;
    existing.lastAppearance = lastAppearance;
    existing.currentState = update.currentState || existing.currentState || `${lastAppearance}出场。`;
    existing.updatedAt = timestamp;
    return;
  }

  store.characterProfiles.push({
    id: randomUUID(),
    projectId,
    name,
    identity: update.identity || "章节状态自动识别的人物",
    currentGoal: update.currentGoal || "待补充",
    longTermGoal: update.longTermGoal || "待补充",
    secret: update.secret || "待补充",
    relationshipToProtagonist: update.relationshipToProtagonist || "待确认",
    attitude: update.attitude || "待确认",
    abilityBoundary: update.abilityBoundary || "待补充",
    voice: update.voice || "待补充",
    knownInformation: update.knownInformation || `${lastAppearance}首次进入重要剧情，具体已知信息待补充。`,
    unknownInformation: update.unknownInformation || "待补充",
    lastAppearance,
    currentState: update.currentState || `${lastAppearance}出场，需在状态管理页补全人物卡。`,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function upsertForeshadowingFromUpdate(
  store: AppStore,
  projectId: string,
  update: ForeshadowingStateUpdate,
  chapterNumber: number,
  timestamp: string
) {
  const name = normalizeForeshadowingName(update.name);

  if (!name || !isValidForeshadowingName(name)) {
    return;
  }

  const existing = store.foreshadowings.find(
    (item) => item.projectId === projectId && (item.name === name || name.includes(item.name))
  );

  if (existing) {
    existing.status = update.status || existing.status;
    existing.relatedCharacters = uniqueList([
      ...(update.relatedCharacters ?? []),
      ...existing.relatedCharacters
    ]).slice(0, 8);
    existing.relatedLocation = update.relatedLocation || existing.relatedLocation;
    existing.expectedRevealChapter = update.expectedRevealChapter || existing.expectedRevealChapter;
    existing.revealMethod = update.revealMethod || existing.revealMethod;
    existing.hiddenInformation = update.hiddenInformation || existing.hiddenInformation;
    existing.updatedAt = timestamp;
    return;
  }

  store.foreshadowings.push({
    id: randomUUID(),
    projectId,
    name,
    plantedChapter: `第 ${chapterNumber} 章`,
    relatedCharacters: update.relatedCharacters ?? [],
    relatedLocation: update.relatedLocation ?? "",
    status: update.status ?? "open",
    expectedRevealChapter: update.expectedRevealChapter ?? "待规划",
    revealMethod: update.revealMethod ?? "后续通过章节任务卡规划回收",
    hiddenInformation: update.hiddenInformation ?? name,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function applyLedgerToWritingState(
  store: AppStore,
  projectId: string,
  ledger: StoredChapterLedger,
  extracted?: ChapterStateUpdateExtraction
) {
  const timestamp = now();
  const plotState = store.plotStates.find((item) => item.projectId === projectId);
  const revealKeywords = ["回收", "揭开", "真相", "曝光", "确认", "水落石出"];

  if (plotState) {
    const cleanClues = cleanStateEntries(ledger.newClues, 8);
    const cleanChanges = cleanStateEntries(ledger.stateChanges, 8);
    const relationshipChanges = cleanStateEntries(extracted?.relationshipChanges ?? [], 10);
    const mapAndForceUpdates = cleanMapAndForceEntries(extracted?.mapAndForceUpdates ?? [], 10);
    const powerSystemUpdates = cleanStateEntries(extracted?.powerSystemUpdates ?? [], 10);
    const resourceUpdates = cleanStateEntries(extracted?.resourceUpdates ?? [], 10);
    const cleanHook = compactStateText(ledger.cliffhanger, 110);
    const stageChange = cleanChanges[0];

    plotState.currentStage = stageChange || plotState.currentStage;
    plotState.shortTermGoal = cleanHook ? `承接第 ${ledger.chapterNumber} 章钩子：${cleanHook}` : plotState.shortTermGoal;
    plotState.unresolvedQuestions = uniqueList([
      ...cleanClues,
      cleanHook,
      ...plotState.unresolvedQuestions
    ]).slice(0, 20);
    plotState.openThreads = uniqueList([
      ...cleanClues,
      cleanHook,
      ...(plotState.openThreads ?? [])
    ]).slice(0, 30);
    const resolved = cleanChanges.filter((item) =>
      revealKeywords.some((keyword) => item.includes(keyword))
    );
    plotState.resolvedThreads = uniqueList([
      ...resolved,
      ...(plotState.resolvedThreads ?? [])
    ]).slice(0, 30);
    plotState.openThreads = plotState.openThreads.filter(
      (thread) =>
        !plotState.resolvedThreads.some(
          (resolvedThread) => resolvedThread.includes(thread) || thread.includes(resolvedThread)
        )
    );
    plotState.nextMilestones = uniqueList([
      cleanHook ? `处理第 ${ledger.chapterNumber} 章钩子：${cleanHook}` : "",
      ...cleanChanges.slice(0, 3),
      ...plotState.nextMilestones
    ]).slice(0, 12);
    plotState.nextStageGoal = cleanHook || plotState.nextStageGoal;
    plotState.powerSystemState = appendStateText(
      plotState.powerSystemState,
      cleanPowerSystemEntries([
        ...powerSystemUpdates,
        ...cleanChanges
      ])
    );
    plotState.mapAndForces = appendMapAndForceStateText(
      plotState.mapAndForces,
      cleanMapAndForceEntries([
        ...mapAndForceUpdates,
        ...cleanChanges
      ])
    );
    plotState.resourceState = appendStateText(
      plotState.resourceState,
      cleanResourceEntries([
        ...resourceUpdates,
        ...cleanChanges
      ])
    );
    plotState.relationshipChanges = uniqueList([
      ...relationshipChanges,
      ...cleanChanges.filter((item) => /关系|态度|信任|敌意|盟友|背叛|合作/.test(item)),
      ...(plotState.relationshipChanges ?? [])
    ]).slice(0, 20);
    plotState.updatedAt = timestamp;
  }

  (extracted?.characterUpdates ?? []).forEach((update) => {
    upsertCharacterFromUpdate(store, projectId, update, ledger.chapterNumber, timestamp);
  });

  ledger.newCharacters.forEach((name) => {
    const existing = store.characterProfiles.find(
      (item) => item.projectId === projectId && item.name === name
    );

    if (existing) {
      existing.lastAppearance = `第 ${ledger.chapterNumber} 章`;
      existing.currentState = `第 ${ledger.chapterNumber} 章《${ledger.title}》出场。`;
      existing.knownInformation = appendStateText(
        existing.knownInformation,
        ledger.newClues.filter((clue) => clue.includes(baseCharacterName(name))),
        8
      );
      existing.currentGoal = compactStateText(ledger.cliffhanger, 80) || existing.currentGoal;
      existing.updatedAt = timestamp;
      return;
    }

    upsertCharacterFromUpdate(store, projectId, {
      name,
      identity: "章节台账自动记录的新人物",
      currentGoal: "待补充",
      longTermGoal: "待补充",
      secret: "待补充",
      relationshipToProtagonist: "待确认",
      attitude: "待确认",
      abilityBoundary: "待补充",
      voice: "待补充",
      knownInformation: `第 ${ledger.chapterNumber} 章首次出场，具体已知信息待补充。`,
      unknownInformation: "待补充",
      lastAppearance: `第 ${ledger.chapterNumber} 章`,
      currentState: `${ledger.title} 出场，需在状态管理页补全人物卡。`
    }, ledger.chapterNumber, timestamp);
  });

  (extracted?.foreshadowingUpdates ?? []).forEach((update) => {
    upsertForeshadowingFromUpdate(store, projectId, update, ledger.chapterNumber, timestamp);
  });

  store.foreshadowings
    .filter((item) => item.projectId === projectId && item.status !== "closed")
    .forEach((item) => {
      const relatedToLedger = [...ledger.newClues, ...ledger.events, ledger.cliffhanger].some(
        (textItem) => textItem.includes(item.name)
      );

      if (relatedToLedger) {
        item.status = ledger.stateChanges.some((entry) =>
          revealKeywords.some((keyword) => entry.includes(keyword))
        )
          ? "closed"
          : item.status === "open"
            ? "partial"
            : item.status;
        item.updatedAt = timestamp;
      }
    });

  ledger.newClues.forEach((clue) => {
    const cleanClue = compactStateText(clue, 90);
    const name = normalizeForeshadowingName(cleanClue);
    const exists = store.foreshadowings.some(
      (item) => item.projectId === projectId && (item.name === name || cleanClue.includes(item.name))
    );

    if (exists || isNoisyStateText(cleanClue) || !isValidForeshadowingName(name)) {
      return;
    }

    store.foreshadowings.push({
      id: randomUUID(),
      projectId,
      name,
      plantedChapter: `第 ${ledger.chapterNumber} 章`,
      relatedCharacters: ledger.newCharacters,
      relatedLocation: plotState?.currentMap ?? "",
      status: "open",
      expectedRevealChapter: "待规划",
      revealMethod: "后续通过章节任务卡规划回收",
      hiddenInformation: cleanClue,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  });
}

async function createAndApplyLedgerForDraft(
  store: AppStore,
  input: {
    projectId: string;
    draft: StoredChapterDraft;
    taskCard: StoredWritingTaskCard;
    useAi: boolean;
  }
) {
  const timestamp = now();
  const bible = store.writingBibles.find((item) => item.projectId === input.projectId)!;
  const plotState = store.plotStates.find((item) => item.projectId === input.projectId)!;
  const longFormPlan = getLatestLongFormPlan(store, input.projectId);
  const lastLedger = getLatestChapterLedgerBefore(store, input.projectId, input.draft.chapterNumber);
  const characters = charactersForChapterContext(store, input.projectId, input.draft.chapterNumber);
  const foreshadowings = foreshadowingsForChapterContext(store, input.projectId, input.draft.chapterNumber);
  const plotStateContext = plotStateForChapterContext(
    plotState,
    foreshadowings,
    input.draft.chapterNumber,
    lastLedger
  );
  const extracted = await extractChapterStateUpdate({
    draft: input.draft,
    taskCard: input.taskCard,
    bible,
    plotState: plotStateContext,
    longFormPlan,
    lastLedger,
    characters,
    foreshadowings
  }, input.useAi);
  const existingLedger = store.chapterLedgers.find((item) => item.draftId === input.draft.id);
  const ledger = createLedgerRecord(input.projectId, input.draft, extracted, timestamp);

  if (existingLedger) {
    ledger.id = existingLedger.id;
    ledger.createdAt = existingLedger.createdAt;
  }

  store.chapterLedgers = store.chapterLedgers.filter((item) => item.draftId !== input.draft.id);
  store.chapterLedgers.push(ledger);
  applyLedgerToWritingState(store, input.projectId, ledger, extracted);

  return {
    ledger,
    tokenUsage: extracted.tokenUsage,
    usedAi: extracted.usedAi,
    error: extracted.error
  };
}

function rollbackPlotStateAfterChapterDelete(
  store: AppStore,
  project: StoredProject,
  startChapter: number
) {
  ensureDefaultWritingState(store, project);

  const plotState = store.plotStates.find((item) => item.projectId === project.id);

  if (!plotState) {
    return;
  }

  const latestLedger = store.chapterLedgers
    .filter((item) => item.projectId === project.id && item.chapterNumber < startChapter)
    .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const hasDeletedChapterRef = (entry: string) =>
    extractChapterNumbers(entry).some((chapterNumber) => chapterNumber >= startChapter);
  const keepEntry = (entry: string) => !hasDeletedChapterRef(entry);

  plotState.unresolvedQuestions = cleanStateEntries(plotState.unresolvedQuestions.filter(keepEntry), 12);
  plotState.openThreads = cleanStateEntries(plotState.openThreads.filter(keepEntry), 16);
  plotState.resolvedThreads = cleanStateEntries(plotState.resolvedThreads.filter(keepEntry), 16);
  plotState.nextMilestones = cleanStateEntries(plotState.nextMilestones.filter(keepEntry), 8);
  plotState.relationshipChanges = cleanStateEntries(plotState.relationshipChanges.filter(keepEntry), 8);

  if (latestLedger) {
    const hook = compactStateText(latestLedger.cliffhanger, 110);
    plotState.shortTermGoal = hook ? `承接第 ${latestLedger.chapterNumber} 章钩子：${hook}` : plotState.shortTermGoal;
    plotState.currentStage = latestLedger.stateChanges[0] || latestLedger.events.at(-1) || plotState.currentStage;
    plotState.nextStageGoal = hook || plotState.nextStageGoal;
    plotState.nextMilestones = uniqueList([
      hook ? `处理第 ${latestLedger.chapterNumber} 章钩子：${hook}` : "",
      ...latestLedger.stateChanges.slice(0, 3),
      ...plotState.nextMilestones
    ]).slice(0, 8);
  } else {
    plotState.shortTermGoal = "承接开局设定，生成下一章任务卡。";
    plotState.currentStage = "新书开局阶段";
    plotState.nextStageGoal = "推进第一阶段主线。";
    plotState.nextMilestones = cleanStateEntries(plotState.nextMilestones, 6);
  }

  plotState.updatedAt = now();
}

function resetWritingMemoryAfterChapterDelete(
  store: AppStore,
  project: StoredProject,
  startChapter: number
) {
  const timestamp = now();
  const bible = store.writingBibles.find((item) => item.projectId === project.id);
  const plotState = store.plotStates.find((item) => item.projectId === project.id);
  const remainingLedgers = store.chapterLedgers
    .filter((item) => item.projectId === project.id && item.chapterNumber < startChapter)
    .sort((a, b) => a.chapterNumber - b.chapterNumber || a.updatedAt.localeCompare(b.updatedAt));
  const latestLedger = remainingLedgers.at(-1) ?? null;
  const stableText = [
    project.name,
    project.description,
    bible?.corePleasure,
    bible?.worldRules,
    bible?.goldenFingerRules,
    bible?.powerSystem,
    bible?.immutableSettings,
    bible?.narrativeTaboos,
    bible?.styleGuide
  ].filter(Boolean).join("\n");
  const remainingLedgerText = remainingLedgers
    .map((ledger) =>
      [
        ledger.title,
        ...ledger.events,
        ...ledger.newCharacters,
        ...ledger.newClues,
        ledger.payoff,
        ledger.cliffhanger,
        ...ledger.stateChanges
      ].join("\n")
    )
    .join("\n");
  const supportText = `${stableText}\n${remainingLedgerText}`;
  const textSupportsName = (name: string) => {
    const baseName = baseCharacterName(name);
    return Boolean(baseName && baseName.length >= 2 && supportText.includes(baseName));
  };
  const pruneMainCharacterLine = (line: string) => {
    if (!/主要人物/.test(line)) {
      return line;
    }

    const kept = line
      .replace(/^主要人物[：:]\s*/, "")
      .split(/、|，/)
      .map((item) => item.trim())
      .filter((item) => {
        const name = baseCharacterName(item.split(/[：:]/).at(-1) ?? item);
        return Boolean(name && supportText.includes(name));
      });

    return kept.length > 0 ? `主要人物：${kept.join("、")}` : "";
  };
  if (bible?.protagonistDesire) {
    bible.protagonistDesire = bible.protagonistDesire
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(pruneMainCharacterLine)
      .filter(Boolean)
      .join("\n") || "后续需要继续补充关键人物真正想要什么、害怕失去什么、愿意付出什么代价。";
    bible.updatedAt = timestamp;
  }
  const hasDeletedChapterRef = (entry: string) =>
    extractChapterNumbers(entry).some((chapterNumber) => chapterNumber >= startChapter);
  const stripDeletedChapterLines = (value: string) =>
    splitLines(value).filter((line) => !hasDeletedChapterRef(line));
  const noPreviousChapters = !latestLedger;

  store.characterProfiles = store.characterProfiles
    .filter((character) => {
      if (character.projectId !== project.id) {
        return true;
      }

      if (textSupportsName(character.name)) {
        return true;
      }

      const chapterBoundFields = [
        character.lastAppearance,
        character.currentState,
        character.knownInformation,
        character.currentGoal,
        character.relationshipToProtagonist
      ];
      const touchedDeletedChapter = chapterBoundFields.some(hasDeletedChapterRef);
      const autoCreated =
        /章节状态自动识别的人物|章节台账自动记录的新人物/.test(character.identity) ||
        /需在状态管理页补全人物卡|首次进入重要剧情/.test(
          `${character.currentState}\n${character.knownInformation}`
        );
      const looksDerived =
        autoCreated ||
        /第\s*[一二三四五六七八九十百千万\d]+\s*章|章节|台账|任务卡|钩子|出场|状态更新|关系推进|线索|伏笔|秘境|遗阵|主殿|天机阁|散修联盟/.test(
          [
            character.identity,
            character.currentGoal,
            character.knownInformation,
            character.relationshipToProtagonist,
            character.lastAppearance,
            character.currentState
          ].join("\n")
        );

      return !(touchedDeletedChapter || looksDerived);
    })
    .map((character) => {
      if (character.projectId !== project.id) {
        return character;
      }

      const chapterBoundFields = [
        character.lastAppearance,
        character.currentState,
        character.knownInformation,
        character.currentGoal,
        character.relationshipToProtagonist
      ];
      const touchedDeletedChapter = chapterBoundFields.some(hasDeletedChapterRef);

      if (!touchedDeletedChapter) {
        return character;
      }

      const knownInformation = stripDeletedChapterLines(character.knownInformation).join("\n");

      return {
        ...character,
        currentGoal: noPreviousChapters ? "待根据重写章节更新" : compactStateText(character.currentGoal, 80) || "待补充",
        knownInformation:
          knownInformation ||
          (noPreviousChapters
            ? "只知道开局阶段已经明确的信息，不能提前知道未揭露真相。"
            : character.knownInformation),
        lastAppearance: noPreviousChapters ? "新建作品" : character.lastAppearance,
        currentState: noPreviousChapters ? "新书开局待写" : character.currentState,
        updatedAt: timestamp
      };
    });

  store.foreshadowings = store.foreshadowings
    .filter((item) => {
      if (item.projectId !== project.id) {
        return true;
      }

      if (hasDeletedChapterRef(item.plantedChapter)) {
        return false;
      }

      const name = normalizeForeshadowingName(item.name);
      const supported =
        (name && supportText.includes(name)) ||
        (item.hiddenInformation && supportText.includes(compactStateText(item.hiddenInformation, 24)));

      return supported;
    })
    .map((item) => {
      if (item.projectId !== project.id) {
        return item;
      }

      const touchedDeletedChapter = [
        item.expectedRevealChapter,
        item.revealMethod,
        item.hiddenInformation
      ].some(hasDeletedChapterRef);

      if (!touchedDeletedChapter && !noPreviousChapters) {
        return item;
      }

      return {
        ...item,
        status: noPreviousChapters ? "open" : item.status,
        expectedRevealChapter: touchedDeletedChapter ? "待规划" : item.expectedRevealChapter,
        revealMethod: touchedDeletedChapter ? "后续通过章节任务卡规划回收" : item.revealMethod,
        hiddenInformation:
          stripDeletedChapterLines(item.hiddenInformation).join("\n") || item.hiddenInformation,
        updatedAt: timestamp
      };
    });

  store.customRelationGraphs = (store.customRelationGraphs ?? [])
    .map((graph) => {
      if (graph.projectId !== project.id) {
        return graph;
      }

      const nodes = graph.nodes.filter(
        (node) =>
          node.type === "core" ||
          supportText.includes(node.label) ||
          supportText.includes(node.meta) ||
          supportText.includes(node.sub)
      );
      const nodeIds = new Set(nodes.map((node) => node.id));
      const edges = graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));

      return {
        ...graph,
        nodes,
        edges,
        updatedAt: timestamp
      };
    })
    .filter((graph) => graph.projectId !== project.id || graph.nodes.length >= 2);

  if (plotState) {
    const openForeshadowingNames = store.foreshadowings
      .filter((item) => item.projectId === project.id && item.status !== "closed")
      .map((item) => item.name);
    const ledgerClues = cleanStateEntries(remainingLedgers.flatMap((ledger) => ledger.newClues), 10);
    const ledgerChanges = cleanStateEntries(remainingLedgers.flatMap((ledger) => ledger.stateChanges), 10);
    const latestHook = latestLedger ? compactStateText(latestLedger.cliffhanger, 110) : "";
    const revealKeywords = ["回收", "揭开", "真相", "曝光", "确认", "水落石出"];

    plotState.shortTermGoal = latestHook
      ? `承接第 ${latestLedger?.chapterNumber} 章钩子：${latestHook}，但必须回扣主线：${compactStateText(plotState.mainGoal, 100) || "当前核心承诺"}`
      : "承接开局设定，生成下一章任务卡。";
    plotState.currentStage = latestLedger
      ? ledgerChanges[0] || latestLedger.events.at(-1) || `已保留到第 ${latestLedger.chapterNumber} 章`
      : "新书开局阶段";
    plotState.currentEnemy = supportText.includes(plotState.currentEnemy)
      ? plotState.currentEnemy
      : "待明确的第一阶段压力源";
    plotState.unresolvedQuestions = uniqueList([
      ...openForeshadowingNames,
      ...ledgerClues,
      latestHook
    ]).slice(0, 12);
    plotState.openThreads = uniqueList([
      ...openForeshadowingNames,
      ...ledgerClues,
      latestHook
    ]).slice(0, 12);
    plotState.resolvedThreads = cleanStateEntries(
      ledgerChanges.filter((entry) => revealKeywords.some((keyword) => entry.includes(keyword))),
      8
    );
    plotState.nextMilestones = uniqueList([
      latestHook ? `处理第 ${latestLedger?.chapterNumber} 章钩子，并让它服务主线：${latestHook}` : "",
      ...ledgerChanges.slice(0, 3)
    ]).slice(0, 8);
    plotState.nextStageGoal = latestHook || plotState.mainGoal || "推进第一阶段主线。";
    plotState.powerSystemState = cleanPowerSystemEntries(
      splitLines([bible?.powerSystem, bible?.goldenFingerRules, ...remainingLedgers.flatMap((ledger) => ledger.stateChanges)].filter(Boolean).join("\n")),
      6
    ).join("\n");
    plotState.mapAndForces = cleanMapAndForceEntries(
      splitLines([bible?.worldRules, ...remainingLedgers.flatMap((ledger) => [...ledger.events, ...ledger.newClues, ...ledger.stateChanges])].filter(Boolean).join("\n")),
      6
    ).join("\n");
    plotState.resourceState = cleanResourceEntries(
      splitLines(remainingLedgers.flatMap((ledger) => [ledger.payoff, ...ledger.newClues, ...ledger.stateChanges]).join("\n")),
      6
    ).join("\n");
    plotState.relationshipChanges = cleanStateEntries(
      remainingLedgers.flatMap((ledger) => ledger.stateChanges).filter((entry) => /关系|态度|信任|敌意|盟友|背叛|合作/.test(entry)),
      8
    );
    plotState.updatedAt = timestamp;
  }
}

async function executeAnalyzeProjectJob(
  store: AppStore,
  project: StoredProject,
  job: StoredAiJob,
  chapters: StoredChapter[],
  useAi: boolean,
  timestamp: string
) {
  const existingIds = new Set(chapters.map((chapter) => chapter.id));
  store.chapterAnalyses = store.chapterAnalyses.filter(
    (analysis) => analysis.projectId !== project.id || !existingIds.has(analysis.chapterId)
  );

  const chapterRuns: Array<AnalysisRunResult<ChapterAnalysisResult>> = useAi
    ? await runChapterAiAnalysis(chapters, project)
    : chapters.map((chapter) => ({
        analysis: analyzeChapter(chapter),
        usedAi: false,
        usedFallback: true
      }));

  if (useAi) {
    const failedRuns = chapterRuns
      .map((run, index) => ({ run, chapter: chapters[index] }))
      .filter((item) => !item.run.usedAi);

    if (failedRuns.length > 0) {
      const sample = failedRuns
        .slice(0, 3)
        .map(({ run, chapter }) => `第 ${chapter.chapterNumber} 章：${run.error ?? "AI 分析失败"}`)
        .join("；");
      throw new Error(
        `AI 章节精拆失败，已停止保存本地兜底结果。失败 ${failedRuns.length} 章，${sample}`
      );
    }
  }

  const rawAnalysisResults = chapterRuns.map((run) => run.analysis);
  const analysisResults: StoredChapterAnalysis[] = rawAnalysisResults.map((result, index) => ({
    id: randomUUID(),
    projectId: project.id,
    chapterId: chapters[index].id,
    ...result,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const allProjectAnalyses = [...store.chapterAnalyses, ...analysisResults]
    .filter((analysis) => analysis.projectId === project.id)
    .sort((a, b) => {
      const chapterA = store.chapters.find((chapter) => chapter.id === a.chapterId)?.chapterNumber ?? 0;
      const chapterB = store.chapters.find((chapter) => chapter.id === b.chapterId)?.chapterNumber ?? 0;

      return chapterA - chapterB;
    });
  const storyRun = useAi
    ? await analyzeStoryWithAi(allProjectAnalyses, analysisProjectContext(project))
    : {
        analysis: buildStoryAnalysis(allProjectAnalyses),
        usedAi: false,
        usedFallback: true
      };

  if (useAi && !storyRun.usedAi) {
    throw new Error(
      `AI 整书分析失败，已停止保存本地兜底结果：${storyRun.error ?? "整书分析质量不达标"}`
    );
  }

  const storyResult = storyRun.analysis;
  const resultUsedAi = chapterRuns.every((run) => run.usedAi) && storyRun.usedAi;
  const resultUsedFallback = chapterRuns.some((run) => run.usedFallback) || storyRun.usedFallback;
  const tokenUsage = combineAiTokenUsages([
    ...rawAnalysisResults.map((result) => getAiTokenUsage(result)),
    getAiTokenUsage(storyResult)
  ]);

  const storyAnalysis: StoredStoryAnalysis = {
    id: randomUUID(),
    projectId: project.id,
    ...storyResult,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.chapterAnalyses.push(...analysisResults);
  store.storyAnalyses = store.storyAnalyses.filter((analysis) => analysis.projectId !== project.id);
  store.storyAnalyses.push(storyAnalysis);
  job.status = "succeeded";
  job.output = withAiBillingOutput(store, job, {
    usedAi: resultUsedAi,
    usedFallback: resultUsedFallback,
    chapterAnalysisCount: analysisResults.length,
    storyAnalysisChapterCount: allProjectAnalyses.length,
    storyAnalysisId: storyAnalysis.id
  }, tokenUsage);
  job.updatedAt = timestamp;
  job.finishedAt = timestamp;
  project.status = "ready";
  project.updatedAt = timestamp;

  return {
    job,
    chapterAnalyses: analysisResults,
    storyAnalysis
  };
}

function analysisProjectContext(project: StoredProject) {
  return {
    genre: project.genre,
    description: project.description
  };
}

async function runChapterAiAnalysis(chapters: StoredChapter[], project: StoredProject) {
  const results: Array<AnalysisRunResult<ChapterAnalysisResult>> = new Array(chapters.length);
  const concurrency = Math.min(3, Math.max(1, chapters.length));
  let nextIndex = 0;
  const projectContext = analysisProjectContext(project);

  async function worker() {
    while (nextIndex < chapters.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await analyzeChapterWithAi(chapters[index], projectContext);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function getAnalyzeChapterConcurrency(totalChapters: number) {
  const configured = Number(process.env.ANALYZE_CHAPTER_CONCURRENCY ?? 3);
  const concurrency = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 3;
  return Math.min(5, Math.max(1, concurrency), Math.max(1, totalChapters));
}

type AnalyzeJobProgressOutput = {
  initialized?: boolean;
  usedAi?: boolean;
  usedFallback?: boolean;
  phase?: "chapters" | "story";
  chapterAnalysisCount?: number;
  totalChapters?: number;
  processedChapterIds?: string[];
  tokenUsage?: AiTokenUsage;
};

function getAnalyzeJobProgressOutput(job: StoredAiJob): AnalyzeJobProgressOutput {
  return job.output && typeof job.output === "object"
    ? (job.output as AnalyzeJobProgressOutput)
    : {};
}

async function executeAnalyzeProjectJobStep(
  store: AppStore,
  project: StoredProject,
  job: StoredAiJob,
  chapters: StoredChapter[],
  useAi: boolean,
  timestamp: string
) {
  if (!useAi) {
    throw new Error("AI 配置不完整，无法进行章节精拆");
  }

  const progress = getAnalyzeJobProgressOutput(job);
  const selectedIds = new Set(chapters.map((chapter) => chapter.id));

  if (!progress.initialized) {
    store.chapterAnalyses = store.chapterAnalyses.filter(
      (analysis) => analysis.projectId !== project.id || !selectedIds.has(analysis.chapterId)
    );
    store.storyAnalyses = store.storyAnalyses.filter((analysis) => analysis.projectId !== project.id);
  }

  const processedChapterIds = new Set(progress.processedChapterIds ?? []);
  const nextChapters = chapters
    .filter((chapter) => !processedChapterIds.has(chapter.id))
    .slice(0, getAnalyzeChapterConcurrency(chapters.length));
  let tokenUsage = progress.tokenUsage;

  if (nextChapters.length > 0) {
    const projectContext = analysisProjectContext(project);
    const runs = await Promise.all(
      nextChapters.map((chapter) => analyzeChapterWithAi(chapter, projectContext))
    );

    for (let index = 0; index < nextChapters.length; index += 1) {
      const nextChapter = nextChapters[index];
      const run = runs[index];

      if (!run.usedAi) {
        const failedUsage = getAiTokenUsage(run.analysis);

        if (failedUsage) {
          job.output = {
            ...progress,
            initialized: true,
            usedAi: true,
            usedFallback: true,
            phase: "chapters",
            chapterAnalysisCount: processedChapterIds.size,
            totalChapters: chapters.length,
            processedChapterIds: Array.from(processedChapterIds),
            tokenUsage: combineAiTokenUsages([tokenUsage, failedUsage])
          };
        }

        throw new Error(`第 ${nextChapter.chapterNumber} 章 AI 精拆失败：${run.error ?? "分析质量不达标"}`);
      }

      store.chapterAnalyses = store.chapterAnalyses.filter((analysis) => analysis.chapterId !== nextChapter.id);
      store.chapterAnalyses.push({
        id: randomUUID(),
        projectId: project.id,
        chapterId: nextChapter.id,
        ...run.analysis,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      processedChapterIds.add(nextChapter.id);
      tokenUsage = combineAiTokenUsages([tokenUsage, getAiTokenUsage(run.analysis)]);
    }
  }

  if (processedChapterIds.size < chapters.length) {
    job.status = "running";
    job.output = {
      initialized: true,
      usedAi: false,
      usedFallback: false,
      phase: "chapters",
      chapterAnalysisCount: processedChapterIds.size,
      totalChapters: chapters.length,
      processedChapterIds: Array.from(processedChapterIds),
      tokenUsage
    };
    job.updatedAt = timestamp;
    project.status = "processing";
    project.updatedAt = timestamp;

    return {
      job,
      projectId: project.id,
      progress: job.output
    };
  }

  const orderedAnalyses = store.chapterAnalyses
    .filter((analysis) => analysis.projectId === project.id)
    .sort((a, b) => {
      const chapterA = store.chapters.find((chapter) => chapter.id === a.chapterId)?.chapterNumber ?? 0;
      const chapterB = store.chapters.find((chapter) => chapter.id === b.chapterId)?.chapterNumber ?? 0;

      return chapterA - chapterB;
    });

  chapters.forEach((chapter) => {
    const analysis = store.chapterAnalyses.find(
      (item) => item.projectId === project.id && item.chapterId === chapter.id
    );

    if (!analysis) {
      throw new Error(`第 ${chapter.chapterNumber} 章缺少拆解结果，无法生成整书分析`);
    }
  });

  job.status = "running";
  job.output = {
    initialized: true,
    usedAi: false,
    usedFallback: false,
    phase: "story",
    chapterAnalysisCount: orderedAnalyses.length,
    totalChapters: orderedAnalyses.length,
    selectedChapterCount: chapters.length,
    processedChapterIds: Array.from(processedChapterIds),
    tokenUsage
  };
  job.updatedAt = now();
  project.status = "processing";
  project.updatedAt = job.updatedAt;
  await writeStore(store);

  const storyRun = await analyzeStoryWithAi(orderedAnalyses, analysisProjectContext(project));

  if (!storyRun.usedAi) {
    const failedUsage = getAiTokenUsage(storyRun.analysis);

    if (failedUsage) {
      job.output = {
        ...progress,
        initialized: true,
        usedAi: true,
        usedFallback: true,
        phase: "story",
        chapterAnalysisCount: orderedAnalyses.length,
        totalChapters: orderedAnalyses.length,
        selectedChapterCount: chapters.length,
        processedChapterIds: Array.from(processedChapterIds),
        tokenUsage: combineAiTokenUsages([tokenUsage, failedUsage])
      };
    }

    throw new Error(`AI 整书分析失败：${storyRun.error ?? "整书分析质量不达标"}`);
  }

  tokenUsage = combineAiTokenUsages([tokenUsage, getAiTokenUsage(storyRun.analysis)]);

  const storyAnalysis: StoredStoryAnalysis = {
    id: randomUUID(),
    projectId: project.id,
    ...storyRun.analysis,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.storyAnalyses = store.storyAnalyses.filter((analysis) => analysis.projectId !== project.id);
  store.storyAnalyses.push(storyAnalysis);
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: true,
    usedFallback: false,
    phase: "done",
    chapterAnalysisCount: orderedAnalyses.length,
    totalChapters: orderedAnalyses.length,
    selectedChapterCount: chapters.length,
    processedChapterIds: Array.from(processedChapterIds),
    storyAnalysisId: storyAnalysis.id
  }, tokenUsage));
  project.status = "ready";
  project.updatedAt = timestamp;

  return {
    job,
    projectId: project.id,
    progress: job.output,
    storyAnalysis
  };
}

async function executeGenerateOutlineJob(
  store: AppStore,
  template: StoredTemplate,
  job: StoredAiJob,
  variables: OutlineVariables,
  useAi: boolean,
  timestamp: string
) {
  const result = await generateOutlineWithAi(
    {
      name: template.name,
      genre: template.genre,
      openingHook: template.openingHook,
      mainLoop: template.mainLoop,
      chapterPacing: template.chapterPacing,
      formula: template.formula,
      migrationAdvice: template.migrationAdvice
    },
    variables,
    useAi
  );
  const { usedAi: resultUsedAi, usedFallback: resultUsedFallback, ...outlineResult } = result;

  const outline: StoredOutline = {
    id: randomUUID(),
    templateId: template.id,
    variables,
    ...outlineResult,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.outlines.push(outline);
  job.status = "succeeded";
  job.output = withAiBillingOutput(store, job, {
    usedAi: resultUsedAi,
    usedFallback: resultUsedFallback,
    outlineId: outline.id
  }, getAiTokenUsage(result));
  job.updatedAt = timestamp;
  job.finishedAt = timestamp;

  return outline;
}

export async function getProjects(): Promise<ProjectWithCounts[]> {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return [];
  }

  return createDomainReadRepository(store).listProjectsForUser(currentUser.id);
}

export async function getDashboardStats(): Promise<DashboardStat[]> {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return [
      { label: "进行中项目", value: "0" },
      { label: "已导入章节", value: "0" },
      { label: "已写正文", value: "0" },
      { label: "待处理任务", value: "0" }
    ];
  }

  return createDomainReadRepository(store).getDashboardStatsForUser(currentUser.id);
}

export function formatAiJobType(type: string) {
  switch (type) {
    case "analyze_chapters":
      return "章节分析";
    case "generate_outline":
      return "生成大纲";
    case "generate_task_card":
      return "生成任务卡";
    case "generate_long_form_plan":
      return "生成长篇规划";
    case "project_creation_assist":
      return "新书立项辅助";
    case "generate_chapter":
      return "生成正文草稿";
    case "review_chapter":
      return "审稿";
    case "edit_second_draft":
      return "二稿编辑";
    default:
      return "AI 任务";
  }
}

export function formatProjectStatus(status: string) {
  switch (status) {
    case "draft":
      return "草稿";
    case "processing":
      return "处理中";
    case "ready":
      return "已就绪";
    case "writing":
      return "创作中";
    default:
      return "未知状态";
  }
}

export async function getRecentAiJobs(limit = 3) {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return [];
  }

  const repo = createDomainReadRepository(store);
  const jobs = repo
    .listJobsForUser(currentUser.id)
    .filter((job) => ["pending", "running", "failed"].includes(job.status))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  return jobs.map((job) => {
    const project = job.projectId
      ? repo.getProjectRecordForUser(job.projectId, currentUser.id)
      : null;
    const output = job.output as { usedAi?: boolean; usedFallback?: boolean } | undefined;

    const progressPercent = calculateAiJobProgress(job);

    return {
      title: project ? `${project.name} · ${formatAiJobType(job.type)}` : formatAiJobType(job.type),
      status:
        job.status === "succeeded"
          ? "完成"
          : job.status === "running"
            ? "处理中"
            : job.status === "failed"
              ? "失败"
              : job.status === "canceled"
                ? "已取消"
                : "待处理",
      progress: `${progressPercent}%`,
      progressPercent,
      detail:
        job.status === "succeeded"
          ? output?.usedAi
            ? "任务已完成并写入存储。"
            : "任务已完成，当前使用本地兜底结果。"
          : job.status === "running"
            ? "任务正在执行中。"
            : job.error || "等待执行。"
    };
  });
}

export async function getProjectAiJobs(projectId: string) {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);
  const repo = createDomainReadRepository(store);
  const project = currentUser ? repo.getProjectRecordForUser(projectId, currentUser.id) : null;

  if (!currentUser || !project) {
    return [];
  }

  return repo.listProjectJobsForUser(projectId, currentUser.id);
}

export async function getAiJob(jobId: string) {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return null;
  }

  return createDomainReadRepository(store).getJobForUser(jobId, currentUser.id);
}

export async function getProject(projectId: string): Promise<ProjectWithCounts | null> {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return null;
  }

  return createDomainReadRepository(store).getProjectForUser(projectId, currentUser.id);
}

export async function getTemplates(): Promise<StoredTemplate[]> {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return [];
  }

  return createDomainReadRepository(store).listTemplatesForUser(currentUser.id);
}

export async function getTemplate(templateId: string): Promise<StoredTemplate | null> {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return null;
  }

  return createDomainReadRepository(store).getTemplateForUser(templateId, currentUser.id);
}

type InspirationListFilter = {
  query?: string;
  type?: InspirationType | "";
  status?: InspirationStatus | "";
  projectId?: string;
};

function normalizeInspirationType(value: unknown): InspirationType {
  return value === "plot" ||
    value === "character" ||
    value === "worldbuilding" ||
    value === "pleasure_point" ||
    value === "foreshadowing" ||
    value === "setting" ||
    value === "line" ||
    value === "topic" ||
    value === "title"
    ? value
    : "other";
}

function normalizeInspirationStatus(value: unknown): InspirationStatus {
  return value === "polished" || value === "used" || value === "archived" ? value : "raw";
}

function normalizeInspirationTags(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))).slice(0, 20)
    : [];
}

function normalizeInspirationOutputs(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const raw = item as Partial<InspirationAiOutput>;
      const mode = String(raw.mode ?? "") as InspirationPolishMode;

      if (
        mode !== "polish" &&
        mode !== "expand_setting" &&
        mode !== "web_novelize" &&
        mode !== "selling_point" &&
        mode !== "pleasure_analysis" &&
        mode !== "variants" &&
        mode !== "task_card" &&
        mode !== "character_draft" &&
        mode !== "foreshadowing_draft"
      ) {
        return null;
      }

      return {
        id: String(raw.id ?? randomUUID()),
        mode,
        title: String(raw.title ?? "").trim(),
        content: String(raw.content ?? "").trim(),
        changes: Array.isArray(raw.changes)
          ? raw.changes.map((item) => String(item).trim()).filter(Boolean)
          : [],
        suggestions: Array.isArray(raw.suggestions)
          ? raw.suggestions.map((item) => String(item).trim()).filter(Boolean)
          : [],
        tags: Array.isArray(raw.tags)
          ? raw.tags.map((item) => String(item).trim()).filter(Boolean)
          : [],
        usedAi: Boolean(raw.usedAi),
        usedFallback: Boolean(raw.usedFallback),
        createdAt: String(raw.createdAt ?? now())
      } satisfies InspirationAiOutput;
    })
    .filter((item): item is InspirationAiOutput => Boolean(item));
}

function buildInspirationProjectContext(store: AppStore, inspiration: StoredInspiration): InspirationProjectContext | undefined {
  if (!inspiration.projectId) {
    return undefined;
  }

  const project = store.projects.find((item) => item.id === inspiration.projectId) ?? null;

  if (!project || (project.ownerUserId && project.ownerUserId !== inspiration.ownerUserId)) {
    return undefined;
  }

  const bible = store.writingBibles.find((item) => item.projectId === project.id) ?? null;
  const plotState = store.plotStates.find((item) => item.projectId === project.id) ?? null;
  const characters = store.characterProfiles
    .filter((item) => item.projectId === project.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  const foreshadowings = store.foreshadowings
    .filter((item) => item.projectId === project.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);

  return {
    project,
    bible: bible
      ? {
          corePleasure: bible.corePleasure,
          worldRules: bible.worldRules,
          goldenFingerRules: bible.goldenFingerRules,
          immutableSettings: bible.immutableSettings,
          styleGuide: bible.styleGuide
        }
      : null,
    plotState: plotState
      ? {
          mainGoal: plotState.mainGoal,
          shortTermGoal: plotState.shortTermGoal,
          currentStage: plotState.currentStage,
          openThreads: plotState.openThreads
        }
      : null,
    characters,
    foreshadowings
  };
}

function matchesInspirationFilter(inspiration: StoredInspiration, filter?: InspirationListFilter) {
  if (!filter) {
    return true;
  }

  if (filter.type && inspiration.type !== filter.type) {
    return false;
  }

  if (filter.status && inspiration.status !== filter.status) {
    return false;
  }

  if (filter.projectId && inspiration.projectId !== filter.projectId) {
    return false;
  }

  const query = filter.query?.trim().toLowerCase();

  if (!query) {
    return true;
  }

  const haystack = [
    inspiration.title,
    inspiration.content,
    inspiration.type,
    inspiration.status,
    inspiration.tags.join(" "),
    inspiration.projectId ?? ""
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export async function getInspirations(filter?: InspirationListFilter) {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return [];
  }

  return createDomainReadRepository(store)
    .listInspirationsForUser(currentUser.id)
    .filter((item) => matchesInspirationFilter(item, filter));
}

export async function getProjectInspirations(projectId: string) {
  return getInspirations({ projectId });
}

export async function getInspiration(inspirationId: string): Promise<StoredInspiration | null> {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return null;
  }

  return createDomainReadRepository(store).getInspirationForUser(inspirationId, currentUser.id);
}

export async function createInspiration(input: {
  title: string;
  content: string;
  type?: InspirationType;
  tags?: string[];
  projectId?: string;
  status?: InspirationStatus;
  aiOutputs?: InspirationAiOutput[];
}) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const timestamp = now();
  const projectId = input.projectId?.trim() || "";

  if (projectId) {
    const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

    if (!project) {
      throw new Error("项目不存在");
    }
  }

  const inspiration: StoredInspiration = {
    id: randomUUID(),
    ownerUserId: currentUser.id,
    projectId: projectId || undefined,
    title: input.title.trim() || "未命名灵感",
    content: input.content.trim(),
    type: normalizeInspirationType(input.type),
    tags: normalizeInspirationTags(input.tags),
    status: normalizeInspirationStatus(input.status),
    aiOutputs: normalizeInspirationOutputs(input.aiOutputs),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  createDomainWriteRepository(store).addInspiration(inspiration);
  await writeStore(store);
  return inspiration;
}

export async function previewInspirationPolish(
  input: {
    title: string;
    content: string;
    type?: InspirationType;
    tags?: string[];
    projectId?: string;
  },
  mode: InspirationPolishMode
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const timestamp = now();
  const projectId = input.projectId?.trim() || "";

  if (projectId) {
    createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  }

  const inspiration: StoredInspiration = {
    id: randomUUID(),
    ownerUserId: currentUser.id,
    projectId: projectId || undefined,
    title: input.title.trim() || "未命名灵感",
    content: input.content.trim(),
    type: normalizeInspirationType(input.type),
    tags: normalizeInspirationTags(input.tags),
    status: "raw",
    aiOutputs: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const result = await polishInspirationWithAi(
    inspiration,
    mode,
    buildInspirationProjectContext(store, inspiration)
  );

  return {
    output: {
      id: randomUUID(),
      mode,
      title: result.title,
      content: result.content,
      changes: result.changes,
      suggestions: result.suggestions,
      tags: result.tags,
      usedAi: result.usedAi,
      usedFallback: result.usedFallback,
      createdAt: now()
    } satisfies InspirationAiOutput
  };
}

export async function updateInspiration(
  inspirationId: string,
  input: {
    title?: string;
    content?: string;
    type?: InspirationType;
    tags?: string[];
    status?: InspirationStatus;
    projectId?: string | null;
    linkedEntityType?: StoredInspiration["linkedEntityType"] | null;
    linkedEntityId?: string | null;
  }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const inspiration = createDomainWriteRepository(store).requireInspirationForUser(inspirationId, currentUser.id);
  const projectId = input.projectId === null ? null : input.projectId?.trim() || inspiration.projectId || null;

  if (projectId) {
    createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  }

  inspiration.title = input.title?.trim() || inspiration.title;
  inspiration.content = input.content?.trim() || inspiration.content;
  inspiration.type = normalizeInspirationType(input.type ?? inspiration.type);
  inspiration.tags = normalizeInspirationTags(input.tags ?? inspiration.tags);
  inspiration.status = normalizeInspirationStatus(input.status ?? inspiration.status);
  inspiration.projectId = projectId || undefined;

  if (input.linkedEntityType !== undefined) {
    inspiration.linkedEntityType = input.linkedEntityType === null ? undefined : input.linkedEntityType;
  }

  if (input.linkedEntityId !== undefined) {
    inspiration.linkedEntityId = input.linkedEntityId === null ? undefined : input.linkedEntityId?.trim() || undefined;
  }

  inspiration.updatedAt = now();

  await writeStore(store);
  return inspiration;
}

export async function deleteInspiration(inspirationId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const inspiration = createDomainWriteRepository(store).requireInspirationForUser(inspirationId, currentUser.id);

  store.inspirations = (store.inspirations ?? []).filter((item) => item.id !== inspiration.id);
  await writeStore(store);
  return { deleted: true };
}

export async function polishInspiration(
  inspirationId: string,
  mode: InspirationPolishMode
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const inspiration = createDomainWriteRepository(store).requireInspirationForUser(inspirationId, currentUser.id);
  const result = await polishInspirationWithAi(inspiration, mode, buildInspirationProjectContext(store, inspiration));
  const output: InspirationAiOutput = {
    id: randomUUID(),
    mode,
    title: result.title,
    content: result.content,
    changes: result.changes,
    suggestions: result.suggestions,
    tags: result.tags,
    usedAi: result.usedAi,
    usedFallback: result.usedFallback,
    createdAt: now()
  };

  inspiration.aiOutputs = [output, ...(inspiration.aiOutputs ?? [])].slice(0, 10);
  inspiration.title = result.title || inspiration.title;
  inspiration.status = "polished";
  inspiration.tags = normalizeInspirationTags([...(inspiration.tags ?? []), ...result.tags]);
  inspiration.updatedAt = now();
  await writeStore(store);

  return {
    inspiration,
    output
  };
}

function normalizeInspirationTransformTarget(value: unknown): InspirationTransformTarget {
  return value === "character" ||
    value === "foreshadowing" ||
    value === "task_card" ||
    value === "bible" ||
    value === "worldbuilding" ||
    value === "short_outline" ||
    value === "variants"
    ? value
    : "task_card";
}

function transformTargetToOutputMode(target: InspirationTransformTarget) {
  if (target === "character") {
    return "character_draft" as const;
  }

  if (target === "foreshadowing") {
    return "foreshadowing_draft" as const;
  }

  if (target === "task_card") {
    return "task_card" as const;
  }

  if (target === "variants") {
    return "variants" as const;
  }

  return "expand_setting" as const;
}

function trimOrEmpty(value: unknown) {
  return String(value ?? "").trim();
}

function appendTextBlock(current: string, next: string) {
  const currentText = current.trim();
  const nextText = next.trim();

  if (!currentText) {
    return nextText;
  }

  if (!nextText) {
    return currentText;
  }

  if (currentText.includes(nextText)) {
    return currentText;
  }

  return `${currentText}\n${nextText}`;
}

export async function previewInspirationTransform(
  inspirationId: string,
  target: InspirationTransformTarget
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const inspiration = createDomainWriteRepository(store).requireInspirationForUser(inspirationId, currentUser.id);
  const result = await transformInspirationWithAi(
    inspiration,
    target,
    buildInspirationProjectContext(store, inspiration)
  );

  return {
    draft: result
  };
}

export async function confirmInspirationTransform(
  inspirationId: string,
  draft: InspirationTransformDraft
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const inspiration = createDomainWriteRepository(store).requireInspirationForUser(inspirationId, currentUser.id);
  const projectId = inspiration.projectId?.trim();

  if (!projectId) {
    throw new Error("请先把灵感关联到项目后再转化");
  }

  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const timestamp = now();
  ensureDefaultWritingState(store, project);

  const output: InspirationAiOutput = {
    id: randomUUID(),
    mode: transformTargetToOutputMode(draft.target),
    title: draft.title.trim() || inspiration.title,
    content: [
      draft.summary.trim(),
      draft.character ? JSON.stringify(draft.character, null, 2) : "",
      draft.foreshadowing ? JSON.stringify(draft.foreshadowing, null, 2) : "",
      draft.taskCard ? JSON.stringify(draft.taskCard, null, 2) : "",
      draft.biblePatch ? JSON.stringify(draft.biblePatch, null, 2) : "",
      draft.shortOutline ? JSON.stringify(draft.shortOutline, null, 2) : "",
      draft.variants ? JSON.stringify(draft.variants, null, 2) : ""
    ]
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n\n"),
    changes: cleanList([
      ...draft.notes,
      ...draft.warnings.map((item) => `注意：${item}`)
    ]).slice(0, 8),
    suggestions: cleanList(draft.warnings.length ? draft.warnings : draft.notes).slice(0, 8),
    tags: cleanList([inspiration.type, ...inspiration.tags]).slice(0, 8),
    usedAi: draft.usedAi,
    usedFallback: draft.usedFallback,
    createdAt: timestamp
  };

  inspiration.aiOutputs = [output, ...(inspiration.aiOutputs ?? [])].slice(0, 10);

  if (draft.target === "character") {
    const character = draft.character ?? {
      name: draft.title.trim() || inspiration.title,
      identity: draft.summary.trim(),
      currentGoal: "",
      longTermGoal: "",
      secret: "",
      relationshipToProtagonist: "",
      attitude: "",
      abilityBoundary: "",
      voice: "",
      knownInformation: "",
      unknownInformation: "",
      lastAppearance: "",
      currentState: ""
    };

    if (!character.name.trim()) {
      throw new Error("人物姓名不能为空");
    }

    const created: StoredCharacterProfile = {
      id: randomUUID(),
      projectId,
      ...character,
      knownInformation: character.knownInformation || draft.summary.trim(),
      currentState: character.currentState || "来自灵感中心的转化草稿",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    store.characterProfiles.push(created);

    inspiration.status = "used";
    inspiration.linkedEntityType = "character";
    inspiration.linkedEntityId = created.id;
    inspiration.updatedAt = timestamp;
    project.updatedAt = timestamp;

    await writeStore(store);
    return { inspiration, output, entity: created, target: draft.target };
  }

  if (draft.target === "foreshadowing") {
    const foreshadowing = draft.foreshadowing ?? {
      name: draft.title.trim() || inspiration.title,
      plantedChapter: "",
      relatedCharacters: [],
      relatedLocation: "",
      status: "open" as const,
      expectedRevealChapter: "",
      revealMethod: "",
      hiddenInformation: draft.summary.trim()
    };

    if (!foreshadowing.name.trim()) {
      throw new Error("伏笔名称不能为空");
    }

    const created: StoredForeshadowing = {
      id: randomUUID(),
      projectId,
      ...foreshadowing,
      relatedCharacters: cleanList(foreshadowing.relatedCharacters),
      hiddenInformation: foreshadowing.hiddenInformation || draft.summary.trim(),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    store.foreshadowings.push(created);

    inspiration.status = "used";
    inspiration.linkedEntityType = "foreshadowing";
    inspiration.linkedEntityId = created.id;
    inspiration.updatedAt = timestamp;
    project.updatedAt = timestamp;

    await writeStore(store);
    return { inspiration, output, entity: created, target: draft.target };
  }

  if (draft.target === "task_card") {
    const latestTaskCard = getLatestWritingTaskCard(store, projectId);
    const latestLedger = store.chapterLedgers
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
    const nextChapterNumber = Math.max(latestTaskCard?.chapterNumber ?? 0, latestLedger?.chapterNumber ?? 0, 0) + 1;
    const targetChapterNumber =
      Number.isFinite(Number(draft.taskCard?.chapterNumber)) && Number(draft.taskCard?.chapterNumber) > 0
        ? Math.floor(Number(draft.taskCard?.chapterNumber))
        : nextChapterNumber;
    const taskCard: StoredWritingTaskCard = {
      id: randomUUID(),
      projectId,
      chapterNumber: targetChapterNumber,
      title: trimOrEmpty(draft.taskCard?.title) || draft.title.trim() || inspiration.title,
      chapterGoal: trimOrEmpty(draft.taskCard?.chapterGoal) || draft.summary.trim(),
      continuity: trimOrEmpty(draft.taskCard?.continuity) || "承接当前主线状态",
      mainPlotProgress: trimOrEmpty(draft.taskCard?.mainPlotProgress) || "推进主线一步",
      requiredCharacters: cleanList(draft.taskCard?.requiredCharacters).slice(0, 8),
      pleasurePoint: trimOrEmpty(draft.taskCard?.pleasurePoint) || "安排一次明确的情绪回报",
      foreshadowingTasks: cleanList(draft.taskCard?.foreshadowingTasks).slice(0, 8),
      rulesNotToBreak: cleanList([
        ...(draft.taskCard?.rulesNotToBreak ?? []),
        ...(store.writingBibles.find((item) => item.projectId === projectId)?.immutableSettings ? [store.writingBibles.find((item) => item.projectId === projectId)!.immutableSettings] : [])
      ]).slice(0, 12),
      endingHook: trimOrEmpty(draft.taskCard?.endingHook) || "留下可继续往下读的钩子",
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    store.writingTaskCards.push(taskCard);
    project.status = "writing";
    project.updatedAt = timestamp;

    inspiration.status = "used";
    inspiration.linkedEntityType = "task_card";
    inspiration.linkedEntityId = taskCard.id;
    inspiration.updatedAt = timestamp;

    await writeStore(store);
    return { inspiration, output, entity: taskCard, target: draft.target };
  }

  if (draft.target === "short_outline") {
    const outlineId = randomUUID();
    const currentStage = [
      trimOrEmpty(draft.shortOutline?.logline) || draft.summary.trim(),
      trimOrEmpty(draft.shortOutline?.coreConflict),
      (draft.shortOutline?.firstChapters ?? []).join(" / "),
      trimOrEmpty(draft.shortOutline?.pacing),
      (draft.shortOutline?.foreshadowingPlan ?? []).join(" / ")
    ]
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n");

    const existingPlan = store.longFormPlans.find((item) => item.projectId === projectId);

    if (existingPlan) {
      existingPlan.corePromise = appendTextBlock(existingPlan.corePromise, draft.summary.trim());
      existingPlan.first10Chapters = uniqueList([
        ...existingPlan.first10Chapters,
        ...(draft.shortOutline?.firstChapters ?? [])
      ]).slice(0, 12);
      existingPlan.first100Pacing = appendTextBlock(existingPlan.first100Pacing, trimOrEmpty(draft.shortOutline?.pacing));
      existingPlan.progressionRules = uniqueList([
        ...existingPlan.progressionRules,
        ...(draft.shortOutline?.foreshadowingPlan ?? [])
      ]).slice(0, 24);
      existingPlan.updatedAt = timestamp;
    }

    const plotState = store.plotStates.find((item) => item.projectId === projectId);
    if (plotState) {
      plotState.mainGoal = appendTextBlock(plotState.mainGoal, trimOrEmpty(draft.shortOutline?.logline) || draft.summary.trim());
      plotState.currentStage = appendTextBlock(plotState.currentStage, currentStage || "已生成短大纲草稿");
      plotState.nextMilestones = uniqueList([
        ...plotState.nextMilestones,
        ...(draft.shortOutline?.firstChapters ?? [])
      ]).slice(0, 8);
      plotState.unresolvedQuestions = uniqueList([
        ...plotState.unresolvedQuestions,
        ...(draft.shortOutline?.foreshadowingPlan ?? [])
      ]).slice(0, 12);
      plotState.updatedAt = timestamp;
    }

    inspiration.status = "used";
    inspiration.linkedEntityType = "outline";
    inspiration.linkedEntityId = outlineId;
    inspiration.updatedAt = timestamp;
    project.updatedAt = timestamp;

    await writeStore(store);
    return { inspiration, output, entity: { id: outlineId, target: draft.target }, target: draft.target };
  }

  if (draft.target === "variants") {
    const bible = store.writingBibles.find((item) => item.projectId === projectId);

    if (!bible) {
      throw new Error("项目创作圣经不存在");
    }

    const variantsText = (draft.variants ?? [])
      .map((item, index) =>
        [
          `变体${index + 1}：${item.title}`,
          `方向：${item.direction}`,
          `冲突：${item.conflict}`,
          `收益：${item.payoff}`,
          `钩子：${item.nextHook}`
        ].join("\n")
      )
      .join("\n\n");

    bible.styleGuide = appendTextBlock(bible.styleGuide, variantsText || draft.summary.trim());
    bible.corePleasure = appendTextBlock(bible.corePleasure, draft.summary.trim());
    bible.updatedAt = timestamp;

    inspiration.status = "used";
    inspiration.linkedEntityType = "bible";
    inspiration.linkedEntityId = bible.id;
    inspiration.updatedAt = timestamp;
    project.updatedAt = timestamp;

    await writeStore(store);
    return { inspiration, output, entity: bible, target: draft.target };
  }

  const bible = store.writingBibles.find((item) => item.projectId === projectId);

  if (!bible) {
    throw new Error("项目创作圣经不存在");
  }

  const patch = draft.biblePatch ?? {};
  bible.corePleasure = appendTextBlock(bible.corePleasure, patch.corePleasure || draft.summary);
  bible.worldRules = appendTextBlock(bible.worldRules, patch.worldRules ?? "");
  bible.goldenFingerRules = appendTextBlock(bible.goldenFingerRules, patch.goldenFingerRules ?? "");
  bible.narrativeTaboos = appendTextBlock(bible.narrativeTaboos, patch.narrativeTaboos ?? "");
  bible.immutableSettings = appendTextBlock(bible.immutableSettings, patch.immutableSettings ?? "");
  bible.styleGuide = appendTextBlock(bible.styleGuide, patch.styleGuide ?? "");
  bible.updatedAt = timestamp;

  inspiration.status = "used";
  inspiration.linkedEntityType = "bible";
  inspiration.linkedEntityId = bible.id;
  inspiration.updatedAt = timestamp;
  project.updatedAt = timestamp;

  await writeStore(store);
  return { inspiration, output, entity: bible, target: draft.target };
}

export async function getLatestOutlineByTemplate(templateId: string): Promise<StoredOutline | null> {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  if (!currentUser) {
    return null;
  }

  return createDomainReadRepository(store).getLatestOutlineForTemplateForUser(
    templateId,
    currentUser.id
  );
}

export async function updateTemplate(
  templateId: string,
  input: {
    name: string;
    genre: string;
    description: string;
    openingHook: string;
    mainLoop: string;
    chapterPacing: string;
    formula: string;
    migrationAdvice: string;
    protagonistModel: string;
    goldenFinger: string;
    usablePatterns: string[];
    avoidCopying: string[];
    tags: string[];
  }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const template = createDomainWriteRepository(store).requireTemplateForUser(templateId, currentUser.id);

  const timestamp = now();
  Object.assign(template, {
    name: input.name.trim() || template.name,
    genre: input.genre.trim() || template.genre,
    description: input.description.trim() || template.description,
    openingHook: input.openingHook.trim() || template.openingHook,
    mainLoop: input.mainLoop.trim() || template.mainLoop,
    chapterPacing: input.chapterPacing.trim() || template.chapterPacing,
    formula: input.formula.trim() || template.formula,
    migrationAdvice: input.migrationAdvice.trim() || template.migrationAdvice,
    protagonistModel: input.protagonistModel.trim() || template.protagonistModel,
    goldenFinger: input.goldenFinger.trim() || template.goldenFinger,
    usablePatterns: input.usablePatterns,
    avoidCopying: input.avoidCopying,
    tags: input.tags,
    updatedAt: timestamp
  });

  await writeStore(store);
  return template;
}

export async function getAiSettings() {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);
  return currentUser ? getUserAiSettings(store, currentUser.id) : mergeAiSettings();
}

export async function getPublicAiSettings() {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);
  const settings = currentUser ? getUserAiSettings(store, currentUser.id) : mergeAiSettings();
  const profiles = currentUser ? listUserAiProfiles(store, currentUser.id) : [];
  const key = settings.apiKey.trim();

  return {
    billingMode: getBillingMode(),
    activeProfileId: settings.id || "",
    providerName: settings.providerName,
    baseUrl: settings.baseUrl,
    model: settings.model,
    profiles: profiles.map((profile) => ({
      id: profile.id || "",
      profileName: profile.profileName || profile.providerName || "默认配置",
      providerName: profile.providerName,
      baseUrl: profile.baseUrl,
      model: profile.model,
      models: profile.models ?? [],
      timeoutMs: profile.timeoutMs,
      active: Boolean(profile.active),
      hasApiKey: profile.apiKey.trim().length > 0,
      apiKeyPreview: profile.apiKey ? `...${profile.apiKey.slice(-4)}` : "",
      updatedAt: profile.updatedAt
    })),
    timeoutMs: settings.timeoutMs,
    hasApiKey: key.length > 0,
    apiKeyPreview: key ? `...${key.slice(-4)}` : "",
    updatedAt: settings.updatedAt
  };
}

export async function getCurrentUserAiSetupStatus() {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);

  return {
    configured: Boolean(currentUser && hasConfiguredAiSettings(store, currentUser.id))
  };
}

export async function updateAiSettings(input: {
  profileId?: string;
  profileName?: string;
  providerName: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  models?: string[];
  timeoutMs: number;
  clearApiKey?: boolean;
}) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const profiles = listUserAiProfiles(store, currentUser.id);
  const rawProfileId = input.profileId?.trim() || "";
  const requestedProfileId = rawProfileId === "new" ? "" : rawProfileId;
  const current = requestedProfileId
    ? profiles.find((profile) => profile.id === requestedProfileId) ?? null
    : null;
  const timestamp = now();
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const model = input.model.trim();
  const providerName = input.providerName.trim();
  const profileId = requestedProfileId || randomUUID();
  const nextApiKey = input.clearApiKey ? "" : input.apiKey?.trim() || current?.apiKey || "";

  const nextSettings: StoredAiSettings = {
    id: profileId,
    userId: currentUser.id,
    profileName: input.profileName?.trim() || providerName || "默认配置",
    providerName: providerName || "OpenAI Compatible",
    baseUrl,
    apiKey: nextApiKey,
    model,
    models: Array.from(new Set([...(input.models ?? []), model].map((item) => item.trim()).filter(Boolean))),
    active: true,
    timeoutMs: Number.isFinite(input.timeoutMs) && input.timeoutMs > 0 ? input.timeoutMs : 60000,
    updatedAt: timestamp
  };
  setPrimaryAiSettings(store, nextSettings);

  await writeStore(store);
  return getPublicAiSettings();
}

export async function switchAiProfile(profileId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const profiles = listUserAiProfiles(store, currentUser.id);
  const target = profiles.find((item) => item.id === profileId);

  if (!target) {
    throw new Error("AI 配置不存在");
  }

  setUserAiProfiles(
    store,
    currentUser.id,
    profiles.map((profile) => ({ ...profile, active: profile.id === profileId, updatedAt: now() }))
  );
  await writeStore(store);
  return getPublicAiSettings();
}

export async function deleteAiProfile(profileId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const profiles = listUserAiProfiles(store, currentUser.id);

  if (profiles.length <= 1) {
    throw new Error("至少保留一个 AI 配置");
  }

  const nextProfiles = profiles.filter((profile) => profile.id !== profileId);

  if (nextProfiles.length === profiles.length) {
    throw new Error("AI 配置不存在");
  }

  if (!nextProfiles.some((profile) => profile.active)) {
    nextProfiles[0].active = true;
  }

  setUserAiProfiles(store, currentUser.id, nextProfiles);
  await writeStore(store);
  return getPublicAiSettings();
}

export async function listAiProviderModels(input: { baseUrl: string; apiKey: string }) {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const apiKey = input.apiKey.trim();

  if (!baseUrl) {
    throw new Error("请先填写请求地址");
  }

  if (!apiKey) {
    throw new Error("请先填写 API Key");
  }

  const response = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`获取模型失败：${response.status} ${text}`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.data)
    ? payload.data.map((item: unknown) =>
        item && typeof item === "object" && "id" in item ? String((item as { id: unknown }).id) : ""
      )
    : [];

  return Array.from(new Set(models.filter(Boolean))).sort();
}

export async function createTemplateFromProject(projectId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const repo = createDomainReadRepository(store);
  const writeRepo = createDomainWriteRepository(store);
  const currentUsage = getUserUsage(store, currentUser);
  const currentLimits = getPlanLimitsForUser(currentUser);

  if (currentUsage.templates + 1 > currentLimits.templates) {
    throw new Error("当前套餐模板数量已达到上限");
  }
  const project = writeRepo.requireProjectForUser(projectId, currentUser.id);

  const storyAnalysis = repo.getLatestStoryAnalysisForProjectForUser(projectId, currentUser.id);

  if (!storyAnalysis) {
    throw new Error("请先完成整书分析，再保存模板");
  }

  const timestamp = now();
  const protagonistModel =
    storyAnalysis.protagonistModel || "被误判或被压制，但拥有反击窗口的成长型主角";
  const goldenFinger =
    storyAnalysis.goldenFingerMechanism || "金手指或信息差机制需要在新题材中重新配置";
  const usablePatterns =
    Array.isArray(storyAnalysis.usablePatterns) && storyAnalysis.usablePatterns.length > 0
      ? storyAnalysis.usablePatterns
      : [storyAnalysis.mainLoop, storyAnalysis.formula, storyAnalysis.pacing].filter(Boolean);
  const avoidCopying =
    Array.isArray(storyAnalysis.avoidCopying) && storyAnalysis.avoidCopying.length > 0
      ? storyAnalysis.avoidCopying
      : ["不要照搬原文句子", "不要照搬角色名称", "不要照搬独特世界观设定"];
  const template: StoredTemplate = {
    id: randomUUID(),
    ownerUserId: currentUser.id,
    sourceProjectId: project.id,
    sourceStoryAnalysisId: storyAnalysis.id,
    name: `${project.name} 模板`,
    genre: project.genre || storyAnalysis.genre || "未分类",
    description: project.description || "从项目分析结果生成的故事模板。",
    openingHook: storyAnalysis.openingHook,
    mainLoop: storyAnalysis.mainLoop,
    chapterPacing: storyAnalysis.pacing,
    formula: storyAnalysis.formula,
    migrationAdvice: storyAnalysis.migrationAdvice,
    protagonistModel,
    goldenFinger,
    usablePatterns,
    avoidCopying,
    tags: [
      project.genre || storyAnalysis.genre || "未分类",
      storyAnalysis.openingModel || "开局模型",
      ...storyAnalysis.topPleasureTypes.slice(0, 3)
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  writeRepo.addTemplate(template);
  await writeStore(store);
  return template;
}

export async function createProject(input: {
  name: string;
  type: "analysis" | "writing";
  genre?: string;
  description?: string;
  coverImageUrl?: string;
  initialState?: InitialProjectStateInput;
}) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const currentUsage = getUserUsage(store, currentUser);
  const currentLimits = getPlanLimitsForUser(currentUser);

  if (currentUsage.projects + 1 > currentLimits.projects) {
    throw new Error("当前套餐项目数量已达到上限");
  }
  const project = createDomainWriteRepository(store).createProject(currentUser.id, input);
  applyInitialProjectState(store, project, input.initialState);
  await writeStore(store);
  return project;
}

export async function assistProjectCreation(input: ProjectCreationAssistInput) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const action: ProjectCreationAssistAction =
    input.action === "protagonists" || input.action === "description" ? input.action : "titles";
  const payload = {
    ...input,
    action
  };
  const job = createAiJob(store, {
    userId: currentUser.id,
    type: "project_creation_assist",
    payload,
    model: getActiveAiModel(store, "local-project-creation-assist", currentUser.id)
  });

  await writeStore(store);
  startAiJob(job);
  await writeStore(store);

  try {
    const result = await generateProjectCreationAssistWithAi(payload);
    finishAiJob(job, withAiBillingOutput(store, job, {
      usedAi: true,
      usedFallback: false,
      action,
      result
    }, getAiTokenUsage(result)));
    await writeStore(store);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "新书立项辅助失败";
    failAiJob(job, message);
    refundAiJobCredits(store, job, "新书立项辅助失败返还");
    await writeStore(store);
    throw new Error(message);
  }
}

export function calculateAiJobProgress(
  job: Pick<StoredAiJob, "status" | "type" | "input" | "output">
) {
  if (job.status === "succeeded" || job.status === "failed" || job.status === "canceled") {
    return 100;
  }

  const input = job.input as Record<string, unknown> | undefined;
  const output = job.output as Record<string, unknown> | undefined;

  if (job.type === "analyze_chapters") {
    const chapterCount = Number(input?.chapterCount ?? 0);
    const chapterAnalysisCount = Number(output?.chapterAnalysisCount ?? 0);

    if (chapterCount > 0 && chapterAnalysisCount > 0) {
      return Math.max(10, Math.min(99, Math.round((chapterAnalysisCount / chapterCount) * 100)));
    }
  }

  return job.status === "running" ? 55 : 5;
}

export async function getProjectChapters(projectId: string): Promise<StoredChapter[]> {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);
  const repo = createDomainReadRepository(store);
  const project = currentUser ? repo.getProjectRecordForUser(projectId, currentUser.id) : null;

  if (!currentUser || !project) {
    return [];
  }

  return repo.listChaptersForProjectForUser(projectId, currentUser.id);
}

export async function getProjectAnalysis(projectId: string) {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);
  const repo = createDomainReadRepository(store);
  const result = currentUser ? repo.getProjectAnalysisForUser(projectId, currentUser.id) : null;

  if (!currentUser || !result) {
    return {
      chapters: [],
      chapterAnalyses: [],
      storyAnalysis: null,
      latestAnalysisJob: null
    };
  }

  const latestAnalysisJob =
    repo
      .listProjectJobsForUser(projectId, currentUser.id)
      .filter((job) => job.type === "analyze_chapters")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  return {
    chapters: result.chapters,
    chapterAnalyses: result.chapterAnalyses,
    storyAnalysis: result.storyAnalysis,
    latestAnalysisJob
  };
}

export async function getProjectWritingState(projectId: string) {
  const store = await readStore();
  const currentUser = await getCurrentUserFromStore(store);
  const repo = createDomainReadRepository(store);

  if (!currentUser) {
    return null;
  }

  const project = repo.getProjectRecordForUser(projectId, currentUser.id);

  if (!project) {
    return null;
  }

  const changed = ensureDefaultWritingState(store, project);
  const cleanedLegacyState = sanitizeLegacyStatePlacement(store, project);

  if (changed || cleanedLegacyState) {
    await writeStore(store);
  }

  const result = repo.getProjectWritingStateForUser(projectId, currentUser.id);

  if (!result) {
    return null;
  }

  return {
    project,
    bible: result.bible,
    plotState: result.plotState,
    characters: result.characters,
    foreshadowings: result.foreshadowings,
    longFormPlans: result.longFormPlans,
    customRelationGraphs: result.customRelationGraphs,
    taskCards: result.taskCards,
    drafts: result.drafts,
    ledgers: result.ledgers,
    reviews: result.reviews,
    editReports: result.editReports
  };
}

function ensureAssistantCollections(store: AppStore) {
  store.assistantThreads ??= [];
  store.assistantMessages ??= [];
}

function titleFromAssistantQuestion(question: string) {
  const title = question
    .replace(/\s+/g, " ")
    .replace(/[《》「」“”"'`]+/g, "")
    .trim();

  return title ? (title.length > 24 ? `${title.slice(0, 24)}...` : title) : "新对话";
}

function formatWritingAssistantReply(reply: Awaited<ReturnType<typeof generateWritingAssistantReply>>) {
  const answer = reply.answer.trim() || "我暂时没有生成有效回答。";
  const suggestions = reply.suggestions.map((item) => item.trim()).filter(Boolean).slice(0, 3);

  return suggestions.length
    ? `${answer}\n\n可以继续问：\n${suggestions.map((item) => `- ${item}`).join("\n")}`
    : answer;
}

function getAssistantMessagesForThread(store: AppStore, threadId: string) {
  return (store.assistantMessages ?? [])
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function getAssistantProjectContext(store: AppStore, userId: string, projectId?: string) {
  if (!projectId) {
    return null;
  }

  const repo = createDomainReadRepository(store);
  const project = repo.getProjectRecordForUser(projectId, userId);

  if (!project) {
    throw new Error("项目不存在");
  }

  ensureDefaultWritingState(store, project);
  sanitizeLegacyStatePlacement(store, project);

  const state = repo.getProjectWritingStateForUser(projectId, userId);

  if (!state) {
    return null;
  }

  return {
    project: state.project,
    bible: state.bible,
    plotState: state.plotState,
    characters: state.characters,
    foreshadowings: state.foreshadowings,
    ledgers: state.ledgers
  };
}

export async function listWritingAssistantThreads(projectId?: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  ensureAssistantCollections(store);

  const normalizedProjectId = projectId?.trim();

  if (normalizedProjectId) {
    createDomainWriteRepository(store).requireProjectForUser(normalizedProjectId, currentUser.id);
  }

  return store.assistantThreads
    .filter((thread) => {
      if (thread.ownerUserId !== currentUser.id) {
        return false;
      }

      return normalizedProjectId ? thread.projectId === normalizedProjectId : !thread.projectId;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12);
}

export async function getWritingAssistantThread(threadId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  ensureAssistantCollections(store);

  const thread = store.assistantThreads.find((item) => item.id === threadId && item.ownerUserId === currentUser.id);

  if (!thread) {
    throw new Error("对话不存在");
  }

  return {
    thread,
    messages: getAssistantMessagesForThread(store, thread.id)
  };
}

export async function deleteWritingAssistantThread(threadId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  ensureAssistantCollections(store);

  const thread = store.assistantThreads.find((item) => item.id === threadId && item.ownerUserId === currentUser.id);

  if (!thread) {
    throw new Error("对话不存在");
  }

  store.assistantThreads = store.assistantThreads.filter((item) => item.id !== thread.id);
  store.assistantMessages = store.assistantMessages.filter((item) => item.threadId !== thread.id);
  await writeStore(store);

  return { threadId: thread.id };
}

export async function updateWritingAssistantThreadTitle(input: { threadId: string; title: string }) {
  const title = input.title.replace(/\s+/g, " ").trim();

  if (!title) {
    throw new Error("对话标题不能为空");
  }

  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  ensureAssistantCollections(store);

  const thread = store.assistantThreads.find((item) => item.id === input.threadId && item.ownerUserId === currentUser.id);

  if (!thread) {
    throw new Error("对话不存在");
  }

  thread.title = title.length > 36 ? `${title.slice(0, 36)}...` : title;
  thread.updatedAt = now();
  await writeStore(store);

  return { thread };
}

export async function chatWithWritingAssistant(input: {
  question: string;
  projectId?: string;
  threadId?: string;
}) {
  const question = input.question.trim();

  if (!question) {
    throw new Error("请输入要咨询的小说创作问题");
  }

  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  ensureAssistantCollections(store);

  const timestamp = now();
  let thread = input.threadId
    ? store.assistantThreads.find((item) => item.id === input.threadId && item.ownerUserId === currentUser.id)
    : undefined;

  if (input.threadId && !thread) {
    throw new Error("对话不存在");
  }

  const normalizedProjectId = input.projectId?.trim() || undefined;
  const projectId = thread?.projectId ?? normalizedProjectId;

  if (!thread) {
    if (projectId) {
      createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
    }

    thread = {
      id: randomUUID(),
      ownerUserId: currentUser.id,
      projectId,
      title: titleFromAssistantQuestion(question),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.assistantThreads.push(thread);
  }

  const history: WritingAssistantChatMessage[] = getAssistantMessagesForThread(store, thread.id)
    .slice(-8)
    .map((message) => ({ role: message.role, content: message.content }));
  const projectContext = getAssistantProjectContext(store, currentUser.id, projectId);
  const reply = await generateWritingAssistantReply({
    question,
    history,
    projectContext,
    assistantName: currentUser.assistantName
  });
  const userMessage: StoredAssistantMessage = {
    id: randomUUID(),
    threadId: thread.id,
    role: "user",
    content: question,
    createdAt: timestamp
  };
  const assistantMessage: StoredAssistantMessage = {
    id: randomUUID(),
    threadId: thread.id,
    role: "assistant",
    content: formatWritingAssistantReply(reply),
    createdAt: now()
  };

  thread.updatedAt = assistantMessage.createdAt;
  store.assistantMessages.push(userMessage, assistantMessage);
  await writeStore(store);

  return {
    thread,
    messages: getAssistantMessagesForThread(store, thread.id),
    reply
  };
}

export async function prepareWritingAssistantStream(input: {
  question: string;
  projectId?: string;
  threadId?: string;
}) {
  const question = input.question.trim();

  if (!question) {
    throw new Error("请输入要咨询的小说创作问题");
  }

  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  ensureAssistantCollections(store);

  const timestamp = now();
  let thread = input.threadId
    ? store.assistantThreads.find((item) => item.id === input.threadId && item.ownerUserId === currentUser.id)
    : undefined;

  if (input.threadId && !thread) {
    throw new Error("对话不存在");
  }

  const normalizedProjectId = input.projectId?.trim() || undefined;
  const projectId = thread?.projectId ?? normalizedProjectId;

  if (!thread) {
    if (projectId) {
      createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
    }

    thread = {
      id: randomUUID(),
      ownerUserId: currentUser.id,
      projectId,
      title: titleFromAssistantQuestion(question),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.assistantThreads.push(thread);
  }

  const history: WritingAssistantChatMessage[] = getAssistantMessagesForThread(store, thread.id)
    .slice(-8)
    .map((message) => ({ role: message.role, content: message.content }));
  const projectContext = getAssistantProjectContext(store, currentUser.id, projectId);
  const userMessage: StoredAssistantMessage = {
    id: randomUUID(),
    threadId: thread.id,
    role: "user",
    content: question,
    createdAt: timestamp
  };

  thread.updatedAt = timestamp;
  store.assistantMessages.push(userMessage);
  await writeStore(store);

  return {
    thread,
    ownerUserId: currentUser.id,
    stream: streamWritingAssistantReply({
      question,
      history,
      projectContext,
      assistantName: currentUser.assistantName
    })
  };
}

export async function saveWritingAssistantStreamReply(input: {
  threadId: string;
  ownerUserId: string;
  content: string;
}) {
  const content = input.content.trim();

  if (!content) {
    return null;
  }

  const store = await readStore();
  ensureAssistantCollections(store);

  const thread = store.assistantThreads.find(
    (item) => item.id === input.threadId && item.ownerUserId === input.ownerUserId
  );

  if (!thread) {
    return null;
  }

  const assistantMessage: StoredAssistantMessage = {
    id: randomUUID(),
    threadId: thread.id,
    role: "assistant",
    content,
    createdAt: now()
  };

  thread.updatedAt = assistantMessage.createdAt;
  store.assistantMessages.push(assistantMessage);
  await writeStore(store);

  return {
    thread,
    message: assistantMessage
  };
}

export async function updateProjectMetadata(
  projectId: string,
  input: {
    name: string;
    genre: string;
    description: string;
  }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const name = input.name.trim();

  if (!name) {
    throw new Error("作品名称不能为空");
  }

  project.name = name;
  project.genre = input.genre.trim();
  project.description = input.description.trim();
  project.updatedAt = now();

  await writeStore(store);
  return project;
}

export async function updateProjectCover(projectId: string, coverImageUrl: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  project.coverImageUrl = normalizeCoverImageUrl(coverImageUrl);
  project.updatedAt = now();

  await writeStore(store);
  return project;
}

export async function updateWritingBible(
  projectId: string,
  input: Omit<
    StoredWritingBible,
    "id" | "projectId" | "createdAt" | "updatedAt"
  >
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  ensureDefaultWritingState(store, project);
  const timestamp = now();
  const bible = store.writingBibles.find((item) => item.projectId === projectId)!;
  const cleanedInput = {
    ...input,
    protagonistDesire: removeLegacyPlacedLines(input.protagonistDesire, [
      "项目目标：",
      "一句话卖点：",
      "前100章节奏：",
      "爽点分布："
    ]) || input.protagonistDesire,
    immutableSettings: removeLegacyPlacedLines(input.immutableSettings, [
      "作品简介：",
      "大纲一句话卖点：",
      "来源大纲：",
      "主分类：",
      "作品标签：",
      "前10章大纲："
    ]) || "不改变主角核心身份、世界规则、金手指限制和已公开事实。"
  };

  Object.assign(bible, {
    ...cleanedInput,
    updatedAt: timestamp
  });
  project.updatedAt = timestamp;

  await writeStore(store);
  return bible;
}

export async function updatePlotState(
  projectId: string,
  input: {
    currentVolume: string;
    currentMap: string;
    mainGoal: string;
    shortTermGoal: string;
    currentStage: string;
    currentEnemy: string;
    unresolvedQuestions: string[];
    openThreads: string[];
    resolvedThreads: string[];
    nextMilestones: string[];
    nextStageGoal: string;
    powerSystemState: string;
    mapAndForces: string;
    resourceState: string;
    relationshipChanges: string[];
  }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  ensureDefaultWritingState(store, project);
  const timestamp = now();
  const plotState = store.plotStates.find((item) => item.projectId === projectId)!;
  const mainGoal =
    /基于已生成的新书大纲|前100章节奏|爽点分布|作品简介|围绕作品设想推进/.test(input.mainGoal) ||
    input.mainGoal.length > 180
      ? extractLabeledLine(input.mainGoal, "一句话卖点：") ||
        "完成第一阶段主线：建立压制、反击和持续悬念。"
      : input.mainGoal;

  Object.assign(plotState, {
    ...input,
    mainGoal,
    powerSystemState: cleanPowerSystemEntries(splitLines(input.powerSystemState), 6).join("\n"),
    mapAndForces: cleanMapAndForceEntries(splitLines(input.mapAndForces), 6).join("\n"),
    resourceState: cleanResourceEntries(splitLines(input.resourceState), 6).join("\n"),
    relationshipChanges: cleanStateEntries(input.relationshipChanges, 8),
    updatedAt: timestamp
  });
  project.updatedAt = timestamp;

  await writeStore(store);
  return plotState;
}

export async function createCustomRelationGraph(
  projectId: string,
  input: {
    title: string;
    description: string;
  }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const title = input.title.trim();

  if (!title) {
    throw new Error("图谱名称不能为空");
  }

  const timestamp = now();
  const graph: StoredCustomRelationGraph = {
    id: randomUUID(),
    projectId,
    title,
    description: input.description.trim(),
    nodes: [],
    edges: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  getCustomRelationGraphs(store).push(graph);
  project.updatedAt = timestamp;

  await writeStore(store);
  return graph;
}

export async function updateCustomRelationGraph(
  projectId: string,
  graphId: string,
  input: {
    title: string;
    description: string;
  }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const graph = getCustomRelationGraphs(store).find((item) => item.id === graphId && item.projectId === projectId);
  const title = input.title.trim();

  if (!graph) {
    throw new Error("自定义图谱不存在");
  }

  if (!title) {
    throw new Error("图谱名称不能为空");
  }

  const timestamp = now();
  graph.title = title;
  graph.description = input.description.trim();
  graph.updatedAt = timestamp;
  project.updatedAt = timestamp;

  await writeStore(store);
  return graph;
}

export async function deleteCustomRelationGraph(projectId: string, graphId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const graphs = getCustomRelationGraphs(store);
  const graph = graphs.find((item) => item.id === graphId && item.projectId === projectId);

  if (!graph) {
    throw new Error("自定义图谱不存在");
  }

  store.customRelationGraphs = graphs.filter((item) => item.id !== graphId);
  project.updatedAt = now();

  await writeStore(store);
  return { graphId, deletedAt: now() };
}

export async function createCustomRelationGraphNode(
  projectId: string,
  graphId: string,
  input: {
    label: string;
    meta: string;
    sub: string;
    type?: unknown;
    tone?: unknown;
    targetNodeId?: string;
    relationLabel?: string;
    relationTone?: unknown;
  }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const graph = getCustomRelationGraphs(store).find((item) => item.id === graphId && item.projectId === projectId);
  const label = input.label.trim();

  if (!graph) {
    throw new Error("自定义图谱不存在");
  }

  if (!label) {
    throw new Error("节点名称不能为空");
  }

  const timestamp = now();
  const node: StoredCustomRelationGraphNode = {
    id: randomUUID(),
    label,
    meta: input.meta.trim(),
    sub: input.sub.trim(),
    type: customGraphNodeType(input.type),
    tone: customGraphTone(input.tone),
    x: 120 + (graph.nodes.length % 5) * 260,
    y: 120 + Math.floor(graph.nodes.length / 5) * 170
  };

  graph.nodes.push(node);

  if (input.targetNodeId && graph.nodes.some((item) => item.id === input.targetNodeId)) {
    graph.edges.push({
      id: randomUUID(),
      from: input.targetNodeId,
      to: node.id,
      label: input.relationLabel?.trim() || "关联",
      tone: customGraphEdgeTone(input.relationTone)
    });
  }

  graph.updatedAt = timestamp;
  project.updatedAt = timestamp;

  await writeStore(store);
  return { graph, node };
}

export async function updateCustomRelationGraphNode(
  projectId: string,
  graphId: string,
  nodeId: string,
  input: {
    label: string;
    meta: string;
    sub: string;
    type?: unknown;
    tone?: unknown;
  }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const graph = getCustomRelationGraphs(store).find((item) => item.id === graphId && item.projectId === projectId);
  const node = graph?.nodes.find((item) => item.id === nodeId);
  const label = input.label.trim();

  if (!graph || !node) {
    throw new Error("自定义节点不存在");
  }

  if (!label) {
    throw new Error("节点名称不能为空");
  }

  const timestamp = now();
  node.label = label;
  node.meta = input.meta.trim();
  node.sub = input.sub.trim();
  node.type = customGraphNodeType(input.type ?? node.type);
  node.tone = customGraphTone(input.tone ?? node.tone);
  graph.updatedAt = timestamp;
  project.updatedAt = timestamp;

  await writeStore(store);
  return { graph, node };
}

export async function deleteCustomRelationGraphNode(projectId: string, graphId: string, nodeId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const graph = getCustomRelationGraphs(store).find((item) => item.id === graphId && item.projectId === projectId);

  if (!graph || !graph.nodes.some((item) => item.id === nodeId)) {
    throw new Error("自定义节点不存在");
  }

  graph.nodes = graph.nodes.filter((item) => item.id !== nodeId);
  graph.edges = graph.edges.filter((item) => item.from !== nodeId && item.to !== nodeId);
  graph.updatedAt = now();
  project.updatedAt = graph.updatedAt;

  await writeStore(store);
  return graph;
}

export async function createCustomRelationGraphEdge(
  projectId: string,
  graphId: string,
  input: {
    from: string;
    to: string;
    label: string;
    tone?: unknown;
  }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const graph = getCustomRelationGraphs(store).find((item) => item.id === graphId && item.projectId === projectId);

  if (!graph) {
    throw new Error("自定义图谱不存在");
  }

  if (!input.from || !input.to || input.from === input.to) {
    throw new Error("请选择两个不同节点建立关系");
  }

  if (!graph.nodes.some((item) => item.id === input.from) || !graph.nodes.some((item) => item.id === input.to)) {
    throw new Error("关系节点不存在");
  }

  const timestamp = now();
  const edge: StoredCustomRelationGraphEdge = {
    id: randomUUID(),
    from: input.from,
    to: input.to,
    label: input.label.trim() || "关联",
    tone: customGraphEdgeTone(input.tone)
  };

  graph.edges.push(edge);
  graph.updatedAt = timestamp;
  project.updatedAt = timestamp;

  await writeStore(store);
  return { graph, edge };
}

export async function deleteCustomRelationGraphEdge(projectId: string, graphId: string, edgeId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const graph = getCustomRelationGraphs(store).find((item) => item.id === graphId && item.projectId === projectId);

  if (!graph || !graph.edges.some((item) => item.id === edgeId)) {
    throw new Error("自定义关系不存在");
  }

  graph.edges = graph.edges.filter((item) => item.id !== edgeId);
  graph.updatedAt = now();
  project.updatedAt = graph.updatedAt;

  await writeStore(store);
  return graph;
}

export async function createCharacterProfile(
  projectId: string,
  input: Omit<
    StoredCharacterProfile,
    "id" | "projectId" | "createdAt" | "updatedAt"
  >
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  if (!input.name.trim()) {
    throw new Error("人物姓名不能为空");
  }

  const timestamp = now();
  const character: StoredCharacterProfile = {
    id: randomUUID(),
    projectId,
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.characterProfiles.push(character);
  project.updatedAt = timestamp;
  await writeStore(store);
  return character;
}

export async function updateCharacterProfile(
  projectId: string,
  characterId: string,
  input: Omit<
    StoredCharacterProfile,
    "id" | "projectId" | "createdAt" | "updatedAt"
  >
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  if (!input.name.trim()) {
    throw new Error("人物姓名不能为空");
  }

  const character = store.characterProfiles.find(
    (item) => item.id === characterId && item.projectId === projectId
  );

  if (!character) {
    throw new Error("人物不存在或已被删除");
  }

  const timestamp = now();
  Object.assign(character, {
    ...input,
    updatedAt: timestamp
  });
  project.updatedAt = timestamp;

  await writeStore(store);
  return character;
}

export async function deleteCharacterProfile(projectId: string, characterId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const originalCount = store.characterProfiles.length;

  store.characterProfiles = store.characterProfiles.filter(
    (item) => !(item.id === characterId && item.projectId === projectId)
  );

  if (store.characterProfiles.length === originalCount) {
    throw new Error("人物不存在或已被删除");
  }

  project.updatedAt = now();
  await writeStore(store);
  return { deleted: true };
}

export async function createForeshadowing(
  projectId: string,
  input: Omit<
    StoredForeshadowing,
    "id" | "projectId" | "createdAt" | "updatedAt"
  >
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  if (!input.name.trim()) {
    throw new Error("伏笔名称不能为空");
  }

  const timestamp = now();
  const foreshadowing: StoredForeshadowing = {
    id: randomUUID(),
    projectId,
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.foreshadowings.push(foreshadowing);
  project.updatedAt = timestamp;
  await writeStore(store);
  return foreshadowing;
}

export async function updateForeshadowing(
  projectId: string,
  foreshadowingId: string,
  input: Omit<
    StoredForeshadowing,
    "id" | "projectId" | "createdAt" | "updatedAt"
  >
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  if (!input.name.trim()) {
    throw new Error("伏笔名称不能为空");
  }

  const foreshadowing = store.foreshadowings.find(
    (item) => item.id === foreshadowingId && item.projectId === projectId
  );

  if (!foreshadowing) {
    throw new Error("伏笔不存在或已被删除");
  }

  const timestamp = now();
  Object.assign(foreshadowing, {
    ...input,
    updatedAt: timestamp
  });
  project.updatedAt = timestamp;

  await writeStore(store);
  return foreshadowing;
}

export async function deleteForeshadowing(projectId: string, foreshadowingId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const originalCount = store.foreshadowings.length;

  store.foreshadowings = store.foreshadowings.filter(
    (item) => !(item.id === foreshadowingId && item.projectId === projectId)
  );

  if (store.foreshadowings.length === originalCount) {
    throw new Error("伏笔不存在或已被删除");
  }

  project.updatedAt = now();
  await writeStore(store);
  return { deleted: true };
}

export async function cleanupProjectWritingState(projectId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  ensureDefaultWritingState(store, project);
  const timestamp = now();
  const plotState = store.plotStates.find((item) => item.projectId === projectId)!;
  const ledgers = store.chapterLedgers
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
  const latestLedger = ledgers.at(-1);
  const initialCharacterCount = store.characterProfiles.filter((item) => item.projectId === projectId).length;
  const initialForeshadowingCount = store.foreshadowings.filter((item) => item.projectId === projectId).length;
  const preferredCharacters = new Map<string, StoredCharacterProfile>();

  store.characterProfiles
    .filter((item) => item.projectId === projectId)
    .forEach((character) => {
      const baseName = baseCharacterName(character.name);

      if (!isValidAutoCharacterName(character.name)) {
        return;
      }

      const existing = preferredCharacters.get(baseName);
      const currentScore = (character.name.includes("（") || character.name.includes("(") ? 2 : 1) +
        (character.identity && character.identity !== "章节台账自动记录的新人物" ? 2 : 0);
      const existingScore = existing
        ? (existing.name.includes("（") || existing.name.includes("(") ? 2 : 1) +
          (existing.identity && existing.identity !== "章节台账自动记录的新人物" ? 2 : 0)
        : 0;

      if (!existing || currentScore > existingScore) {
        preferredCharacters.set(baseName, character);
      }
    });

  const keptCharacterIds = new Set(Array.from(preferredCharacters.values()).map((item) => item.id));
  store.characterProfiles = store.characterProfiles.filter((item) => {
    if (item.projectId !== projectId) {
      return true;
    }
    return keptCharacterIds.has(item.id);
  });
  store.characterProfiles
    .filter((item) => item.projectId === projectId)
    .forEach((character) => {
      const specificEntries = characterSpecificEntries(character.name, ledgers);

      character.name = baseCharacterName(character.name);
      character.knownInformation = specificEntries.join("\n") || "待补充";
      character.currentState = compactStateText(character.currentState, 80);
      character.currentGoal = compactStateText(character.currentGoal, 60) || "待补充";
      character.updatedAt = timestamp;
    });

  const keptForeshadowings: StoredForeshadowing[] = [];
  const seenForeshadowingNames = new Set<string>();

  store.foreshadowings
    .filter((item) => item.projectId === projectId)
    .forEach((item) => {
      const name = normalizeForeshadowingName(item.name);

      if (
        seenForeshadowingNames.has(name) ||
        !isValidForeshadowingName(name) ||
        /这些信息|活着|所有害他的人|很快|一角|讲透/.test(name)
      ) {
        return;
      }

      seenForeshadowingNames.add(name);
      keptForeshadowings.push({
        ...item,
        name,
        hiddenInformation: compactStateText(item.hiddenInformation || name, 90),
        updatedAt: timestamp
      });
    });

  store.foreshadowings = [
    ...store.foreshadowings.filter((item) => item.projectId !== projectId),
    ...keptForeshadowings
  ];

  const ledgerClues = cleanStateEntries(ledgers.flatMap((ledger) => ledger.newClues), 10);
  const ledgerChanges = cleanStateEntries(ledgers.flatMap((ledger) => ledger.stateChanges), 10);
  const latestHook = latestLedger ? compactStateText(latestLedger.cliffhanger, 100) : "";
  const descriptionGoal = compactStateText(plotState.mainGoal, 120);
  const nextStageAnchor = compactStateText(plotState.nextStageGoal || descriptionGoal, 120);

  Object.assign(plotState, {
    mainGoal: descriptionGoal || "建立主角的第一轮逆袭循环",
    shortTermGoal: latestHook
      ? `承接第 ${latestLedger?.chapterNumber} 章钩子：${latestHook}，但必须回扣主线：${descriptionGoal || nextStageAnchor || "当前核心承诺"}`
      : plotState.shortTermGoal,
    currentStage: ledgerChanges[0] || plotState.currentStage,
    unresolvedQuestions: uniqueList([
      ...keptForeshadowings.map((item) => item.name),
      ...ledgerClues,
      latestHook
    ]).slice(0, 12),
    openThreads: uniqueList([
      ...keptForeshadowings.filter((item) => item.status !== "closed").map((item) => item.name),
      ...ledgerClues,
      latestHook
    ]).slice(0, 12),
    resolvedThreads: cleanStateEntries(plotState.resolvedThreads, 8),
    nextMilestones: uniqueList([
      nextStageAnchor ? `继续推进阶段目标：${nextStageAnchor}` : "",
      latestHook ? `处理第 ${latestLedger?.chapterNumber} 章钩子，并让它服务主线：${latestHook}` : "",
      ...ledgerChanges.slice(0, 3)
    ]).slice(0, 8),
    nextStageGoal: nextStageAnchor || plotState.nextStageGoal,
    powerSystemState: cleanPowerSystemEntries(splitLines(plotState.powerSystemState), 6).join("\n"),
    mapAndForces: cleanMapAndForceEntries(splitLines(plotState.mapAndForces), 6).join("\n"),
    resourceState: cleanResourceEntries(splitLines(plotState.resourceState), 6).join("\n"),
    relationshipChanges: cleanStateEntries(plotState.relationshipChanges, 8),
    updatedAt: timestamp
  });

  resetWritingMemoryAfterChapterDelete(store, project, (latestLedger?.chapterNumber ?? 0) + 1);
  project.updatedAt = timestamp;

  await writeStore(store);

  const finalCharacterCount = store.characterProfiles.filter((item) => item.projectId === projectId).length;
  const finalForeshadowingCount = store.foreshadowings.filter((item) => item.projectId === projectId).length;

  return {
    removedCharacters: initialCharacterCount - finalCharacterCount,
    removedForeshadowings: initialForeshadowingCount - finalForeshadowingCount,
    characters: finalCharacterCount,
    foreshadowings: finalForeshadowingCount
  };
}

export async function generateLongFormPlan(
  projectId: string,
  input?: { targetTotalWords?: number },
  options?: { existingJobId?: string; retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  ensureDefaultWritingState(store, project);
  store.longFormPlans ??= [];

  const timestamp = now();
  const bible = store.writingBibles.find((item) => item.projectId === projectId)!;
  const plotState = store.plotStates.find((item) => item.projectId === projectId)!;
  const targetTotalWords = inferTargetTotalWordsFromState(project, bible, input?.targetTotalWords);
  const estimatedChapters = estimateChapterCount(targetTotalWords);
  const storyAnalysis = store.storyAnalyses
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const characters = store.characterProfiles
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const foreshadowings = store.foreshadowings
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const job = options?.existingJobId
    ? createDomainWriteRepository(store).requireJobForUser(options.existingJobId, currentUser.id)
    : createAiJob(store, {
        userId: currentUser.id,
        projectId,
        type: "generate_long_form_plan",
        payload: { targetTotalWords, estimatedChapters },
        model: getActiveAiModel(store, "local-long-form-plan", currentUser.id),
        retryOfJobId: options?.retryOfJobId
      });

  if (!job) {
    throw new Error("任务不存在");
  }

  if (!options?.existingJobId) {
    await writeStore(store);
    startAiJob(job);
    await writeStore(store);
  }

  if (!hasConfiguredAiSettings(store, currentUser.id)) {
    const message = "AI 未配置，无法生成长篇规划";
    failAiJob(job, message);
    refundAiJobCredits(store, job, "长篇规划生成失败返还");
    await writeStore(store);
    throw new Error(message);
  }

  let aiPlan: Awaited<ReturnType<typeof generateLongFormPlanWithAi>>;

  try {
    aiPlan = await generateLongFormPlanWithAi({
      projectName: project.name,
      projectDescription: project.description,
      targetTotalWords,
      estimatedChapters,
      bible,
      plotState,
      characters,
      foreshadowings,
      storyAnalysis
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "长篇规划 AI 生成失败";
    failAiJob(job, message);
    refundAiJobCredits(store, job, "长篇规划生成失败返还");
    await writeStore(store);
    throw new Error(message);
  }

  const plan: StoredLongFormPlan = {
    id: randomUUID(),
    projectId,
    targetTotalWords,
    estimatedChapters,
    planningBasis: aiPlan.planningBasis || `按目标 ${targetTotalWords} 字、约 ${estimatedChapters} 章规划阶段节奏。`,
    corePromise: aiPlan.corePromise || project.description || bible.corePleasure,
    volumePlan: cleanList(aiPlan.volumePlan).slice(0, 12),
    progressionPacing: cleanList(aiPlan.progressionPacing).slice(0, 20),
    rewardPacing: cleanList(aiPlan.rewardPacing).slice(0, 16),
    first10Chapters: cleanList(aiPlan.first10Chapters).slice(0, 12),
    first100Pacing: aiPlan.first100Pacing || "前100章按开局机制验证、小收益、中收益、大爽点、阶段收束轮换推进。",
    post100Pacing: aiPlan.post100Pacing || "100章后按全书卷纲进入后期推进：收束支线、回收伏笔、提高核心压力、控制最终成长档位并准备终局。",
    progressionRules: cleanList([
      ...buildDefaultLongFormProgressionRules(targetTotalWords, estimatedChapters),
      ...aiPlan.progressionRules
    ]).slice(0, 24),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.longFormPlans.push(plan);
  project.updatedAt = timestamp;
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: true,
    usedFallback: false,
    longFormPlanId: plan.id,
    targetTotalWords,
    estimatedChapters
  }, getAiTokenUsage(aiPlan)));
  await writeStore(store);
  return plan;
}

export async function generateWritingTaskCard(
  projectId: string,
  input?: Partial<
    Pick<
      StoredWritingTaskCard,
      | "title"
      | "chapterGoal"
      | "continuity"
      | "mainPlotProgress"
      | "pleasurePoint"
      | "endingHook"
    >
  > & {
    chapterNumber?: number;
    useAnalysisContext?: boolean;
    relatedInspirationIds?: string[];
  },
  options?: { existingJobId?: string; retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  ensureDefaultWritingState(store, project);
  const timestamp = now();
  const bible = store.writingBibles.find((item) => item.projectId === projectId)!;
  const plotState = store.plotStates.find((item) => item.projectId === projectId)!;
  const longFormPlan = getLatestLongFormPlan(store, projectId);
  const useAnalysisContext = input?.useAnalysisContext !== false;
  const storyAnalysis = useAnalysisContext
    ? store.storyAnalyses
        .filter((item) => item.projectId === projectId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    : null;
  const relatedInspirations = (input?.relatedInspirationIds ?? [])
    .map((id) => store.inspirations.find((item) => item.id === id && item.projectId === projectId && item.ownerUserId === currentUser.id))
    .filter((item): item is StoredInspiration => Boolean(item))
    .map((item) => ({
      title: item.title,
      type: item.type,
      content: item.content,
      tags: item.tags
    }))
    .slice(0, 6);
  const relatedInspirationText = relatedInspirations
    .map((item) => `灵感「${item.title}」：${compactStateText(item.content, 120)}`)
    .join("；");
  const chapterIdsByNumber = new Map(
    store.chapters
      .filter((chapter) => chapter.projectId === projectId)
      .map((chapter) => [chapter.id, chapter.chapterNumber])
  );
  const recentChapterAnalyses = useAnalysisContext
    ? store.chapterAnalyses
        .filter((item) => item.projectId === projectId)
        .sort(
          (a, b) =>
            (chapterIdsByNumber.get(b.chapterId) ?? 0) -
              (chapterIdsByNumber.get(a.chapterId) ?? 0) ||
            b.updatedAt.localeCompare(a.updatedAt)
        )
        .slice(0, 5)
    : [];
  const latestLedger = store.chapterLedgers
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => b.chapterNumber - a.chapterNumber || b.updatedAt.localeCompare(a.updatedAt))[0];
  const latestDraft = getLatestChapterDraft(store, projectId);
  const lastTaskCard = getLatestWritingTaskCard(store, projectId);
  const nextChapterNumber =
    Math.max(
      latestLedger?.chapterNumber ?? 0,
      latestDraft?.chapterNumber ?? 0,
      lastTaskCard?.chapterNumber ?? 0,
      0
    ) + 1;
  const targetChapterNumber =
    Number.isFinite(input?.chapterNumber) && Number(input?.chapterNumber) > 0
      ? Math.floor(Number(input?.chapterNumber))
      : nextChapterNumber;
  const lastLedger = getLatestChapterLedgerBefore(store, projectId, targetChapterNumber);
  const lastDraft = getLatestChapterDraftBefore(store, projectId, targetChapterNumber);

  const contextForeshadowings = foreshadowingsForChapterContext(store, projectId, targetChapterNumber);
  const plotStateContext = plotStateForChapterContext(
    plotState,
    contextForeshadowings,
    targetChapterNumber,
    lastLedger
  );
  const openForeshadowings = contextForeshadowings
    .filter((item) => item.status !== "closed")
    .slice(0, 3);
  const allCharacters = charactersForChapterContext(store, projectId, targetChapterNumber);
  const scheduledCharacters = allCharacters.filter((item) =>
    isCharacterScheduledForChapter(item, targetChapterNumber)
  );
  const relevantCharacters = uniqueList([
    ...scheduledCharacters.map((item) => item.name),
    ...allCharacters
      .filter(
        (item) =>
          item.currentGoal.trim() ||
          item.longTermGoal.trim() ||
          item.relationshipToProtagonist.trim() ||
          item.attitude.trim() ||
          item.currentState.trim()
      )
      .slice(0, 2)
      .map((item) => item.name),
    ...allCharacters.slice(0, 3).map((item) => item.name)
  ]).slice(0, 5);
  const chapterCharacterConstraints = uniqueList(
    scheduledCharacters.map((character) => buildCharacterTaskInstruction(character))
  );
  const job = options?.existingJobId
    ? createDomainWriteRepository(store).requireJobForUser(options.existingJobId, currentUser.id)
    : createAiJob(store, {
        userId: currentUser.id,
        projectId,
        type: "generate_task_card",
        payload: { chapterNumber: targetChapterNumber, input: input ?? {} },
        model: getActiveAiModel(store, "local-writing-task-card", currentUser.id),
        retryOfJobId: options?.retryOfJobId
      });

  if (!job) {
    throw new Error("任务不存在");
  }

  if (!options?.existingJobId) {
    await writeStore(store);
    startAiJob(job);
    await writeStore(store);
  }

  const fallbackCard = {
    title: input?.title?.trim() || `第${targetChapterNumber}章 反击前夜`,
    chapterGoal: withCharacterTaskRequirement(
      input?.chapterGoal?.trim() ||
        (relatedInspirationText ? `参考相关灵感：${relatedInspirationText}。` : "") ||
        `${project.description.trim() ? `参考作品简介的开局方向：${project.description.trim()}。` : ""}围绕“${plotStateContext.mainGoal || storyAnalysis?.mainLoop || "当前主线"}”推进一步，让主角获得可见收益或新线索。`,
      chapterCharacterConstraints
    ),
    continuity: withCharacterTaskRequirement(
      input?.continuity?.trim() ||
        (lastLedger
          ? `承接上一章钩子：${lastLedger.cliffhanger}`
          : targetChapterNumber === 1
            ? project.description.trim()
              ? `开启第一章：参考作品简介的开局设定：${project.description.trim()}`
              : `开启第一章：建立主角初始处境与第一轮压力`
          : project.description.trim()
            ? `参考作品简介的开局设定：${project.description.trim()}`
            : `承接当前阶段：${plotStateContext.currentStage}`),
      chapterCharacterConstraints
    ),
    mainPlotProgress: withCharacterTaskRequirement(
      input?.mainPlotProgress?.trim() ||
        (relatedInspirationText ? `把相关灵感转成当前主线里的具体推进：${relatedInspirationText}` : "") ||
        `${project.description.trim() ? "避免明显偏离作品简介里的主角身份、初始危机和核心卖点。" : ""}按“${storyAnalysis?.mainLoop || plotStateContext.currentStage}”继续推进到下一个冲突点。`,
      chapterCharacterConstraints
    ),
    requiredCharacters: relevantCharacters.length > 0 ? relevantCharacters : ["主角", "主要对手"],
    pleasurePoint:
      input?.pleasurePoint?.trim() ||
      `使用“${storyAnalysis?.topPleasureTypes[0] || bible.corePleasure}”制造一次明确情绪回报，并写清收益来源、触发条件、是否符合关键机制；本章也可以只是小收益、线索或机制试错，不必强行大突破。`,
    foreshadowingTasks:
      openForeshadowings.length > 0
        ? openForeshadowings.map((item) => `${item.name}：保持${item.status === "partial" ? "部分回收" : "未回收"}状态`)
        : plotStateContext.unresolvedQuestions.length > 0
          ? plotStateContext.unresolvedQuestions.slice(0, 3).map((item) => `围绕未解悬念继续埋设：${item}`)
          : ["埋设一条可在后续章节回收的线索"],
    rulesNotToBreak: uniqueList([
      ...splitLines(`${bible.narrativeTaboos}\n${bible.immutableSettings}`),
      project.description.trim()
        ? `核心承诺锚点：本章不能偏离作品简介里的主角身份、初始压力、核心卖点和关键机制；支线必须服务「${project.description.trim()}」。`
        : "",
      plotStateContext.mainGoal
        ? `主线回扣要求：本章的新地图、新组织、新危机或新收益，必须能解释为服务当前主线「${plotStateContext.mainGoal}」。`
        : "",
      "禁止只顺着上一章钩子无限扩支线；如果开启支线，必须写清它如何回到核心承诺。",
      "本章所有收益必须回答：收益是什么、来源是什么、触发条件是什么、是否符合关键机制、是否导致节奏越级。",
      targetChapterNumber <= 5
        ? `当前是第 ${targetChapterNumber} 章，仍属于开局早期；如果作品是 10 万字以上，优先写资格、试用、预期收益、小额增长或机制验证，不要过早连续大阶段突破。`
        : "",
      "禁止机制偷换：不能只保留关键机制名词，却让核心成长实际来自另一套资源、奇遇、副本或外力。",
      longFormPlan
        ? `长篇规划约束：目标约 ${longFormPlan.targetTotalWords} 字 / ${longFormPlan.estimatedChapters} 章。本章必须符合成长节奏、收益频率和前100章节奏；如冲突，优先降级为小收益、线索、资格或机制试错。`
        : "尚未生成长篇规划；本章默认保守推进，不要连续大升级、大地图跳转或让支线替代主线。",
      ...(longFormPlan?.progressionRules ?? []),
      "章节功能可以轮换：允许日常经营、关系铺垫、机制试错、小收益和低强度压力，不要每章都强行新敌人、新地图、大战斗或大突破。"
    ]),
    endingHook: withCharacterTaskRequirement(
      input?.endingHook?.trim() ||
        `章末抛出一个新信息，让当前阶段的“${plotStateContext.currentEnemy || "压力源"}”升级。`,
      chapterCharacterConstraints
    )
  };

  let aiCard: Awaited<ReturnType<typeof generateWritingTaskCardWithAi>> | null = null;

  if (hasConfiguredAiSettings(store, currentUser.id)) {
    try {
      aiCard = await generateWritingTaskCardWithAi({
        projectName: project.name,
        projectDescription: project.description,
        bible,
        plotState: plotStateContext,
        longFormPlan,
        lastLedger,
        latestDraft: lastDraft,
        characters: allCharacters,
        chapterCharacterConstraints,
        foreshadowings: contextForeshadowings,
        relatedInspirations,
        storyAnalysis,
        recentChapterAnalyses,
        userInput: input,
        chapterNumber: targetChapterNumber,
        useAnalysisContext
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成任务卡 AI 调用失败";
      failAiJob(job, message);
      refundAiJobCredits(store, job, "生成任务卡 AI 调用失败返还");
      await writeStore(store);
      throw new Error(message);
    }
  }

  const resolvedCard = aiCard
    ? {
        title: aiCard.title || fallbackCard.title,
        chapterGoal: withCharacterTaskRequirement(
          aiCard.chapterGoal || fallbackCard.chapterGoal,
          chapterCharacterConstraints
        ),
        continuity: withCharacterTaskRequirement(
          aiCard.continuity || fallbackCard.continuity,
          chapterCharacterConstraints
        ),
        mainPlotProgress: withCharacterTaskRequirement(
          aiCard.mainPlotProgress || fallbackCard.mainPlotProgress,
          chapterCharacterConstraints
        ),
        requiredCharacters:
          uniqueList([
            ...(aiCard.requiredCharacters && aiCard.requiredCharacters.length > 0
              ? aiCard.requiredCharacters
              : fallbackCard.requiredCharacters),
            ...relevantCharacters
          ]).slice(0, 6),
        pleasurePoint: aiCard.pleasurePoint || fallbackCard.pleasurePoint,
        foreshadowingTasks:
          aiCard.foreshadowingTasks && aiCard.foreshadowingTasks.length > 0
            ? aiCard.foreshadowingTasks
            : fallbackCard.foreshadowingTasks,
        rulesNotToBreak:
          aiCard.rulesNotToBreak && aiCard.rulesNotToBreak.length > 0
            ? aiCard.rulesNotToBreak
            : fallbackCard.rulesNotToBreak,
        endingHook: withCharacterTaskRequirement(
          aiCard.endingHook || fallbackCard.endingHook,
          chapterCharacterConstraints
        )
      }
    : fallbackCard;

  const card: StoredWritingTaskCard = {
    id: randomUUID(),
    projectId,
    chapterNumber: targetChapterNumber,
    ...resolvedCard,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.writingTaskCards.push(card);
  project.status = "writing";
  project.updatedAt = timestamp;
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: Boolean(aiCard),
    usedFallback: !aiCard,
    chapterNumber: targetChapterNumber,
    taskCardId: card.id
  }, getAiTokenUsage(aiCard)));
  await writeStore(store);
  return card;
}

export async function deleteWritingTaskCard(projectId: string, taskCardId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const taskCard = store.writingTaskCards.find(
    (item) => item.id === taskCardId && item.projectId === projectId
  );

  if (!taskCard) {
    throw new Error("任务卡不存在");
  }

  const relatedDraftIds = new Set(
    store.chapterDrafts
      .filter((item) => item.projectId === projectId && item.taskCardId === taskCardId)
      .map((item) => item.id)
  );

  const deletedDraftCount = relatedDraftIds.size;
  const deletedLedgerCount = store.chapterLedgers.filter(
    (item) => item.projectId === projectId && relatedDraftIds.has(item.draftId)
  ).length;
  const deletedReviewCount = store.reviewReports.filter(
    (item) => item.projectId === projectId && relatedDraftIds.has(item.draftId)
  ).length;

  store.reviewReports = store.reviewReports.filter(
    (item) => !(item.projectId === projectId && relatedDraftIds.has(item.draftId))
  );
  store.chapterLedgers = store.chapterLedgers.filter(
    (item) => !(item.projectId === projectId && relatedDraftIds.has(item.draftId))
  );
  store.chapterDrafts = store.chapterDrafts.filter(
    (item) => !(item.projectId === projectId && item.taskCardId === taskCardId)
  );
  store.writingTaskCards = store.writingTaskCards.filter(
    (item) => !(item.id === taskCardId && item.projectId === projectId)
  );
  if (deletedDraftCount > 0 || deletedLedgerCount > 0 || deletedReviewCount > 0) {
    resetWritingMemoryAfterChapterDelete(store, project, taskCard.chapterNumber);
  }
  project.updatedAt = now();

  await writeStore(store);

  return {
    taskCardId,
    deletedDraftCount,
    deletedLedgerCount,
    deletedReviewCount
  };
}

export async function deleteWritingChaptersFrom(projectId: string, chapterNumber: number) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const startChapter = Math.max(1, Math.floor(Number(chapterNumber)));

  if (!Number.isFinite(startChapter)) {
    throw new Error("章节编号无效");
  }

  const deletedTaskCardIds = new Set(
    store.writingTaskCards
      .filter((item) => item.projectId === projectId && item.chapterNumber >= startChapter)
      .map((item) => item.id)
  );
  const deletedDraftIds = new Set(
    store.chapterDrafts
      .filter((item) => item.projectId === projectId && item.chapterNumber >= startChapter)
      .map((item) => item.id)
  );
  const deletedTaskCardCount = deletedTaskCardIds.size;
  const deletedDraftCount = deletedDraftIds.size;
  const deletedLedgerCount = store.chapterLedgers.filter(
    (item) =>
      item.projectId === projectId &&
      (item.chapterNumber >= startChapter || deletedDraftIds.has(item.draftId))
  ).length;
  const deletedReviewCount = store.reviewReports.filter(
    (item) =>
      item.projectId === projectId &&
      (item.chapterNumber >= startChapter || deletedDraftIds.has(item.draftId))
  ).length;

  store.reviewReports = store.reviewReports.filter(
    (item) =>
      !(
        item.projectId === projectId &&
        (item.chapterNumber >= startChapter || deletedDraftIds.has(item.draftId))
      )
  );
  store.chapterLedgers = store.chapterLedgers.filter(
    (item) =>
      !(
        item.projectId === projectId &&
        (item.chapterNumber >= startChapter || deletedDraftIds.has(item.draftId))
      )
  );
  store.chapterDrafts = store.chapterDrafts.filter(
    (item) => !(item.projectId === projectId && item.chapterNumber >= startChapter)
  );
  store.writingTaskCards = store.writingTaskCards.filter(
    (item) => !(item.projectId === projectId && item.chapterNumber >= startChapter)
  );
  resetWritingMemoryAfterChapterDelete(store, project, startChapter);
  project.updatedAt = now();

  await writeStore(store);

  return {
    fromChapter: startChapter,
    deletedTaskCardCount,
    deletedDraftCount,
    deletedLedgerCount,
    deletedReviewCount
  };
}

export async function generateChapterDraft(
  projectId: string,
  taskCardId?: string,
  options?: { targetWordCount?: number; existingJobId?: string; retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  ensureDefaultWritingState(store, project);
  const taskCard =
    (taskCardId
      ? store.writingTaskCards.find((item) => item.id === taskCardId && item.projectId === projectId)
      : getLatestWritingTaskCard(store, projectId)) ?? null;

  if (!taskCard) {
    throw new Error("请先生成章节任务卡");
  }
  const timestamp = now();
  const bible = store.writingBibles.find((item) => item.projectId === projectId)!;
  const plotState = store.plotStates.find((item) => item.projectId === projectId)!;
  const longFormPlan = getLatestLongFormPlan(store, projectId);
  const lastLedger = getLatestChapterLedgerBefore(store, projectId, taskCard.chapterNumber);
  const characters = charactersForChapterContext(store, projectId, taskCard.chapterNumber);
  const foreshadowings = foreshadowingsForChapterContext(store, projectId, taskCard.chapterNumber);
  const plotStateContext = plotStateForChapterContext(
    plotState,
    foreshadowings,
    taskCard.chapterNumber,
    lastLedger
  );
  const targetWordCount = normalizeDraftTargetWordCount(options?.targetWordCount);
  const job = options?.existingJobId
    ? createDomainWriteRepository(store).requireJobForUser(options.existingJobId, currentUser.id)
    : createAiJob(store, {
        userId: currentUser.id,
        projectId,
        type: "generate_chapter",
        payload: { taskCardId, chapterNumber: taskCard.chapterNumber, targetWordCount },
        model: getActiveAiModel(store, "local-writing-chapter-generator", currentUser.id),
        retryOfJobId: options?.retryOfJobId
      });

  if (!job) {
    throw new Error("任务不存在");
  }

  if (!options?.existingJobId) {
    await writeStore(store);
    startAiJob(job);
    await writeStore(store);
  }

  if (!hasConfiguredAiSettings(store, currentUser.id)) {
    const message = "AI 未配置，无法生成章节正文";
    failAiJob(job, message);
    refundAiJobCredits(store, job, "章节正文生成失败返还");
    await writeStore(store);
    throw new Error(message);
  }

  let aiDraft: Awaited<ReturnType<typeof generateChapterDraftWithAi>>;

  try {
    aiDraft = await generateChapterDraftWithAi({
      taskCard,
      projectName: project.name,
      projectDescription: project.description,
      bible,
      plotState: plotStateContext,
      longFormPlan,
      lastLedger,
      previousDraftTail: getPreviousDraftTail(store, projectId, taskCard.chapterNumber),
      characters,
      foreshadowings,
      targetWordCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "章节正文 AI 生成失败";
    failAiJob(job, message);
    refundAiJobCredits(store, job, "章节正文生成失败返还");
    await writeStore(store);
    throw new Error(message);
  }

  const title = aiDraft.title || taskCard.title;
  const content = prepareChapterDraftContentForSave(aiDraft.content, targetWordCount);

  if (
    aiDraft &&
    countDraftCharacters(content) < minimumSavableDraftCharacters(targetWordCount)
  ) {
    const message = `正文生成结果偏短：当前 ${countDraftCharacters(content)} 字，最低保存要求 ${minimumSavableDraftCharacters(targetWordCount)} 字。请降低目标字数或重新生成。`;
    failAiJob(job, message, withAiBillingOutput(store, job, {
      usedAi: true,
      usedFallback: false,
      failed: true,
      chapterNumber: taskCard.chapterNumber,
      targetWordCount,
      actualCharacters: countDraftCharacters(content)
    }, getAiTokenUsage(aiDraft)));
    await writeStore(store);
    throw new Error(message);
  }

  const draft: StoredChapterDraft = {
    id: randomUUID(),
    projectId,
    taskCardId: taskCard.id,
    chapterNumber: taskCard.chapterNumber,
    title,
    content,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.chapterDrafts.push(draft);
  project.status = "writing";
  project.updatedAt = timestamp;
  const stateUpdate = await createAndApplyLedgerForDraft(store, {
    projectId,
    draft,
    taskCard,
    useAi: true
  });
  const tokenUsage = combineAiTokenUsages([getAiTokenUsage(aiDraft), stateUpdate.tokenUsage]);
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: true,
    usedFallback: false,
    draftId: draft.id,
    chapterNumber: draft.chapterNumber,
    targetWordCount,
    actualCharacters: countDraftCharacters(draft.content),
    ledgerId: stateUpdate.ledger.id,
    stateUpdated: true,
    stateUpdateUsedAi: stateUpdate.usedAi,
    stateUpdateError: stateUpdate.error
  }, tokenUsage));
  await writeStore(store);
  return draft;
}

export async function regenerateChapterDraftContent(
  projectId: string,
  draftId: string,
  options?: { targetWordCount?: number; existingJobId?: string; retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  ensureDefaultWritingState(store, project);
  const draft = store.chapterDrafts.find((item) => item.id === draftId && item.projectId === projectId);

  if (!draft) {
    throw new Error("要重写的章节正文不存在");
  }

  const taskCard = store.writingTaskCards.find(
    (item) => item.id === draft.taskCardId && item.projectId === projectId
  );

  if (!taskCard) {
    throw new Error("章节任务卡不存在，无法只重写正文");
  }

  const bible = store.writingBibles.find((item) => item.projectId === projectId)!;
  const plotState = store.plotStates.find((item) => item.projectId === projectId)!;
  const longFormPlan = getLatestLongFormPlan(store, projectId);
  const lastLedger = getLatestChapterLedgerBefore(store, projectId, taskCard.chapterNumber);
  const characters = charactersForChapterContext(store, projectId, taskCard.chapterNumber);
  const foreshadowings = foreshadowingsForChapterContext(store, projectId, taskCard.chapterNumber);
  const plotStateContext = plotStateForChapterContext(
    plotState,
    foreshadowings,
    taskCard.chapterNumber,
    lastLedger
  );
  const targetWordCount = normalizeDraftTargetWordCount(
    options?.targetWordCount ?? countDraftCharacters(draft.content)
  );
  const job = options?.existingJobId
    ? createDomainWriteRepository(store).requireJobForUser(options.existingJobId, currentUser.id)
    : createAiJob(store, {
        userId: currentUser.id,
        projectId,
        type: "generate_chapter",
        payload: {
          draftId: draft.id,
          taskCardId: taskCard.id,
          chapterNumber: taskCard.chapterNumber,
          targetWordCount,
          regenerateOnlyContent: true
        },
        model: getActiveAiModel(store, "local-writing-chapter-generator", currentUser.id),
        retryOfJobId: options?.retryOfJobId
      });

  if (!job) {
    throw new Error("任务不存在");
  }

  if (!options?.existingJobId) {
    await writeStore(store);
    startAiJob(job);
    await writeStore(store);
  }

  if (!hasConfiguredAiSettings(store, currentUser.id)) {
    const message = "AI 未配置，无法重写章节正文";
    failAiJob(job, message);
    refundAiJobCredits(store, job, "章节正文重写失败返还");
    await writeStore(store);
    throw new Error(message);
  }

  let aiDraft: Awaited<ReturnType<typeof generateChapterDraftWithAi>>;

  try {
    aiDraft = await generateChapterDraftWithAi({
      taskCard,
      projectName: project.name,
      projectDescription: project.description,
      bible,
      plotState: plotStateContext,
      longFormPlan,
      lastLedger,
      previousDraftTail: getPreviousDraftTail(store, projectId, taskCard.chapterNumber),
      characters,
      foreshadowings,
      targetWordCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "章节正文 AI 重写失败";
    failAiJob(job, message);
    refundAiJobCredits(store, job, "章节正文重写失败返还");
    await writeStore(store);
    throw new Error(message);
  }

  const content = prepareChapterDraftContentForSave(aiDraft.content, targetWordCount);
  const actualCharacters = countDraftCharacters(content);

  if (actualCharacters < minimumSavableDraftCharacters(targetWordCount)) {
    const message = `正文重写结果偏短：当前 ${actualCharacters} 字，最低保存要求 ${minimumSavableDraftCharacters(targetWordCount)} 字。请降低目标字数或重新生成。`;
    failAiJob(job, message, withAiBillingOutput(store, job, {
      usedAi: true,
      usedFallback: false,
      failed: true,
      draftId: draft.id,
      chapterNumber: taskCard.chapterNumber,
      targetWordCount,
      actualCharacters
    }, getAiTokenUsage(aiDraft)));
    await writeStore(store);
    throw new Error(message);
  }

  const timestamp = now();
  const deletedReviewCount = store.reviewReports.filter((item) => item.draftId === draft.id).length;
  const preservedLedgerCount = store.chapterLedgers.filter((item) => item.draftId === draft.id).length;

  store.reviewReports = store.reviewReports.filter((item) => item.draftId !== draft.id);
  draft.content = content;
  draft.status = "draft";
  draft.updatedAt = timestamp;
  project.status = "writing";
  project.updatedAt = timestamp;
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: true,
    usedFallback: false,
    draftId: draft.id,
    chapterNumber: draft.chapterNumber,
    targetWordCount,
    actualCharacters,
    regenerateOnlyContent: true,
    preservedLedgerCount,
    deletedReviewCount,
    stateUpdated: false
  }, getAiTokenUsage(aiDraft)));
  await writeStore(store);

  return {
    draft,
    preservedLedgerCount,
    deletedReviewCount
  };
}

export async function prepareChapterDraftStream(
  projectId: string,
  taskCardId?: string,
  options?: { targetWordCount?: number }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const taskCard =
    (taskCardId
      ? store.writingTaskCards.find((item) => item.id === taskCardId && item.projectId === projectId)
      : getLatestWritingTaskCard(store, projectId)) ?? null;

  if (!taskCard) {
    throw new Error("请先生成章节任务卡");
  }

  const bible = store.writingBibles.find((item) => item.projectId === projectId)!;
  const plotState = store.plotStates.find((item) => item.projectId === projectId)!;
  const longFormPlan = getLatestLongFormPlan(store, projectId);
  const lastLedger = getLatestChapterLedgerBefore(store, projectId, taskCard.chapterNumber);
  const foreshadowings = foreshadowingsForChapterContext(store, projectId, taskCard.chapterNumber);
  const targetWordCount = normalizeDraftTargetWordCount(options?.targetWordCount);
  const context: ChapterDraftContext = {
    taskCard,
    projectName: project.name,
    projectDescription: project.description,
    bible,
    plotState: plotStateForChapterContext(plotState, foreshadowings, taskCard.chapterNumber, lastLedger),
    longFormPlan,
    lastLedger,
    previousDraftTail: getPreviousDraftTail(store, projectId, taskCard.chapterNumber),
    characters: charactersForChapterContext(store, projectId, taskCard.chapterNumber),
    foreshadowings,
    targetWordCount
  };
  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "generate_chapter",
    payload: {
      taskCardId: taskCard.id,
      chapterNumber: taskCard.chapterNumber,
      streamed: true,
      targetWordCount
    },
    model: getActiveAiModel(store, "local-writing-chapter-generator", currentUser.id)
  });

  project.status = "writing";
  project.updatedAt = now();
  await writeStore(store);
  startAiJob(job);
  await writeStore(store);

  return {
    projectId,
    taskCard,
    context,
    jobId: job.id,
    useAi: hasConfiguredAiSettings(store, currentUser.id),
    fallbackContent: buildFallbackChapterDraftContent(taskCard)
  };
}

export async function prepareRegenerateChapterDraftContentStream(
  projectId: string,
  draftId: string,
  options?: { targetWordCount?: number }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const draft = store.chapterDrafts.find((item) => item.id === draftId && item.projectId === projectId);

  if (!draft) {
    throw new Error("要重写的章节正文不存在");
  }

  const taskCard = store.writingTaskCards.find(
    (item) => item.id === draft.taskCardId && item.projectId === projectId
  );

  if (!taskCard) {
    throw new Error("章节任务卡不存在，无法只重写正文");
  }

  const bible = store.writingBibles.find((item) => item.projectId === projectId)!;
  const plotState = store.plotStates.find((item) => item.projectId === projectId)!;
  const longFormPlan = getLatestLongFormPlan(store, projectId);
  const lastLedger = getLatestChapterLedgerBefore(store, projectId, taskCard.chapterNumber);
  const foreshadowings = foreshadowingsForChapterContext(store, projectId, taskCard.chapterNumber);
  const targetWordCount = normalizeDraftTargetWordCount(
    options?.targetWordCount ?? countDraftCharacters(draft.content)
  );
  const context: ChapterDraftContext = {
    taskCard,
    projectName: project.name,
    projectDescription: project.description,
    bible,
    plotState: plotStateForChapterContext(plotState, foreshadowings, taskCard.chapterNumber, lastLedger),
    longFormPlan,
    lastLedger,
    previousDraftTail: getPreviousDraftTail(store, projectId, taskCard.chapterNumber),
    characters: charactersForChapterContext(store, projectId, taskCard.chapterNumber),
    foreshadowings,
    targetWordCount
  };
  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "generate_chapter",
    payload: {
      draftId: draft.id,
      taskCardId: taskCard.id,
      chapterNumber: taskCard.chapterNumber,
      streamed: true,
      regenerateOnlyContent: true,
      targetWordCount
    },
    model: getActiveAiModel(store, "local-writing-chapter-generator", currentUser.id)
  });

  project.status = "writing";
  project.updatedAt = now();
  await writeStore(store);
  startAiJob(job);
  await writeStore(store);

  return {
    projectId,
    draftId: draft.id,
    taskCard,
    context,
    jobId: job.id,
    useAi: hasConfiguredAiSettings(store, currentUser.id)
  };
}

export async function saveStreamedChapterDraft(input: {
  projectId: string;
  taskCardId: string;
  jobId: string;
  content: string;
  usedAi: boolean;
  tokenUsage?: AiTokenUsage;
}) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(
    input.projectId,
    currentUser.id,
    "流式正文保存失败：项目或任务不存在"
  );
  const taskCard = store.writingTaskCards.find(
    (item) => item.id === input.taskCardId && item.projectId === input.projectId
  );
  const job = createDomainWriteRepository(store).requireJobForUser(
    input.jobId,
    currentUser.id,
    "流式正文保存失败：项目或任务不存在"
  );

  if (!taskCard) {
    throw new Error("流式正文保存失败：项目或任务不存在");
  }

  const timestamp = now();
  const lastLedger = getLatestChapterLedgerBefore(store, input.projectId, taskCard.chapterNumber);
  const foreshadowings = foreshadowingsForChapterContext(store, input.projectId, taskCard.chapterNumber);
  const draftContext: ChapterDraftContext = {
    taskCard,
    projectName: project.name,
    projectDescription: project.description,
    bible: store.writingBibles.find((item) => item.projectId === input.projectId)!,
    plotState: plotStateForChapterContext(
      store.plotStates.find((item) => item.projectId === input.projectId)!,
      foreshadowings,
      taskCard.chapterNumber,
      lastLedger
    ),
    lastLedger,
    previousDraftTail: getPreviousDraftTail(store, input.projectId, taskCard.chapterNumber),
    characters: charactersForChapterContext(store, input.projectId, taskCard.chapterNumber),
    foreshadowings,
    targetWordCount: Number(getJobInputRecord(job)?.targetWordCount ?? 0) || undefined
  };
  const payload = getJobInputRecord(job);
  const targetWordCount = Number(payload?.targetWordCount ?? 0) || undefined;
  let tokenUsage = input.tokenUsage;
  let content = prepareChapterDraftContentForSave(
    sanitizeChapterDraftDiction(input.content.trim(), draftContext),
    targetWordCount
  );

  if (
    input.usedAi &&
    countDraftCharacters(content) > maximumDraftCharacters(targetWordCount)
  ) {
    const compressed = await compressChapterDraftToTarget(content, draftContext, normalizeDraftTargetWordCount(targetWordCount));
    content = compressed.content;
    tokenUsage = combineAiTokenUsages([tokenUsage, compressed.usage]);
  }

  if (!content) {
    const message = "AI 没有返回正文，未保存为章节草稿";
    failAiJob(job, message, withAiBillingOutput(store, job, {
      usedAi: input.usedAi,
      usedFallback: false,
      streamed: true,
      failed: true,
      chapterNumber: taskCard.chapterNumber,
      targetWordCount,
      actualCharacters: 0
    }, tokenUsage));
    await writeStore(store);
    throw new Error(message);
  }

  if (
    input.usedAi &&
    countDraftCharacters(content) < minimumSavableDraftCharacters(targetWordCount)
  ) {
    const message = `正文生成结果偏短：当前 ${countDraftCharacters(content)} 字，最低保存要求 ${minimumSavableDraftCharacters(targetWordCount)} 字。请降低目标字数或重新生成。`;
    failAiJob(job, message, withAiBillingOutput(store, job, {
      usedAi: true,
      usedFallback: false,
      streamed: true,
      failed: true,
      chapterNumber: taskCard.chapterNumber,
      targetWordCount,
      actualCharacters: countDraftCharacters(content)
    }, tokenUsage));
    await writeStore(store);
    throw new Error(message);
  }

  const draft: StoredChapterDraft = {
    id: randomUUID(),
    projectId: input.projectId,
    taskCardId: taskCard.id,
    chapterNumber: taskCard.chapterNumber,
    title: taskCard.title,
    content,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.chapterDrafts.push(draft);
  project.status = "writing";
  project.updatedAt = timestamp;
  const stateUpdate = await createAndApplyLedgerForDraft(store, {
    projectId: input.projectId,
    draft,
    taskCard,
    useAi: input.usedAi && hasConfiguredAiSettings(store, currentUser.id)
  });
  const finalTokenUsage = combineAiTokenUsages([tokenUsage, stateUpdate.tokenUsage]);
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: input.usedAi,
    usedFallback: false,
    streamed: true,
    draftId: draft.id,
    chapterNumber: draft.chapterNumber,
    targetWordCount,
    actualCharacters: countDraftCharacters(draft.content),
    ledgerId: stateUpdate.ledger.id,
    stateUpdated: true,
    stateUpdateUsedAi: stateUpdate.usedAi,
    stateUpdateError: stateUpdate.error
  }, finalTokenUsage));
  await writeStore(store);
  return draft;
}

export async function saveStreamedRegeneratedChapterDraftContent(input: {
  projectId: string;
  draftId: string;
  jobId: string;
  content: string;
  usedAi: boolean;
  tokenUsage?: AiTokenUsage;
}) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(
    input.projectId,
    currentUser.id,
    "流式正文重写保存失败：项目或章节不存在"
  );
  const draft = store.chapterDrafts.find(
    (item) => item.id === input.draftId && item.projectId === input.projectId
  );
  const job = createDomainWriteRepository(store).requireJobForUser(
    input.jobId,
    currentUser.id,
    "流式正文重写保存失败：项目或章节不存在"
  );

  if (!draft) {
    throw new Error("流式正文重写保存失败：项目或章节不存在");
  }

  const taskCard = store.writingTaskCards.find(
    (item) => item.id === draft.taskCardId && item.projectId === input.projectId
  );

  if (!taskCard) {
    throw new Error("章节任务卡不存在，无法保存重写正文");
  }

  const timestamp = now();
  const lastLedger = getLatestChapterLedgerBefore(store, input.projectId, taskCard.chapterNumber);
  const foreshadowings = foreshadowingsForChapterContext(store, input.projectId, taskCard.chapterNumber);
  const targetWordCount = Number(getJobInputRecord(job)?.targetWordCount ?? 0) || undefined;
  const draftContext: ChapterDraftContext = {
    taskCard,
    projectName: project.name,
    projectDescription: project.description,
    bible: store.writingBibles.find((item) => item.projectId === input.projectId)!,
    plotState: plotStateForChapterContext(
      store.plotStates.find((item) => item.projectId === input.projectId)!,
      foreshadowings,
      taskCard.chapterNumber,
      lastLedger
    ),
    longFormPlan: getLatestLongFormPlan(store, input.projectId),
    lastLedger,
    previousDraftTail: getPreviousDraftTail(store, input.projectId, taskCard.chapterNumber),
    characters: charactersForChapterContext(store, input.projectId, taskCard.chapterNumber),
    foreshadowings,
    targetWordCount
  };
  let tokenUsage = input.tokenUsage;
  let content = prepareChapterDraftContentForSave(
    sanitizeChapterDraftDiction(input.content.trim(), draftContext),
    targetWordCount
  );

  if (
    input.usedAi &&
    countDraftCharacters(content) > maximumDraftCharacters(targetWordCount)
  ) {
    const compressed = await compressChapterDraftToTarget(content, draftContext, normalizeDraftTargetWordCount(targetWordCount));
    content = compressed.content;
    tokenUsage = combineAiTokenUsages([tokenUsage, compressed.usage]);
  }

  const actualCharacters = countDraftCharacters(content);

  if (!content) {
    const message = "AI 没有返回正文，未替换当前章节";
    failAiJob(job, message, withAiBillingOutput(store, job, {
      usedAi: input.usedAi,
      usedFallback: false,
      streamed: true,
      regenerateOnlyContent: true,
      failed: true,
      draftId: draft.id,
      chapterNumber: draft.chapterNumber,
      targetWordCount,
      actualCharacters: 0
    }, tokenUsage));
    await writeStore(store);
    throw new Error(message);
  }

  if (
    input.usedAi &&
    actualCharacters < minimumSavableDraftCharacters(targetWordCount)
  ) {
    const message = `正文重写结果偏短：当前 ${actualCharacters} 字，最低保存要求 ${minimumSavableDraftCharacters(targetWordCount)} 字。请降低目标字数或重新生成。`;
    failAiJob(job, message, withAiBillingOutput(store, job, {
      usedAi: true,
      usedFallback: false,
      streamed: true,
      regenerateOnlyContent: true,
      failed: true,
      draftId: draft.id,
      chapterNumber: draft.chapterNumber,
      targetWordCount,
      actualCharacters
    }, tokenUsage));
    await writeStore(store);
    throw new Error(message);
  }

  const deletedReviewCount = store.reviewReports.filter((item) => item.draftId === draft.id).length;
  const preservedLedgerCount = store.chapterLedgers.filter((item) => item.draftId === draft.id).length;

  store.reviewReports = store.reviewReports.filter((item) => item.draftId !== draft.id);
  draft.content = content;
  draft.status = "draft";
  draft.updatedAt = timestamp;
  project.status = "writing";
  project.updatedAt = timestamp;
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: input.usedAi,
    usedFallback: false,
    streamed: true,
    regenerateOnlyContent: true,
    draftId: draft.id,
    chapterNumber: draft.chapterNumber,
    targetWordCount,
    actualCharacters,
    preservedLedgerCount,
    deletedReviewCount,
    stateUpdated: false
  }, tokenUsage));
  await writeStore(store);
  return draft;
}

export async function createChapterLedger(projectId: string, draftId?: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const draft =
    (draftId
      ? store.chapterDrafts.find((item) => item.id === draftId && item.projectId === projectId)
      : getLatestChapterDraft(store, projectId)) ?? null;

  if (!draft) {
    throw new Error("请先生成正文草稿");
  }

  const taskCard = store.writingTaskCards.find((item) => item.id === draft.taskCardId);

  if (!taskCard) {
    throw new Error("章节任务卡不存在，无法更新章节台账");
  }

  const useAi = hasConfiguredAiSettings(store, currentUser.id);
  const job = useAi
    ? createAiJob(store, {
        userId: currentUser.id,
        projectId,
        type: "update_chapter_state",
        payload: { draftId: draft.id, chapterNumber: draft.chapterNumber },
        model: getActiveAiModel(store, "local-writing-state-update", currentUser.id)
      })
    : null;

  if (job) {
    startAiJob(job);
  }

  const stateUpdate = await createAndApplyLedgerForDraft(store, {
    projectId,
    draft,
    taskCard,
    useAi
  });

  if (job) {
    finishAiJob(job, withAiBillingOutput(store, job, {
      usedAi: stateUpdate.usedAi,
      usedFallback: !stateUpdate.usedAi,
      draftId: draft.id,
      ledgerId: stateUpdate.ledger.id,
      chapterNumber: draft.chapterNumber,
      stateUpdated: true,
      stateUpdateError: stateUpdate.error
    }, stateUpdate.tokenUsage));
  }

  project.updatedAt = now();
  await writeStore(store);
  return stateUpdate.ledger;
}

export async function reviewChapterDraft(
  projectId: string,
  draftId?: string,
  options?: { existingJobId?: string; retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const draft =
    (draftId
      ? store.chapterDrafts.find((item) => item.id === draftId && item.projectId === projectId)
      : getLatestChapterDraft(store, projectId)) ?? null;

  if (!draft) {
    throw new Error("请先生成正文草稿");
  }

  const taskCard = store.writingTaskCards.find((item) => item.id === draft.taskCardId);
  const bible = store.writingBibles.find((item) => item.projectId === projectId)!;
  const plotState = store.plotStates.find((item) => item.projectId === projectId)!;
  const longFormPlan = getLatestLongFormPlan(store, projectId);
  const lastLedger = getLatestChapterLedgerBefore(store, projectId, draft.chapterNumber);
  const currentLedger = store.chapterLedgers.find((item) => item.draftId === draft.id) ?? null;
  const characters = charactersForChapterContext(store, projectId, draft.chapterNumber);
  const reviewCharacters = characters.map((character) =>
    withCharacterGenderConstraint(
      character,
      inferCharacterGenderFromProjectEvidence(store, projectId, character, draft.chapterNumber, draft.content)
    )
  );
  const foreshadowings = foreshadowingsForChapterContext(store, projectId, draft.chapterNumber);
  const plotStateContext = plotStateForChapterContext(
    plotState,
    foreshadowings,
    draft.chapterNumber,
    lastLedger
  );
  const job = options?.existingJobId
    ? createDomainWriteRepository(store).requireJobForUser(options.existingJobId, currentUser.id)
    : createAiJob(store, {
        userId: currentUser.id,
        projectId,
        type: "review_chapter",
        payload: { draftId: draft.id, chapterNumber: draft.chapterNumber },
        model: getActiveAiModel(store, "local-writing-reviewer", currentUser.id),
        retryOfJobId: options?.retryOfJobId
      });

  if (!job) {
    throw new Error("任务不存在");
  }

  if (!options?.existingJobId) {
    await writeStore(store);
    startAiJob(job);
    await writeStore(store);
  }
  const timestamp = now();
  const issues: ReviewIssue[] = [];
  const previousReview = store.reviewReports
    .filter((item) => item.draftId === draft.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  if (taskCard && !draftEndingAppearsToCarryHook(draft.content, taskCard.endingHook)) {
    issues.push({
      type: "章末钩子弱化",
      location: endingDraftExcerpt(draft.content) || "结尾段",
      severity: "medium",
      suggestion: buildEndingHookSuggestion(draft.content, taskCard.endingHook)
    });
  }

  const aiFlavorFallbackSentence = findAiFlavorFallbackSentence(draft.content);

  if (aiFlavorFallbackSentence) {
    issues.push({
      type: "AI 味表达",
      location: aiFlavorFallbackSentence,
      severity: "medium",
      suggestion: buildAiFlavorFallbackSuggestion(aiFlavorFallbackSentence)
    });
  }

  reviewCharacters.forEach((character) => {
    const gender = inferCharacterGenderFromProjectEvidence(
      store,
      projectId,
      character,
      draft.chapterNumber,
      draft.content
    );
    const mismatch = gender ? findCharacterPronounMismatch(draft.content, character, gender) : null;

    if (mismatch) {
      issues.push({
        type: "人物代词错误",
        location: mismatch.location,
        severity: "high",
        problem: `${baseCharacterName(character.name)}的人物性别/代词与前文状态不一致。`,
        suggestion: mismatch.suggestion
      });
    }
  });

  if (draft.content.length < 800) {
    issues.push({
      type: "正文密度不足",
      location: "全文",
      severity: "low",
      suggestion: "当前更像章节样稿，后续应补足场景、对话和压制过程。"
    });
  }

  if (/无限|无代价|随便使用|一招秒杀|直接无敌|没有上限/.test(draft.content)) {
    issues.push({
      type: "战力膨胀风险",
      location: "能力释放段",
      severity: "high",
      suggestion: `检查是否违反金手指限制和战力体系：${bible.goldenFingerRules || bible.powerSystem}`
    });
  }

  reviewCharacters.forEach((character) => {
    const hiddenFragments = splitLines(`${character.secret}\n${character.unknownInformation}`)
      .filter((item) => item.length >= 4)
      .slice(0, 5);
    const leaked = hiddenFragments.find((fragment) =>
      draft.content.includes(character.name) && draft.content.includes(fragment)
    );

    if (leaked) {
      issues.push({
        type: "人物信息越界",
        location: character.name,
        severity: "high",
        suggestion: `${character.name} 可能知道了不该知道的信息：“${leaked}”。请改成误判、猜测或延后揭示。`
      });
    }
  });

  const newSettingLines = extractLinesByKeywords(
    draft.content,
    ["新境界", "新地图", "新势力", "规则", "等级", "宗门", "家族", "公司", "黑市"],
    5
  ).filter((line) => {
    const knownSettingText = [
      bible.worldRules,
      bible.powerSystem,
      bible.immutableSettings,
      bible.goldenFingerRules,
      plotStateContext.currentMap,
      plotStateContext.currentStage,
      plotStateContext.mainGoal,
      plotStateContext.shortTermGoal,
      plotStateContext.mapAndForces,
      plotStateContext.powerSystemState,
      plotStateContext.resourceState,
      plotStateContext.openThreads.join("\n"),
      plotStateContext.nextMilestones.join("\n"),
      ledgerToReviewEvidence(currentLedger),
      ledgerToReviewEvidence(lastLedger),
      taskCard?.chapterGoal ?? "",
      taskCard?.mainPlotProgress ?? "",
      taskCard?.pleasurePoint ?? "",
      taskCard?.foreshadowingTasks.join("\n") ?? "",
      taskCard?.rulesNotToBreak.join("\n") ?? "",
      reviewCharacters.map((character) => [
        character.name,
        character.identity,
        character.currentGoal,
        character.relationshipToProtagonist,
        character.knownInformation,
        character.currentState
      ].join("\n")).join("\n"),
      foreshadowings.map((item) => [
        item.name,
        item.relatedLocation,
        item.hiddenInformation,
        item.revealMethod
      ].join("\n")).join("\n")
    ].join("\n");
    return !isSettingLineRecorded(line, knownSettingText);
  });

  if (newSettingLines.length > 0) {
    issues.push({
      type: "未入库新设定",
      location: "设定描写段",
      severity: "low",
      suggestion: `本章疑似出现需要长期复用的新设定：${newSettingLines[0]}。系统会先通过章节台账自动同步；如果它只是一次性岗位、地点或道具，可忽略；如果后续还会反复使用，再到状态页补进世界观、战力体系、资源状态或地图势力。`
    });
  }

  const aiReview = hasConfiguredAiSettings(store, currentUser.id)
    ? await reviewChapterDraftWithAi({
        projectName: project.name,
        projectDescription: project.description,
        draft,
        taskCard:
          taskCard ??
          ({
            ...draft,
            title: draft.title,
            chapterGoal: "",
            continuity: "",
            mainPlotProgress: "",
            requiredCharacters: [],
            pleasurePoint: "",
            foreshadowingTasks: [],
            rulesNotToBreak: [],
            endingHook: "",
            status: "draft",
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt
          } as StoredWritingTaskCard),
        bible,
        plotState: plotStateContext,
        longFormPlan,
        lastLedger,
        currentLedger,
        characters: reviewCharacters,
        foreshadowings
      })
    : null;
  const localPronounIssues = issues.filter(isPronounOrGenderReviewIssue);
  const aiIssues = aiReview?.issues?.filter((issue) => !isPronounOrGenderReviewIssue(issue)) ?? [];
  const finalIssues = uniqueReviewIssues(
    aiIssues.length > 0 ? [...localPronounIssues, ...aiIssues] : issues
  );
  const previousIssuesToCarry = (previousReview?.issues ?? []).filter((issue) => issue.type !== "未入库新设定");
  const mergedIssues = mergeReviewIssues(finalIssues, previousIssuesToCarry);
  const aiOverall = aiReview?.overall?.trim() ?? "";
  const finalOverall =
    aiOverall && (localPronounIssues.length > 0 || !/代词|性别|她\/她的|他\/他的|女性|男性/.test(aiOverall))
      ? aiOverall
      : issues.length === 0
        ? "未发现明显跑偏问题，可以进入人工二稿。"
        : "已发现需要修正的问题，建议先处理一致性和表达问题再入库。";

  const finalStateSuggestions =
    aiReview?.stateUpdateSuggestions && aiReview.stateUpdateSuggestions.length > 0
      ? aiReview.stateUpdateSuggestions
      : [
          "将本章新增线索写入章节台账",
          "确认人物知道/不知道的信息是否变化",
          "确认本章收益是否影响下一章开局"
        ];
  const shouldUpdateState = aiReview?.shouldUpdateState ?? true;

  const report: StoredReviewReport = {
    id: randomUUID(),
    projectId,
    draftId: draft.id,
    chapterNumber: draft.chapterNumber,
    overall: formatReviewText(finalOverall),
    issues: mergedIssues.map(sanitizeReviewIssueText),
    shouldUpdateState,
    stateUpdateSuggestions: finalStateSuggestions.map(formatReviewText),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  draft.status = "reviewed";
  draft.updatedAt = timestamp;
  store.reviewReports = store.reviewReports.filter((item) => item.draftId !== draft.id);
  store.reviewReports.push(report);
  project.updatedAt = timestamp;
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: Boolean(aiReview),
    usedFallback: !aiReview,
    reviewReportId: report.id,
    issues: report.issues.length,
    preservedIssues: previousReview ? Math.max(0, report.issues.length - finalIssues.length) : 0
  }, getAiTokenUsage(aiReview)));
  await writeStore(store);
  return report;
}

export async function editDraftText(
  projectId: string,
  input: { mode: string; text: string; draftId?: string },
  options?: { existingJobId?: string; retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const originalText = input.text.trim();

  if (originalText.length < 10) {
    throw new Error("请先输入需要二稿编辑的文本");
  }

  const draft = input.draftId
    ? store.chapterDrafts.find((item) => item.id === input.draftId && item.projectId === projectId)
    : undefined;

  if (input.draftId && !draft) {
    throw new Error("二稿关联章节不存在");
  }

  const timestamp = now();
  const { aiFlavorSentences, diagnosis } = diagnoseAiFlavor(originalText);
  const job = options?.existingJobId
    ? createDomainWriteRepository(store).requireJobForUser(options.existingJobId, currentUser.id)
    : createAiJob(store, {
        userId: currentUser.id,
        projectId,
        type: "edit_second_draft",
        payload: { mode: input.mode || "网文作者版", originalText, draftId: draft?.id },
        model: getActiveAiModel(store, "local-editing-helper", currentUser.id),
        retryOfJobId: options?.retryOfJobId
      });

  if (!job) {
    throw new Error("任务不存在");
  }

  if (!options?.existingJobId) {
    await writeStore(store);
    startAiJob(job);
    await writeStore(store);
  }

  if (!hasConfiguredAiSettings(store, currentUser.id)) {
    const message = "AI 未配置，无法生成二稿";
    failAiJob(job, message);
    refundAiJobCredits(store, job, "二稿生成失败返还");
    await writeStore(store);
    throw new Error(message);
  }

  let aiEdit: Awaited<ReturnType<typeof editDraftTextWithAi>>;

  try {
    aiEdit = await editDraftTextWithAi({
        mode: input.mode || "网文作者版",
        originalText
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : "二稿 AI 生成失败";
    failAiJob(job, message);
    refundAiJobCredits(store, job, "二稿生成失败返还");
    await writeStore(store);
    throw new Error(message);
  }

  const report: StoredEditReport = {
    id: randomUUID(),
    projectId,
    draftId: draft?.id,
    mode: input.mode || "网文作者版",
    originalText,
    aiFlavorSentences:
      aiEdit.aiFlavorSentences && aiEdit.aiFlavorSentences.length > 0
        ? aiEdit.aiFlavorSentences
        : aiFlavorSentences,
    diagnosis:
      aiEdit.diagnosis && aiEdit.diagnosis.length > 0
        ? aiEdit.diagnosis
        : diagnosis,
    revisedText: aiEdit.revisedText,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.editReports.push(report);
  project.updatedAt = timestamp;
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: true,
    usedFallback: false,
    editReportId: report.id,
    aiFlavorSentences: report.aiFlavorSentences.length
  }, getAiTokenUsage(aiEdit)));
  await writeStore(store);
  return report;
}

export async function prepareEditDraftTextStream(
  projectId: string,
  input: { mode: string; text: string; draftId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const originalText = input.text.trim();

  if (originalText.length < 10) {
    throw new Error("请先输入需要二稿编辑的文本");
  }

  const draft = input.draftId
    ? store.chapterDrafts.find((item) => item.id === input.draftId && item.projectId === projectId)
    : undefined;

  if (input.draftId && !draft) {
    throw new Error("二稿关联章节不存在");
  }

  const mode = input.mode || "网文作者版";
  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "edit_second_draft",
    payload: { mode, originalText, draftId: draft?.id, streamed: true },
    model: getActiveAiModel(store, "local-editing-helper", currentUser.id)
  });

  await writeStore(store);
  startAiJob(job);
  await writeStore(store);

  return {
    projectId,
    mode,
    originalText,
    draftId: draft?.id,
    jobId: job.id,
    useAi: hasConfiguredAiSettings(store, currentUser.id),
    fallbackText: buildFallbackEditedText(mode, originalText)
  };
}

export async function saveStreamedEditReport(input: {
  projectId: string;
  jobId: string;
  mode: string;
  originalText: string;
  draftId?: string;
  revisedText: string;
  usedAi: boolean;
  tokenUsage?: AiTokenUsage;
}) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(
    input.projectId,
    currentUser.id,
    "流式二稿保存失败：项目或任务不存在"
  );
  const job = createDomainWriteRepository(store).requireJobForUser(
    input.jobId,
    currentUser.id,
    "流式二稿保存失败：项目或任务不存在"
  );

  const timestamp = now();
  const { aiFlavorSentences, diagnosis } = diagnoseAiFlavor(input.originalText);
  const revisedText = input.revisedText.trim();

  if (revisedText.length < 10) {
    const message = "AI 没有返回有效二稿内容，未保存报告";
    failAiJob(job, message, withAiBillingOutput(store, job, {
      usedAi: input.usedAi,
      usedFallback: false,
      streamed: true,
      failed: true
    }, input.tokenUsage));
    await writeStore(store);
    throw new Error(message);
  }

  try {
    assertEditedTextComplete(input.originalText, revisedText, input.mode);
  } catch (error) {
    const message = error instanceof Error ? error.message : "二稿结果不完整，未保存报告";
    failAiJob(job, message, withAiBillingOutput(store, job, {
      usedAi: input.usedAi,
      usedFallback: false,
      streamed: true,
      failed: true
    }, input.tokenUsage));
    await writeStore(store);
    throw new Error(message);
  }

  const report: StoredEditReport = {
    id: randomUUID(),
    projectId: input.projectId,
    draftId: input.draftId,
    mode: input.mode || "网文作者版",
    originalText: input.originalText,
    aiFlavorSentences,
    diagnosis,
    revisedText,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.editReports.push(report);
  project.updatedAt = timestamp;
  finishAiJob(job, withAiBillingOutput(store, job, {
    usedAi: input.usedAi,
    usedFallback: false,
    streamed: true,
    editReportId: report.id,
    aiFlavorSentences: report.aiFlavorSentences.length
  }, input.tokenUsage));
  await writeStore(store);
  return report;
}

export async function applyEditedTextToDraft(input: {
  projectId: string;
  draftId: string;
  revisedText: string;
}) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(input.projectId, currentUser.id);
  const draft = store.chapterDrafts.find(
    (item) => item.id === input.draftId && item.projectId === input.projectId
  );
  const revisedText = input.revisedText.trim();

  if (!draft) {
    throw new Error("要替换的章节不存在");
  }

  if (revisedText.length < 10) {
    throw new Error("二稿内容太短，不能替换章节正文");
  }

  const deletedLedgerCount = store.chapterLedgers.filter(
    (item) => item.projectId === input.projectId && item.chapterNumber >= draft.chapterNumber
  ).length;
  const deletedReviewCount = store.reviewReports.filter(
    (item) => item.projectId === input.projectId && item.chapterNumber >= draft.chapterNumber
  ).length;
  const timestamp = now();
  const resetReviewedDraftCount = store.chapterDrafts.reduce((count, item) => {
    if (
      item.projectId === input.projectId &&
      item.chapterNumber >= draft.chapterNumber &&
      item.status === "reviewed"
    ) {
      item.status = "draft";
      item.updatedAt = timestamp;
      return count + 1;
    }

    return count;
  }, 0);

  store.chapterLedgers = store.chapterLedgers.filter(
    (item) => !(item.projectId === input.projectId && item.chapterNumber >= draft.chapterNumber)
  );
  store.reviewReports = store.reviewReports.filter(
    (item) => !(item.projectId === input.projectId && item.chapterNumber >= draft.chapterNumber)
  );

  draft.content = revisedText;
  draft.status = "draft";
  draft.updatedAt = timestamp;
  resetWritingMemoryAfterChapterDelete(store, project, draft.chapterNumber);
  project.updatedAt = timestamp;

  await writeStore(store);

  return {
    draftId: draft.id,
    chapterNumber: draft.chapterNumber,
    deletedLedgerCount,
    deletedReviewCount,
    resetReviewedDraftCount
  };
}

export async function importSourceText(input: {
  projectId: string;
  title: string;
  content: string;
  sourceType: "paste" | "txt";
}) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(input.projectId, currentUser.id);

  const content = input.content.trim();
  const currentUsage = getUserUsage(store, currentUser);
  const currentLimits = getPlanLimitsForUser(currentUser);

  if (content.length < 20) {
    throw new Error("文本太短，无法分章");
  }

  if (currentUsage.importedCharacters + content.length > currentLimits.importedCharacters) {
    throw new Error("当前套餐可导入字符额度不足，请减少单次导入量");
  }

  const timestamp = now();
  const sourceText: StoredSourceText = {
    id: randomUUID(),
    projectId: project.id,
    title: input.title.trim() || `${project.name} 原文`,
    content,
    sourceType: input.sourceType,
    charCount: content.length,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const splitChapters = splitNovelText(content);
  const existingChapterCount = store.chapters.filter(
    (chapter) => chapter.projectId === project.id
  ).length;

  const chapters: StoredChapter[] = splitChapters.map((chapter, index) => ({
    id: randomUUID(),
    projectId: project.id,
    sourceTextId: sourceText.id,
    chapterNumber: existingChapterCount + index + 1,
    title: chapter.title,
    content: chapter.content,
    charCount: chapter.charCount,
    orderIndex: existingChapterCount + index,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

  store.sourceTexts.push(sourceText);
  store.chapters.push(...chapters);
  project.status = "ready";
  project.updatedAt = timestamp;

  const savedByAppend = await appendImportedSourceText({
    sourceText,
    chapters,
    projectUpdatedAt: timestamp
  });

  if (!savedByAppend) {
    await writeStore(store);
  }

  return {
    sourceText,
    chapters
  };
}

export async function updateProjectChapter(
  projectId: string,
  chapterId: string,
  input: { title: string; content: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(
    projectId,
    currentUser.id,
    "章节不存在"
  );
  const chapter = store.chapters.find(
    (item) => item.id === chapterId && item.projectId === projectId
  );

  if (!chapter) {
    throw new Error("章节不存在");
  }

  const timestamp = now();
  chapter.title = input.title.trim() || chapter.title;
  chapter.content = input.content.trim() || chapter.content;
  chapter.charCount = chapter.content.length;
  chapter.updatedAt = timestamp;
  project.updatedAt = timestamp;

  const analyses = store.chapterAnalyses.filter((item) => item.chapterId === chapter.id);
  analyses.forEach((analysis) => {
    analysis.updatedAt = timestamp;
  });

  await writeStore(store);
  return chapter;
}

export async function createManualChapter(
  projectId: string,
  input: { title: string; content: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const title = input.title.trim();
  const content = input.content.trim();

  if (!content) {
    throw new Error("章节内容不能为空");
  }

  const sourceText =
    store.sourceTexts.find((item) => item.projectId === projectId) ??
    ({
      id: randomUUID(),
      projectId,
      title: "手动章节来源",
      content: "",
      sourceType: "paste" as const,
      charCount: 0,
      createdAt: now(),
      updatedAt: now()
    } satisfies StoredSourceText);

  if (!store.sourceTexts.some((item) => item.id === sourceText.id)) {
    store.sourceTexts.push(sourceText);
  }

  const timestamp = now();
  const chapter: StoredChapter = {
    id: randomUUID(),
    projectId,
    sourceTextId: sourceText.id,
    chapterNumber: store.chapters.filter((item) => item.projectId === projectId).length + 1,
    title: title || `第 ${store.chapters.filter((item) => item.projectId === projectId).length + 1} 章`,
    content,
    charCount: content.length,
    orderIndex: store.chapters.filter((item) => item.projectId === projectId).length,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.chapters.push(chapter);
  project.updatedAt = timestamp;
  await writeStore(store);
  return chapter;
}

export async function deleteProjectChapter(projectId: string, chapterId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const chapter = store.chapters.find(
    (item) => item.id === chapterId && item.projectId === projectId
  );

  if (!chapter) {
    throw new Error("章节不存在");
  }

  store.chapters = store.chapters.filter((item) => item.id !== chapterId);
  store.chapterAnalyses = store.chapterAnalyses.filter((item) => item.chapterId !== chapterId);
  normalizeProjectChapterOrder(store, projectId);
  project.updatedAt = now();

  await writeStore(store);
}

export async function deleteProject(projectId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const storyAnalysisIds = new Set(
    store.storyAnalyses.filter((item) => item.projectId === projectId).map((item) => item.id)
  );

  store.sourceTexts = store.sourceTexts.filter((item) => item.projectId !== projectId);
  store.chapters = store.chapters.filter((item) => item.projectId !== projectId);
  store.chapterAnalyses = store.chapterAnalyses.filter((item) => item.projectId !== projectId);
  store.storyAnalyses = store.storyAnalyses.filter((item) => item.projectId !== projectId);
  store.writingBibles = store.writingBibles.filter((item) => item.projectId !== projectId);
  store.characterProfiles = store.characterProfiles.filter((item) => item.projectId !== projectId);
  store.foreshadowings = store.foreshadowings.filter((item) => item.projectId !== projectId);
  store.plotStates = store.plotStates.filter((item) => item.projectId !== projectId);
  store.longFormPlans = (store.longFormPlans ?? []).filter((item) => item.projectId !== projectId);
  store.customRelationGraphs = (store.customRelationGraphs ?? []).filter((item) => item.projectId !== projectId);
  store.writingTaskCards = store.writingTaskCards.filter((item) => item.projectId !== projectId);
  store.chapterDrafts = store.chapterDrafts.filter((item) => item.projectId !== projectId);
  store.chapterLedgers = store.chapterLedgers.filter((item) => item.projectId !== projectId);
  store.reviewReports = store.reviewReports.filter((item) => item.projectId !== projectId);
  store.editReports = store.editReports.filter((item) => item.projectId !== projectId);
  store.inspirations = (store.inspirations ?? []).map((item) => {
    const linkedToDeletedProject = item.linkedEntityType === "project" && item.linkedEntityId === projectId;

    if (item.projectId !== projectId && !linkedToDeletedProject) {
      return item;
    }

    return {
      ...item,
      projectId: item.projectId === projectId ? undefined : item.projectId,
      linkedEntityType: linkedToDeletedProject ? undefined : item.linkedEntityType,
      linkedEntityId: linkedToDeletedProject ? undefined : item.linkedEntityId,
      updatedAt: now()
    };
  });
  const removedAssistantThreadIds = new Set(
    (store.assistantThreads ?? []).filter((item) => item.projectId === projectId).map((item) => item.id)
  );
  store.assistantThreads = (store.assistantThreads ?? []).filter((item) => item.projectId !== projectId);
  store.assistantMessages = (store.assistantMessages ?? []).filter((item) => !removedAssistantThreadIds.has(item.threadId));
  store.aiJobs = store.aiJobs.filter((item) => item.projectId !== projectId);
  store.templates.forEach((template) => {
    if (template.sourceProjectId === projectId) {
      template.sourceProjectId = undefined;
      template.updatedAt = now();
    }
    if (template.sourceStoryAnalysisId && storyAnalysisIds.has(template.sourceStoryAnalysisId)) {
      template.sourceStoryAnalysisId = undefined;
      template.updatedAt = now();
    }
  });
  store.projects = store.projects.filter((item) => item.id !== projectId);

  await writeStore(store);
  return { projectId, name: project.name, deletedAt: now() };
}

export async function moveProjectChapter(
  projectId: string,
  chapterId: string,
  direction: "up" | "down"
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const chapters = store.chapters
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const index = chapters.findIndex((item) => item.id === chapterId);

  if (index < 0) {
    throw new Error("章节不存在");
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= chapters.length) {
    return chapters[index];
  }

  const [current] = chapters.splice(index, 1);
  chapters.splice(targetIndex, 0, current);
  chapters.forEach((chapter, idx) => {
    chapter.orderIndex = idx;
    chapter.chapterNumber = idx + 1;
    chapter.updatedAt = now();
  });
  project.updatedAt = now();
  await writeStore(store);
  return current;
}

export async function analyzeProject(
  projectId: string,
  options?: { retryOfJobId?: string; scope?: ChapterAnalysisScope }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const allChapters = store.chapters
    .filter((chapter) => chapter.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const { selectedChapters: chapters, scope, selectedCount, fromChapter, toChapter } =
    describeChapterAnalysisScope(allChapters, options?.scope);

  if (allChapters.length === 0) {
    throw new Error("请先导入文本并完成分章");
  }

  if (chapters.length === 0) {
    throw new Error("当前分析范围内没有章节，请重新选择章节区间");
  }

  const useAi = hasConfiguredAiSettings(store, currentUser.id);
  const hasActiveAnalysisJob = store.aiJobs.some(
    (item) =>
      item.projectId === projectId &&
      item.type === "analyze_chapters" &&
      isRunnableAiJob(item) &&
      item.id !== options?.retryOfJobId
  );

  if (project.status === "processing" && hasActiveAnalysisJob) {
    throw new Error("当前项目已有分析任务在执行，请等待完成后再重新分析");
  }

  const timestamp = now();
  const previousStatus = project.status;
  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "analyze_chapters",
    payload: { chapterCount: selectedCount, fromChapter, toChapter, scope },
    model: useAi ? getUserAiSettings(store, currentUser.id).model || "local-rule-analyzer" : "local-rule-analyzer",
    retryOfJobId: options?.retryOfJobId
  });

  project.status = "processing";
  project.updatedAt = timestamp;

  await writeStore(store);
  startAiJob(job);
  await writeStore(store);

  try {
    const result = await executeAnalyzeProjectJob(store, project, job, chapters, useAi, timestamp);
    await writeStore(store);
    return result;
  } catch (error) {
    failAiJob(job, error instanceof Error ? error.message : "整书分析失败");
    refundAiJobCredits(store, job, "整书分析失败返还");
    project.status = previousStatus;
    project.updatedAt = now();
    await writeStore(store);
    throw error;
  }
}

export async function generateOutline(
  templateId: string,
  variables: OutlineVariables,
  options?: { retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const template = createDomainWriteRepository(store).requireTemplateForUser(templateId, currentUser.id);

  const useAi = hasConfiguredAiSettings(store, currentUser.id);
  const timestamp = now();
  const job = createAiJob(store, {
    userId: currentUser.id,
    type: "generate_outline",
    payload: { templateId, variables },
    model: useAi ? getUserAiSettings(store, currentUser.id).model || "local-outline-generator" : "local-outline-generator",
    retryOfJobId: options?.retryOfJobId
  });

  await writeStore(store);
  startAiJob(job);
  await writeStore(store);

  try {
    const outline = await executeGenerateOutlineJob(
      store,
      template,
      job,
      variables,
      useAi,
      timestamp
    );
    await writeStore(store);
    return outline;
  } catch (error) {
    failAiJob(job, error instanceof Error ? error.message : "大纲生成失败");
    refundAiJobCredits(store, job, "大纲生成失败返还");
    await writeStore(store);
    throw error;
  }
}

export async function enqueueAnalyzeProjectJob(
  projectId: string,
  options?: { retryOfJobId?: string; scope?: ChapterAnalysisScope }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const allChapters = store.chapters.filter((chapter) => chapter.projectId === projectId);
  const { selectedChapters: chapters, scope, selectedCount, fromChapter, toChapter } =
    describeChapterAnalysisScope(allChapters, options?.scope);

  if (allChapters.length === 0) {
    throw new Error("请先导入文本并完成分章");
  }

  if (chapters.length === 0) {
    throw new Error("当前分析范围内没有章节，请重新选择章节区间");
  }

  const hasActiveAnalysisJob = store.aiJobs.some(
    (item) =>
      item.projectId === projectId &&
      item.type === "analyze_chapters" &&
      isRunnableAiJob(item) &&
      item.id !== options?.retryOfJobId
  );

  if (project.status === "processing" && hasActiveAnalysisJob) {
    throw new Error("当前项目已有分析任务在执行，请等待完成后再重新分析");
  }

  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "analyze_chapters",
    payload: { chapterCount: selectedCount, fromChapter, toChapter, scope },
    model: getActiveAiModel(store, "local-rule-analyzer", currentUser.id),
    retryOfJobId: options?.retryOfJobId
  });

  project.status = "processing";
  project.updatedAt = now();
  await writeStore(store);
  return job;
}

export async function enqueueGenerateOutlineJob(
  templateId: string,
  variables: OutlineVariables,
  options?: { retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  createDomainWriteRepository(store).requireTemplateForUser(templateId, currentUser.id);

  const job = createAiJob(store, {
    userId: currentUser.id,
    type: "generate_outline",
    payload: { templateId, variables },
    model: getActiveAiModel(store, "local-outline-generator", currentUser.id),
    retryOfJobId: options?.retryOfJobId
  });

  await writeStore(store);
  return job;
}

export async function enqueueWritingTaskCardJob(
  projectId: string,
  input?: Parameters<typeof generateWritingTaskCard>[1],
  options?: { retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  ensureDefaultWritingState(store, project);
  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "generate_task_card",
    payload: { input: input ?? {}, chapterNumber: input?.chapterNumber },
    model: getActiveAiModel(store, "local-writing-task-card", currentUser.id),
    retryOfJobId: options?.retryOfJobId
  });

  project.status = "writing";
  project.updatedAt = now();
  await writeStore(store);
  return job;
}

export async function enqueueLongFormPlanJob(
  projectId: string,
  input?: Parameters<typeof generateLongFormPlan>[1],
  options?: { retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  ensureDefaultWritingState(store, project);
  const bible = store.writingBibles.find((item) => item.projectId === projectId)!;
  const targetTotalWords = inferTargetTotalWordsFromState(project, bible, input?.targetTotalWords);
  const estimatedChapters = estimateChapterCount(targetTotalWords);
  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "generate_long_form_plan",
    payload: { targetTotalWords, estimatedChapters },
    model: getActiveAiModel(store, "local-long-form-plan", currentUser.id),
    retryOfJobId: options?.retryOfJobId
  });

  project.updatedAt = now();
  await writeStore(store);
  return job;
}

export async function enqueueChapterDraftJob(
  projectId: string,
  taskCardId?: string,
  options?: { targetWordCount?: number; retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const taskCard =
    (taskCardId
      ? store.writingTaskCards.find((item) => item.id === taskCardId && item.projectId === projectId)
      : getLatestWritingTaskCard(store, projectId)) ?? null;

  if (!taskCard) {
    throw new Error("请先生成章节任务卡");
  }
  const targetWordCount = normalizeDraftTargetWordCount(options?.targetWordCount);

  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "generate_chapter",
    payload: { taskCardId: taskCard.id, chapterNumber: taskCard.chapterNumber, targetWordCount },
    model: getActiveAiModel(store, "local-writing-chapter-generator", currentUser.id),
    retryOfJobId: options?.retryOfJobId
  });

  project.status = "writing";
  project.updatedAt = now();
  await writeStore(store);
  return job;
}

export async function enqueueRegenerateChapterDraftContentJob(
  projectId: string,
  draftId: string,
  options?: { targetWordCount?: number; retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);
  const draft = store.chapterDrafts.find((item) => item.id === draftId && item.projectId === projectId);

  if (!draft) {
    throw new Error("要重写的章节正文不存在");
  }

  const taskCard = store.writingTaskCards.find(
    (item) => item.id === draft.taskCardId && item.projectId === projectId
  );

  if (!taskCard) {
    throw new Error("章节任务卡不存在，无法只重写正文");
  }

  const targetWordCount = normalizeDraftTargetWordCount(
    options?.targetWordCount ?? countDraftCharacters(draft.content)
  );
  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "generate_chapter",
    payload: {
      draftId: draft.id,
      taskCardId: taskCard.id,
      chapterNumber: taskCard.chapterNumber,
      targetWordCount,
      regenerateOnlyContent: true
    },
    model: getActiveAiModel(store, "local-writing-chapter-generator", currentUser.id),
    retryOfJobId: options?.retryOfJobId
  });

  project.status = "writing";
  project.updatedAt = now();
  await writeStore(store);
  return job;
}

export async function enqueueReviewChapterJob(
  projectId: string,
  draftId?: string,
  options?: { retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const draft =
    (draftId
      ? store.chapterDrafts.find((item) => item.id === draftId && item.projectId === projectId)
      : getLatestChapterDraft(store, projectId)) ?? null;

  if (!draft) {
    throw new Error("请先生成正文草稿");
  }

  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "review_chapter",
    payload: { draftId: draft.id, chapterNumber: draft.chapterNumber },
    model: getActiveAiModel(store, "local-writing-reviewer", currentUser.id),
    retryOfJobId: options?.retryOfJobId
  });

  await writeStore(store);
  return job;
}

export async function enqueueEditSecondDraftJob(
  projectId: string,
  input: { mode: string; text: string; draftId?: string },
  options?: { retryOfJobId?: string }
) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const project = createDomainWriteRepository(store).requireProjectForUser(projectId, currentUser.id);

  const originalText = input.text.trim();

  if (originalText.length < 10) {
    throw new Error("请先输入需要二稿编辑的文本");
  }

  const draft = input.draftId
    ? store.chapterDrafts.find((item) => item.id === input.draftId && item.projectId === projectId)
    : undefined;

  if (input.draftId && !draft) {
    throw new Error("二稿关联章节不存在");
  }

  const job = createAiJob(store, {
    userId: currentUser.id,
    projectId,
    type: "edit_second_draft",
    payload: { mode: input.mode || "网文作者版", originalText, draftId: draft?.id },
    model: getActiveAiModel(store, "local-editing-helper", currentUser.id),
    retryOfJobId: options?.retryOfJobId
  });

  await writeStore(store);
  return job;
}

export async function processAiJob(jobId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const repo = createDomainWriteRepository(store);
  const job = repo.requireJobForUser(jobId, currentUser.id);

  if (job.status === "succeeded") {
    return { job, skipped: true, reason: "任务已完成" };
  }

  const canContinueRunningAnalysis = job.type === "analyze_chapters" && job.status === "running";

  if (job.status !== "pending" && !canContinueRunningAnalysis) {
    throw new Error(`只有待处理任务可以执行，当前状态：${job.status}`);
  }

  if (job.userId && job.userId !== currentUser.id) {
    throw new Error("无权执行该任务");
  }
  if (job.projectId) {
    repo.requireProjectForUser(job.projectId, currentUser.id, "无权执行该任务");
  }

  const input = getJobInputRecord(job);
  const timestamp = now();
  if (job.status === "pending") {
    startAiJob(job);
  } else {
    job.updatedAt = timestamp;
  }
  await writeStore(store);

  try {
    return await runWithAiModelOverride(job.model, async () => {
    if (job.type === "analyze_chapters") {
      if (!job.projectId) {
        throw new Error("分析任务缺少项目归属");
      }

      const project = repo.requireProjectForUser(job.projectId, currentUser.id);

      const chapters = store.chapters
        .filter((chapter) => chapter.projectId === project.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const selectedChapters = selectChaptersForAnalysis(
        chapters,
        input?.scope && typeof input.scope === "object"
          ? (input.scope as ChapterAnalysisScope)
          : undefined
      );

      if (chapters.length === 0) {
        throw new Error("请先导入文本并完成分章");
      }

      if (selectedChapters.length === 0) {
        throw new Error("当前分析范围内没有章节，请重新选择章节区间");
      }

      const useAi = hasConfiguredAiSettings(store, currentUser.id);
      const result = await executeAnalyzeProjectJobStep(store, project, job, selectedChapters, useAi, timestamp);
      await writeStore(store);
      return { job, projectId: project.id, result };
    }

    if (job.type === "generate_outline") {
      const templateId = String(input?.templateId ?? "");
      const template = createDomainWriteRepository(store).requireTemplateForUser(
        templateId,
        currentUser.id
      );

      const variables = (input?.variables ?? {}) as OutlineVariables;
      const outline = await executeGenerateOutlineJob(
        store,
        template,
        job,
        variables,
        hasConfiguredAiSettings(store, currentUser.id),
        timestamp
      );
      await writeStore(store);
      return { job, templateId: template.id, result: outline };
    }

    if (job.type === "generate_task_card") {
      if (!job.projectId) {
        throw new Error("任务缺少项目归属");
      }

      const payload = getJobInputRecord(job);
      const input = (payload?.input ?? {}) as Parameters<typeof generateWritingTaskCard>[1];
      const card = await generateWritingTaskCard(job.projectId, {
        ...input,
        chapterNumber: Number(payload?.chapterNumber ?? input?.chapterNumber ?? 0) || undefined
      }, {
        existingJobId: job.id
      });
      const latestStore = await readStore();
      const updatedJob = latestStore.aiJobs.find((item) => item.id === job.id) ?? job;
      return { job: updatedJob, projectId: job.projectId, result: card };
    }

    if (job.type === "generate_long_form_plan") {
      if (!job.projectId) {
        throw new Error("任务缺少项目归属");
      }

      const payload = getJobInputRecord(job);
      const plan = await generateLongFormPlan(job.projectId, {
        targetTotalWords: Number(payload?.targetTotalWords ?? 0) || undefined
      }, {
        existingJobId: job.id
      });
      const latestStore = await readStore();
      const updatedJob = latestStore.aiJobs.find((item) => item.id === job.id) ?? job;
      return { job: updatedJob, projectId: job.projectId, result: plan };
    }

    if (job.type === "generate_chapter") {
      if (!job.projectId) {
        throw new Error("任务缺少项目归属");
      }

      const payload = getJobInputRecord(job);
      const draft = payload?.regenerateOnlyContent
        ? await regenerateChapterDraftContent(job.projectId, String(payload?.draftId ?? ""), {
            existingJobId: job.id,
            targetWordCount: Number(payload?.targetWordCount ?? 0) || undefined
          })
        : await generateChapterDraft(job.projectId, String(payload?.taskCardId ?? ""), {
            existingJobId: job.id,
            targetWordCount: Number(payload?.targetWordCount ?? 0) || undefined
          });
      const latestStore = await readStore();
      const updatedJob = latestStore.aiJobs.find((item) => item.id === job.id) ?? job;
      return { job: updatedJob, projectId: job.projectId, result: draft };
    }

    if (job.type === "review_chapter") {
      if (!job.projectId) {
        throw new Error("任务缺少项目归属");
      }

      const payload = getJobInputRecord(job);
      const review = await reviewChapterDraft(job.projectId, String(payload?.draftId ?? ""), {
        existingJobId: job.id
      });
      const latestStore = await readStore();
      const updatedJob = latestStore.aiJobs.find((item) => item.id === job.id) ?? job;
      return { job: updatedJob, projectId: job.projectId, result: review };
    }

    if (job.type === "edit_second_draft") {
      if (!job.projectId) {
        throw new Error("任务缺少项目归属");
      }

      const payload = getJobInputRecord(job);
      const report = await editDraftText(
        job.projectId,
        {
          mode: String(payload?.mode ?? "网文作者版"),
          text: String(payload?.originalText ?? ""),
          draftId: payload?.draftId ? String(payload.draftId) : undefined
        },
        {
          existingJobId: job.id
        }
      );
      const latestStore = await readStore();
      const updatedJob = latestStore.aiJobs.find((item) => item.id === job.id) ?? job;
      return { job: updatedJob, projectId: job.projectId, result: report };
    }

    throw new Error("当前任务类型暂不支持后台执行");
    });
  } catch (error) {
    const output = getJobObject(job.output);
    const tokenUsage = output.tokenUsage as AiTokenUsage | undefined;

    if (tokenUsage) {
      failAiJob(job, error instanceof Error ? error.message : "任务执行失败", withAiBillingOutput(store, job, {
        ...output,
        usedAi: output.usedAi === true,
        usedFallback: output.usedFallback === true,
        failed: true
      }, tokenUsage));
    } else {
      failAiJob(job, error instanceof Error ? error.message : "任务执行失败");
      refundAiJobCredits(store, job, "AI 任务执行失败返还");
    }
    await writeStore(store);
    throw error;
  }
}

async function resolveAiJobOwnerUserId(jobId: string) {
  const store = await readStore();
  const repo = createDomainReadRepository(store);
  const job = repo.getJobRecord(jobId);

  if (!job) {
    throw new Error("任务不存在");
  }

  if (job.userId) {
    return job.userId;
  }

  if (job.projectId) {
    const project = repo.getProjectRecord(job.projectId);

    if (project?.ownerUserId) {
      return project.ownerUserId;
    }
  }

  throw new Error("任务缺少用户归属，无法由后台 Worker 执行");
}

export async function processAiJobAsOwner(jobId: string) {
  const ownerUserId = await resolveAiJobOwnerUserId(jobId);

  return runAsUser(ownerUserId, () => processAiJob(jobId));
}

export async function processPendingAiJobs(limit = 5) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const jobIds = createDomainReadRepository(store).listPendingJobIdsForUser(currentUser.id, limit);
  const results = [];

  for (const jobId of jobIds) {
    try {
      results.push({ ok: true, ...(await processAiJob(jobId)) });
    } catch (error) {
      results.push({
        ok: false,
        jobId,
        error: error instanceof Error ? error.message : "任务执行失败"
      });
    }
  }

  return {
    processed: results.length,
    results
  };
}

export async function processPendingAiJobsAsWorker(limit = 10) {
  const store = await readStore();
  const jobIds = createDomainReadRepository(store).listPendingJobIds(limit);
  const results = [];

  for (const jobId of jobIds) {
    try {
      results.push({ ok: true, ...(await processAiJobAsOwner(jobId)) });
    } catch (error) {
      results.push({
        ok: false,
        jobId,
        error: error instanceof Error ? error.message : "后台任务执行失败"
      });
    }
  }

  return {
    processed: results.length,
    results
  };
}

export async function retryAiJob(jobId: string) {
  const store = await readStore();
  const currentUser = await requireCurrentUser(store);
  const repo = createDomainWriteRepository(store);
  const job = repo.requireJobForUser(jobId, currentUser.id);

  if (job.userId && job.userId !== currentUser.id) {
    throw new Error("无权重试该任务");
  }
  if (job.projectId) {
    repo.requireProjectForUser(job.projectId, currentUser.id, "无权重试该任务");
  }

  const input = getJobInputRecord(job);

  switch (job.type) {
    case "analyze_chapters":
      if (!job.projectId) {
        throw new Error("该分析任务缺少项目归属，无法重试");
      }
      return {
        projectId: job.projectId,
        jobType: job.type,
        job: await enqueueAnalyzeProjectJob(job.projectId, {
          retryOfJobId: job.id,
          scope:
            input?.scope && typeof input.scope === "object"
              ? (input.scope as ChapterAnalysisScope)
              : undefined
        })
      };

    case "generate_task_card":
      if (!job.projectId) {
        throw new Error("该任务缺少项目归属，无法重试");
      }
      return {
        projectId: job.projectId,
        jobType: job.type,
        job: await enqueueWritingTaskCardJob(job.projectId, {
          ...(input?.input && typeof input.input === "object" ? (input.input as object) : {}),
          chapterNumber: Number(input?.chapterNumber ?? 0) || undefined
        } as Parameters<typeof generateWritingTaskCard>[1], { retryOfJobId: job.id })
      };

    case "generate_long_form_plan":
      if (!job.projectId) {
        throw new Error("该任务缺少项目归属，无法重试");
      }
      return {
        projectId: job.projectId,
        jobType: job.type,
        job: await enqueueLongFormPlanJob(job.projectId, {
          targetTotalWords: Number(input?.targetTotalWords ?? 0) || undefined
        }, { retryOfJobId: job.id })
      };

    case "generate_chapter":
      if (!job.projectId) {
        throw new Error("该任务缺少项目归属，无法重试");
      }
      if (input?.regenerateOnlyContent) {
        return {
          projectId: job.projectId,
          jobType: job.type,
          job: await enqueueRegenerateChapterDraftContentJob(job.projectId, String(input?.draftId ?? ""), {
            targetWordCount: Number(input?.targetWordCount ?? 0) || undefined,
            retryOfJobId: job.id
          })
        };
      }
      return {
        projectId: job.projectId,
        jobType: job.type,
        job: await enqueueChapterDraftJob(job.projectId, String(input?.taskCardId ?? ""), {
          targetWordCount: Number(input?.targetWordCount ?? 0) || undefined,
          retryOfJobId: job.id
        })
      };

    case "review_chapter":
      if (!job.projectId) {
        throw new Error("该任务缺少项目归属，无法重试");
      }
      return {
        projectId: job.projectId,
        jobType: job.type,
        job: await enqueueReviewChapterJob(job.projectId, String(input?.draftId ?? ""), {
          retryOfJobId: job.id
        })
      };

    case "edit_second_draft":
      if (!job.projectId) {
        throw new Error("该任务缺少项目归属，无法重试");
      }
      return {
        projectId: job.projectId,
        jobType: job.type,
        job: await enqueueEditSecondDraftJob(
          job.projectId,
          {
            mode: String(input?.mode ?? "网文作者版"),
            text: String(input?.originalText ?? ""),
            draftId: input?.draftId ? String(input.draftId) : undefined
          },
          { retryOfJobId: job.id }
        )
      };

    case "generate_outline":
      if (typeof input?.templateId !== "string" || !input.templateId) {
        throw new Error("该大纲任务缺少模板信息，无法重试");
      }
      return {
        templateId: input.templateId,
        jobType: job.type,
        job: await enqueueGenerateOutlineJob(input.templateId, (input?.variables ?? {}) as OutlineVariables, {
          retryOfJobId: job.id
        })
      };

    default:
      throw new Error("当前任务类型暂不支持重试");
  }
}
