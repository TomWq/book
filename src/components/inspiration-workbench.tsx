"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ActionLoadingOverlay } from "@/components/api-form";
import { useConfirmDialog } from "@/components/confirm-dialog-provider";
import { CustomSelect, type SelectOption } from "@/components/custom-select";
import type {
  InspirationAiOutput,
  InspirationPolishMode,
  InspirationStatus,
  InspirationTransformDraft,
  InspirationTransformTarget,
  InspirationType,
  StoredInspiration,
  StoredProject
} from "@/lib/project-types";

type InspirationDraft = {
  title: string;
  content: string;
  type: InspirationType;
  tags: string;
  status: InspirationStatus;
  projectId: string;
  linkedEntityType: NonNullable<StoredInspiration["linkedEntityType"]> | "";
  linkedEntityId: string;
};

const typeOptions: Array<{ value: InspirationType; label: string }> = [
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

const statusOptions: Array<{ value: InspirationStatus; label: string }> = [
  { value: "raw", label: "原始" },
  { value: "polished", label: "已润色" },
  { value: "used", label: "已使用" },
  { value: "archived", label: "已归档" }
];

const polishModes: Array<{ value: InspirationPolishMode; label: string; hint: string }> = [
  { value: "polish", label: "润色表达", hint: "保留原意，写得更顺" },
  { value: "expand_setting", label: "扩写设定", hint: "把一句想法变成完整设定" },
  { value: "web_novelize", label: "网文化", hint: "强化冲突和钩子" },
  { value: "selling_point", label: "提炼卖点", hint: "一句话看懂值不值得写" },
  { value: "pleasure_analysis", label: "分析爽点", hint: "压制、释放、有效原因" },
  { value: "variants", label: "生成变体", hint: "给出多个可选方向" },
  { value: "task_card", label: "生成章节任务", hint: "转成任务卡草稿" },
  { value: "character_draft", label: "转人物草稿", hint: "补齐目标、秘密和信息边界" },
  { value: "foreshadowing_draft", label: "转伏笔草稿", hint: "补齐埋设、回收和隐藏信息" }
];

const transformTargetOptions: Array<SelectOption<InspirationTransformTarget>> = [
  { value: "task_card", label: "章节任务卡", hint: "情节、爽点、台词最适合先变成可写的一章" },
  { value: "character", label: "人物档案", hint: "补齐目标、秘密、关系和信息边界" },
  { value: "foreshadowing", label: "伏笔条目", hint: "沉淀埋设章节、回收方式和隐藏信息" },
  { value: "bible", label: "创作圣经", hint: "把稳定规则写入项目底层设定" },
  { value: "worldbuilding", label: "世界观设定", hint: "补充世界规则、限制和可延展冲突" },
  { value: "short_outline", label: "短大纲", hint: "把故事构思变成前几章推进和节奏安排" },
  { value: "variants", label: "桥段变体", hint: "生成多个方向，方便挑一个最顺主线的版本" }
];

const transformRecommendations: Record<InspirationType, InspirationTransformTarget[]> = {
  plot: ["task_card", "short_outline", "variants"],
  character: ["character", "task_card", "variants"],
  worldbuilding: ["worldbuilding", "bible", "short_outline"],
  pleasure_point: ["task_card", "variants", "bible"],
  foreshadowing: ["foreshadowing", "task_card", "short_outline"],
  setting: ["bible", "worldbuilding", "variants"],
  line: ["task_card", "variants", "character"],
  topic: ["short_outline", "variants", "bible"],
  title: ["short_outline", "variants", "bible"],
  other: ["task_card", "variants", "bible"]
};

const typeFilterOptions: Array<SelectOption<InspirationType | "">> = [
  { value: "", label: "全部类型" },
  ...typeOptions
];

const statusFilterOptions: Array<SelectOption<InspirationStatus | "">> = [
  { value: "", label: "全部状态" },
  ...statusOptions
];

const linkedEntityOptions: Array<SelectOption<InspirationDraft["linkedEntityType"]>> = [
  { value: "", label: "暂不关联" },
  { value: "project", label: "项目" },
  { value: "character", label: "人物" },
  { value: "foreshadowing", label: "伏笔" },
  { value: "chapter", label: "章节" },
  { value: "task_card", label: "任务卡" },
  { value: "outline", label: "卷纲 / 大纲" },
  { value: "bible", label: "创作圣经" }
];

const inspirationPageSize = 8;

function emptyDraft(): InspirationDraft {
  return {
    title: "",
    content: "",
    type: "other",
    tags: "",
    status: "raw",
    projectId: "",
    linkedEntityType: "",
    linkedEntityId: ""
  };
}

function toDraft(inspiration?: StoredInspiration | null): InspirationDraft {
  if (!inspiration) {
    return emptyDraft();
  }

  return {
    title: inspiration.title,
    content: inspiration.content,
    type: inspiration.type,
    tags: inspiration.tags.join("，"),
    status: inspiration.status,
    projectId: inspiration.projectId ?? "",
    linkedEntityType: inspiration.linkedEntityType ?? "",
    linkedEntityId: inspiration.linkedEntityId ?? ""
  };
}

function parseTags(value: string) {
  return value
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusLabel(value: InspirationStatus) {
  return statusOptions.find((option) => option.value === value)?.label ?? value;
}

function typeLabel(value: InspirationType) {
  return typeOptions.find((option) => option.value === value)?.label ?? value;
}

function modeHint(value: InspirationPolishMode) {
  return polishModes.find((mode) => mode.value === value)?.hint ?? "";
}

function transformTargetLabel(value: InspirationTransformTarget) {
  return transformTargetOptions.find((option) => option.value === value)?.label ?? value;
}

function transformTargetHint(value: InspirationTransformTarget) {
  return transformTargetOptions.find((option) => option.value === value)?.hint ?? "";
}

function recommendedTransformTargets(type: InspirationType) {
  return transformRecommendations[type] ?? transformRecommendations.other;
}

function entityLabel(value?: StoredInspiration["linkedEntityType"]) {
  switch (value) {
    case "character":
      return "人物档案";
    case "foreshadowing":
      return "伏笔条目";
    case "task_card":
      return "章节任务卡";
    case "outline":
      return "短大纲";
    case "bible":
      return "创作圣经";
    case "chapter":
      return "章节";
    case "project":
      return "项目";
    default:
      return "";
  }
}

function entityHref(inspiration: StoredInspiration) {
  if (!inspiration.projectId || !inspiration.linkedEntityType) {
    return "";
  }

  if (inspiration.linkedEntityType === "task_card" || inspiration.linkedEntityType === "chapter") {
    return `/projects/${inspiration.projectId}/writing`;
  }

  if (inspiration.linkedEntityType === "character" || inspiration.linkedEntityType === "foreshadowing" || inspiration.linkedEntityType === "bible" || inspiration.linkedEntityType === "outline") {
    return `/projects/${inspiration.projectId}/state`;
  }

  return `/projects/${inspiration.projectId}`;
}

function sameText(left?: string, right?: string) {
  return String(left ?? "").trim().replace(/\s+/g, " ") === String(right ?? "").trim().replace(/\s+/g, " ");
}

function toLines(value?: string[]) {
  return (value ?? []).join("\n");
}

function fromLines(value: string) {
  return value
    .split(/\r?\n|，|、/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readErrorPayload(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error?: unknown }).error ?? "");
  }

  return "";
}

async function readResponseError(response: Response) {
  const json = await response.clone().json().catch(() => null);
  const text = await response.clone().text().catch(() => "");
  return readErrorPayload(json) || text || "操作失败";
}

export function InspirationWorkbench({
  initialInspirations,
  projects,
  initialProjectId = ""
}: {
  initialInspirations: StoredInspiration[];
  projects: StoredProject[];
  initialProjectId?: string;
}) {
  const { confirm } = useConfirmDialog();
  const [inspirations, setInspirations] = useState(initialInspirations);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<InspirationType | "">("");
  const [statusFilter, setStatusFilter] = useState<InspirationStatus | "">("");
  const [projectFilter, setProjectFilter] = useState(initialProjectId);
  const [tagFilter, setTagFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<InspirationDraft>(() => emptyDraft());
  const [newDraft, setNewDraft] = useState<InspirationDraft>(() => emptyDraft());
  const [newPreview, setNewPreview] = useState<InspirationAiOutput | null>(null);
  const [polishMode, setPolishMode] = useState<InspirationPolishMode>("polish");
  const [transformTarget, setTransformTarget] = useState<InspirationTransformTarget>("task_card");
  const [transformDraft, setTransformDraft] = useState<InspirationTransformDraft | null>(null);
  const [transformSourceId, setTransformSourceId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<{ title: string; description: string } | null>(null);
  const [listPage, setListPage] = useState(1);

  const selected = useMemo(
    () => inspirations.find((item) => item.id === selectedId) ?? null,
    [inspirations, selectedId]
  );
  const projectFilterOptions = useMemo<Array<SelectOption<string>>>(
    () => [
      { value: "", label: "全部项目" },
      ...projects.map((project) => ({ value: project.id, label: project.name }))
    ],
    [projects]
  );
  const projectLinkOptions = useMemo<Array<SelectOption<string>>>(
    () => [
      { value: "", label: "不关联项目" },
      ...projects.map((project) => ({ value: project.id, label: project.name }))
    ],
    [projects]
  );
  const polishedCount = inspirations.filter((item) => item.status === "polished").length;
  const linkedCount = inspirations.filter((item) => item.projectId).length;
  const selectedProjectName = selected?.projectId
    ? projects.find((project) => project.id === selected.projectId)?.name ?? "已关联项目"
    : "未关联项目";
  const selectedTransformTargets = useMemo(
    () => recommendedTransformTargets(selected?.type ?? draft.type),
    [draft.type, selected?.type]
  );
  const primaryTransformTarget = selectedTransformTargets[0] ?? "task_card";

  const filteredInspirations = useMemo(() => {
    const query = search.trim().toLowerCase();
    const tagQuery = tagFilter.trim().toLowerCase();

    return inspirations
      .filter((item) => {
        if (typeFilter && item.type !== typeFilter) {
          return false;
        }

        if (statusFilter && item.status !== statusFilter) {
          return false;
        }

        if (projectFilter && item.projectId !== projectFilter) {
          return false;
        }

        if (tagQuery && !item.tags.some((tag) => tag.toLowerCase().includes(tagQuery))) {
          return false;
        }

        if (query) {
          const haystack = [
            item.title,
            item.content,
            item.type,
            item.status,
            item.tags.join(" "),
            item.projectId ?? ""
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        }

        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [inspirations, projectFilter, search, statusFilter, tagFilter, typeFilter]);
  const totalListPages = Math.max(1, Math.ceil(filteredInspirations.length / inspirationPageSize));
  const currentListPage = Math.min(listPage, totalListPages);
  const paginatedInspirations = filteredInspirations.slice(
    (currentListPage - 1) * inspirationPageSize,
    currentListPage * inspirationPageSize
  );

  useEffect(() => {
    if (!selectedId) {
      setDraft(emptyDraft());
      return;
    }

    if (selected) {
      setDraft(toDraft(selected));
      return;
    }

    if (filteredInspirations.length > 0) {
      setSelectedId(filteredInspirations[0].id);
      setDraft(toDraft(filteredInspirations[0]));
    }
  }, [filteredInspirations, selected, selectedId]);

  useEffect(() => {
    setListPage(1);
  }, [projectFilter, search, statusFilter, tagFilter, typeFilter]);

  useEffect(() => {
    if (listPage > totalListPages) {
      setListPage(totalListPages);
    }
  }, [listPage, totalListPages]);

  useEffect(() => {
    setTransformDraft(null);
    setTransformSourceId("");
  }, [selectedId]);

  useEffect(() => {
    if (selected) {
      setTransformTarget(recommendedTransformTargets(selected.type)[0] ?? "task_card");
    }
  }, [selected?.id, selected?.type]);

  function upsertInspiration(next: StoredInspiration) {
    setInspirations((current) => {
      const exists = current.some((item) => item.id === next.id);
      const nextList = exists
        ? current.map((item) => (item.id === next.id ? next : item))
        : [next, ...current];
      return nextList.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
    setSelectedId(next.id);
    setDraft(toDraft(next));
    setListPage(1);
  }

  function updateNewDraft(patch: Partial<InspirationDraft>) {
    setNewPreview(null);
    setNewDraft((current) => ({ ...current, ...patch }));
  }

  async function createNewInspirationRecord() {
    if (!newDraft.content.trim()) {
      setError("请先填写灵感内容");
      return null;
    }

    const response = await fetch("/api/inspirations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newDraft.title,
        content: newDraft.content,
        type: newDraft.type,
        tags: parseTags(newDraft.tags),
        projectId: newDraft.projectId || ""
      })
    });

    if (!response.ok) {
      setError(await readResponseError(response));
      return null;
    }

    const payload = (await response.json()) as { inspiration: StoredInspiration };
    setNewDraft(emptyDraft());
    setNewPreview(null);
    upsertInspiration(payload.inspiration);
    return payload.inspiration;
  }

  async function polishInspirationById(inspirationId: string) {
    const response = await fetch(`/api/inspirations/${inspirationId}/polish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: polishMode })
    });

    if (!response.ok) {
      setError(await readResponseError(response));
      return null;
    }

    const payload = (await response.json()) as {
      inspiration: StoredInspiration;
      output: InspirationAiOutput;
    };
    upsertInspiration(payload.inspiration);
    setDraft(toDraft(payload.inspiration));
    return payload;
  }

  async function createInspiration() {
    setError("");
    setNotice("");
    setIsPending(true);
    try {
      const inspiration = await createNewInspirationRecord();
      if (!inspiration) {
        return;
      }
      setNotice("灵感已保存");
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存灵感失败");
    } finally {
      setIsPending(false);
    }
  }

  async function previewNewInspirationPolish() {
    setError("");
    setNotice("");

    if (!newDraft.content.trim()) {
      setError("请先填写灵感内容");
      return;
    }

    setIsPending(true);
    setAiLoading({
      title: "正在生成 AI 润色预览",
      description: "正在读取灵感内容并整理成可采用的版本。"
    });
    try {
      const response = await fetch("/api/inspirations/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDraft.title,
          content: newDraft.content,
          type: newDraft.type,
          tags: parseTags(newDraft.tags),
          projectId: newDraft.projectId || "",
          mode: polishMode
        })
      });

      if (!response.ok) {
        setError(await readResponseError(response));
        return;
      }

      const payload = (await response.json()) as { output: InspirationAiOutput };
      setNewPreview(payload.output);
      setNotice("AI 润色预览已生成，满意后再保存");
    } catch (error) {
      setError(error instanceof Error ? error.message : "AI 润色预览失败");
    } finally {
      setIsPending(false);
      setAiLoading(null);
    }
  }

  async function savePreviewAsInspiration() {
    setError("");
    setNotice("");

    if (!newPreview) {
      setError("请先生成 AI 润色预览");
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch("/api/inspirations/preview/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDraft.title,
          type: newDraft.type,
          tags: parseTags(newDraft.tags),
          projectId: newDraft.projectId || "",
          status: "polished",
          output: newPreview
        })
      });

      if (!response.ok) {
        setError(await readResponseError(response));
        return;
      }

      const payload = (await response.json()) as { inspiration: StoredInspiration };
      setNewDraft(emptyDraft());
      setNewPreview(null);
      upsertInspiration(payload.inspiration);
      setNotice("已采用 AI 润色结果并保存");
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存润色灵感失败");
    } finally {
      setIsPending(false);
    }
  }

  async function saveSelected() {
    if (!selected) {
      setError("请先选择一条灵感");
      return;
    }

    setError("");
    setNotice("");

    setIsPending(true);
    setAiLoading({
      title: "正在保存灵感",
      description: "正在保存标题、内容、分类和项目关联。"
    });
    try {
      const response = await fetch(`/api/inspirations/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          content: draft.content,
          type: draft.type,
          tags: parseTags(draft.tags),
          status: draft.status,
          projectId: draft.projectId || null,
          linkedEntityType: draft.linkedEntityType || null,
          linkedEntityId: draft.linkedEntityId || null
        })
      });

      if (!response.ok) {
        setError(await readResponseError(response));
        return;
      }

      const payload = (await response.json()) as { inspiration: StoredInspiration };
      upsertInspiration(payload.inspiration);
      setNotice("灵感已更新");
    } catch (error) {
      setError(error instanceof Error ? error.message : "更新灵感失败");
    } finally {
      setIsPending(false);
      setAiLoading(null);
    }
  }

  async function deleteSelected() {
    if (!selected) {
      return;
    }

    if (!(await confirm({
      title: "删除灵感",
      message: `确定删除灵感「${selected.title}」吗？`,
      confirmLabel: "确认删除",
      tone: "danger"
    }))) {
      return;
    }

    setError("");
    setNotice("");

    setIsPending(true);
    try {
      const response = await fetch(`/api/inspirations/${selected.id}`, { method: "DELETE" });

      if (!response.ok) {
        setError(await readResponseError(response));
        return;
      }

      setInspirations((current) => current.filter((item) => item.id !== selected.id));
      const next = inspirations.find((item) => item.id !== selected.id) ?? null;
      setSelectedId(next?.id ?? "");
      setDraft(toDraft(next));
      setNotice("灵感已删除");
    } catch (error) {
      setError(error instanceof Error ? error.message : "删除灵感失败");
    } finally {
      setIsPending(false);
    }
  }

  async function polishSelected() {
    if (!selected) {
      setError("请先选择一条灵感");
      return;
    }

    setError("");
    setNotice("");

    setIsPending(true);
    setAiLoading({
      title: "正在执行 AI 润色",
      description: "正在读取灵感内容和项目上下文，生成整理结果。"
    });
    try {
      const payload = await polishInspirationById(selected.id);
      if (!payload) {
        return;
      }
      setNotice(payload.output.usedAi ? "AI 润色完成" : "已使用本地整理结果");
    } catch (error) {
      setError(error instanceof Error ? error.message : "AI 润色失败");
    } finally {
      setIsPending(false);
      setAiLoading(null);
    }
  }

  async function previewTransform(nextTarget?: InspirationTransformTarget) {
    if (!selected) {
      setError("请先选择一条灵感");
      return;
    }

    if (!selected.projectId) {
      setError("一键转化前需要先关联项目");
      return;
    }

    const target = nextTarget ?? transformTarget;
    setTransformTarget(target);
    setError("");
    setNotice("");
    setIsPending(true);
    setAiLoading({
      title: "正在生成转化草稿",
      description: `正在把灵感整理成「${transformTargetLabel(target)}」草稿。`
    });
    try {
      const response = await fetch(`/api/inspirations/${selected.id}/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      });

      if (!response.ok) {
        setError(await readResponseError(response));
        return;
      }

      const payload = (await response.json()) as { draft: InspirationTransformDraft };
      setTransformDraft(payload.draft);
      setTransformSourceId(selected.id);
      setNotice("转化草稿已生成，确认前可以继续修改");
    } catch (error) {
      setError(error instanceof Error ? error.message : "生成转化草稿失败");
    } finally {
      setIsPending(false);
      setAiLoading(null);
    }
  }

  async function confirmTransform() {
    if (!selected || !transformDraft || transformSourceId !== selected.id) {
      setError("请先生成当前灵感的转化草稿");
      return;
    }

    setError("");
    setNotice("");
    setIsPending(true);
    try {
      const response = await fetch(`/api/inspirations/${selected.id}/confirm-transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: transformDraft })
      });

      if (!response.ok) {
        setError(await readResponseError(response));
        return;
      }

      const payload = (await response.json()) as { inspiration: StoredInspiration };
      upsertInspiration(payload.inspiration);
      setTransformDraft(null);
      setTransformSourceId("");
      setNotice("已写入项目资产，并标记为已使用");
    } catch (error) {
      setError(error instanceof Error ? error.message : "写入项目资产失败");
    } finally {
      setIsPending(false);
    }
  }

  function updateTransformDraft(patch: Partial<InspirationTransformDraft>) {
    setTransformDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function updateTransformCharacter(patch: Partial<NonNullable<InspirationTransformDraft["character"]>>) {
    setTransformDraft((current) =>
      current
        ? {
            ...current,
            character: {
              name: "",
              identity: "",
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
              currentState: "",
              ...(current.character ?? {}),
              ...patch
            }
          }
        : current
    );
  }

  function updateTransformForeshadowing(patch: Partial<NonNullable<InspirationTransformDraft["foreshadowing"]>>) {
    setTransformDraft((current) =>
      current
        ? {
            ...current,
            foreshadowing: {
              name: "",
              plantedChapter: "",
              relatedCharacters: [],
              relatedLocation: "",
              status: "open",
              expectedRevealChapter: "",
              revealMethod: "",
              hiddenInformation: "",
              ...(current.foreshadowing ?? {}),
              ...patch
            }
          }
        : current
    );
  }

  function updateTransformTaskCard(patch: Partial<NonNullable<InspirationTransformDraft["taskCard"]>>) {
    setTransformDraft((current) =>
      current
        ? {
            ...current,
            taskCard: {
              title: "",
              chapterGoal: "",
              continuity: "",
              mainPlotProgress: "",
              requiredCharacters: [],
              pleasurePoint: "",
              foreshadowingTasks: [],
              rulesNotToBreak: [],
              endingHook: "",
              ...(current.taskCard ?? {}),
              ...patch
            }
          }
        : current
    );
  }

  function updateTransformBiblePatch(patch: Partial<NonNullable<InspirationTransformDraft["biblePatch"]>>) {
    setTransformDraft((current) =>
      current
        ? {
            ...current,
            biblePatch: {
              ...(current.biblePatch ?? {}),
              ...patch
            }
          }
        : current
    );
  }

  function updateTransformShortOutline(patch: Partial<NonNullable<InspirationTransformDraft["shortOutline"]>>) {
    setTransformDraft((current) =>
      current
        ? {
            ...current,
            shortOutline: {
              logline: "",
              coreConflict: "",
              firstChapters: [],
              pacing: "",
              foreshadowingPlan: [],
              ...(current.shortOutline ?? {}),
              ...patch
            }
          }
        : current
    );
  }

  function updateTransformVariant(
    index: number,
    patch: Partial<NonNullable<InspirationTransformDraft["variants"]>[number]>
  ) {
    setTransformDraft((current) => {
      if (!current) {
        return current;
      }

      const variants = current.variants?.length ? [...current.variants] : [];
      const defaultVariant: NonNullable<InspirationTransformDraft["variants"]>[number] = {
        title: "",
        direction: "",
        conflict: "",
        payoff: "",
        nextHook: ""
      };
      variants[index] = { ...defaultVariant, ...(variants[index] ?? {}), ...patch };
      return { ...current, variants };
    });
  }

  return (
    <div className="inspiration-workbench">
      {aiLoading ? (
        <ActionLoadingOverlay title={aiLoading.title} description={aiLoading.description} />
      ) : null}
      <section className="inspiration-header">
        <div>
          <div className="inspiration-kicker">灵感中心</div>
          <h1>先记下来，再慢慢变成能写的东西</h1>
          <p>把灵感存成素材池，后面再接大纲、人物和伏笔，不让脑子里的好点子白白掉地上。</p>
        </div>
        <div className="inspiration-summary">
          <div className="inspiration-stat">
            <span>总灵感</span>
            <strong>{inspirations.length}</strong>
          </div>
          <div className="inspiration-stat">
            <span>已润色</span>
            <strong>{polishedCount}</strong>
          </div>
          <div className="inspiration-stat">
            <span>关联项目</span>
            <strong>{linkedCount}</strong>
          </div>
        </div>
      </section>

      <div className="inspiration-toolbar">
        <label className="inspiration-search">
          <span>搜索</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="标题、内容、标签" />
        </label>
        <CustomSelect
          id="filter-type"
          label="类型"
          value={typeFilter}
          options={typeFilterOptions}
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          onChange={setTypeFilter}
          className="inspiration-filter-select"
        />
        <CustomSelect
          id="filter-status"
          label="状态"
          value={statusFilter}
          options={statusFilterOptions}
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          onChange={setStatusFilter}
          className="inspiration-filter-select"
        />
        <CustomSelect
          id="filter-project"
          label="项目"
          value={projectFilter}
          options={projectFilterOptions}
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          onChange={setProjectFilter}
          className="inspiration-filter-select"
        />
        <label>
          <span>标签</span>
          <input value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} placeholder="例如：退婚流" />
        </label>
      </div>

      <div className="inspiration-grid">
        <aside className="inspiration-panel inspiration-list-panel">
          <div className="panel-head">
            <div>
              <h2>灵感列表</h2>
              <p>
                {filteredInspirations.length} 条匹配结果
                {filteredInspirations.length > inspirationPageSize ? ` · 第 ${currentListPage}/${totalListPages} 页` : ""}
              </p>
            </div>
            <button
              type="button"
              className={`button small-button ${selectedId ? "" : "primary"}`}
              onClick={() => {
                setSelectedId("");
                setDraft(emptyDraft());
                setError("");
                setNotice("");
              }}
            >
              新灵感
            </button>
          </div>
          <div className="inspiration-list">
            {filteredInspirations.length === 0 ? (
              <div className="inspiration-empty-list">
                <div className="empty-state compact">
                  <strong>还没有灵感</strong>
                  <span>先在右侧记一条，或者放一条想法进来。</span>
                </div>
                <div className="inspiration-empty-hints">
                  <span>适合记录</span>
                  <div>
                    <span className="chip">情节钩子</span>
                    <span className="chip">世界观规则</span>
                    <span className="chip">人物反差</span>
                    <span className="chip">爽点公式</span>
                  </div>
                </div>
              </div>
            ) : (
              paginatedInspirations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`inspiration-list-item ${item.id === selectedId ? "active" : ""}`}
                  onClick={() => {
                    setSelectedId(item.id);
                    setDraft(toDraft(item));
                  }}
                >
                  <div className="row">
                    <strong>{item.title}</strong>
                    <span className={`pill inspiration-status-${item.status}`}>{statusLabel(item.status)}</span>
                  </div>
                  <div className="muted clamp-two">{item.content || "没有正文内容"}</div>
                  <div className="meta-row">
                    <span className="chip">{typeLabel(item.type)}</span>
                    {item.projectId ? (
                      <span className="chip">{projects.find((project) => project.id === item.projectId)?.name ?? "项目"}</span>
                    ) : (
                      <span className="chip">未关联项目</span>
                    )}
                    <span className="chip">{formatDate(item.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
          {filteredInspirations.length > inspirationPageSize ? (
            <div className="inspiration-pagination" aria-label="灵感列表分页">
              <button
                type="button"
                className="button small-button"
                disabled={currentListPage <= 1}
                onClick={() => setListPage((page) => Math.max(1, page - 1))}
              >
                上一页
              </button>
              <span>{currentListPage} / {totalListPages}</span>
              <button
                type="button"
                className="button small-button"
                disabled={currentListPage >= totalListPages}
                onClick={() => setListPage((page) => Math.min(totalListPages, page + 1))}
              >
                下一页
              </button>
            </div>
          ) : null}
        </aside>

        <section className="inspiration-panel inspiration-editor-panel">
          <div className="panel-head">
            <div>
              <h2>{selected ? "编辑灵感" : "捕捉新灵感"}</h2>
              <p>{selected ? `${typeLabel(selected.type)} · ${selectedProjectName}` : "先把脑子里的火花按住，后面再整理。"}</p>
            </div>
            <Link href="/projects" className="button small-button">
              回项目中心
            </Link>
          </div>

          {selected ? (
            <div className="inspiration-editor">
              <div className="inspiration-current-card">
                <div>
                  <span className={`pill inspiration-status-${selected.status}`}>{statusLabel(selected.status)}</span>
                  <h3>{selected.title}</h3>
                </div>
                <div className="meta-row">
                  <span className="chip">{typeLabel(selected.type)}</span>
                  <span className="chip">{selectedProjectName}</span>
                  <span className="chip">{formatDate(selected.updatedAt)}</span>
                  {selected.linkedEntityType ? (
                    <Link className="chip inspiration-linked-chip" href={entityHref(selected)}>
                      已写入：{entityLabel(selected.linkedEntityType)}
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span className="field-label">标题</span>
                  <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <div className="field">
                  <span className="field-label">类型</span>
                  <CustomSelect
                    id="draft-type"
                    value={draft.type}
                    options={typeOptions}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => setDraft((current) => ({ ...current, type: value }))}
                  />
                </div>
                <div className="field">
                  <span className="field-label">状态</span>
                  <CustomSelect
                    id="draft-status"
                    value={draft.status}
                    options={statusOptions}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => setDraft((current) => ({ ...current, status: value }))}
                  />
                </div>
                <div className="field">
                  <span className="field-label">关联项目</span>
                  <CustomSelect
                    id="draft-project"
                    value={draft.projectId}
                    options={projectLinkOptions}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) => setDraft((current) => ({ ...current, projectId: value }))}
                  />
                </div>
              </div>

              <label className="field">
                <span className="field-label">内容</span>
                <textarea
                  value={draft.content}
                  rows={10}
                  onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                />
              </label>

              <div className="field-grid">
                <label className="field">
                  <span className="field-label">标签</span>
                  <textarea
                    value={draft.tags}
                    rows={3}
                    onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="退婚流，信息差，压制反击"
                  />
                </label>
                <div className="field">
                  <span className="field-label">关联实体类型</span>
                  <CustomSelect
                    id="draft-linked-entity"
                    value={draft.linkedEntityType}
                    options={linkedEntityOptions}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        linkedEntityType: value
                      }))
                    }
                  />
                  <span className="field-help">这一项先留着，方便后续一键转化接入。</span>
                </div>
              </div>

              {draft.linkedEntityType ? (
                <label className="field">
                  <span className="field-label">关联实体 ID</span>
                  <input
                    value={draft.linkedEntityId}
                    onChange={(event) => setDraft((current) => ({ ...current, linkedEntityId: event.target.value }))}
                    placeholder="如果后续绑定了人物/伏笔/章节，这里会存对应 ID"
                  />
                </label>
              ) : null}

              <div className="inspiration-action-strip">
                <div className="action-row">
                  <button type="button" className="button primary" onClick={() => void saveSelected()} disabled={isPending}>
                    保存修改
                  </button>
                  <button type="button" className="button danger" onClick={() => void deleteSelected()} disabled={isPending}>
                    删除
                  </button>
                </div>
                <div className="inspiration-ai-box">
                  <div>
                    <strong>AI 润色</strong>
                    <span>{modeHint(polishMode)}</span>
                  </div>
                  <CustomSelect
                    id="draft-polish-mode"
                    value={polishMode}
                    options={polishModes}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={setPolishMode}
                    className="compact-select"
                  />
                  <button type="button" className="button" onClick={() => void polishSelected()} disabled={isPending}>
                    AI 润色
                  </button>
                </div>
              </div>

              <section className="output-block inspiration-transform-block">
                <div className="row">
                  <div>
                    <div className="section-title">一键转化</div>
                    <p className="output-caption">
                      推荐转成「{transformTargetLabel(primaryTransformTarget)}」。点击任意方向先生成草稿，确认后再写入项目资产。
                    </p>
                  </div>
                  <div className="inspiration-transform-actions">
                    <button type="button" className="button primary" onClick={() => void previewTransform(primaryTransformTarget)} disabled={isPending || !selected.projectId}>
                      按推荐生成
                    </button>
                  </div>
                </div>
                {!selected.projectId ? (
                  <div className="inspiration-ai-note">先把灵感关联到项目，才能写入人物、伏笔或任务卡。</div>
                ) : null}
                <div className="inspiration-transform-targets">
                  {transformTargetOptions.map((option) => {
                    const isRecommended = selectedTransformTargets.includes(option.value);
                    const isActive = transformTarget === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`transform-target-card ${isActive ? "active" : ""} ${isRecommended ? "recommended" : ""}`}
                        onClick={() => void previewTransform(option.value)}
                        disabled={isPending || !selected.projectId}
                      >
                        <span className="transform-target-meta">{isRecommended ? "推荐" : "可选"}</span>
                        <strong>{option.label}</strong>
                        <small>{option.hint ?? transformTargetHint(option.value)}</small>
                      </button>
                    );
                  })}
                </div>
                {transformDraft && transformSourceId === selected.id ? (
                  <div className="inspiration-transform-draft">
                    <div className="field-grid">
                      <label className="field">
                        <span className="field-label">草稿标题</span>
                        <input value={transformDraft.title} onChange={(event) => updateTransformDraft({ title: event.target.value })} />
                      </label>
                      <label className="field">
                        <span className="field-label">转化摘要</span>
                        <textarea value={transformDraft.summary} rows={3} onChange={(event) => updateTransformDraft({ summary: event.target.value })} />
                      </label>
                    </div>

                    {transformDraft.target === "character" && transformDraft.character ? (
                      <div className="field-grid">
                        <label className="field">
                          <span className="field-label">姓名</span>
                          <input value={transformDraft.character.name} onChange={(event) => updateTransformCharacter({ name: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">身份</span>
                          <input value={transformDraft.character.identity} onChange={(event) => updateTransformCharacter({ identity: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">当前目标</span>
                          <textarea value={transformDraft.character.currentGoal} rows={2} onChange={(event) => updateTransformCharacter({ currentGoal: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">长期目标</span>
                          <textarea value={transformDraft.character.longTermGoal} rows={2} onChange={(event) => updateTransformCharacter({ longTermGoal: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">秘密</span>
                          <textarea value={transformDraft.character.secret} rows={2} onChange={(event) => updateTransformCharacter({ secret: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">与主角关系</span>
                          <input value={transformDraft.character.relationshipToProtagonist} onChange={(event) => updateTransformCharacter({ relationshipToProtagonist: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">能力边界</span>
                          <textarea value={transformDraft.character.abilityBoundary} rows={2} onChange={(event) => updateTransformCharacter({ abilityBoundary: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">信息边界</span>
                          <textarea
                            value={`${transformDraft.character.knownInformation}\n\n不知道：${transformDraft.character.unknownInformation}`}
                            rows={4}
                            onChange={(event) => {
                              const [known, unknown = ""] = event.target.value.split(/\n\n不知道：/);
                              updateTransformCharacter({ knownInformation: known, unknownInformation: unknown });
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {transformDraft.target === "foreshadowing" && transformDraft.foreshadowing ? (
                      <div className="field-grid">
                        <label className="field">
                          <span className="field-label">伏笔名称</span>
                          <input value={transformDraft.foreshadowing.name} onChange={(event) => updateTransformForeshadowing({ name: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">埋设章节</span>
                          <input value={transformDraft.foreshadowing.plantedChapter} onChange={(event) => updateTransformForeshadowing({ plantedChapter: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">关联人物</span>
                          <input value={transformDraft.foreshadowing.relatedCharacters.join("，")} onChange={(event) => updateTransformForeshadowing({ relatedCharacters: fromLines(event.target.value) })} />
                        </label>
                        <label className="field">
                          <span className="field-label">预计回收</span>
                          <input value={transformDraft.foreshadowing.expectedRevealChapter} onChange={(event) => updateTransformForeshadowing({ expectedRevealChapter: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">回收方式</span>
                          <textarea value={transformDraft.foreshadowing.revealMethod} rows={3} onChange={(event) => updateTransformForeshadowing({ revealMethod: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">不能提前透露的信息</span>
                          <textarea value={transformDraft.foreshadowing.hiddenInformation} rows={3} onChange={(event) => updateTransformForeshadowing({ hiddenInformation: event.target.value })} />
                        </label>
                      </div>
                    ) : null}

                    {transformDraft.target === "task_card" && transformDraft.taskCard ? (
                      <div className="field-grid">
                        <label className="field">
                          <span className="field-label">章节标题</span>
                          <input value={transformDraft.taskCard.title} onChange={(event) => updateTransformTaskCard({ title: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">章节序号</span>
                          <input value={transformDraft.taskCard.chapterNumber ?? ""} onChange={(event) => updateTransformTaskCard({ chapterNumber: Number(event.target.value) || undefined })} placeholder="留空则自动接下一章" />
                        </label>
                        <label className="field">
                          <span className="field-label">本章目标</span>
                          <textarea value={transformDraft.taskCard.chapterGoal} rows={3} onChange={(event) => updateTransformTaskCard({ chapterGoal: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">承接上一章</span>
                          <textarea value={transformDraft.taskCard.continuity} rows={3} onChange={(event) => updateTransformTaskCard({ continuity: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">主线推进</span>
                          <textarea value={transformDraft.taskCard.mainPlotProgress} rows={3} onChange={(event) => updateTransformTaskCard({ mainPlotProgress: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">要释放的爽点</span>
                          <textarea value={transformDraft.taskCard.pleasurePoint} rows={3} onChange={(event) => updateTransformTaskCard({ pleasurePoint: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">人物 / 伏笔 / 禁区</span>
                          <textarea
                            value={[
                              `人物：${toLines(transformDraft.taskCard.requiredCharacters)}`,
                              `伏笔：${toLines(transformDraft.taskCard.foreshadowingTasks)}`,
                              `禁区：${toLines(transformDraft.taskCard.rulesNotToBreak)}`
                            ].join("\n\n")}
                            rows={7}
                            onChange={(event) => {
                              const value = event.target.value;
                              const people = value.match(/人物：([\s\S]*?)(?:\n\n伏笔：|$)/)?.[1] ?? "";
                              const foreshadowings = value.match(/伏笔：([\s\S]*?)(?:\n\n禁区：|$)/)?.[1] ?? "";
                              const rules = value.match(/禁区：([\s\S]*)/)?.[1] ?? "";
                              updateTransformTaskCard({
                                requiredCharacters: fromLines(people),
                                foreshadowingTasks: fromLines(foreshadowings),
                                rulesNotToBreak: fromLines(rules)
                              });
                            }}
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">章末钩子</span>
                          <textarea value={transformDraft.taskCard.endingHook} rows={3} onChange={(event) => updateTransformTaskCard({ endingHook: event.target.value })} />
                        </label>
                      </div>
                    ) : null}

                    {(transformDraft.target === "bible" || transformDraft.target === "worldbuilding") && transformDraft.biblePatch ? (
                      <div className="field-grid">
                        <label className="field">
                          <span className="field-label">核心爽点补充</span>
                          <textarea value={transformDraft.biblePatch.corePleasure ?? ""} rows={3} onChange={(event) => updateTransformBiblePatch({ corePleasure: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">世界规则补充</span>
                          <textarea value={transformDraft.biblePatch.worldRules ?? ""} rows={3} onChange={(event) => updateTransformBiblePatch({ worldRules: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">金手指规则</span>
                          <textarea value={transformDraft.biblePatch.goldenFingerRules ?? ""} rows={3} onChange={(event) => updateTransformBiblePatch({ goldenFingerRules: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">不可违反设定</span>
                          <textarea value={transformDraft.biblePatch.immutableSettings ?? ""} rows={3} onChange={(event) => updateTransformBiblePatch({ immutableSettings: event.target.value })} />
                        </label>
                      </div>
                    ) : null}

                    {transformDraft.target === "short_outline" && transformDraft.shortOutline ? (
                      <div className="field-grid">
                        <label className="field">
                          <span className="field-label">一句话大纲</span>
                          <textarea value={transformDraft.shortOutline.logline} rows={3} onChange={(event) => updateTransformShortOutline({ logline: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">核心冲突</span>
                          <textarea value={transformDraft.shortOutline.coreConflict} rows={3} onChange={(event) => updateTransformShortOutline({ coreConflict: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">前几章推进</span>
                          <textarea value={toLines(transformDraft.shortOutline.firstChapters)} rows={5} onChange={(event) => updateTransformShortOutline({ firstChapters: fromLines(event.target.value) })} />
                        </label>
                        <label className="field">
                          <span className="field-label">节奏安排</span>
                          <textarea value={transformDraft.shortOutline.pacing} rows={3} onChange={(event) => updateTransformShortOutline({ pacing: event.target.value })} />
                        </label>
                        <label className="field">
                          <span className="field-label">伏笔安排</span>
                          <textarea value={toLines(transformDraft.shortOutline.foreshadowingPlan)} rows={4} onChange={(event) => updateTransformShortOutline({ foreshadowingPlan: fromLines(event.target.value) })} />
                        </label>
                      </div>
                    ) : null}

                    {transformDraft.target === "variants" && transformDraft.variants?.length ? (
                      <div className="inspiration-variant-list">
                        {transformDraft.variants.map((variant, index) => (
                          <div key={`${variant.title}-${index}`} className="field-grid inspiration-variant-card">
                            <label className="field">
                              <span className="field-label">变体标题</span>
                              <input value={variant.title} onChange={(event) => updateTransformVariant(index, { title: event.target.value })} />
                            </label>
                            <label className="field">
                              <span className="field-label">方向</span>
                              <textarea value={variant.direction} rows={2} onChange={(event) => updateTransformVariant(index, { direction: event.target.value })} />
                            </label>
                            <label className="field">
                              <span className="field-label">冲突</span>
                              <textarea value={variant.conflict} rows={2} onChange={(event) => updateTransformVariant(index, { conflict: event.target.value })} />
                            </label>
                            <label className="field">
                              <span className="field-label">爽点收益</span>
                              <textarea value={variant.payoff} rows={2} onChange={(event) => updateTransformVariant(index, { payoff: event.target.value })} />
                            </label>
                            <label className="field">
                              <span className="field-label">后续钩子</span>
                              <textarea value={variant.nextHook} rows={2} onChange={(event) => updateTransformVariant(index, { nextHook: event.target.value })} />
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {(transformDraft.notes.length || transformDraft.warnings.length) ? (
                      <div className="ai-output-notes">
                        <span>确认前提示</span>
                        <div className="meta-row">
                          {[...transformDraft.notes, ...transformDraft.warnings].map((item) => (
                            <span key={item} className="chip">{item}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="action-row">
                      <button type="button" className="button primary" onClick={() => void confirmTransform()} disabled={isPending}>
                        确认写入项目资产
                      </button>
                      <button type="button" className="button ghost-button" onClick={() => setTransformDraft(null)} disabled={isPending}>
                        放弃草稿
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <div className="status-line">
                {error ? <span className="text-danger">{error}</span> : null}
                {!error && notice ? <span className="text-success">{notice}</span> : null}
              </div>

              <div className="inspiration-outputs">
                <section className="output-block current-content-block">
                  <div>
                    <div className="section-title">当前保存内容</div>
                    <p className="output-caption">
                      {selected.status === "polished"
                        ? "这条灵感已经采用过 AI 润色或整理结果。"
                        : "这里显示当前真正保存进灵感库的内容。"}
                    </p>
                  </div>
                  <div className="current-content-text">{selected.content || "暂无内容"}</div>
                </section>

                <section className="output-block ai-history-block">
                  <div>
                    <div className="section-title">AI 润色记录</div>
                    <p className="output-caption">保留每次 AI 处理的方式、改动点和后续建议。</p>
                  </div>
                  {selected.aiOutputs.length === 0 ? (
                    <div className="empty-state compact">
                      <strong>还没有 AI 结果</strong>
                      <span>点一下“AI 润色”试试看。</span>
                    </div>
                  ) : (
                    <div className="ai-output-list">
                      {selected.aiOutputs.map((output) => (
                        <article
                          key={output.id}
                          className={`ai-output-card ${sameText(output.content, selected.content) ? "current-saved" : ""}`}
                        >
                          <div className="row">
                            <strong>{output.title}</strong>
                            <span className="chip">{output.usedAi ? "AI" : "本地"}</span>
                          </div>
                          {sameText(output.content, selected.content) ? (
                            <div className="ai-adopted-note">已采用为当前保存内容</div>
                          ) : (
                            <div className="muted">{output.content}</div>
                          )}
                          {(output.changes ?? []).length ? (
                            <div className="ai-output-notes">
                              <span>AI 做了什么</span>
                              <div className="meta-row">
                                {(output.changes ?? []).map((item) => (
                                  <span key={item} className="chip">{item}</span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <div className="meta-row">
                            <span className="chip">{polishModes.find((mode) => mode.value === output.mode)?.label ?? output.mode}</span>
                            <span className="chip">{formatDate(output.createdAt)}</span>
                          </div>
                          {output.suggestions.length ? (
                            <div className="ai-output-notes">
                              <span>下一步建议</span>
                              <div className="meta-row">
                                {output.suggestions.map((item) => (
                                  <span key={item} className="chip">{item}</span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="inspiration-editor">
              <div className="inspiration-capture-shell">
                <section className="inspiration-capture-main">
                  <div className="inspiration-capture-banner">
                    <div>
                      <strong>快速捕捉</strong>
                      <span>先写下原始想法，AI 只做预览，满意后再保存。</span>
                    </div>
                    <span className="chip">不会自动保存</span>
                  </div>

                  <div className="field-grid">
                    <label className="field">
                      <span className="field-label">标题</span>
                      <input value={newDraft.title} onChange={(event) => updateNewDraft({ title: event.target.value })} placeholder="例如：被退婚后，师父突然失联" />
                    </label>
                    <div className="field">
                      <span className="field-label">类型</span>
                      <CustomSelect
                        id="new-type"
                        value={newDraft.type}
                        options={typeOptions}
                        openSelect={openSelect}
                        setOpenSelect={setOpenSelect}
                        onChange={(value) => updateNewDraft({ type: value })}
                      />
                    </div>
                    <div className="field">
                      <span className="field-label">关联项目</span>
                      <CustomSelect
                        id="new-project"
                        value={newDraft.projectId}
                        options={projectLinkOptions}
                        openSelect={openSelect}
                        setOpenSelect={setOpenSelect}
                        onChange={(value) => updateNewDraft({ projectId: value })}
                      />
                    </div>
                    <label className="field">
                      <span className="field-label">标签</span>
                      <input value={newDraft.tags} onChange={(event) => updateNewDraft({ tags: event.target.value })} placeholder="退婚流，打脸，反转" />
                    </label>
                  </div>

                  <label className="field inspiration-content-field">
                    <span className="field-label">内容</span>
                    <textarea
                      value={newDraft.content}
                      rows={12}
                      onChange={(event) => updateNewDraft({ content: event.target.value })}
                      placeholder="比如：写下突然想到的情节、人物、设定、伏笔或一句台词。"
                    />
                  </label>
                </section>

                <aside className="inspiration-ai-dock">
                  <div className="inspiration-ai-dock-head">
                    <span>AI 润色台</span>
                    <strong>{polishModes.find((mode) => mode.value === polishMode)?.label ?? "润色表达"}</strong>
                    <p>{modeHint(polishMode)}</p>
                  </div>
                  <CustomSelect
                    id="new-polish-mode"
                    label="处理方式"
                    value={polishMode}
                    options={polishModes}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                    onChange={setPolishMode}
                    className="compact-select"
                  />
                  <div className="inspiration-ai-actions">
                    <button type="button" className="button" onClick={() => void previewNewInspirationPolish()} disabled={isPending}>
                      AI 润色预览
                    </button>
                    {newPreview ? (
                      <button type="button" className="button primary" onClick={() => void savePreviewAsInspiration()} disabled={isPending}>
                        采用润色并保存
                      </button>
                    ) : null}
                    <button type="button" className="button ghost-button" onClick={() => void createInspiration()} disabled={isPending}>
                      只保存原文
                    </button>
                  </div>
                  <div className="inspiration-ai-note">建议先预览，再决定是否采用。原文不会被覆盖。</div>
                </aside>
              </div>

              {newPreview ? (
                <section className="output-block inspiration-preview-block">
                  <div className="section-title">AI 润色预览</div>
                  <article className="ai-output-card">
                    <div className="row">
                      <strong>{newPreview.title}</strong>
                      <span className="chip">{newPreview.usedAi ? "AI" : "本地"}</span>
                    </div>
                    <div className="muted">{newPreview.content}</div>
                    {(newPreview.changes ?? []).length ? (
                      <div className="ai-output-notes">
                        <span>AI 做了什么</span>
                        <div className="meta-row">
                          {(newPreview.changes ?? []).map((item) => (
                            <span key={item} className="chip">{item}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="meta-row">
                      <span className="chip">{polishModes.find((mode) => mode.value === newPreview.mode)?.label ?? newPreview.mode}</span>
                      {newPreview.tags.map((tag) => (
                        <span key={tag} className="chip">{tag}</span>
                      ))}
                    </div>
                    {newPreview.suggestions.length ? (
                      <div className="ai-output-notes">
                        <span>下一步建议</span>
                        <div className="meta-row">
                          {newPreview.suggestions.map((item) => (
                            <span key={item} className="chip">{item}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                </section>
              ) : null}

              {error ? <div className="status-line text-danger">{error}</div> : null}
              {!error && notice ? <div className="status-line text-success">{notice}</div> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
