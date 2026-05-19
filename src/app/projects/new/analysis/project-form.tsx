"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const genreOptions = [
  "都市逆袭",
  "玄幻升级",
  "修仙",
  "规则怪谈",
  "悬疑脑洞",
  "末世",
  "女频重生",
  "历史权谋",
  "直播",
  "其他"
];

function asText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function AnalysisProjectForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const sourceTitle = asText(formData.get("sourceTitle"));
    const analysisGoal = asText(formData.get("analysisGoal"));
    const description = [
      sourceTitle ? `原书/来源：${sourceTitle}` : "",
      analysisGoal ? `分析目标：${analysisGoal}` : ""
    ].filter(Boolean).join("\n");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: asText(formData.get("name")),
          type: "analysis",
          genre: asText(formData.get("genre")),
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
          <div className="field-label">题材方向</div>
          <select name="genre" defaultValue="都市逆袭">
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <div className="field-label">分析目标</div>
        <textarea
          name="analysisGoal"
          placeholder="例如：只拆前 30 章开局留存、爽点密度、主循环和可复用模板。"
        />
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
