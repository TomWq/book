"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { maxProjectDescriptionLength } from "@/lib/project-limits";
import type { StoredOutline, StoredTemplate } from "@/lib/projects";

type OutlineCreateFormState = {
  name: string;
  genre: string;
  targetReader: string;
  protagonistName: string;
  description: string;
  coreSellingPoint: string;
  goldenFinger: string;
  openingHook: string;
};

type CreateProjectFromOutlineFormProps = {
  template: StoredTemplate;
  outline: StoredOutline;
};

const fallbackTags = ["模板迁移", "长篇连载", "章节大纲"];

function trimText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function pickFirstMeaningful(values: Array<string | undefined>) {
  return values.map((item) => item?.trim() ?? "").find(Boolean) ?? "";
}

function guessProtagonistName(value: string) {
  const candidate = value
    .split(/[：:，,。；;\s]/)[0]
    ?.replace(/[^\u4e00-\u9fa5A-Za-z·]/g, "")
    .trim();

  if (!candidate || /主角|强者|身份|模型|少年|少女|废柴|隐藏/.test(candidate)) {
    return "";
  }

  return candidate.slice(0, 8);
}

function buildInitialState(template: StoredTemplate, outline: StoredOutline): OutlineCreateFormState {
  const firstChapter = outline.first10Chapters[0] ?? "";
  const genre = outline.variables.genre || template.genre || "都市逆袭";
  const title = pickFirstMeaningful([
    outline.titleOptions[0],
    outline.logline.slice(0, 40),
    `${genre}新书`
  ]);

  return {
    name: title.slice(0, 60),
    genre,
    targetReader: outline.variables.targetReader || "网文读者",
    protagonistName: guessProtagonistName(outline.protagonist || outline.variables.protagonist),
    description: pickFirstMeaningful([outline.intro, outline.logline]).slice(0, maxProjectDescriptionLength),
    coreSellingPoint: pickFirstMeaningful([
      outline.coreSellingPoints.slice(0, 3).join("；"),
      outline.logline,
      template.formula
    ]),
    goldenFinger: outline.variables.goldenFinger || template.goldenFinger || "",
    openingHook: firstChapter || template.openingHook || outline.logline
  };
}

export function CreateProjectFromOutlineForm({
  template,
  outline
}: CreateProjectFromOutlineFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState(() => buildInitialState(template, outline));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const tagPreview = useMemo(
    () => Array.from(new Set([formState.genre, ...fallbackTags].filter(Boolean))).slice(0, 6),
    [formState.genre]
  );

  function updateField(field: keyof OutlineCreateFormState, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const protagonistNames = [trimText(formData.get("protagonistName"))].filter(Boolean);
    const writingGoal = [
      "基于已生成的新书大纲进入长篇创作。",
      outline.logline ? `一句话卖点：${outline.logline}` : "",
      outline.first100Pacing ? `前100章节奏：${outline.first100Pacing}` : "",
      outline.pleasureDistribution ? `爽点分布：${outline.pleasureDistribution}` : ""
    ].filter(Boolean).join("\n");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimText(formData.get("name")),
          type: "writing",
          genre: trimText(formData.get("genre")),
          description: trimText(formData.get("description")),
          targetReader: trimText(formData.get("targetReader")) || "网文读者",
          tags: tagPreview,
          protagonistNames,
          coreSellingPoint: trimText(formData.get("coreSellingPoint")),
          openingHook: trimText(formData.get("openingHook")),
          goldenFinger: trimText(formData.get("goldenFinger")),
          writingGoal,
          outlineId: outline.id,
          outlineLogline: outline.logline,
          worldSetting: outline.worldSetting,
          outlineChapters: outline.first10Chapters,
          first100Pacing: outline.first100Pacing,
          foreshadowingPlan: outline.foreshadowingPlan,
          pleasureDistribution: outline.pleasureDistribution
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "创建创作项目失败");
      }

      const projectId = payload?.project?.id;

      if (!projectId) {
        throw new Error("创建成功但未返回项目 ID");
      }

      router.push(`/projects/${projectId}/writing`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "创建创作项目失败");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="outline-create-card" onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <div className="outline-create-head">
        <div>
          <div className="mini-label">下一步</div>
          <h3>从这份大纲开始创作</h3>
          <p>确认作品信息后创建创作项目，系统会把大纲、节奏和伏笔计划写入状态管理。</p>
        </div>
        <button className="button primary create-work-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "创建中..." : "创建并开始写"}
        </button>
      </div>

      {outline.titleOptions.length > 0 ? (
        <div className="assist-suggestion-list compact">
          {outline.titleOptions.slice(0, 4).map((title) => (
            <button
              key={title}
              className="assist-suggestion"
              type="button"
              onClick={() => updateField("name", title.slice(0, 60))}
            >
              {title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="outline-create-grid">
        <div className="field">
          <div className="field-label">书名</div>
          <input
            name="name"
            value={formState.name}
            onChange={(event) => updateField("name", event.target.value)}
            maxLength={60}
            required
          />
        </div>
        <div className="field">
          <div className="field-label">主分类</div>
          <input
            name="genre"
            value={formState.genre}
            onChange={(event) => updateField("genre", event.target.value)}
          />
        </div>
        <div className="field">
          <div className="field-label">目标读者</div>
          <input
            name="targetReader"
            value={formState.targetReader}
            onChange={(event) => updateField("targetReader", event.target.value)}
          />
        </div>
        <div className="field">
          <div className="field-label">主角名</div>
          <input
            name="protagonistName"
            value={formState.protagonistName}
            onChange={(event) => updateField("protagonistName", event.target.value)}
            placeholder="可先留空，后续在状态页补充"
            maxLength={8}
          />
        </div>
      </div>

      <div className="outline-create-grid wide">
        <div className="field">
          <div className="field-label">核心卖点</div>
          <textarea
            name="coreSellingPoint"
            value={formState.coreSellingPoint}
            onChange={(event) => updateField("coreSellingPoint", event.target.value)}
          />
        </div>
        <div className="field">
          <div className="field-label">开局钩子</div>
          <textarea
            name="openingHook"
            value={formState.openingHook}
            onChange={(event) => updateField("openingHook", event.target.value)}
          />
        </div>
      </div>

      <div className="outline-create-grid wide">
        <div className="field">
          <div className="field-label">作品简介</div>
          <textarea
            name="description"
            value={formState.description}
            onChange={(event) => updateField("description", event.target.value)}
            maxLength={maxProjectDescriptionLength}
            required
          />
          <div className="field-hint">{formState.description.length}/{maxProjectDescriptionLength}</div>
        </div>
        <div className="field">
          <div className="field-label">金手指 / 关键机制</div>
          <textarea
            name="goldenFinger"
            value={formState.goldenFinger}
            onChange={(event) => updateField("goldenFinger", event.target.value)}
          />
        </div>
      </div>

      <div className="outline-create-foot">
        <div className="outline-chip-group">
          {tagPreview.map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))}
        </div>
        {error ? <div className="pill danger form-error">{error}</div> : null}
      </div>
    </form>
  );
}
