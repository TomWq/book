"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { novelTaxonomy, readerOptions, type TargetReader } from "@/lib/novel-taxonomy";

const tagSections = [
  { key: "mainCategories", label: "主分类" },
  { key: "themes", label: "主题" },
  { key: "roles", label: "角色" }
] as const;

const creationSteps = [
  { id: "book-step-identity", index: "01", label: "作品身份" },
  { id: "book-step-audience", index: "02", label: "读者与标签" },
  { id: "book-step-story", index: "03", label: "故事起点" }
] as const;

const maxSelectedTagsPerGroup = 2;

type TagSectionKey = (typeof tagSections)[number]["key"];
type TitleNamingStyle = "fanqie" | "qidian";
type CreationStepId = (typeof creationSteps)[number]["id"];

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
  const [titleConcept, setTitleConcept] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [titleNamingStyle, setTitleNamingStyle] = useState<TitleNamingStyle>("fanqie");
  const [description, setDescription] = useState("");
  const [protagonist1, setProtagonist1] = useState("");
  const [protagonist2, setProtagonist2] = useState("");
  const [targetReader, setTargetReader] = useState<TargetReader>("男频");
  const [genre, setGenre] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [activeTagSection, setActiveTagSection] = useState<TagSectionKey>("mainCategories");
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [protagonistSuggestions, setProtagonistSuggestions] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<CreationStepId>("book-step-identity");

  const coverTitle = name || "书本名称";
  const coverAuthor = authorName.trim() || "作者名称";
  const taxonomy = novelTaxonomy[targetReader];
  const currentCategory = taxonomy.mainCategories.find((item) => item.name === genre) ?? null;
  const selectedTagText = useMemo(
    () => [genre, ...selectedTags].filter(Boolean).slice(0, 5).join(" / "),
    [genre, selectedTags]
  );
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);
  const themeTagSet = useMemo(() => new Set(taxonomy.themes), [taxonomy.themes]);
  const roleTagSet = useMemo(() => new Set(taxonomy.roles), [taxonomy.roles]);
  const selectedThemeCount = selectedTags.filter((tag) => themeTagSet.has(tag)).length;
  const selectedRoleCount = selectedTags.filter((tag) => roleTagSet.has(tag)).length;
  function updateTargetReader(nextReader: TargetReader) {
    const nextTaxonomy = novelTaxonomy[nextReader];
    const nextThemeTags = new Set(nextTaxonomy.themes);
    const nextRoleTags = new Set(nextTaxonomy.roles);

    setTargetReader(nextReader);
    setGenre("");
    setSelectedTags((current) => {
      const keptThemes = current.filter((tag) => nextThemeTags.has(tag)).slice(0, maxSelectedTagsPerGroup);
      const keptRoles = current.filter((tag) => nextRoleTags.has(tag)).slice(0, maxSelectedTagsPerGroup);
      return [...keptThemes, ...keptRoles];
    });
    setActiveTagSection("mainCategories");
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => {
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

  function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const nextUrl = URL.createObjectURL(file);

    setCoverImageUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return nextUrl;
    });
  }

  function clearCoverImage() {
    setCoverImageUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return "";
    });
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

  function getCurrentContext() {
    const formData = formRef.current ? new FormData(formRef.current) : new FormData();

    return {
      name,
      genre,
      targetReader,
      titleNamingStyle,
      titleConcept,
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

    if (!genre) {
      setError("请先在第二步选择主分类");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: asText(formData.get("name")),
          type: "writing",
          genre,
          description: asText(formData.get("description")),
          targetReader,
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
        <div className={`book-cover ${coverImageUrl ? "has-custom-cover" : ""}`}>
          {coverImageUrl ? (
            <img className="book-cover-image" src={coverImageUrl} alt="自定义封面预览" />
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
          {coverImageUrl ? (
            <button className="button" type="button" onClick={clearCoverImage}>
              恢复默认
            </button>
          ) : null}
        </div>
        <div className="book-cover-note">
          <strong>封面后续可补</strong>
          <span>可上传自定义封面覆盖默认预览；未上传时会用书名和作者名生成临时封面。</span>
        </div>
        <div className="tag-row">
          {selectedTagText ? <span className="chip">{selectedTagText}</span> : <span className="chip">未选择标签</span>}
        </div>
      </aside>

      <div className="book-create-main">
        <nav className="book-step-nav" aria-label="新书创建步骤">
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
                  <small>长标题，强反差，直接抛爽点</small>
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
              AI 起名会参考：{titleNamingStyle === "qidian" ? "起点风格" : "番茄小说风格"}、读者与标签里的内容，所以调整下方信息会影响起名结果。
              {/* AI 起名会参考：{targetReader}、{genre}{selectedTags.length ? `、${selectedTags.join("、")}` : ""}
              {protagonist1.trim() ? `、主角 ${protagonist1.trim()}` : ""}，以及下方已填写的卖点、金手指和开局钩子。 */}
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
            <span className="muted">主分类必选，主题最多 2 个，角色最多 2 个</span>
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
                  <small>{currentCategory?.description ?? "主分类不默认选中，打开作品标签后从当前读者频道下选择。"}</small>
                </span>
              </button>
            </div>
          </div>

          <div className="selected-tag-panel">
            <div>
              <div className="field-label">主题与角色</div>
              <div className="muted">主题 {selectedThemeCount}/{maxSelectedTagsPerGroup}，角色 {selectedRoleCount}/{maxSelectedTagsPerGroup}</div>
            </div>
            <div className="selected-tag-list">
              {selectedTags.length > 0 ? selectedTags.map((tag) => (
                <button key={tag} className="selected-tag-chip" type="button" onClick={() => toggleTag(tag)}>
                  {tag}
                </button>
              )) : <span className="muted">暂未选择主题或角色</span>}
            </div>
            <button className="button tag-dialog-trigger" type="button" onClick={() => setIsTagDialogOpen(true)}>
              打开作品标签
            </button>
          </div>

          {isTagDialogOpen ? (
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
                    {activeTagSection === "mainCategories" ? taxonomy.mainCategories.map((category) => (
                      <button
                        key={category.name}
                        className={`taxonomy-card ${genre === category.name ? "selected" : ""}`}
                        type="button"
                        onClick={() => setGenre(category.name)}
                      >
                        <span className="taxonomy-card-icon" aria-hidden="true">{category.name.slice(0, 1)}</span>
                        <span>
                          <strong>{category.name}</strong>
                          <small>{category.description}</small>
                        </span>
                      </button>
                    )) : null}

                    {activeTagSection === "themes" ? taxonomy.themes.map((tag) => (
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

                    {activeTagSection === "roles" ? taxonomy.roles.map((tag) => (
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
                  </div>
                </div>

                <div className="tag-dialog-foot">
                  <span>主分类必选且只能选一个，主题最多可选 2 个，角色最多可选 2 个</span>
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
          ) : null}
        </div>

        <div className="book-create-section" id="book-step-story">
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
