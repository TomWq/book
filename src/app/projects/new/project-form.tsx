"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AiCoverGeneratorDialog } from "@/components/ai-cover-generator-dialog";
import { novelTaxonomy, qidianTaxonomyByReader, readerOptions, type TargetReader } from "@/lib/novel-taxonomy";
import type { InspirationStatus, InspirationType } from "@/lib/project-types";

const fanqieTagSections = [
  { key: "mainCategories", label: "主分类" },
  { key: "themes", label: "主题" },
  { key: "roles", label: "角色" }
] as const;

const qidianTagSections = [
  { key: "mainCategories", label: "主分类" },
  { key: "subCategories", label: "子类" }
] as const;

const creationSteps = [
  { id: "book-step-identity", index: "01", label: "作品身份" },
  { id: "book-step-audience", index: "02", label: "读者与标签" },
  { id: "book-step-story", index: "03", label: "故事起点" }
] as const;

const maxSelectedTagsPerGroup = 2;
const maxProjectCharacters = 20;
const maxStoryInspirations = 20;
const maxStoryIdeaLength = 8000;
const maxStoryInspirationContentLength = 6000;
const draftStorageKey = "ai-novel-workbench:new-writing-project-draft:v3";

type TitleNamingStyle = "fanqie" | "qidian";
type TagTaxonomyStyle = "fanqie" | "qidian";
type DescriptionWritingStyle = "fanqie" | "qidian";
type CreationStepId = (typeof creationSteps)[number]["id"];
type TagSectionKey = (typeof fanqieTagSections)[number]["key"] | (typeof qidianTagSections)[number]["key"];
type WorkLengthType = "short" | "medium" | "long" | "epic";
type StoryDesignReaderMode = "auto" | TargetReader;
const characterRoleOptions = ["男主", "女主", "男配", "女配"] as const;
const storyDesignReaderModes: Array<{ value: StoryDesignReaderMode; label: string }> = [
  { value: "auto", label: "AI 自判" },
  ...readerOptions.map((reader) => ({ value: reader, label: reader }))
];
const storyInspirationTypeOptions: Array<{ value: InspirationType | ""; label: string }> = [
  { value: "", label: "全部类型" },
  { value: "plot", label: "情节" },
  { value: "character", label: "人物" },
  { value: "worldbuilding", label: "世界观" },
  { value: "pleasure_point", label: "爽点" },
  { value: "foreshadowing", label: "伏笔" },
  { value: "setting", label: "设定" },
  { value: "line", label: "台词" },
  { value: "topic", label: "选题" },
  { value: "title", label: "书名" },
  { value: "other", label: "其他" }
];
const workLengthOptions: Array<{ value: WorkLengthType; label: string; hint: string; defaultWords: string }> = [
  { value: "short", label: "短篇", hint: "适合 10-30 万字，节奏更紧，结局提前规划", defaultWords: "20" },
  { value: "medium", label: "中篇", hint: "适合 30-80 万字，主线完整，支线克制", defaultWords: "50" },
  { value: "long", label: "长篇", hint: "适合 80-150 万字，多阶段升级和地图推进", defaultWords: "100" },
  { value: "epic", label: "超长篇", hint: "适合 150 万字以上，长期连载和多卷结构", defaultWords: "200" }
];
type CharacterRole = (typeof characterRoleOptions)[number];

type CharacterDraft = {
  id: string;
  role: CharacterRole;
  name: string;
};

type CharacterNameSuggestion = {
  role: CharacterRole;
  name: string;
};

type TitleSuggestionBatch = {
  contextKey: string;
  titles: string[];
};

type StoryDesignResult = {
  titleOptions: string[];
  logline: string;
  intro: string;
  coreSellingPoint: string;
  coreConflict: string;
  protagonistDesign: string;
  goldenFinger: string;
  openingHook: string;
  mainLoop: string;
  worldSetting: string;
  characterSuggestions: CharacterNameSuggestion[];
  first10Chapters: string[];
  pleasurePoints: string[];
  foreshadowing: string[];
  risksToAvoid: string[];
  recommendedGenre: string;
  recommendedTags: string[];
};

type StoryInspirationOption = {
  id: string;
  title: string;
  content: string;
  type: InspirationType;
  status: InspirationStatus;
  tags: string[];
  projectId?: string;
  updatedAt: string;
};

type ProjectFormDraft = {
  name: string;
  storyIdea: string;
  storyInspirations: StoryInspirationOption[];
  storyDesignReaderMode: StoryDesignReaderMode;
  titleConcept: string;
  authorName: string;
  coverImageUrl: string;
  titleNamingStyle: TitleNamingStyle;
  tagTaxonomyStyle: TagTaxonomyStyle;
  descriptionWritingStyle: DescriptionWritingStyle;
  description: string;
  characters: CharacterDraft[];
  protagonist1?: string;
  protagonist2?: string;
  targetReader: TargetReader;
  genre: string;
  selectedTags: string[];
  activeTagSection: TagSectionKey;
  activeStep: CreationStepId;
  coreSellingPoint: string;
  goldenFinger: string;
  openingHook: string;
  autoGenerateLongFormPlan: boolean;
  workLengthType: WorkLengthType;
  targetTotalWords: string;
};

function defaultCharacters(targetReader: TargetReader = "男频"): CharacterDraft[] {
  return targetReader === "女频"
    ? [
        { id: "lead-female", role: "女主", name: "" },
        { id: "lead-male", role: "男主", name: "" }
      ]
    : [
        { id: "lead-male", role: "男主", name: "" },
        { id: "lead-female", role: "女主", name: "" }
      ];
}

const defaultDraft: ProjectFormDraft = {
  name: "",
  storyIdea: "",
  storyInspirations: [],
  storyDesignReaderMode: "auto",
  titleConcept: "",
  authorName: "",
  coverImageUrl: "",
  titleNamingStyle: "fanqie",
  tagTaxonomyStyle: "fanqie",
  descriptionWritingStyle: "fanqie",
  description: "",
  characters: defaultCharacters(),
  targetReader: "男频",
  genre: "",
  selectedTags: [],
  activeTagSection: "mainCategories",
  activeStep: "book-step-identity",
  coreSellingPoint: "",
  goldenFinger: "",
  openingHook: "",
  autoGenerateLongFormPlan: true,
  workLengthType: "medium",
  targetTotalWords: "50"
};

function asText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function isTargetReader(value: unknown): value is TargetReader {
  return readerOptions.includes(value as TargetReader);
}

function isTitleNamingStyle(value: unknown): value is TitleNamingStyle {
  return value === "fanqie" || value === "qidian";
}

function isTagTaxonomyStyle(value: unknown): value is TagTaxonomyStyle {
  return value === "fanqie" || value === "qidian";
}

function isDescriptionWritingStyle(value: unknown): value is DescriptionWritingStyle {
  return value === "fanqie" || value === "qidian";
}

function isCreationStepId(value: unknown): value is CreationStepId {
  return creationSteps.some((step) => step.id === value);
}

function isTagSectionKey(value: unknown): value is TagSectionKey {
  return [...fanqieTagSections, ...qidianTagSections].some((section) => section.key === value);
}

function isCharacterRole(value: unknown): value is CharacterRole {
  return characterRoleOptions.includes(value as CharacterRole);
}

function isWorkLengthType(value: unknown): value is WorkLengthType {
  return workLengthOptions.some((option) => option.value === value);
}

function isStoryDesignReaderMode(value: unknown): value is StoryDesignReaderMode {
  return value === "auto" || isTargetReader(value);
}

function isInspirationType(value: unknown): value is InspirationType {
  return (
    value === "plot" ||
    value === "character" ||
    value === "worldbuilding" ||
    value === "pleasure_point" ||
    value === "foreshadowing" ||
    value === "setting" ||
    value === "line" ||
    value === "topic" ||
    value === "title" ||
    value === "other"
  );
}

function isInspirationStatus(value: unknown): value is InspirationStatus {
  return value === "raw" || value === "polished" || value === "used" || value === "archived";
}

function inspirationTypeLabel(value: InspirationType) {
  const labels: Record<InspirationType, string> = {
    plot: "情节",
    character: "人物",
    worldbuilding: "世界观",
    pleasure_point: "爽点",
    foreshadowing: "伏笔",
    setting: "设定",
    line: "台词",
    topic: "选题",
    title: "书名",
    other: "其他"
  };

  return labels[value] ?? value;
}

function inspirationStatusLabel(value: InspirationStatus) {
  const labels: Record<InspirationStatus, string> = {
    raw: "原始",
    polished: "已润色",
    used: "已使用",
    archived: "已归档"
  };

  return labels[value] ?? value;
}

function stringValue(value: unknown, maxLength = 1000) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function compactStringValue(value: unknown, maxLength = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function stringListValue(value: unknown, limit: number, maxLength = 120) {
  return Array.isArray(value)
    ? value.map((item) => compactStringValue(item, maxLength)).filter(Boolean).slice(0, limit)
    : [];
}

function normalizeTargetTotalWords(value: unknown) {
  const text = stringValue(value, 8).replace(/[^\d.]/g, "");
  const numberValue = Number(text);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return defaultDraft.targetTotalWords;
  }

  return String(Math.min(500, Math.max(5, Math.round(numberValue))));
}

function cleanTargetTotalWordsInput(value: string) {
  const text = value.replace(/[^\d]/g, "").slice(0, 3);

  if (!text) {
    return "";
  }

  return String(Math.min(500, Math.max(1, Number(text))));
}

function createCharacterDraft(role: CharacterRole = "男主", name = ""): CharacterDraft {
  return {
    id: `character-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    name: name.slice(0, 12)
  };
}

function normalizeTitleContextPart(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasConcreteTitleDirection(values: Array<string | undefined>) {
  return values
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .some((item) => {
      const parts = item.split(/[，,、/；;\s]+/).map(normalizeTitleContextPart).filter(Boolean);
      const compact = normalizeTitleContextPart(item).replace(/[，,、/；;\s]/g, "");

      if (parts.length >= 2 && parts.every((part) => part.length <= 6)) {
        return false;
      }

      return compact.length >= 8;
    });
}

function buildTitleSuggestionContextKey(input: {
  titleNamingStyle: TitleNamingStyle;
  tagTaxonomyStyle: TagTaxonomyStyle;
  targetReader: TargetReader;
  genre: string;
  selectedTags: string[];
  titleConcept: string;
  coreSellingPoint: string;
  goldenFinger: string;
  openingHook: string;
  description: string;
  characters: CharacterDraft[];
}) {
  return JSON.stringify({
    titleNamingStyle: input.titleNamingStyle,
    tagTaxonomyStyle: input.tagTaxonomyStyle,
    targetReader: input.targetReader,
    genre: normalizeTitleContextPart(input.genre),
    selectedTags: input.selectedTags.map(normalizeTitleContextPart).filter(Boolean).sort(),
    titleConcept: normalizeTitleContextPart(input.titleConcept),
    coreSellingPoint: normalizeTitleContextPart(input.coreSellingPoint),
    goldenFinger: normalizeTitleContextPart(input.goldenFinger),
    openingHook: normalizeTitleContextPart(input.openingHook),
    description: normalizeTitleContextPart(input.description),
    characterNames: input.characters.map((character) => normalizeTitleContextPart(character.name)).filter(Boolean)
  });
}

function normalizeCharacters(
  rawCharacters: unknown,
  legacyNames: string[],
  targetReader: TargetReader = "男频"
): CharacterDraft[] {
  if (Array.isArray(rawCharacters)) {
    const characters = rawCharacters
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const raw = item as Partial<Record<keyof CharacterDraft, unknown>>;
        const role = isCharacterRole(raw.role) ? raw.role : defaultRoleForReader(index, targetReader);

        return {
          id: stringValue(raw.id, 60) || `character-${index}`,
          role,
          name: stringValue(raw.name, 12)
        };
      })
      .filter((item): item is CharacterDraft => Boolean(item))
      .slice(0, maxProjectCharacters);

    if (characters.length > 0) {
      return characters;
    }
  }

  const legacyCharacters = legacyNames
    .map((name, index): CharacterDraft | null =>
      name.trim()
        ? {
            id: `legacy-${index}`,
            role: defaultRoleForReader(index, targetReader),
            name: name.slice(0, 12)
          }
        : null
    )
    .filter((item): item is CharacterDraft => Boolean(item));

  return legacyCharacters.length > 0 ? legacyCharacters : defaultCharacters(targetReader);
}

function alignLeadCharactersForReader(characters: CharacterDraft[], targetReader: TargetReader) {
  const shouldAlign =
    characters.length === 0 ||
    (characters.length === 2 &&
      characters.every((character) => !character.name.trim()) &&
      characters.every((character) => character.role === "男主" || character.role === "女主"));

  if (!shouldAlign) {
    return characters;
  }

  const defaults = defaultCharacters(targetReader);

  return defaults.map((character, index) => ({
    ...character,
    id: characters[index]?.id ?? character.id
  }));
}

function defaultRoleForReader(index: number, targetReader: TargetReader = "男频"): CharacterRole {
  return targetReader === "女频"
    ? index === 0
      ? "女主"
      : index === 1
        ? "男主"
        : "女配"
    : index === 1
      ? "女主"
      : "男主";
}

function normalizeStoryDesign(rawValue: unknown, targetReader: TargetReader = "男频"): StoryDesignResult | null {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const raw = rawValue as Record<string, unknown>;
  const characterSuggestions: CharacterNameSuggestion[] = Array.isArray(raw.characterSuggestions)
    ? raw.characterSuggestions
        .map((item, index): CharacterNameSuggestion | null => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const record = item as { role?: unknown; name?: unknown };
          const rawRole = isCharacterRole(record.role) ? record.role : defaultRoleForReader(index, targetReader);
          const role = targetReader === "女频" && index === 0 && rawRole === "男主" ? "女主" : rawRole;
          const name = compactStringValue(record.name, 12);

          return name ? { role, name } : null;
        })
        .filter((item): item is CharacterNameSuggestion => Boolean(item))
        .slice(0, maxProjectCharacters)
    : [];
  const design: StoryDesignResult = {
    titleOptions: stringListValue(raw.titleOptions, 6, 60),
    logline: compactStringValue(raw.logline, 220),
    intro: compactStringValue(raw.intro, 700),
    coreSellingPoint: compactStringValue(raw.coreSellingPoint, 320),
    coreConflict: compactStringValue(raw.coreConflict, 360),
    protagonistDesign: compactStringValue(raw.protagonistDesign, 360),
    goldenFinger: compactStringValue(raw.goldenFinger, 360),
    openingHook: compactStringValue(raw.openingHook, 360),
    mainLoop: compactStringValue(raw.mainLoop, 360),
    worldSetting: compactStringValue(raw.worldSetting, 520),
    characterSuggestions,
    first10Chapters: stringListValue(raw.first10Chapters, 10, 320),
    pleasurePoints: stringListValue(raw.pleasurePoints, 10, 320),
    foreshadowing: stringListValue(raw.foreshadowing, 8, 300),
    risksToAvoid: stringListValue(raw.risksToAvoid, 8, 300),
    recommendedGenre: compactStringValue(raw.recommendedGenre, 40),
    recommendedTags: stringListValue(raw.recommendedTags, 6, 40)
  };
  const hasContent = [
    design.logline,
    design.intro,
    design.coreSellingPoint,
    design.coreConflict,
    design.goldenFinger,
    design.openingHook,
    design.mainLoop
  ].some(Boolean);

  return hasContent || design.titleOptions.length > 0 || design.first10Chapters.length > 0 ? design : null;
}

function normalizeStoryInspiration(rawValue: unknown): StoryInspirationOption | null {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const raw = rawValue as Record<string, unknown>;
  const id = compactStringValue(raw.id, 80);
  const content = stringValue(raw.content, maxStoryInspirationContentLength).trim();

  if (!id || !content) {
    return null;
  }

  return {
    id,
    title: compactStringValue(raw.title, 80) || content.slice(0, 24) || "未命名灵感",
    content,
    type: isInspirationType(raw.type) ? raw.type : "other",
    status: isInspirationStatus(raw.status) ? raw.status : "raw",
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((item) => compactStringValue(item, 24)).filter(Boolean).slice(0, 8)
      : [],
    projectId: compactStringValue(raw.projectId, 80) || undefined,
    updatedAt: compactStringValue(raw.updatedAt, 40)
  };
}

function normalizeStoryInspirations(value: unknown) {
  return Array.isArray(value)
    ? value
        .map(normalizeStoryInspiration)
        .filter((item): item is StoryInspirationOption => Boolean(item))
        .slice(0, maxStoryInspirations)
    : [];
}

function formatStoryInspiration(inspiration: StoryInspirationOption, contentLength = maxStoryInspirationContentLength) {
  const content = stringValue(inspiration.content, contentLength).trim();
  const tags = inspiration.tags.length > 0 ? `\n标签：${inspiration.tags.join("、")}` : "";

  return `灵感「${inspiration.title}」\n类型：${inspirationTypeLabel(inspiration.type)}\n内容：${content}${tags}`;
}

function normalizeDraft(value: unknown): ProjectFormDraft {
  if (!value || typeof value !== "object") {
    return defaultDraft;
  }

  const raw = value as Partial<Record<keyof ProjectFormDraft, unknown>>;
  const legacyProtagonists = [stringValue(raw.protagonist1, 12), stringValue(raw.protagonist2, 12)];
  const storyDesignReaderMode = isStoryDesignReaderMode(raw.storyDesignReaderMode)
    ? raw.storyDesignReaderMode
    : defaultDraft.storyDesignReaderMode;
  const targetReader = storyDesignReaderMode !== "auto"
    ? storyDesignReaderMode
    : isTargetReader(raw.targetReader)
      ? raw.targetReader
      : defaultDraft.targetReader;

  return {
    name: stringValue(raw.name, 60),
    storyIdea: stringValue(raw.storyIdea, maxStoryIdeaLength),
    storyInspirations: normalizeStoryInspirations(raw.storyInspirations),
    storyDesignReaderMode,
    titleConcept: stringValue(raw.titleConcept, 500),
    authorName: stringValue(raw.authorName, 20),
    coverImageUrl: stringValue(raw.coverImageUrl, 1_200_000),
    titleNamingStyle: isTitleNamingStyle(raw.titleNamingStyle) ? raw.titleNamingStyle : defaultDraft.titleNamingStyle,
    tagTaxonomyStyle: isTagTaxonomyStyle(raw.tagTaxonomyStyle) ? raw.tagTaxonomyStyle : defaultDraft.tagTaxonomyStyle,
    descriptionWritingStyle: isDescriptionWritingStyle(raw.descriptionWritingStyle)
      ? raw.descriptionWritingStyle
      : defaultDraft.descriptionWritingStyle,
    description: stringValue(raw.description, 500),
    characters: alignLeadCharactersForReader(
      normalizeCharacters(raw.characters, legacyProtagonists, targetReader),
      targetReader
    ),
    protagonist1: legacyProtagonists[0],
    protagonist2: legacyProtagonists[1],
    targetReader,
    genre: stringValue(raw.genre, 40),
    selectedTags: Array.isArray(raw.selectedTags)
      ? raw.selectedTags.map((item) => stringValue(item, 40)).filter(Boolean).slice(0, 4)
      : [],
    activeTagSection: isTagSectionKey(raw.activeTagSection) ? raw.activeTagSection : defaultDraft.activeTagSection,
    activeStep: isCreationStepId(raw.activeStep) ? raw.activeStep : defaultDraft.activeStep,
    coreSellingPoint: stringValue(raw.coreSellingPoint, 160),
    goldenFinger: stringValue(raw.goldenFinger, 160),
    openingHook: stringValue(raw.openingHook, 160),
    autoGenerateLongFormPlan:
      typeof raw.autoGenerateLongFormPlan === "boolean"
        ? raw.autoGenerateLongFormPlan
        : defaultDraft.autoGenerateLongFormPlan,
    workLengthType: isWorkLengthType(raw.workLengthType) ? raw.workLengthType : defaultDraft.workLengthType,
    targetTotalWords: normalizeTargetTotalWords(raw.targetTotalWords)
  };
}

export function ProjectForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const draftRestoredRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assistLoading, setAssistLoading] = useState<"" | "titles" | "protagonists" | "description" | "titleConcept" | "storyDesign">("");
  const [error, setError] = useState("");
  const [assistError, setAssistError] = useState("");
  const [storyDesignError, setStoryDesignError] = useState("");
  const [titleAssistError, setTitleAssistError] = useState("");
  const [name, setName] = useState("");
  const [storyIdea, setStoryIdea] = useState("");
  const [storyInspirations, setStoryInspirations] = useState<StoryInspirationOption[]>([]);
  const [storyDesignReaderMode, setStoryDesignReaderMode] = useState<StoryDesignReaderMode>("auto");
  const [storyDesign, setStoryDesign] = useState<StoryDesignResult | null>(null);
  const [titleConcept, setTitleConcept] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [titleNamingStyle, setTitleNamingStyle] = useState<TitleNamingStyle>("fanqie");
  const [tagTaxonomyStyle, setTagTaxonomyStyle] = useState<TagTaxonomyStyle>("fanqie");
  const [descriptionWritingStyle, setDescriptionWritingStyle] = useState<DescriptionWritingStyle>("fanqie");
  const [description, setDescription] = useState("");
  const [characters, setCharacters] = useState<CharacterDraft[]>(() => defaultCharacters());
  const [targetReader, setTargetReader] = useState<TargetReader>("男频");
  const [genre, setGenre] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [isInspirationPickerOpen, setIsInspirationPickerOpen] = useState(false);
  const [isAiCoverDialogOpen, setIsAiCoverDialogOpen] = useState(false);
  const [availableInspirations, setAvailableInspirations] = useState<StoryInspirationOption[]>([]);
  const [inspirationSearch, setInspirationSearch] = useState("");
  const [inspirationTypeFilter, setInspirationTypeFilter] = useState<InspirationType | "">("");
  const [isLoadingInspirations, setIsLoadingInspirations] = useState(false);
  const [inspirationPickerError, setInspirationPickerError] = useState("");
  const [coverPreviewError, setCoverPreviewError] = useState("");
  const [activeTagSection, setActiveTagSection] = useState<TagSectionKey>("mainCategories");
  const [titleSuggestionBatch, setTitleSuggestionBatch] = useState<TitleSuggestionBatch | null>(null);
  const [protagonistSuggestions, setProtagonistSuggestions] = useState<CharacterNameSuggestion[]>([]);
  const [activeStep, setActiveStep] = useState<CreationStepId>("book-step-identity");
  const [coreSellingPoint, setCoreSellingPoint] = useState("");
  const [goldenFinger, setGoldenFinger] = useState("");
  const [openingHook, setOpeningHook] = useState("");
  const [autoGenerateLongFormPlan, setAutoGenerateLongFormPlan] = useState(true);
  const [workLengthType, setWorkLengthType] = useState<WorkLengthType>("medium");
  const [targetTotalWords, setTargetTotalWords] = useState("50");

  const coverTitle = name || "书本名称";
  const coverAuthor = authorName.trim() || "作者名称";
  const taxonomy = novelTaxonomy[targetReader];
  const qidianTaxonomy = qidianTaxonomyByReader[targetReader];
  const currentFanqieCategory = taxonomy.mainCategories.find((item) => item.name === genre) ?? null;
  const currentQidianCategory = qidianTaxonomy.find((item) => item.name === genre) ?? null;
  const currentCategory = tagTaxonomyStyle === "qidian" ? currentQidianCategory : currentFanqieCategory;
  const tagSections = tagTaxonomyStyle === "qidian" ? qidianTagSections : fanqieTagSections;
  const selectedTagText = useMemo(
    () => [tagTaxonomyStyle === "qidian" ? "起点" : "番茄", genre, ...selectedTags].filter(Boolean).slice(0, 5).join(" / "),
    [genre, selectedTags, tagTaxonomyStyle]
  );
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);
  const themeTagSet = useMemo(() => new Set(taxonomy.themes), [taxonomy.themes]);
  const roleTagSet = useMemo(() => new Set(taxonomy.roles), [taxonomy.roles]);
  const selectedThemeCount = selectedTags.filter((tag) => themeTagSet.has(tag)).length;
  const selectedRoleCount = selectedTags.filter((tag) => roleTagSet.has(tag)).length;
  const currentSubCategories = currentQidianCategory?.subCategories ?? [];
  const selectedSubCategory = selectedTags.find((tag) => currentSubCategories.includes(tag)) ?? "";
  const selectedStoryInspirationIdSet = useMemo(
    () => new Set(storyInspirations.map((inspiration) => inspiration.id)),
    [storyInspirations]
  );
  const filteredInspirations = useMemo(() => {
    const query = inspirationSearch.trim().toLowerCase();

    return availableInspirations.filter((inspiration) => {
      if (inspirationTypeFilter && inspiration.type !== inspirationTypeFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        inspiration.title,
        inspiration.content,
        inspirationTypeLabel(inspiration.type),
        inspirationStatusLabel(inspiration.status),
        ...inspiration.tags
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [availableInspirations, inspirationSearch, inspirationTypeFilter]);
  const titleSuggestionContextKey = useMemo(
    () => buildTitleSuggestionContextKey({
      titleNamingStyle,
      tagTaxonomyStyle,
      targetReader,
      genre,
      selectedTags,
      titleConcept,
      coreSellingPoint,
      goldenFinger,
      openingHook,
      description,
      characters
    }),
    [
      titleNamingStyle,
      tagTaxonomyStyle,
      targetReader,
      genre,
      selectedTags,
      titleConcept,
      coreSellingPoint,
      goldenFinger,
      openingHook,
      description,
      characters
    ]
  );
  const currentTitleSuggestions =
    titleSuggestionBatch?.contextKey === titleSuggestionContextKey ? titleSuggestionBatch.titles : [];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const hasOpenDialog = isTagDialogOpen || isInspirationPickerOpen;

    if (!hasOpenDialog) {
      return;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousDocumentOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTagDialogOpen(false);
        setIsInspirationPickerOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isInspirationPickerOpen, isTagDialogOpen]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftStorageKey);

      if (stored) {
        const draft = normalizeDraft(JSON.parse(stored));

        setName(draft.name);
        setStoryIdea(draft.storyIdea);
        setStoryInspirations(draft.storyInspirations);
        setStoryDesignReaderMode(draft.storyDesignReaderMode);
        setTitleConcept(draft.titleConcept);
        setAuthorName(draft.authorName);
        setCoverImageUrl(draft.coverImageUrl);
        setCoverPreviewError("");
        setTitleNamingStyle(draft.titleNamingStyle);
        setTagTaxonomyStyle(draft.tagTaxonomyStyle);
        setDescriptionWritingStyle(draft.descriptionWritingStyle);
        setDescription(draft.description);
        setCharacters(draft.characters);
        setTargetReader(draft.targetReader);
        setGenre(draft.genre);
        setSelectedTags(draft.selectedTags);
        setActiveTagSection(draft.activeTagSection);
        setCoreSellingPoint(draft.coreSellingPoint);
        setGoldenFinger(draft.goldenFinger);
        setOpeningHook(draft.openingHook);
        setAutoGenerateLongFormPlan(draft.autoGenerateLongFormPlan);
        setWorkLengthType(draft.workLengthType);
        setTargetTotalWords(draft.targetTotalWords);
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }

    window.scrollTo({ top: 0, left: 0 });
    draftRestoredRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftRestoredRef.current) {
      return;
    }

    const draft: ProjectFormDraft = {
      name,
      storyIdea,
      storyInspirations,
      storyDesignReaderMode,
      titleConcept,
      authorName,
      coverImageUrl,
      titleNamingStyle,
      tagTaxonomyStyle,
      descriptionWritingStyle,
      description,
      characters,
      targetReader,
      genre,
      selectedTags,
      activeTagSection,
      activeStep,
      coreSellingPoint,
      goldenFinger,
      openingHook,
      autoGenerateLongFormPlan,
      workLengthType,
      targetTotalWords
    };

    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      try {
        window.localStorage.setItem(draftStorageKey, JSON.stringify({ ...draft, coverImageUrl: "" }));
      } catch {
        // Ignore storage quota errors; the form still works during the current session.
      }
    }
  }, [
    activeStep,
    activeTagSection,
    authorName,
    coreSellingPoint,
    coverImageUrl,
    characters,
    description,
    descriptionWritingStyle,
    genre,
    goldenFinger,
    name,
    storyIdea,
    storyInspirations,
    storyDesignReaderMode,
    openingHook,
    selectedTags,
    tagTaxonomyStyle,
    targetReader,
    targetTotalWords,
    titleConcept,
    titleNamingStyle,
    workLengthType,
    autoGenerateLongFormPlan
  ]);

  function updateTagTaxonomyStyle(nextStyle: TagTaxonomyStyle) {
    setTagTaxonomyStyle(nextStyle);
    setGenre("");
    setSelectedTags([]);
    setActiveTagSection("mainCategories");
  }

  function updateTargetReader(nextReader: TargetReader) {
    const nextTaxonomy = novelTaxonomy[nextReader];
    const nextThemeTags = new Set(nextTaxonomy.themes);
    const nextRoleTags = new Set(nextTaxonomy.roles);
    const aiSuggestedNameSet = new Set(protagonistSuggestions.map((item) => item.name.trim()).filter(Boolean));

    setStoryDesignReaderMode(nextReader);
    setTargetReader(nextReader);
    setStoryDesign(null);
    setStoryDesignError("");
    setProtagonistSuggestions([]);
    setCharacters((current) =>
      alignLeadCharactersForReader(
        current.map((character) =>
          aiSuggestedNameSet.has(character.name.trim()) ? { ...character, name: "" } : character
        ),
        nextReader
      )
    );
    if (tagTaxonomyStyle === "fanqie") {
      setGenre("");
      setSelectedTags((current) => {
        const keptThemes = current.filter((tag) => nextThemeTags.has(tag)).slice(0, maxSelectedTagsPerGroup);
        const keptRoles = current.filter((tag) => nextRoleTags.has(tag)).slice(0, maxSelectedTagsPerGroup);
        return [...keptThemes, ...keptRoles];
      });
    } else {
      setGenre("");
      setSelectedTags([]);
    }
    setActiveTagSection("mainCategories");
  }

  function updateStoryDesignReaderMode(nextMode: StoryDesignReaderMode) {
    setStoryDesignReaderMode(nextMode);
    setStoryDesign(null);
    setStoryDesignError("");
    if (nextMode !== "auto" && nextMode !== targetReader) {
      updateTargetReader(nextMode);
    } else if (nextMode !== "auto") {
      setCharacters((current) => alignLeadCharactersForReader(current, nextMode));
    }
  }

  function updateGenre(nextGenre: string) {
    setGenre(nextGenre);
    if (tagTaxonomyStyle === "qidian") {
      setSelectedTags([]);
      setActiveTagSection("subCategories");
    }
  }

  function updateWorkLengthType(nextType: WorkLengthType) {
    setWorkLengthType(nextType);
    const option = workLengthOptions.find((item) => item.value === nextType);
    const defaultWordValues = new Set(workLengthOptions.map((item) => item.defaultWords));

    if (option && (!targetTotalWords.trim() || defaultWordValues.has(targetTotalWords))) {
      setTargetTotalWords(option.defaultWords);
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => {
      if (tagTaxonomyStyle === "qidian") {
        return current.includes(tag) ? [] : [tag];
      }

      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }

      const isTheme = themeTagSet.has(tag);
      const isRole = roleTagSet.has(tag);
      const sameGroupCount = current.filter((item) =>
        isTheme ? themeTagSet.has(item) : isRole ? roleTagSet.has(item) : false
      ).length;

      if ((isTheme || isRole) && sameGroupCount >= maxSelectedTagsPerGroup) {
        return current;
      }

      return [...current, tag];
    });
  }

  async function fileToDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("封面读取失败"));
      reader.readAsDataURL(file);
    });
  }

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setCoverImageUrl(await fileToDataUrl(file));
    setCoverPreviewError("");
  }

  function clearCoverImage() {
    setCoverImageUrl("");
    setCoverPreviewError("");
  }

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const sections = creationSteps
      .map((step) => document.getElementById(step.id))
      .filter((element): element is HTMLElement => Boolean(element));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visible?.target.id) {
          setActiveStep(visible.target.id as CreationStepId);
        }
      },
      {
        rootMargin: "-120px 0px -62% 0px",
        threshold: 0
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  function scrollToStep(stepId: CreationStepId) {
    setActiveStep(stepId);
    document.getElementById(stepId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateCharacter(id: string, patch: Partial<Pick<CharacterDraft, "role" | "name">>) {
    setCharacters((current) =>
      current.map((character) =>
        character.id === id
          ? {
              ...character,
              ...patch,
              name: patch.name !== undefined ? patch.name.slice(0, 12) : character.name
            }
          : character
      )
    );
  }

  function addCharacter(role: CharacterRole) {
    setCharacters((current) => [...current, createCharacterDraft(role)].slice(0, maxProjectCharacters));
  }

  function removeCharacter(id: string) {
    setCharacters((current) => current.filter((character) => character.id !== id));
  }

  function getFilledCharacters() {
    return characters
      .map((character) => ({
        role: character.role,
        name: character.name.trim()
      }))
      .filter((character) => character.name)
      .slice(0, maxProjectCharacters);
  }

  function getCurrentContext(options: { descriptionAssistMode?: "generate" | "polish"; forStoryDesign?: boolean } = {}) {
    const cleanStoryDesignNames = (items: CharacterDraft[]) =>
      items.map((character) =>
        options.forStoryDesign
          ? { ...character, name: "" }
          : character
      );
    const baseContextCharacters =
      options.forStoryDesign && storyDesignReaderMode === "女频"
        ? alignLeadCharactersForReader(cleanStoryDesignNames(characters), "女频")
        : options.forStoryDesign && storyDesignReaderMode === "男频"
          ? alignLeadCharactersForReader(cleanStoryDesignNames(characters), "男频")
          : cleanStoryDesignNames(characters);
    const contextCharacters =
      options.forStoryDesign && storyDesignReaderMode === "auto"
        ? baseContextCharacters.filter((character) => character.name.trim())
        : baseContextCharacters;

    return {
      name,
      storyIdea,
      genre,
      categoryDescription: currentCategory?.description ?? "",
      targetReader,
      titleNamingStyle,
      tagTaxonomyStyle,
      descriptionWritingStyle,
      titleConcept,
      avoidTitles: currentTitleSuggestions,
      tags: selectedTags,
      protagonistNames: contextCharacters.map((character) => character.name.trim()).filter(Boolean),
      protagonistCharacters: contextCharacters.map((character) => ({
        role: character.role,
        name: character.name.trim()
      })),
      coreSellingPoint,
      goldenFinger,
      openingHook,
      description: options.descriptionAssistMode === "polish" ? description : "",
      descriptionAssistMode: options.descriptionAssistMode ?? "generate",
      workLengthType,
      targetTotalWords
    };
  }

  async function loadInspirations() {
    if (availableInspirations.length > 0 || isLoadingInspirations) {
      return;
    }

    setIsLoadingInspirations(true);
    setInspirationPickerError("");

    try {
      const response = await fetch("/api/inspirations");
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "读取灵感失败");
      }

      const inspirations: StoryInspirationOption[] = Array.isArray(payload?.inspirations)
        ? payload.inspirations
            .map(normalizeStoryInspiration)
            .filter((item: StoryInspirationOption | null): item is StoryInspirationOption => Boolean(item))
        : [];

      inspirations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setAvailableInspirations(inspirations);
    } catch (loadError) {
      setInspirationPickerError(loadError instanceof Error ? loadError.message : "读取灵感失败");
    } finally {
      setIsLoadingInspirations(false);
    }
  }

  function openInspirationPicker() {
    setIsInspirationPickerOpen(true);
    void loadInspirations();
  }

  function addStoryInspiration(inspiration: StoryInspirationOption) {
    if (selectedStoryInspirationIdSet.has(inspiration.id)) {
      return;
    }

    setStoryInspirations((current) => {
      if (current.some((item) => item.id === inspiration.id)) {
        return current;
      }

      return [...current, inspiration].slice(0, maxStoryInspirations);
    });
    setStoryIdea((current) => {
      const block = formatStoryInspiration(inspiration);
      if (current.includes(block)) {
        return current;
      }

      const separator = current.trim() ? "\n\n" : "";
      return `${current.trimEnd()}${separator}${block}`.slice(0, maxStoryIdeaLength);
    });
    setStoryDesignError("");
  }

  function removeStoryInspiration(inspirationId: string) {
    const inspiration = storyInspirations.find((item) => item.id === inspirationId);

    setStoryInspirations((current) => current.filter((inspiration) => inspiration.id !== inspirationId));
    if (inspiration) {
      const block = formatStoryInspiration(inspiration);
      setStoryIdea((current) => current.replace(block, "").replace(/\n{3,}/g, "\n\n").trim());
    }
  }

  function toggleStoryInspiration(inspiration: StoryInspirationOption) {
    if (selectedStoryInspirationIdSet.has(inspiration.id)) {
      removeStoryInspiration(inspiration.id);
      return;
    }

    addStoryInspiration(inspiration);
  }

  function applyStoryDesign(design: StoryDesignResult) {
    if (design.titleOptions[0]) {
      setName(design.titleOptions[0].slice(0, 60));
    }
    if (design.intro) {
      setDescription(design.intro.slice(0, 500));
    }
    if (design.coreSellingPoint) {
      setCoreSellingPoint(design.coreSellingPoint.slice(0, 160));
    }
    if (design.goldenFinger) {
      setGoldenFinger(design.goldenFinger.slice(0, 160));
    }
    if (design.openingHook) {
      setOpeningHook(design.openingHook.slice(0, 160));
    }
    if (design.logline || design.protagonistDesign || design.coreConflict) {
      setTitleConcept(
        [design.logline, design.protagonistDesign, design.coreConflict, design.mainLoop]
          .filter(Boolean)
          .join(" ")
          .slice(0, 500)
      );
    }
    if (design.characterSuggestions.length > 0) {
      setProtagonistSuggestions(design.characterSuggestions);
      setCharacters((current) => {
        const baseCharacters =
          storyDesignReaderMode === "女频"
            ? alignLeadCharactersForReader(current, "女频")
            : storyDesignReaderMode === "男频"
              ? alignLeadCharactersForReader(current, "男频")
              : current;
        const next = baseCharacters.length > 0
          ? [...baseCharacters]
          : defaultCharacters(storyDesignReaderMode === "女频" ? "女频" : "男频");

        design.characterSuggestions.forEach((item, index) => {
          const role = storyDesignReaderMode === "女频" && index === 0 ? "女主" : item.role;
          const existing = next[index] ?? createCharacterDraft(role);

          next[index] = {
            ...existing,
            role,
            name: item.name.slice(0, 12)
          };
        });

        return next.slice(0, maxProjectCharacters);
      });
    }
  }

  async function runAssist(
    action: "titles" | "protagonists" | "description" | "titleConcept" | "storyDesign",
    options: { descriptionAssistMode?: "generate" | "polish" } = {}
  ) {
    setAssistLoading(action);
    setAssistError("");
    if (action === "storyDesign") {
      setStoryDesignError("");
      setStoryDesign(null);
    }
    if (action === "titles" || action === "titleConcept") {
      setTitleAssistError("");
    }

    if (action === "titleConcept") {
      const hasAnyTitleContext = [
        titleConcept,
        genre,
        selectedTags.join(" "),
        coreSellingPoint,
        openingHook,
        goldenFinger,
        description,
        ...getFilledCharacters().map((character) => character.name)
      ].some((item) => item.trim());

      if (!hasAnyTitleContext) {
        setAssistLoading("");
        setTitleAssistError("先写一点想法，或先选择主分类、标签、读者，再让 AI 帮你整理起名方向。");
        return;
      }
    }

    if (action === "storyDesign" && !storyIdea.trim()) {
      setAssistLoading("");
      setStoryDesignError("先写一点小说大概思路或方向，再让 AI 做整体设计。");
      return;
    }

    if (action === "titles") {
      if (!titleConcept.trim()) {
        setAssistLoading("");
        setTitleAssistError("请先在书本名称上方填写起名前描述，再让 AI 按这个描述起名。");
        return;
      }
    }

    try {
      const context = getCurrentContext({ ...options, forStoryDesign: action === "storyDesign" });
      const isAutoStoryDesignReader = action === "storyDesign" && storyDesignReaderMode === "auto";
      const response = await fetch("/api/projects/new/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          ...context,
          targetReader: isAutoStoryDesignReader ? "" : context.targetReader,
          categoryDescription: isAutoStoryDesignReader ? "" : context.categoryDescription,
          storyDesignReaderMode
        })
      });
      const payload = await response.json().catch((e) => ({ error: String(e) }));

      if (!response.ok) {
        throw new Error(payload?.error || "AI 辅助生成失败");
      }

      const result = payload?.result ?? {};

      if (action === "titles") {
        const titles = Array.isArray(result.titles)
          ? result.titles.map((item: unknown) => String(item).trim()).filter(Boolean)
          : [];

        setTitleSuggestionBatch({
          contextKey: titleSuggestionContextKey,
          titles
        });
        if (titles.length === 0) {
          setTitleAssistError("这轮 AI 起名质量不达标，已被筛选拦下。请直接再点一次 AI 起名，系统会避开本轮失败方向重新生成。");
        }
        if (titles[0]) {
          setName(titles[0].slice(0, 60));
        }
      }

      if (action === "protagonists") {
        const names: string[] = Array.isArray(result.protagonistNames)
          ? result.protagonistNames.map((item: unknown) => String(item).trim()).filter(Boolean)
          : [];
        const suggestedCharacters: CharacterNameSuggestion[] = Array.isArray(result.protagonistCharacters)
          ? result.protagonistCharacters
              .map((item: unknown, index: number): CharacterNameSuggestion | null => {
                if (!item || typeof item !== "object") {
                  return null;
                }

                const raw = item as { role?: unknown; name?: unknown };
                const role = isCharacterRole(raw.role) ? raw.role : characters[index]?.role ?? defaultRoleForReader(index, targetReader);
                const name = String(raw.name ?? "").trim();

                return name ? { role, name } : null;
              })
              .filter((item: CharacterNameSuggestion | null): item is CharacterNameSuggestion => Boolean(item))
          : [];
        const fallbackSuggestions = names.map((item, index) => ({
          role: characters[index]?.role ?? defaultRoleForReader(index, targetReader),
          name: item
        }));
        const suggestions = (suggestedCharacters.length > 0 ? suggestedCharacters : fallbackSuggestions).slice(0, maxProjectCharacters);

        setProtagonistSuggestions(suggestions);
        if (suggestions.length > 0) {
          setCharacters((current) => {
            const next = current.length > 0 ? [...current] : defaultCharacters(targetReader);

            next.forEach((character, index) => {
              const item = suggestions[index];

              if (!item) {
                return;
              }

              const cleanName = item.name.slice(0, 12);

              if (!cleanName) {
                return;
              }

              next[index] = {
                ...character,
                role: item.role || character.role,
                name: cleanName
              };
            });

            return next.slice(0, maxProjectCharacters);
          });
        }
      }

      if (action === "description") {
        const nextDescription = String(result.description ?? "").trim();

        if (nextDescription) {
          setDescription(nextDescription.slice(0, 500));
        }
      }

      if (action === "titleConcept") {
        const nextTitleConcept = String(result.titleConcept ?? "").trim();

        if (nextTitleConcept) {
          setTitleConcept(nextTitleConcept.slice(0, 500));
          setTitleAssistError("");
        } else {
          setTitleAssistError("AI 没有整理出可用的起名方向，请先补一点主角处境、目标或读者期待。");
        }
      }

      if (action === "storyDesign") {
        const nextStoryDesign = normalizeStoryDesign(
          result.storyDesign,
          storyDesignReaderMode === "女频" ? "女频" : "男频"
        );

        if (!nextStoryDesign) {
          setStoryDesignError("AI 没有生成可用的新书整体设计，请补充一点主角处境、冲突或题材方向后重试。");
          return;
        }

        setStoryDesign(nextStoryDesign);
        setTitleSuggestionBatch({
          contextKey: titleSuggestionContextKey,
          titles: nextStoryDesign.titleOptions
        });
        applyStoryDesign(nextStoryDesign);
      }
    } catch (assistError) {
      const message = assistError instanceof Error ? assistError.message : "AI 辅助生成失败";

      if (action === "titles" || action === "titleConcept") {
        setTitleAssistError(message);
      } else if (action === "storyDesign") {
        setStoryDesignError(message);
      } else {
        setAssistError(message);
      }
    } finally {
      setAssistLoading("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const protagonistCharacters = getFilledCharacters();
    const protagonistNames = protagonistCharacters.map((character) => character.name);
    const normalizedTargetTotalWords = Number(normalizeTargetTotalWords(targetTotalWords)) * 10000;

    if (!genre) {
      setError("请先在第二步选择主分类");
      setIsSubmitting(false);
      return;
    }

    if (tagTaxonomyStyle === "qidian" && selectedTags.length === 0) {
      setError("请先在第二步选择起点子类");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: asText(formData.get("name")),
          authorName: asText(formData.get("authorName")),
          type: "writing",
          genre,
          description: asText(formData.get("description")),
          coverImageUrl,
          targetReader,
          tagTaxonomyStyle,
          tags: selectedTags,
          protagonistNames,
          protagonistCharacters,
          workLengthType,
          targetTotalWords: normalizedTargetTotalWords,
          coreSellingPoint: asText(formData.get("coreSellingPoint")),
          openingHook: asText(formData.get("openingHook")),
          goldenFinger: asText(formData.get("goldenFinger")),
          writingGoal: storyDesign
            ? [storyDesign.logline, storyDesign.coreConflict, storyDesign.mainLoop].filter(Boolean).join("\n")
            : "",
          outlineLogline: storyDesign?.logline ?? "",
          worldSetting: storyDesign?.worldSetting ?? "",
          outlineChapters: storyDesign?.first10Chapters ?? [],
          foreshadowingPlan: storyDesign?.foreshadowing ?? [],
          pleasureDistribution: storyDesign?.pleasurePoints.join("\n") ?? "",
          relatedInspirationIds: storyInspirations.map((inspiration) => inspiration.id),
          autoGenerateLongFormPlan
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "创建作品失败");
      }

      const projectId = payload?.project?.id;

      if (!projectId) {
        throw new Error("创建成功但未返回项目 ID");
      }

      window.localStorage.removeItem(draftStorageKey);
      router.push(
        payload?.longFormPlanJob
          ? `/projects/${projectId}/state#long-form-plan`
          : `/projects/${projectId}/writing`
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "创建作品失败");
      setIsSubmitting(false);
    }
  }

  const tagDialog = isTagDialogOpen ? (
    <div className="tag-dialog-backdrop" role="presentation" onMouseDown={() => setIsTagDialogOpen(false)}>
      <div
        className="tag-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tag-dialog-head">
          <h3 id="tag-dialog-title">作品标签</h3>
          <button className="tag-dialog-close" type="button" onClick={() => setIsTagDialogOpen(false)} aria-label="关闭作品标签">
            ×
          </button>
        </div>

        <div className="tag-dialog-body">
          <nav className="tag-dialog-tabs" aria-label="标签类型">
            {tagSections.map((section) => (
              <button
                key={section.key}
                className={activeTagSection === section.key ? "active" : ""}
                type="button"
                onClick={() => setActiveTagSection(section.key)}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="tag-dialog-options">
            {activeTagSection === "mainCategories" && tagTaxonomyStyle === "fanqie" ? taxonomy.mainCategories.map((category) => (
              <button
                key={category.name}
                className={`taxonomy-card taxonomy-card-main ${genre === category.name ? "selected" : ""}`}
                type="button"
                onClick={() => updateGenre(category.name)}
              >
                <span className="taxonomy-card-icon" aria-hidden="true">{category.name.slice(0, 1)}</span>
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.description}</small>
                </span>
              </button>
            )) : null}

            {activeTagSection === "mainCategories" && tagTaxonomyStyle === "qidian" ? qidianTaxonomy.map((category) => (
              <button
                key={category.name}
                className={`taxonomy-card taxonomy-card-main ${genre === category.name ? "selected" : ""}`}
                type="button"
                onClick={() => updateGenre(category.name)}
              >
                <span className="taxonomy-card-icon" aria-hidden="true">{category.name.slice(0, 1)}</span>
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.description}</small>
                </span>
              </button>
            )) : null}

            {activeTagSection === "themes" && tagTaxonomyStyle === "fanqie" ? taxonomy.themes.map((tag) => (
              <button
                key={tag}
                className={`taxonomy-card compact ${selectedTagSet.has(tag) ? "selected" : ""}`}
                type="button"
                disabled={!selectedTagSet.has(tag) && selectedThemeCount >= maxSelectedTagsPerGroup}
                onClick={() => toggleTag(tag)}
              >
                <span className="taxonomy-card-icon" aria-hidden="true">{tag.slice(0, 1)}</span>
                <strong>{tag}</strong>
              </button>
            )) : null}

            {activeTagSection === "roles" && tagTaxonomyStyle === "fanqie" ? taxonomy.roles.map((tag) => (
              <button
                key={tag}
                className={`taxonomy-card compact ${selectedTagSet.has(tag) ? "selected" : ""}`}
                type="button"
                disabled={!selectedTagSet.has(tag) && selectedRoleCount >= maxSelectedTagsPerGroup}
                onClick={() => toggleTag(tag)}
              >
                <span className="taxonomy-card-icon alt" aria-hidden="true">{tag.slice(0, 1)}</span>
                <strong>{tag}</strong>
              </button>
            )) : null}

            {activeTagSection === "subCategories" && tagTaxonomyStyle === "qidian" ? (
              currentSubCategories.length > 0 ? currentSubCategories.map((tag) => (
                <button
                  key={tag}
                  className={`taxonomy-card compact ${selectedTagSet.has(tag) ? "selected" : ""}`}
                  type="button"
                  onClick={() => toggleTag(tag)}
                >
                  <span className="taxonomy-card-icon alt" aria-hidden="true">{tag.slice(0, 1)}</span>
                  <strong>{tag}</strong>
                </button>
              )) : (
                <div className="taxonomy-empty">
                  <strong>先选择主分类</strong>
                  <span>起点体系需要先选玄幻、奇幻、都市等大类，再选择对应子类。</span>
                </div>
              )
            ) : null}
          </div>
        </div>

        <div className="tag-dialog-foot">
          <span>
            {tagTaxonomyStyle === "qidian"
              ? "起点体系：主分类只能选一个，子类最多选一个"
              : "番茄体系：主分类必选且只能选一个，主题最多可选 2 个，角色最多可选 2 个"}
          </span>
          <div className="hero-actions">
            <button className="button" type="button" onClick={() => setIsTagDialogOpen(false)}>
              取消
            </button>
            <button className="button primary create-work-button" type="button" onClick={() => setIsTagDialogOpen(false)}>
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const inspirationPickerDialog = isInspirationPickerOpen ? (
    <div className="tag-dialog-backdrop" role="presentation" onMouseDown={() => setIsInspirationPickerOpen(false)}>
      <div
        className="tag-dialog inspiration-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspiration-picker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tag-dialog-head">
          <h3 id="inspiration-picker-title">选择灵感</h3>
          <button
            className="tag-dialog-close"
            type="button"
            onClick={() => setIsInspirationPickerOpen(false)}
            aria-label="关闭灵感选择"
          >
            ×
          </button>
        </div>

        <div className="inspiration-picker-body">
          <div className="inspiration-picker-toolbar">
            <input
              value={inspirationSearch}
              onChange={(event) => setInspirationSearch(event.target.value)}
              placeholder="搜索标题、内容、标签"
              aria-label="搜索灵感"
            />
            <select
              value={inspirationTypeFilter}
              onChange={(event) => setInspirationTypeFilter(event.target.value as InspirationType | "")}
              aria-label="按灵感类型筛选"
            >
              {storyInspirationTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {inspirationPickerError ? <div className="taxonomy-empty">{inspirationPickerError}</div> : null}

          <div className="inspiration-picker-list">
            {isLoadingInspirations ? (
              <div className="taxonomy-empty">
                <strong>正在读取灵感</strong>
                <span>稍等一下，正在从灵感中心取素材。</span>
              </div>
            ) : filteredInspirations.length > 0 ? (
              filteredInspirations.map((inspiration) => {
                const isSelected = selectedStoryInspirationIdSet.has(inspiration.id);

                return (
                  <button
                    key={inspiration.id}
                    className={`inspiration-picker-item ${isSelected ? "selected" : ""}`}
                    type="button"
                    onClick={() => toggleStoryInspiration(inspiration)}
                    aria-pressed={isSelected}
                  >
                    <span className="inspiration-picker-item-head">
                      <strong>{inspiration.title}</strong>
                      <span>
                        {inspirationTypeLabel(inspiration.type)} · {inspirationStatusLabel(inspiration.status)}
                      </span>
                    </span>
                    <span className="inspiration-picker-state">
                      {isSelected ? "已选择，点击取消" : "点击选择"}
                    </span>
                    <span className="inspiration-picker-content">{inspiration.content}</span>
                    {inspiration.tags.length > 0 ? (
                      <span className="inspiration-picker-tags">
                        {inspiration.tags.slice(0, 4).map((tag) => (
                          <em key={tag}>{tag}</em>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="taxonomy-empty">
                <strong>没有匹配的灵感</strong>
                <span>可以换个关键词，或先去灵感中心记录一条新构思。</span>
              </div>
            )}
          </div>
        </div>

        <div className="tag-dialog-foot">
          <span>已选择 {storyInspirations.length} 条灵感，创建作品后会关联到新项目。</span>
          <div className="hero-actions">
            <button className="button primary create-work-button" type="button" onClick={() => setIsInspirationPickerOpen(false)}>
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
    <form ref={formRef} className="book-create-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <aside className="book-create-preview">
        <div className={`book-cover ${coverImageUrl ? "has-custom-cover" : ""}`}>
          {coverImageUrl ? (
            <img
              className="book-cover-image"
              src={coverImageUrl}
              alt="自定义封面预览"
              onError={() => setCoverPreviewError("封面图片加载失败，请重新生成或重新上传")}
            />
          ) : (
            <>
              <div className="book-cover-title">{coverTitle}</div>
              <div className="book-cover-author">{coverAuthor}</div>
            </>
          )}
        </div>
        <div className="cover-upload-actions">
          <label className="button cover-upload-button">
            上传封面
            <input type="file" accept="image/*" onChange={handleCoverUpload} />
          </label>
          <button className="button" type="button" onClick={() => setIsAiCoverDialogOpen(true)}>
            AI 生成封面
          </button>
          {coverImageUrl ? (
            <button className="button" type="button" onClick={clearCoverImage}>
              恢复默认
            </button>
          ) : null}
        </div>
        <div className="book-cover-note">
          <strong>封面会同步保存</strong>
          <span>上传后会写入项目封面；未上传时会用书名和作者名生成临时封面。</span>
        </div>
        {coverPreviewError ? <div className="field-hint project-cover-error">{coverPreviewError}</div> : null}
        <div className="tag-row">
          {selectedTagText ? <span className="chip">{selectedTagText}</span> : <span className="chip">未选择标签</span>}
        </div>
      </aside>

      <AiCoverGeneratorDialog
        open={isAiCoverDialogOpen}
        title={name}
        authorName={authorName}
        onClose={() => setIsAiCoverDialogOpen(false)}
        onGenerated={(nextCoverImageUrl) => {
          setCoverImageUrl(nextCoverImageUrl);
          setCoverPreviewError("");
        }}
      />

      <div className="book-create-main">
        <div className="book-create-section" id="book-step-identity">
          <div className="section-head compact">
            <div>
              <div className="mini-label">第一步</div>
              <h3>作品身份</h3>
            </div>
            <span className="chip">创作项目</span>
          </div>

          <div className="story-design-card">
            <div className="story-design-head">
              <div>
                <div className="mini-label">新书整体设计</div>
                <strong>先把粗略想法变成可开书方案</strong>
                <p>输入一句方向、几个设定点或一段脑洞，AI 会整理出书名、简介、核心冲突、金手指、主循环和前 10 章推进。</p>
              </div>
              <div className="story-design-actions">
                <button className="button story-design-button" type="button" onClick={openInspirationPicker}>
                  选择灵感
                </button>
                <button
                  className="button primary story-design-button"
                  type="button"
                  onClick={() => runAssist("storyDesign")}
                  disabled={Boolean(assistLoading)}
                >
                  {assistLoading === "storyDesign" ? "设计中..." : "AI 设计新书"}
                </button>
              </div>
            </div>
            <textarea
              value={storyIdea}
              onChange={(event) => {
                setStoryIdea(event.target.value);
                if (storyDesignError) {
                  setStoryDesignError("");
                }
              }}
              placeholder="例如：想写一个末世直播文，主角不是战斗型，而是靠规则解读和信息差带队活下去；希望有强反转、群像，但金手指不能太无敌。"
              maxLength={maxStoryIdeaLength}
            />
            <div className="story-design-reader-row">
              <span>设计频道</span>
              <div className="story-design-reader-options">
                {storyDesignReaderModes.map((mode) => (
                  <label key={mode.value}>
                    <input
                      type="radio"
                      name="storyDesignReaderMode"
                      value={mode.value}
                      checked={storyDesignReaderMode === mode.value}
                      onChange={() => updateStoryDesignReaderMode(mode.value)}
                    />
                    <span>{mode.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {storyInspirations.length > 0 ? (
              <div className="story-inspiration-picked" aria-label="已选择的灵感">
                {storyInspirations.map((inspiration) => (
                  <details className="story-inspiration-chip" key={inspiration.id}>
                    <summary>
                      <span>
                        <strong>{inspiration.title}</strong>
                        <small>
                          {inspirationTypeLabel(inspiration.type)} · {inspirationStatusLabel(inspiration.status)}
                        </small>
                      </span>
                    </summary>
                    <p>{inspiration.content}</p>
                    {inspiration.tags.length > 0 ? (
                      <div className="story-inspiration-chip-tags">
                        {inspiration.tags.map((tag) => (
                          <em key={tag}>{tag}</em>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeStoryInspiration(inspiration.id)}
                      aria-label={`取消关联灵感：${inspiration.title}`}
                      title="取消关联"
                    >
                      ×
                    </button>
                  </details>
                ))}
              </div>
            ) : null}
            <div className="field-hint">{storyIdea.length}/{maxStoryIdeaLength}</div>
            {storyDesignError ? <div className="field-hint story-design-error">{storyDesignError}</div> : null}

            {storyDesign ? (
              <div className="story-design-result">
                <div className="story-design-result-head">
                  <strong>{storyDesign.logline || "新书方案已生成"}</strong>
                  <button className="mini-action-button" type="button" onClick={() => applyStoryDesign(storyDesign)}>
                    采用到表单
                  </button>
                </div>
                <div className="story-design-grid">
                  <div>
                    <span>核心冲突</span>
                    <p>{storyDesign.coreConflict || "暂未生成"}</p>
                  </div>
                  <div>
                    <span>金手指 / 机制</span>
                    <p>{storyDesign.goldenFinger || "暂未生成"}</p>
                  </div>
                  <div>
                    <span>主角模型</span>
                    <p>{storyDesign.protagonistDesign || "暂未生成"}</p>
                  </div>
                  <div>
                    <span>主循环</span>
                    <p>{storyDesign.mainLoop || "暂未生成"}</p>
                  </div>
                </div>
                {storyDesign.titleOptions.length > 0 ? (
                  <div className="assist-suggestion-list">
                    {storyDesign.titleOptions.map((title) => (
                      <button
                        key={title}
                        className="assist-suggestion"
                        type="button"
                        onClick={() => setName(title.slice(0, 60))}
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                ) : null}
                {storyDesign.first10Chapters.length > 0 ? (
                  <details className="story-design-details">
                    <summary>前 10 章推进</summary>
                    <ol>
                      {storyDesign.first10Chapters.map((chapter, index) => (
                        <li key={`${chapter}-${index}`}>{chapter}</li>
                      ))}
                    </ol>
                  </details>
                ) : null}
                {storyDesign.pleasurePoints.length > 0 || storyDesign.foreshadowing.length > 0 || storyDesign.risksToAvoid.length > 0 ? (
                  <div className="story-design-long-lists">
                    {storyDesign.pleasurePoints.length > 0 ? (
                      <details className="story-design-details">
                        <summary>爽点设计</summary>
                        <ul>
                          {storyDesign.pleasurePoints.map((item, index) => (
                            <li key={`pleasure-${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {storyDesign.foreshadowing.length > 0 ? (
                      <details className="story-design-details">
                        <summary>伏笔安排</summary>
                        <ul>
                          {storyDesign.foreshadowing.map((item, index) => (
                            <li key={`foreshadowing-${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {storyDesign.risksToAvoid.length > 0 ? (
                      <details className="story-design-details">
                        <summary>避坑清单</summary>
                        <ul>
                          {storyDesign.risksToAvoid.map((item, index) => (
                            <li key={`risk-${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="field">
            <div className="field-label field-label-row">
              <span>AI 起名前先填这里</span>
              <button
                className="mini-action-button"
                type="button"
                onClick={() => runAssist("titleConcept")}
                disabled={Boolean(assistLoading)}
              >
                {assistLoading === "titleConcept" ? "润色中..." : "AI 润色方向"}
              </button>
            </div>
            <textarea
              value={titleConcept}
              onChange={(event) => setTitleConcept(event.target.value)}
              placeholder="写给 AI 起名用，可以像备忘一样写：主角一开始是什么身份或处境，后面想走到什么位置；读者最期待主角靠什么反击、拿回什么；整体想要什么气质，尽量避开什么联想。"
              maxLength={500}
            />
            <div className="field-hint">
              这是 AI 起名的主要依据；“AI 润色方向”会整理你在上面写的粗略想法，让它更适合拿去起名，不会直接生成书名。{titleConcept.length}/500
            </div>
          </div>

          <div className="field">
            <div className="field-label field-label-row">
              <span>书本名称</span>
              <button
                className="mini-action-button"
                type="button"
                onClick={() => runAssist("titles")}
                disabled={Boolean(assistLoading)}
              >
                {assistLoading === "titles" ? "生成中..." : titleConcept.trim() ? "AI 按方向起名" : "AI 起名"}
              </button>
            </div>
            <div className="title-style-picker" aria-label="AI 起名风格">
              <label>
                <input
                  type="radio"
                  name="titleNamingStyle"
                  value="fanqie"
                  checked={titleNamingStyle === "fanqie"}
                  onChange={() => setTitleNamingStyle("fanqie")}
                />
                <span>
                  <strong>番茄小说风格</strong>
                  <small>适中长标题，强反差，直接抛爽点</small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="titleNamingStyle"
                  value="qidian"
                  checked={titleNamingStyle === "qidian"}
                  onChange={() => setTitleNamingStyle("qidian")}
                />
                <span>
                  <strong>起点风格</strong>
                  <small>短书名，类型感，意象更传统</small>
                </span>
              </label>
            </div>
            <div className="assist-context-hint">
              AI 起名会参考：{titleNamingStyle === "qidian" ? "起点风格" : "番茄小说风格"}、起名方向素材、读者与标签；其中方向素材会直接影响书名的主体、目标和爽点。
            </div>
            {titleAssistError ? <div className="field-hint title-assist-error">{titleAssistError}</div> : null}
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="请输入作品名称，或让 AI 生成番茄风格标题"
              maxLength={60}
              required
            />
            <div className="field-hint">
              {name.length}/60
              {titleNamingStyle === "fanqie" ? " · AI 起名按番茄小说风格生成" : " · AI 起名按起点风格生成"}
            </div>
            {currentTitleSuggestions.length > 0 ? (
              <div className="assist-suggestion-list">
                {currentTitleSuggestions.map((title) => (
                  <button
                    key={title}
                    className="assist-suggestion"
                    type="button"
                    onClick={() => setName(title.slice(0, 60))}
                  >
                    {title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="field">
            <div className="field-label">作者名称</div>
            <input
              name="authorName"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="请输入笔名，用于封面预览"
              maxLength={20}
            />
            <div className="field-hint">{authorName.length}/20</div>
          </div>

          <div className="quote-box warning-box">
            这里专门创建要写的新书。只想上传原文做拆解的话，去创建拆书项目，表单会更轻。
          </div>
        </div>

        <div className="book-create-section" id="book-step-audience">
          <div className="section-head compact">
            <div>
              <div className="mini-label">第二步</div>
              <h3>读者与标签</h3>
            </div>
            <span className="muted">
              {tagTaxonomyStyle === "qidian" ? "起点：主分类必选，子类选 1 个" : "番茄：主分类必选，主题最多 2 个，角色最多 2 个"}
            </span>
          </div>

          <div className="field">
            <div className="field-label">标签体系</div>
            <div className="title-style-picker" aria-label="读者与标签体系">
              <label>
                <input
                  type="radio"
                  name="tagTaxonomyStyle"
                  value="fanqie"
                  checked={tagTaxonomyStyle === "fanqie"}
                  onChange={() => updateTagTaxonomyStyle("fanqie")}
                />
                <span>
                  <strong>番茄体系</strong>
                  <small>先选主分类，再选主题和角色标签</small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="tagTaxonomyStyle"
                  value="qidian"
                  checked={tagTaxonomyStyle === "qidian"}
                  onChange={() => updateTagTaxonomyStyle("qidian")}
                />
                <span>
                  <strong>起点体系</strong>
                  <small>先选大类，再选对应子类</small>
                </span>
              </label>
            </div>
          </div>

          <div className="split-panels">
            <div className="field">
              <div className="field-label">目标读者</div>
              <div className="segmented-row">
                {readerOptions.map((reader) => (
                  <label key={reader}>
                    <input
                      type="radio"
                      name="targetReader"
                      value={reader}
                      checked={targetReader === reader}
                      onChange={() => updateTargetReader(reader)}
                    />
                    <span>{reader}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <div className="field-label field-label-row">
                <span>主分类</span>
                <button className="mini-action-button" type="button" onClick={() => setIsTagDialogOpen(true)}>
                  更换标签
                </button>
              </div>
              <button className="category-summary-button" type="button" onClick={() => setIsTagDialogOpen(true)}>
                <span className="category-summary-icon" aria-hidden="true">{currentCategory?.name.slice(0, 1) ?? "选"}</span>
                <span>
                  <strong>{currentCategory?.name ?? "请选择主分类"}</strong>
                  <small>
                    {currentCategory?.description ??
                      (tagTaxonomyStyle === "qidian"
                        ? "起点体系不按男频女频拆分，打开作品标签后选择大类。"
                        : "主分类不默认选中，打开作品标签后从当前读者频道下选择。")}
                  </small>
                </span>
              </button>
            </div>
          </div>

          <div className="selected-tag-panel">
            <div>
              <div className="field-label">{tagTaxonomyStyle === "qidian" ? "子类" : "主题与角色"}</div>
              <div className="muted">
                {tagTaxonomyStyle === "qidian"
                  ? `子类 ${selectedSubCategory ? "1" : "0"}/1`
                  : `主题 ${selectedThemeCount}/${maxSelectedTagsPerGroup}，角色 ${selectedRoleCount}/${maxSelectedTagsPerGroup}`}
              </div>
            </div>
            <div className="selected-tag-list">
              {selectedTags.length > 0 ? selectedTags.map((tag) => (
                <button key={tag} className="selected-tag-chip" type="button" onClick={() => toggleTag(tag)}>
                  {tag}
                </button>
              )) : <span className="muted">{tagTaxonomyStyle === "qidian" ? "暂未选择子类" : "暂未选择主题或角色"}</span>}
            </div>
            <button className="button tag-dialog-trigger" type="button" onClick={() => setIsTagDialogOpen(true)}>
              打开作品标签
            </button>
          </div>

        </div>

        <div className="book-create-section" id="book-step-story">
          <div className="section-head compact">
            <div>
              <div className="mini-label">第三步</div>
              <h3>故事起点</h3>
            </div>
          </div>

          <div className="field character-builder">
            <div className="field-label field-label-row">
              <span>主要人物（可选）</span>
              <button
                className="mini-action-button"
                type="button"
                onClick={() => runAssist("protagonists")}
                disabled={Boolean(assistLoading)}
              >
                {assistLoading === "protagonists" ? "生成中..." : "AI 取名"}
              </button>
            </div>
            <div className="character-builder-hint">可先只填第一主角；男主、女主、男配、女配都可以继续添加。</div>
            <div className="character-list">
              {characters.map((character) => (
                <div className="character-row" key={character.id}>
                  <select
                    aria-label="人物身份"
                    value={character.role}
                    onChange={(event) => updateCharacter(character.id, { role: event.target.value as CharacterRole })}
                  >
                    {characterRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <input
                    value={character.name}
                    onChange={(event) => updateCharacter(character.id, { name: event.target.value })}
                    placeholder="请输入人物名"
                    maxLength={12}
                  />
                  <button
                    className="character-remove-button"
                    type="button"
                    onClick={() => removeCharacter(character.id)}
                    aria-label={`删除${character.role}${character.name ? `：${character.name}` : ""}`}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="character-add-actions" aria-label="添加人物">
              {characterRoleOptions.map((role) => (
                <button key={role} type="button" onClick={() => addCharacter(role)} disabled={characters.length >= maxProjectCharacters}>
                  + {role}
                </button>
              ))}
            </div>
          </div>
          {protagonistSuggestions.length > 0 ? (
            <div className="assist-suggestion-list compact" aria-label="AI 取名候选">
              {protagonistSuggestions.map((item) => (
                <span key={`${item.role}-${item.name}`} className="assist-suggestion" aria-disabled="true">
                  <span>{item.role}</span>
                  {item.name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="field">
            <div className="field-label">作品体量</div>
            <div className="title-style-picker work-length-picker" aria-label="作品体量">
              {workLengthOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="workLengthType"
                    value={option.value}
                    checked={workLengthType === option.value}
                    onChange={() => updateWorkLengthType(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="field-label field-label-row">
              <span>目标总字数</span>
              <span className="field-hint">创建后建议先生成长篇规划 / 总纲节奏</span>
            </div>
            <div className="target-total-words-input">
              <input
                name="targetTotalWords"
                type="number"
                min={5}
                max={500}
                value={targetTotalWords}
                onChange={(event) => setTargetTotalWords(cleanTargetTotalWordsInput(event.target.value))}
                placeholder="50"
              />
              <span>万字左右</span>
            </div>
          </div>

          <div className="split-panels">
            <div className="field">
              <div className="field-label">核心卖点(可选)</div>
              <input
                name="coreSellingPoint"
                value={coreSellingPoint}
                onChange={(event) => setCoreSellingPoint(event.target.value)}
                placeholder="例如：主角被长期低估，但能用独特规则扭转局面"
              />
            </div>
            <div className="field">
              <div className="field-label">金手指 / 关键机制(可选)</div>
              <input
                name="goldenFinger"
                value={goldenFinger}
                onChange={(event) => setGoldenFinger(event.target.value)}
                placeholder="例如：隐藏能力 / 资源渠道 / 特殊记忆 / 代价规则"
              />
            </div>
          </div>

          <div className="field">
            <div className="field-label">开局钩子(可选)</div>
            <input
              name="openingHook"
              value={openingHook}
              onChange={(event) => setOpeningHook(event.target.value)}
              placeholder="例如：主角在第一场公开危机里被迫做出反常选择"
            />
          </div>

          <div className="field">
            <div className="field-label field-label-row">
              <span>作品简介</span>
              <div className="inline-action-group">
                <button
                  className="mini-action-button"
                  type="button"
                  onClick={() => runAssist("description", { descriptionAssistMode: "generate" })}
                  disabled={Boolean(assistLoading)}
                >
                  {assistLoading === "description" ? "处理中..." : "AI 生成简介"}
                </button>
                <button
                  className="mini-action-button"
                  type="button"
                  onClick={() => runAssist("description", { descriptionAssistMode: "polish" })}
                  disabled={Boolean(assistLoading) || !description.trim()}
                  title="按当前选择的平台简介风格润色你已经写好的简介"
                >
                  AI 润色简介
                </button>
              </div>
            </div>
            <div className="title-style-picker" aria-label="AI 简介风格">
              <label>
                <input
                  type="radio"
                  name="descriptionWritingStyle"
                  value="fanqie"
                  checked={descriptionWritingStyle === "fanqie"}
                  onChange={() => setDescriptionWritingStyle("fanqie")}
                />
                <span>
                  <strong>番茄简介</strong>
                  <small>卖点前置，冲突直给，爽点更明确</small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="descriptionWritingStyle"
                  value="qidian"
                  checked={descriptionWritingStyle === "qidian"}
                  onChange={() => setDescriptionWritingStyle("qidian")}
                />
                <span>
                  <strong>起点简介</strong>
                  <small>设定感，悬念感，语气更稳</small>
                </span>
              </label>
            </div>
            <div className="assist-context-hint">
              AI 简介会按{descriptionWritingStyle === "qidian" ? "起点简介" : "番茄简介"}生成，并参考上方题材、标签、主角、卖点、开局钩子，以及“AI 起名前先填这里”的方向素材。
            </div>
            <textarea
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="请输入 50-500 字以内的作品简介：主角是谁、遇到什么压制、靠什么反击、读者为什么继续追。"
              maxLength={500}
              required
            />
            <div className="field-hint">{description.length}/500</div>
          </div>

          <div className="long-form-create-card">
            <div>
              <div className="mini-label">建议开写前先完成</div>
              <strong>长篇规划 / 总纲节奏</strong>
              <p>
                创建作品后自动按目标字数估算章节数，并生成全书总纲节奏、成长上限、收益频率和任务卡硬规则。
                这份规划会同步到状态页，后续任务卡和正文都会读取；不合适可以在状态页重新生成。
              </p>
            </div>
            <label className="option-row compact-option-row long-form-create-toggle">
              <input
                type="checkbox"
                checked={autoGenerateLongFormPlan}
                onChange={(event) => setAutoGenerateLongFormPlan(event.target.checked)}
              />
              <span>
                <strong>创建后自动生成长篇规划</strong>
                <small>建议保持开启；关闭后也可以稍后在状态页手动生成。</small>
              </span>
            </label>
          </div>
        </div>

        {assistError ? <div className="pill danger form-error">{assistError}</div> : null}
        {error ? <div className="pill danger form-error">{error}</div> : null}

        <div className="book-create-actions">
          <Link href="/projects" className="button">
            取消
          </Link>
          <button className="button primary create-work-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "创建中..." : "立即创建"}
          </button>
        </div>
      </div>

      <aside className="book-create-side">
        <nav className="book-step-nav book-step-nav-vertical" aria-label="新书创建步骤">
          {creationSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              className={activeStep === step.id ? "active" : ""}
              aria-current={activeStep === step.id ? "step" : undefined}
              onClick={() => scrollToStep(step.id)}
            >
              <span>{step.index}</span>
              <strong>{step.label}</strong>
            </button>
          ))}
        </nav>
      </aside>
    </form>
    {isMounted && tagDialog ? createPortal(tagDialog, document.body) : null}
    {isMounted && inspirationPickerDialog ? createPortal(inspirationPickerDialog, document.body) : null}
    </>
  );
}
