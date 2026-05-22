import type { AppStore, StoredAiSettings } from "@/lib/project-types";

export function getEnvAiSettings(): StoredAiSettings {
  return {
    providerName: process.env.AI_PROVIDER_NAME ?? "",
    baseUrl: process.env.AI_BASE_URL ?? "",
    apiKey: process.env.AI_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60000)
  };
}

export function mergeAiSettings(settings?: StoredAiSettings): StoredAiSettings {
  const envSettings = getEnvAiSettings();

  return {
    providerName: settings?.providerName || envSettings.providerName,
    baseUrl: settings?.baseUrl || envSettings.baseUrl,
    apiKey: settings?.apiKey || envSettings.apiKey,
    model: settings?.model || envSettings.model,
    timeoutMs: settings?.timeoutMs || envSettings.timeoutMs,
    updatedAt: settings?.updatedAt
  };
}

export function normalizeStoredAiSettings(settings?: StoredAiSettings | StoredAiSettings[]) {
  if (Array.isArray(settings)) {
    return settings;
  }

  return settings ? [settings] : [];
}

export function getPrimaryAiSettings(store: AppStore, userId: string) {
  const settings = normalizeStoredAiSettings(store.aiSettings);
  const userSettings = settings.filter((item) => item.userId === userId);
  return userSettings.find((item) => item.active) ?? userSettings[0] ?? null;
}

export function setPrimaryAiSettings(store: AppStore, settings: StoredAiSettings) {
  const list = normalizeStoredAiSettings(store.aiSettings).slice();
  const id = settings.id || `${settings.userId || "global"}:default`;
  const nextSettings = { ...settings, id, active: true };
  const index = list.findIndex((item) => (item.id || `${item.userId || "global"}:default`) === id);
  const nextList = list.map((item) =>
    item.userId === settings.userId ? { ...item, active: false } : item
  );

  if (index >= 0) {
    nextList[index] = nextSettings;
  } else {
    nextList.push(nextSettings);
  }

  store.aiSettings = nextList;
}

export function listUserAiProfiles(store: AppStore, userId: string) {
  const profiles = normalizeStoredAiSettings(store.aiSettings)
    .filter((item) => item.userId === userId)
    .map((item, index) => ({
      ...item,
      id: item.id || `${userId}:default:${index}`,
      profileName: item.profileName || item.providerName || `配置 ${index + 1}`,
      models: Array.isArray(item.models) ? item.models : item.model ? [item.model] : []
    }));

  if (profiles.some((item) => item.active)) {
    return profiles;
  }

  return profiles.map((item, index) => ({ ...item, active: index === 0 }));
}

export function setUserAiProfiles(store: AppStore, userId: string, profiles: StoredAiSettings[]) {
  const list = normalizeStoredAiSettings(store.aiSettings).slice();
  store.aiSettings = [
    ...list.filter((item) => item.userId !== userId),
    ...profiles
  ];
}

export function getUserAiSettings(store: AppStore, userId: string) {
  const settings = getPrimaryAiSettings(store, userId);

  if (settings) {
    return mergeAiSettings(settings);
  }

  return mergeAiSettings({
    userId,
    providerName: "",
    baseUrl: "",
    apiKey: "",
    model: "",
    timeoutMs: 0
  });
}

export function hasConfiguredAiSettings(store: AppStore, userId?: string) {
  const settings = userId ? getPrimaryAiSettings(store, userId) : normalizeStoredAiSettings(store.aiSettings)[0];

  return Boolean(
    settings?.baseUrl &&
      settings?.apiKey &&
      settings?.model
  );
}

export function getActiveAiModel(store: AppStore, fallbackModel: string, userId?: string) {
  const settings = userId ? getPrimaryAiSettings(store, userId) : normalizeStoredAiSettings(store.aiSettings)[0];

  return hasConfiguredAiSettings(store, userId)
    ? settings?.model || fallbackModel
    : fallbackModel;
}
