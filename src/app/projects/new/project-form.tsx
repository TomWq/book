"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";

const categoryOptions = [
  "都市高武",
  "东方玄幻",
  "规则怪谈",
  "科幻末世",
  "历史古代",
  "女频重生",
  "悬疑脑洞",
  "直播爽文",
  "修仙升级",
  "权谋争霸",
  "游戏体育",
  "都市日常"
];

const tagOptions = [
  "开局压制",
  "打脸反击",
  "身份曝光",
  "金手指",
  "战力升级",
  "信息差",
  "强情绪",
  "轻松搞笑",
  "复仇推进",
  "事业线",
  "感情线",
  "悬念钩子"
];

function asText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function ProjectForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assistLoading, setAssistLoading] = useState<"" | "titles" | "protagonists" | "description">("");
  const [error, setError] = useState("");
  const [assistError, setAssistError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [protagonist1, setProtagonist1] = useState("");
  const [protagonist2, setProtagonist2] = useState("");
  const [genre, setGenre] = useState(categoryOptions[0]);
  const [selectedTags, setSelectedTags] = useState<string[]>(["开局压制", "打脸反击"]);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [protagonistSuggestions, setProtagonistSuggestions] = useState<string[]>([]);

  const coverTitle = name || "书本名称";
  const selectedTagText = useMemo(
    () => [genre, ...selectedTags].filter(Boolean).slice(0, 5).join(" / "),
    [genre, selectedTags]
  );

  function toggleTag(tag: string) {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }

      return [...current, tag].slice(0, 6);
    });
  }

  function getCurrentContext() {
    const formData = formRef.current ? new FormData(formRef.current) : new FormData();

    return {
      name,
      genre,
      targetReader: asText(formData.get("targetReader")) || "男频",
      tags: selectedTags,
      protagonistNames: [protagonist1, protagonist2].map((item) => item.trim()).filter(Boolean),
      coreSellingPoint: asText(formData.get("coreSellingPoint")),
      goldenFinger: asText(formData.get("goldenFinger")),
      openingHook: asText(formData.get("openingHook")),
      description
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
      const payload = await response.json().catch(() => ({}));

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
        const names = Array.isArray(result.protagonistNames)
          ? result.protagonistNames.map((item: unknown) => String(item).trim()).filter(Boolean)
          : [];

        setProtagonistSuggestions(names);
        if (names[0]) {
          setProtagonist1(names[0].slice(0, 8));
        }
        if (names[1]) {
          setProtagonist2(names[1].slice(0, 8));
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
    const protagonistNames = [asText(formData.get("protagonist1")), asText(formData.get("protagonist2"))]
      .filter(Boolean);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: asText(formData.get("name")),
          type: "writing",
          genre,
          description: asText(formData.get("description")),
          targetReader: asText(formData.get("targetReader")) || "男频",
          tags: selectedTags,
          protagonistNames,
          coreSellingPoint: asText(formData.get("coreSellingPoint")),
          openingHook: asText(formData.get("openingHook")),
          goldenFinger: asText(formData.get("goldenFinger")),
          writingGoal: asText(formData.get("writingGoal"))
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

      router.push(`/projects/${projectId}/writing`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "创建作品失败");
      setIsSubmitting(false);
    }
  }

  return (
    <form ref={formRef} className="book-create-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <aside className="book-create-preview">
        <div className="book-cover">
          <div className="book-cover-title">{coverTitle.slice(0, 24)}</div>
          <div className="book-cover-author">作者名称</div>
        </div>
        <div className="book-cover-note">
          <strong>封面后续可补</strong>
          <span>这里先用书名生成预览，当前重点是把创作信息建完整。</span>
        </div>
        <div className="tag-row">
          {selectedTagText ? <span className="chip">{selectedTagText}</span> : <span className="chip">未选择标签</span>}
        </div>
      </aside>

      <div className="book-create-main">
        <div className="book-create-section">
          <div className="section-head compact">
            <div>
              <div className="mini-label">第一步</div>
              <h3>作品身份</h3>
            </div>
            <span className="chip">创作项目</span>
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
                {assistLoading === "titles" ? "生成中..." : "AI 起名"}
              </button>
            </div>
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="请输入作品名称，或让 AI 生成榜单风格长书名"
              maxLength={60}
              required
            />
            <div className="field-hint">{name.length}/60</div>
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

          <div className="quote-box warning-box">
            这里专门创建要写的新书。只想上传原文做拆解的话，去创建拆书项目，表单会更轻。
          </div>
        </div>

        <div className="book-create-section">
          <div className="section-head compact">
            <div>
              <div className="mini-label">第二步</div>
              <h3>读者与标签</h3>
            </div>
            <span className="muted">主分类必选，作品标签最多 6 个</span>
          </div>

          <div className="split-panels">
            <div className="field">
              <div className="field-label">目标读者</div>
              <div className="segmented-row">
                {["男频", "女频", "通用"].map((reader) => (
                  <label key={reader}>
                    <input type="radio" name="targetReader" value={reader} defaultChecked={reader === "男频"} />
                    <span>{reader}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <div className="field-label">主分类</div>
              <select name="genre" value={genre} onChange={(event) => setGenre(event.target.value)}>
                {categoryOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="tag-picker">
            {tagOptions.map((tag) => (
              <label key={tag} className="tag-option">
                <input
                  type="checkbox"
                  name="tags"
                  value={tag}
                  checked={selectedTags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                />
                <span>{tag}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="book-create-section">
          <div className="section-head compact">
            <div>
              <div className="mini-label">第三步</div>
              <h3>故事起点</h3>
            </div>
          </div>

          <div className="split-panels">
            <div className="field">
              <div className="field-label field-label-row">
                <span>主角名 1</span>
                <button
                  className="mini-action-button"
                  type="button"
                  onClick={() => runAssist("protagonists")}
                  disabled={Boolean(assistLoading)}
                >
                  {assistLoading === "protagonists" ? "生成中..." : "AI 取名"}
                </button>
              </div>
              <input
                name="protagonist1"
                value={protagonist1}
                onChange={(event) => setProtagonist1(event.target.value)}
                placeholder="请输入主角名"
                maxLength={8}
              />
            </div>
            <div className="field">
              <div className="field-label">主角名 2</div>
              <input
                name="protagonist2"
                value={protagonist2}
                onChange={(event) => setProtagonist2(event.target.value)}
                placeholder="双主角可填，非必填"
                maxLength={8}
              />
            </div>
          </div>
          {protagonistSuggestions.length > 0 ? (
            <div className="assist-suggestion-list compact">
              {protagonistSuggestions.map((item) => (
                <button
                  key={item}
                  className="assist-suggestion"
                  type="button"
                  onClick={() => {
                    if (!protagonist1 || protagonist1 === item) {
                      setProtagonist1(item.slice(0, 8));
                    } else {
                      setProtagonist2(item.slice(0, 8));
                    }
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}

          <div className="split-panels">
            <div className="field">
              <div className="field-label">核心卖点</div>
              <input name="coreSellingPoint" placeholder="例如：被误判的废柴，用系统反打所有人" />
            </div>
            <div className="field">
              <div className="field-label">金手指 / 关键机制</div>
              <input name="goldenFinger" placeholder="例如：情绪值系统 / 旧神契约 / 重生记忆" />
            </div>
          </div>

          <div className="field">
            <div className="field-label">开局钩子</div>
            <input name="openingHook" placeholder="例如：退婚当天，主角觉醒隐藏身份，但必须先装废物" />
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

          <div className="field">
            <div className="field-label">本项目目标</div>
            <textarea
              name="writingGoal"
              placeholder="例如：先跑通前 30 章爽点节奏；或拆一本爆款的开局公式，再迁移成新书。"
            />
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
        <div className="task-block">
          <div className="task-title">创建后写入</div>
          <div className="muted">作品信息、目标读者、核心爽点、金手指、开局钩子和主角档案。</div>
        </div>
        <div className="task-block">
          <div className="task-title">创作项目下一步</div>
          <div className="muted">进入状态页检查创作圣经，再去创作页生成章节任务卡。</div>
        </div>
        <div className="task-block">
          <div className="task-title">拆书项目下一步</div>
          <div className="muted">拆书项目已独立成轻量入口，只需要项目名、题材和分析目标。</div>
          <div className="hero-actions">
            <Link href="/projects/new/analysis" className="button">
              去新建拆书
            </Link>
          </div>
        </div>
      </aside>
    </form>
  );
}
