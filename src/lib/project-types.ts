import type { OutlineVariables } from "@/lib/ai/outline";
import type { AiTaskPricingOverrides } from "@/lib/ai-task-pricing";

export type PleasurePoint = {
  type: string;
  setup: string;
  release: string;
  whyItWorks: string;
  drivesMainPlot: boolean;
};

export type EntityRelation = {
  source: string;
  target: string;
  type: string;
  evidence: string;
  chapterNumber?: number;
};

export type PlanKey = "trial" | "creator" | "studio";

export type StoredProject = {
  id: string;
  ownerUserId?: string;
  name: string;
  authorName?: string;
  type: "analysis" | "writing";
  description: string;
  genre: string;
  coverImageUrl?: string;
  status: "draft" | "processing" | "ready" | "writing";
  createdAt: string;
  updatedAt: string;
};

export type InitialProjectStateInput = {
  targetReader?: string;
  tagTaxonomyStyle?: "fanqie" | "qidian";
  tags?: string[];
  protagonistNames?: string[];
  protagonistCharacters?: Array<{ name: string; role?: string }>;
  workLengthType?: "short" | "medium" | "long" | "epic";
  targetTotalWords?: number;
  coreSellingPoint?: string;
  openingHook?: string;
  goldenFinger?: string;
  writingGoal?: string;
  outlineId?: string;
  outlineLogline?: string;
  worldSetting?: string;
  outlineChapters?: string[];
  first100Pacing?: string;
  foreshadowingPlan?: string[];
  pleasureDistribution?: string;
};

export type StoredSourceText = {
  id: string;
  projectId: string;
  title: string;
  content: string;
  sourceType: "paste" | "txt";
  charCount: number;
  createdAt: string;
  updatedAt: string;
};

export type StoredChapter = {
  id: string;
  projectId: string;
  sourceTextId: string;
  chapterNumber: number;
  title: string;
  content: string;
  charCount: number;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type StoredAiJob = {
  id: string;
  userId?: string;
  projectId?: string;
  type: string;
  status: "pending" | "running" | "succeeded" | "failed" | "canceled";
  input?: unknown;
  output?: unknown;
  error?: string;
  attempts: number;
  model?: string;
  retryOfJobId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export type ChapterAnalysisScope = {
  mode?: "all" | "first" | "range" | "single";
  startChapter?: number;
  endChapter?: number;
  limit?: number;
};

export type StoredChapterAnalysis = {
  id: string;
  projectId: string;
  chapterId: string;
  summary: string;
  mainEvent: string;
  conflict: string;
  pressurePoint: string;
  payoff: string;
  cliffhanger: string;
  readerHook: string;
  newInformation: string[];
  newCharacters: string[];
  stateChanges: string[];
  entityRelations: EntityRelation[];
  pleasurePoints: PleasurePoint[];
  createdAt: string;
  updatedAt: string;
};

export type StoredStoryAnalysis = {
  id: string;
  projectId: string;
  genre: string;
  protagonistModel: string;
  openingModel: string;
  goldenFingerMechanism: string;
  villainFunction: string;
  supportingRoles: string;
  mapProgression: string;
  usablePatterns: string[];
  avoidCopying: string[];
  openingHook: string;
  mainLoop: string;
  pacing: string;
  topPleasureTypes: string[];
  formula: string;
  migrationAdvice: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredAiSettings = {
  id?: string;
  userId?: string;
  profileName?: string;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  models?: string[];
  active?: boolean;
  timeoutMs: number;
  updatedAt?: string;
};

export type StoredCoverImageSettings = {
  id?: string;
  userId?: string;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  dailyLimit?: number;
  updatedAt?: string;
};

export type StoredCoverImageUsage = {
  id: string;
  userId: string;
  dateKey: string;
  keyHash?: string;
  count: number;
  createdAt: string;
  updatedAt: string;
};

export type StoredTemplate = {
  id: string;
  ownerUserId?: string;
  sourceProjectId?: string;
  sourceStoryAnalysisId?: string;
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
  createdAt: string;
  updatedAt: string;
};

export type InspirationType =
  | "plot"
  | "character"
  | "worldbuilding"
  | "pleasure_point"
  | "foreshadowing"
  | "setting"
  | "line"
  | "topic"
  | "title"
  | "other";

export type InspirationStatus = "raw" | "polished" | "used" | "archived";

export type InspirationPolishMode =
  | "polish"
  | "expand_setting"
  | "web_novelize"
  | "selling_point"
  | "pleasure_analysis"
  | "variants"
  | "task_card"
  | "character_draft"
  | "foreshadowing_draft";

export type InspirationTransformTarget =
  | "character"
  | "foreshadowing"
  | "task_card"
  | "bible"
  | "worldbuilding"
  | "short_outline"
  | "variants";

export type InspirationTransformDraft = {
  target: InspirationTransformTarget;
  title: string;
  summary: string;
  character?: {
    name: string;
    identity: string;
    currentGoal: string;
    longTermGoal: string;
    secret: string;
    relationshipToProtagonist: string;
    attitude: string;
    abilityBoundary: string;
    voice: string;
    knownInformation: string;
    unknownInformation: string;
    lastAppearance: string;
    currentState: string;
  };
  foreshadowing?: {
    name: string;
    plantedChapter: string;
    relatedCharacters: string[];
    relatedLocation: string;
    status: "open" | "partial" | "closed";
    expectedRevealChapter: string;
    revealMethod: string;
    hiddenInformation: string;
  };
  taskCard?: {
    chapterNumber?: number;
    title: string;
    chapterGoal: string;
    continuity: string;
    mainPlotProgress: string;
    requiredCharacters: string[];
    pleasurePoint: string;
    foreshadowingTasks: string[];
    rulesNotToBreak: string[];
    endingHook: string;
  };
  biblePatch?: {
    corePleasure?: string;
    worldRules?: string;
    goldenFingerRules?: string;
    narrativeTaboos?: string;
    immutableSettings?: string;
    styleGuide?: string;
  };
  shortOutline?: {
    logline: string;
    coreConflict: string;
    firstChapters: string[];
    pacing: string;
    foreshadowingPlan: string[];
  };
  variants?: Array<{
    title: string;
    direction: string;
    conflict: string;
    payoff: string;
    nextHook: string;
  }>;
  notes: string[];
  warnings: string[];
  usedAi: boolean;
  usedFallback: boolean;
};

export type InspirationAiOutput = {
  id: string;
  mode: InspirationPolishMode;
  title: string;
  content: string;
  changes: string[];
  suggestions: string[];
  tags: string[];
  usedAi: boolean;
  usedFallback: boolean;
  createdAt: string;
};

export type StoredInspiration = {
  id: string;
  ownerUserId: string;
  projectId?: string;
  title: string;
  content: string;
  type: InspirationType;
  tags: string[];
  status: InspirationStatus;
  aiOutputs: InspirationAiOutput[];
  linkedEntityType?: "project" | "character" | "foreshadowing" | "chapter" | "task_card" | "outline" | "bible";
  linkedEntityId?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredOutline = {
  id: string;
  templateId: string;
  variables: OutlineVariables;
  titleOptions: string[];
  logline: string;
  intro: string;
  templateInheritance: string[];
  variableMapping: string[];
  coreSellingPoints: string[];
  worldSetting: string;
  protagonist: string;
  characters: string[];
  first10Chapters: string[];
  first100Pacing: string;
  foreshadowingPlan: string[];
  pleasureDistribution: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredWritingBible = {
  id: string;
  projectId: string;
  workType: string;
  targetReader: string;
  corePleasure: string;
  protagonistDesire: string;
  worldRules: string;
  goldenFingerRules: string;
  powerSystem: string;
  narrativeTaboos: string;
  immutableSettings: string;
  styleGuide: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredCharacterProfile = {
  id: string;
  projectId: string;
  name: string;
  identity: string;
  currentGoal: string;
  longTermGoal: string;
  secret: string;
  relationshipToProtagonist: string;
  attitude: string;
  abilityBoundary: string;
  voice: string;
  knownInformation: string;
  unknownInformation: string;
  lastAppearance: string;
  currentState: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredForeshadowing = {
  id: string;
  projectId: string;
  name: string;
  plantedChapter: string;
  relatedCharacters: string[];
  relatedLocation: string;
  status: "open" | "partial" | "closed";
  expectedRevealChapter: string;
  revealMethod: string;
  hiddenInformation: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPlotState = {
  id: string;
  projectId: string;
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
  createdAt: string;
  updatedAt: string;
};

export type StoredLongFormPlan = {
  id: string;
  projectId: string;
  targetTotalWords: number;
  estimatedChapters: number;
  planningBasis: string;
  corePromise: string;
  volumePlan: string[];
  progressionPacing: string[];
  rewardPacing: string[];
  confirmedFacts: string[];
  openQuestions: string[];
  doNotChange: string[];
  doNotRevealEarly: string[];
  tagPromises: string[];
  first10Chapters: string[];
  first100Pacing: string;
  post100Pacing: string;
  progressionRules: string[];
  createdAt: string;
  updatedAt: string;
};

export type CustomRelationGraphNodeType =
  | "person"
  | "place"
  | "force"
  | "thread"
  | "core"
  | "power"
  | "resource"
  | "knowledge"
  | "event";

export type CustomRelationGraphTone = "neutral" | "success" | "danger" | "warning" | "core";

export type StoredCustomRelationGraphNode = {
  id: string;
  label: string;
  meta: string;
  sub: string;
  type: CustomRelationGraphNodeType;
  tone: CustomRelationGraphTone;
  x?: number;
  y?: number;
};

export type StoredCustomRelationGraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  tone: Exclude<CustomRelationGraphTone, "core">;
};

export type StoredCustomRelationGraph = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  nodes: StoredCustomRelationGraphNode[];
  edges: StoredCustomRelationGraphEdge[];
  createdAt: string;
  updatedAt: string;
};

export type StoredWritingTaskCard = {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string;
  chapterGoal: string;
  continuity: string;
  mainPlotProgress: string;
  requiredCharacters: string[];
  pleasurePoint: string;
  foreshadowingTasks: string[];
  rulesNotToBreak: string[];
  endingHook: string;
  status: "draft" | "approved";
  createdAt: string;
  updatedAt: string;
};

export type StoredChapterDraft = {
  id: string;
  projectId: string;
  taskCardId: string;
  chapterNumber: number;
  title: string;
  content: string;
  status: "draft" | "reviewed";
  createdAt: string;
  updatedAt: string;
};

export type StoredChapterLedger = {
  id: string;
  projectId: string;
  draftId: string;
  chapterNumber: number;
  title: string;
  events: string[];
  newCharacters: string[];
  newClues: string[];
  payoff: string;
  cliffhanger: string;
  stateChanges: string[];
  carryOverTasks?: string[];
  closureStatus?: "pending" | "confirmed";
  closureConfirmedAt?: string;
  closureDecisions?: Array<{
    targetType: "character" | "foreshadowing";
    targetId: string;
    decision: "accepted" | "ignored";
    decidedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type ReviewIssue = {
  type: string;
  location: string;
  severity: "low" | "medium" | "high";
  problem?: string;
  suggestion: string;
};

export type StoredReviewReport = {
  id: string;
  projectId: string;
  draftId: string;
  chapterNumber: number;
  overall: string;
  issues: ReviewIssue[];
  shouldUpdateState: boolean;
  stateUpdateSuggestions: string[];
  createdAt: string;
  updatedAt: string;
};

export type StoredEditReport = {
  id: string;
  projectId: string;
  draftId?: string;
  mode: string;
  originalText: string;
  aiFlavorSentences: string[];
  diagnosis: string[];
  revisedText: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredAssistantThread = {
  id: string;
  ownerUserId: string;
  projectId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredAssistantMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type LicenseCodePurpose = "desktop" | "web";

export function normalizeLicenseCodePurpose(value: unknown): LicenseCodePurpose {
  return value === "web" ? "web" : "desktop";
}

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  penName?: string;
  penNameSetAt?: string;
  assistantName?: string;
  passwordSalt: string;
  passwordHash: string;
  role: "user" | "admin";
  plan?: "trial" | "creator" | "studio";
  creditsBalance?: number;
  aiBillingMarkup?: number;
  aiBillingMinimum?: number;
  aiTaskPricingOverrides?: AiTaskPricingOverrides;
  licenseCustomerId?: string;
  licenseCodeHash?: string;
  licenseCodePurpose?: LicenseCodePurpose;
  licenseMachineHash?: string;
  licenseActivatedAt?: string;
  licenseExpiresAt?: string;
  licenseSignedOutAt?: string;
  onboardingCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredCreditTransaction = {
  id: string;
  userId: string;
  type: "recharge" | "consume" | "refund" | "grant" | "adjust";
  amount: number;
  balanceAfter: number;
  reason: string;
  relatedJobId?: string;
  orderId?: string;
  createdAt: string;
};

export type StoredLicenseCode = {
  id: string;
  codeHash: string;
  plainCode?: string;
  codePreview: string;
  purpose: LicenseCodePurpose;
  customerName?: string;
  customerContact?: string;
  status: "unused" | "used" | "disabled" | "expired";
  maxActivations: number;
  activationCount: number;
  machineHash?: string;
  activatedAt?: string;
  lastVerifiedAt?: string;
  durationMinutes?: number;
  expiresAt?: string;
  disabledAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredLicenseActivationLog = {
  id: string;
  licenseCodeId?: string;
  codeHash: string;
  machineHash?: string;
  result: "success" | "failed";
  reason: string;
  clientName?: string;
  createdAt: string;
};

export type StoredSession = {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
};

export type ActivationAccessMode = "license_required" | "free_access";

export type StoredAccessPolicy = {
  requireActivation: boolean;
  updatedAt?: string;
  updatedBy?: string;
};

export type AppStore = {
  accessPolicy?: StoredAccessPolicy;
  users: StoredUser[];
  sessions: StoredSession[];
  projects: StoredProject[];
  sourceTexts: StoredSourceText[];
  chapters: StoredChapter[];
  chapterAnalyses: StoredChapterAnalysis[];
  storyAnalyses: StoredStoryAnalysis[];
  aiJobs: StoredAiJob[];
  templates: StoredTemplate[];
  inspirations: StoredInspiration[];
  outlines: StoredOutline[];
  writingBibles: StoredWritingBible[];
  characterProfiles: StoredCharacterProfile[];
  foreshadowings: StoredForeshadowing[];
  plotStates: StoredPlotState[];
  longFormPlans: StoredLongFormPlan[];
  customRelationGraphs?: StoredCustomRelationGraph[];
  writingTaskCards: StoredWritingTaskCard[];
  chapterDrafts: StoredChapterDraft[];
  chapterLedgers: StoredChapterLedger[];
  reviewReports: StoredReviewReport[];
  editReports: StoredEditReport[];
  assistantThreads: StoredAssistantThread[];
  assistantMessages: StoredAssistantMessage[];
  creditTransactions: StoredCreditTransaction[];
  licenseCodes: StoredLicenseCode[];
  licenseActivationLogs: StoredLicenseActivationLog[];
  aiSettings?: StoredAiSettings | StoredAiSettings[];
  coverImageSettings?: StoredCoverImageSettings | StoredCoverImageSettings[];
  coverImageUsages?: StoredCoverImageUsage[];
};

export type ProjectWithCounts = StoredProject & {
  _count: {
    chapters: number;
    chapterAnalyses: number;
    storyAnalyses: number;
    sourceTexts: number;
    writingTaskCards: number;
    chapterDrafts: number;
    chapterLedgers: number;
    reviewReports: number;
    aiJobs: number;
  };
};

export type DashboardStat = {
  label: string;
  value: string;
};

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  plan: PlanKey;
  licenseCustomerId?: string;
  licenseActivatedAt?: string;
  creditsBalance: number;
  aiModel: string;
  aiBillingMarkup: number;
  aiBillingMinimum: number;
  aiTaskPricing: Array<{
    type: string;
    label: string;
    unitLabel: string;
    baseCredits: number;
    unitCredits: number;
    multiplier: number;
    isCustom: boolean;
  }>;
  projectCount: number;
  aiJobCount: number;
  aiTokenTotal: number;
  aiCreditActual: number;
  creditConsumed: number;
  creditRecharged: number;
  lastActiveAt: string;
};

export type AdminAiUsageTypeSummary = {
  type: string;
  jobs: number;
  units: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  actualCredits: number;
  estimatedCredits: number;
  fallbackJobs: number;
};

export type AdminAiUsageSummary = {
  jobs: number;
  aiJobs: number;
  fallbackJobs: number;
  units: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  reasoningTokens: number;
  actualCredits: number;
  estimatedCredits: number;
  byType: AdminAiUsageTypeSummary[];
};

export type AdminDashboardSummary = {
  totalUsers: number;
  adminUsers: number;
  totalCreditsBalance: number;
  totalConsumed: number;
  totalRecharged: number;
  totalAiJobs: number;
  aiUsage: AdminAiUsageSummary;
  users: AdminUserSummary[];
};

export type AdminLicenseSummary = {
  id: string;
  plainCode?: string;
  codePreview: string;
  purpose: LicenseCodePurpose;
  customerName: string;
  customerContact: string;
  status: StoredLicenseCode["status"];
  maxActivations: number;
  activationCount: number;
  machineHash?: string;
  activatedAt?: string;
  lastVerifiedAt?: string;
  durationMinutes?: number;
  expiresAt?: string;
  disabledAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  recentLogs: StoredLicenseActivationLog[];
};

export type AdminLicenseCenterSummary = {
  accessPolicy: StoredAccessPolicy;
  total: number;
  unused: number;
  active: number;
  disabled: number;
  expired: number;
  recentLogCount: number;
  recentLogs: StoredLicenseActivationLog[];
  licenses: AdminLicenseSummary[];
};
