"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CustomSelect, type SelectOption } from "@/components/custom-select";
import { novelTaxonomy, qidianTaxonomyByReader, readerOptions, type TargetReader } from "@/lib/novel-taxonomy";

type AnalysisTaxonomyStyle = "fanqie" | "qidian";

function asText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function getGenreOptions(style: AnalysisTaxonomyStyle, reader: TargetReader) {
  return style === "qidian" ? qidianTaxonomyByReader[reader] : novelTaxonomy[reader].mainCategories;
}

function hasSubCategories(category: unknown): category is { subCategories: string[] } {
  return Boolean(
    category &&
      typeof category === "object" &&
      Array.isArray((category as { subCategories?: unknown }).subCategories)
  );
}

export function AnalysisProjectForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [taxonomyStyle, setTaxonomyStyle] = useState<AnalysisTaxonomyStyle>("fanqie");
  const [targetReader, setTargetReader] = useState<TargetReader>("男频");
  const [genre, setGenre] = useState(novelTaxonomy.男频.mainCategories[0].name);
  const [subCategory, setSubCategory] = useState("");
  const [openSelect, setOpenSelect] = useState<string | null>(null);

  const genreOptions = getGenreOptions(taxonomyStyle, targetReader);
  const selectedCategory = genreOptions.find((category) => category.name === genre) ?? genreOptions[0];
  const qidianSubCategories = taxonomyStyle === "qidian" && hasSubCategories(selectedCategory)
    ? selectedCategory.subCategories
    : [];
  const selectedSubCategory = taxonomyStyle === "qidian" ? subCategory || qidianSubCategories[0] || "" : "";
  const projectGenre = taxonomyStyle === "qidian" && selectedSubCategory ? `${genre} / ${selectedSubCategory}` : genre;
  const genreSelectOptions: Array<SelectOption<string>> = genreOptions.map((category) => ({
    value: category.name,
    label: category.name,
    hint: category.description
  }));
  const subCategoryOptions: Array<SelectOption<string>> = qidianSubCategories.length
    ? qidianSubCategories.map((category) => ({ value: category, label: category }))
    : [{ value: "", label: "暂无子类" }];

  function updateTargetReader(nextReader: TargetReader) {
    setTargetReader(nextReader);
    const nextCategory = getGenreOptions(taxonomyStyle, nextReader)[0];
    setGenre(nextCategory.name);
    setSubCategory(hasSubCategories(nextCategory) ? nextCategory.subCategories[0] ?? "" : "");
  }

  function updateTaxonomyStyle(nextStyle: AnalysisTaxonomyStyle) {
    setTaxonomyStyle(nextStyle);
    const nextCategory = getGenreOptions(nextStyle, targetReader)[0];
    setGenre(nextCategory.name);
    setSubCategory(hasSubCategories(nextCategory) ? nextCategory.subCategories[0] ?? "" : "");
  }

  function updateGenre(nextGenre: string) {
    setGenre(nextGenre);
    const nextCategory = genreOptions.find((category) => category.name === nextGenre);
    setSubCategory(hasSubCategories(nextCategory) ? nextCategory.subCategories[0] ?? "" : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const sourceTitle = asText(formData.get("sourceTitle"));
    const sourceSynopsis = asText(formData.get("sourceSynopsis"));
    const analysisGoal = asText(formData.get("analysisGoal"));
    const description = [
      sourceTitle ? `原书/来源：${sourceTitle}` : "",
      sourceSynopsis ? `原书简介：${sourceSynopsis}` : "",
      `分类体系：${taxonomyStyle === "qidian" ? "起点体系" : "番茄体系"}`,
      `目标读者：${targetReader}`,
      analysisGoal ? `分析目标：${analysisGoal}` : ""
    ].filter(Boolean).join("\n");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: asText(formData.get("name")),
          type: "analysis",
          genre: projectGenre,
          description
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "创建拆书项目失败");
      }

      const projectId = payload?.project?.id;

      if (!projectId) {
        throw new Error("创建成功但未返回项目 ID");
      }

      router.push(`/projects/${projectId}/import`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "创建拆书项目失败");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="analysis-create-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <div className="analysis-form-section">
        <div className="field">
          <div className="field-label">拆书项目名</div>
          <input name="name" placeholder="例如：某本都市退婚流前 30 章拆解" required />
        </div>

        <div className="split-panels">
          <div className="field">
            <div className="field-label">原书 / 来源说明</div>
            <input name="sourceTitle" placeholder="例如：书名、平台、题材来源" />
          </div>
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
        </div>
      </div>

      <div className="analysis-context-grid">
        <div className="field analysis-compact-textarea">
          <div className="field-label">原书简介 / 平台简介</div>
          <textarea
            name="sourceSynopsis"
            placeholder="粘贴作品简介、平台推荐语或一句话卖点。用于判断开局承诺、目标读者和爽点预期。"
          />
        </div>
        <div className="field analysis-compact-textarea">
          <div className="field-label">分析目标</div>
          <textarea
            name="analysisGoal"
            placeholder="例如：只拆前 30 章开局留存、爽点密度、主循环和可复用模板。"
          />
        </div>
      </div>

      <div className="analysis-taxonomy-grid">
        <div className="field">
          <div className="field-label">分类体系</div>
          <div className="title-style-picker" aria-label="拆书题材分类体系">
            <label>
              <input
                type="radio"
                name="taxonomyStyle"
                value="fanqie"
                checked={taxonomyStyle === "fanqie"}
                onChange={() => updateTaxonomyStyle("fanqie")}
              />
              <span>
                <strong>番茄体系</strong>
                <small>按番茄常见主分类拆解题材方向</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="taxonomyStyle"
                value="qidian"
                checked={taxonomyStyle === "qidian"}
                onChange={() => updateTaxonomyStyle("qidian")}
              />
              <span>
                <strong>起点体系</strong>
                <small>按起点大类和子类标记来源作品</small>
              </span>
            </label>
          </div>
        </div>

        <div className="analysis-taxonomy-stack">
          <div className="field">
            <div className="field-label">{taxonomyStyle === "qidian" ? "起点大类" : "题材方向"}</div>
            <CustomSelect
              id="analysis-genre"
              value={genre}
              options={genreSelectOptions}
              openSelect={openSelect}
              setOpenSelect={setOpenSelect}
              onChange={updateGenre}
            />
          </div>

          {taxonomyStyle === "qidian" ? (
            <div className="field">
              <div className="field-label">起点子类</div>
              <CustomSelect
                id="analysis-sub-category"
                value={selectedSubCategory}
                options={subCategoryOptions}
                openSelect={openSelect}
                setOpenSelect={setOpenSelect}
                onChange={setSubCategory}
              />
            </div>
          ) : null}

          <div className="analysis-genre-summary">
            <strong>{projectGenre}</strong>
            <span>{selectedCategory?.description}</span>
          </div>
        </div>
      </div>

      {error ? <div className="pill danger form-error">{error}</div> : null}

      <div className="book-create-actions">
        <Link href="/projects" className="button">
          取消
        </Link>
        <button className="button primary create-work-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "创建中..." : "创建并导入文本"}
        </button>
      </div>
    </form>
  );
}
