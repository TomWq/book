import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/components/api-form";
import { Panel } from "@/components/panel";
import { getTemplate, getLatestOutlineByTemplate } from "@/lib/projects";

export default async function TemplateDetailPage({
  params
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const [template, outline] = await Promise.all([
    getTemplate(templateId),
    getLatestOutlineByTemplate(templateId)
  ]);

  if (!template) {
    notFound();
  }

  return (
    <div className="grid two-col">
      <Panel title={template.name} description={template.openingHook}>
        <div className="list">
          <div className="list-item">
            <strong>主角模型</strong>
            <div className="muted">{template.protagonistModel || "未填写"}</div>
          </div>
          <div className="list-item">
            <strong>金手指 / 机制</strong>
            <div className="muted">{template.goldenFinger || "未填写"}</div>
          </div>
          <div className="list-item">
            <strong>主循环</strong>
            <div className="muted">{template.mainLoop}</div>
          </div>
          <div className="list-item">
            <strong>节奏</strong>
            <div className="muted">{template.chapterPacing}</div>
          </div>
          <div className="list-item">
            <strong>公式</strong>
            <div className="muted">{template.formula}</div>
          </div>
          <div className="list-item">
            <strong>可迁移结构</strong>
            <div className="meta-row">
              {template.usablePatterns.map((item) => (
                <span key={item} className="chip">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="list-item">
            <strong>不可照搬</strong>
            <div className="meta-row">
              {template.avoidCopying.map((item) => (
                <span key={item} className="chip">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="list-item">
            <strong>标签</strong>
            <div className="meta-row">
              {template.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="下一步"
        description="把模板直接迁移到新题材，生成新书大纲。"
        action={
          <Link href={`/templates/${template.id}/generate-outline`} className="button">
            生成大纲
          </Link>
        }
      >
        <div className="quote-box">
          配置题材、主角、金手指和爽点密度后，即可生成新书简介、前 10 章大纲和前 100 章节奏表。
        </div>
        <div style={{ height: 12 }} />
        {outline ? (
          <div className="list">
            <div className="list-item">
              <strong>最近大纲</strong>
              <div className="muted">{outline.logline}</div>
            </div>
          </div>
        ) : null}
      </Panel>

      <div style={{ gridColumn: "1 / -1" }}>
        <Panel title="编辑模板" description="模板可持续维护，作为后续大纲生成和迁移的资产。">
          <ApiForm
            className="forms"
            endpoint={`/api/templates/${template.id}`}
            method="PATCH"
            arrayFields={["usablePatterns", "avoidCopying", "tags"]}
          >
            <div className="field">
              <div className="field-label">模板名</div>
              <input name="name" defaultValue={template.name} />
            </div>
            <div className="field">
              <div className="field-label">题材</div>
              <input name="genre" defaultValue={template.genre} />
            </div>
            <div className="field">
              <div className="field-label">来源摘要</div>
              <textarea name="description" defaultValue={template.description} />
            </div>
            <div className="field">
              <div className="field-label">开局钩子</div>
              <textarea name="openingHook" defaultValue={template.openingHook} />
            </div>
            <div className="field">
              <div className="field-label">主循环</div>
              <textarea name="mainLoop" defaultValue={template.mainLoop} />
            </div>
            <div className="field">
              <div className="field-label">节奏密度</div>
              <textarea name="chapterPacing" defaultValue={template.chapterPacing} />
            </div>
            <div className="field">
              <div className="field-label">主角模型</div>
              <input name="protagonistModel" defaultValue={template.protagonistModel} />
            </div>
            <div className="field">
              <div className="field-label">金手指 / 机制</div>
              <input name="goldenFinger" defaultValue={template.goldenFinger} />
            </div>
            <div className="field">
              <div className="field-label">公式</div>
              <textarea name="formula" defaultValue={template.formula} />
            </div>
            <div className="field">
              <div className="field-label">迁移建议</div>
              <textarea name="migrationAdvice" defaultValue={template.migrationAdvice} />
            </div>
            <div className="split-panels">
              <div className="field">
                <div className="field-label">可迁移结构</div>
                <textarea name="usablePatterns" defaultValue={template.usablePatterns.join("\n")} />
              </div>
              <div className="field">
                <div className="field-label">不可照搬</div>
                <textarea name="avoidCopying" defaultValue={template.avoidCopying.join("\n")} />
              </div>
            </div>
            <div className="field">
              <div className="field-label">标签</div>
              <textarea name="tags" defaultValue={template.tags.join("\n")} />
            </div>
            <button className="button" type="submit">
              保存模板
            </button>
          </ApiForm>
        </Panel>
      </div>
    </div>
  );
}
