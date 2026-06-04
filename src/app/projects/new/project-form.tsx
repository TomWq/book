"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AiCoverGeneratorDialog } from "@/components/ai-cover-generator-dialog";
import { novelTaxonomy, qidianTaxonomyByReader, readerOptions, type TargetReader } from "@/lib/novel-taxonomy";

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
const draftStorageKey = "ai-novel-workbench:new-writing-project-draft:v1";

type TitleNamingStyle = "fanqie" | "qidian";
type TagTaxonomyStyle = "fanqie" | "qidian";
type DescriptionWritingStyle = "fanqie" | "qidian";
type CreationStepId = (typeof creationSteps)[number]["id"];
type TagSectionKey = (typeof fanqieTagSections)[number]["key"] | (typeof qidianTagSections)[number]["key"];
type WorkLengthType = "short" | "medium" | "long" | "epic";
const characterRoleOptions = ["男主", "女主", "男配", "女配"] as const;
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

type ProjectFormDraft = {
  name: string;
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

function defaultCharacters(): CharacterDraft[] {
  return [
    { id: "lead-male", role: "男主", name: "" },
    { id: "lead-female", role: "女主", name: "" }
  ];
}

const defaultDraft: ProjectFormDraft = {
  name: "",
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

function stringValue(value: unknown, maxLength = 1000) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
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

function normalizeCharacters(rawCharacters: unknown, legacyNames: string[]): CharacterDraft[] {
  if (Array.isArray(rawCharacters)) {
    const characters = rawCharacters
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const raw = item as Partial<Record<keyof CharacterDraft, unknown>>;
        const role = isCharacterRole(raw.role) ? raw.role : index === 1 ? "女主" : "男主";

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
            role: index === 1 ? "女主" : "男主",
            name: name.slice(0, 12)
          }
        : null
    )
    .filter((item): item is CharacterDraft => Boolean(item));

  return legacyCharacters.length > 0 ? legacyCharacters : defaultCharacters();
}

function normalizeDraft(value: unknown): ProjectFormDraft {
  if (!value || typeof value !== "object") {
    return defaultDraft;
  }

  const raw = value as Partial<Record<keyof ProjectFormDraft, unknown>>;
  const legacyProtagonists = [stringValue(raw.protagonist1, 12), stringValue(raw.protagonist2, 12)];

  return {
    name: stringValue(raw.name, 60),
    titleConcept: stringValue(raw.titleConcept, 240),
    authorName: stringValue(raw.authorName, 20),
    coverImageUrl: stringValue(raw.coverImageUrl, 1_200_000),
    titleNamingStyle: isTitleNamingStyle(raw.titleNamingStyle) ? raw.titleNamingStyle : defaultDraft.titleNamingStyle,
    tagTaxonomyStyle: isTagTaxonomyStyle(raw.tagTaxonomyStyle) ? raw.tagTaxonomyStyle : defaultDraft.tagTaxonomyStyle,
    descriptionWritingStyle: isDescriptionWritingStyle(raw.descriptionWritingStyle)
      ? raw.descriptionWritingStyle
      : defaultDraft.descriptionWritingStyle,
    description: stringValue(raw.description, 500),
    characters: normalizeCharacters(raw.characters, legacyProtagonists),
    protagonist1: legacyProtagonists[0],
    protagonist2: legacyProtagonists[1],
    targetReader: isTargetReader(raw.targetReader) ? raw.targetReader : defaultDraft.targetReader,
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
  const [assistLoading, setAssistLoading] = useState<"" | "titles" | "protagonists" | "description">("");
  const [error, setError] = useState("");
  const [assistError, setAssistError] = useState("");
  const [name, setName] = useState("");
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
  const [isAiCoverDialogOpen, setIsAiCoverDialogOpen] = useState(false);
  const [coverPreviewError, setCoverPreviewError] = useState("");
  const [activeTagSection, setActiveTagSection] = useState<TagSectionKey>("mainCategories");
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isTagDialogOpen) {
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
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isTagDialogOpen]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftStorageKey);

      if (stored) {
        const draft = normalizeDraft(JSON.parse(stored));

        setName(draft.name);
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

    setTargetReader(nextReader);
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

  function getCurrentContext() {
    return {
      name,
      genre,
      targetReader,
      titleNamingStyle,
      tagTaxonomyStyle,
      descriptionWritingStyle,
      titleConcept,
      avoidTitles: titleSuggestions,
      tags: selectedTags,
      protagonistNames: getFilledCharacters().map((character) => character.name),
      protagonistCharacters: characters.map((character) => ({
        role: character.role,
        name: character.name.trim()
      })),
      coreSellingPoint,
      goldenFinger,
      openingHook,
      description,
      workLengthType,
      targetTotalWords
    };
  }

  async function runAssist(action: "titles" | "protagonists" | "description") {
    setAssistLoading(action);
    setAssistError("");

    try {
      const response = await fetch("/api/projects/new/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          ...getCurrentContext()
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

        setTitleSuggestions(titles);
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
                const role = isCharacterRole(raw.role) ? raw.role : characters[index]?.role ?? (index === 1 ? "女主" : "男主");
                const name = String(raw.name ?? "").trim();

                return name ? { role, name } : null;
              })
              .filter((item: CharacterNameSuggestion | null): item is CharacterNameSuggestion => Boolean(item))
          : [];
        const fallbackSuggestions = names.map((item, index) => ({
          role: characters[index]?.role ?? (index === 1 ? "女主" : "男主"),
          name: item
        }));
        const suggestions = (suggestedCharacters.length > 0 ? suggestedCharacters : fallbackSuggestions).slice(0, maxProjectCharacters);

        setProtagonistSuggestions(suggestions);
        if (suggestions.length > 0) {
          setCharacters((current) => {
            const next = current.length > 0 ? [...current] : defaultCharacters();

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
    } catch (assistError) {
      setAssistError(assistError instanceof Error ? assistError.message : "AI 辅助生成失败");
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

          <div className="field">
            <div className="field-label">起名构思（可选）</div>
            <textarea
              value={titleConcept}
              onChange={(event) => setTitleConcept(event.target.value)}
              placeholder="可先不填；如果暂时想不出书名，就写题材、主角处境、核心冲突和爽点关键词，让 AI 据此起名"
              maxLength={240}
            />
            <div className="field-hint">可选，留空也能直接让 AI 按当前题材起名。{titleConcept.length}/240</div>
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
                {assistLoading === "titles" ? "生成中..." : titleConcept.trim() ? "AI 按构思起名" : "AI 起名"}
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
              AI 起名会参考：{titleNamingStyle === "qidian" ? "起点风格" : "番茄小说风格"}、起名构思、读者与标签里的内容，所以调整下方信息会影响起名结果。
            </div>
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
              {titleNamingStyle === "fanqie" ? " · AI 起名建议 8-24 字" : " · AI 起名建议 2-12 字"}
            </div>
            {titleSuggestions.length > 0 ? (
              <div className="assist-suggestion-list">
                {titleSuggestions.map((title) => (
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
            <div className="character-builder-hint">可先只填男主；多女主、男配、女配都可以继续添加。</div>
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
                placeholder="例如：被误判的废柴，用系统反打所有人"
              />
            </div>
            <div className="field">
              <div className="field-label">金手指 / 关键机制(可选)</div>
              <input
                name="goldenFinger"
                value={goldenFinger}
                onChange={(event) => setGoldenFinger(event.target.value)}
                placeholder="例如：情绪值系统 / 旧神契约 / 重生记忆"
              />
            </div>
          </div>

          <div className="field">
            <div className="field-label">开局钩子(可选)</div>
            <input
              name="openingHook"
              value={openingHook}
              onChange={(event) => setOpeningHook(event.target.value)}
              placeholder="例如：退婚当天，主角觉醒隐藏身份，但必须先装废物"
            />
          </div>

          <div className="field">
            <div className="field-label field-label-row">
              <span>作品简介</span>
              <button
                className="mini-action-button"
                type="button"
                onClick={() => runAssist("description")}
                disabled={Boolean(assistLoading)}
              >
                {assistLoading === "description"
                  ? "润色中..."
                  : description.trim()
                    ? "AI 润色扩写"
                    : "AI 生成简介"}
              </button>
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
              AI 简介会按{descriptionWritingStyle === "qidian" ? "起点简介" : "番茄简介"}生成，并参考上方题材、标签、主角、卖点和开局钩子。
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
    </>
  );
}
