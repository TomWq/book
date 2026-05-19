import { notFound } from "next/navigation";
import { ApiForm } from "@/components/api-form";
import { CreateProjectFromOutlineForm } from "@/components/create-project-from-outline-form";
import { Panel } from "@/components/panel";
import { getLatestOutlineByTemplate, getTemplate } from "@/lib/projects";

export default async function GenerateOutlinePage({
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

  const outlineReady = Boolean(outline);
  const resultAnchors = outline
    ? [
        ["create", "创作"],
        ["intro", "简介"],
        ["setting", "设定"],
        ["chapters", "前 10 章"],
        ["pacing", "节奏"],
        ["foreshadowing", "伏笔"],
        ["selling", "卖点"]
      ]
    : [];

  return (
    <div className="grid outline-generate-page">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className={`pill ${outlineReady ? "success" : "warning"}`}>
              {outlineReady ? "已有生成结果" : "等待生成"}
            </div>
            <h1>新题材大纲生成</h1>
            <p>
              基于模板，把题材、身份、金手指、爽点密度和篇幅变量迁移成一套新书方案。
            </p>
          </div>
          <div className="hero-actions">
            <span className="chip">{template.genre || "未分类"}</span>
            <span className="chip">{template.chapterPacing || "未填写节奏"}</span>
          </div>
        </div>
      </section>

      <div className="outline-workbench">
        <aside className="outline-config-pane">
          <Panel title="新题材变量" description="配置主角、题材、金手指和爽点密度。">
            <ApiForm
              className="forms compact-outline-form"
              endpoint={`/api/templates/${templateId}/outlines`}
              redirectPrefix={`/templates/${templateId}/generate-outline?outline=`}
              redirectDataPath="outline.id"
            >
              <div className="field">
                <div className="field-label">题材</div>
                <input name="genre" defaultValue={template.genre || "都市逆袭"} />
              </div>
              <div className="field">
                <div className="field-label">主角身份</div>
                <input name="protagonist" defaultValue={template.protagonistModel || "被轻视的隐藏强者"} />
              </div>
              <div className="field">
                <div className="field-label">金手指类型</div>
                <input name="goldenFinger" defaultValue={template.goldenFinger || "系统"} />
              </div>
              <div className="field">
                <div className="field-label">世界观背景</div>
                <textarea
                  name="worldBackground"
                  defaultValue={`${template.genre || "都市逆袭"}背景下，资源、身份和信息差共同决定角色命运。`}
                />
              </div>
              <div className="split-panels">
                <div className="field">
                  <div className="field-label">爽点密度</div>
                  <input name="pleasureDensity" defaultValue={template.chapterPacing || "2-3章一个小爽点"} />
                </div>
                <div className="field">
                  <div className="field-label">感情线强度</div>
                  <input name="romanceStrength" defaultValue="弱线" />
                </div>
              </div>
              <div className="split-panels">
                <div className="field">
                  <div className="field-label">黑暗程度</div>
                  <input name="darknessLevel" defaultValue="中等" />
                </div>
                <div className="field">
                  <div className="field-label">预计篇幅</div>
                  <input name="estimatedLength" defaultValue="80-120万字" />
                </div>
              </div>
              <div className="field">
                <div className="field-label">目标读者</div>
                <input name="targetReader" defaultValue="网文读者" />
              </div>
              <button className="button primary" type="submit">
                生成大纲
              </button>
            </ApiForm>
          </Panel>
        </aside>

        <section className="outline-result-pane">
          <div className="outline-result-head">
            <div>
              <h2>生成结果</h2>
              <p>简介、设定、章节、节奏和伏笔分区展示，右侧区域独立滚动。</p>
            </div>
            {resultAnchors.length > 0 ? (
              <div className="outline-anchor-row">
                {resultAnchors.map(([href, label]) => (
                  <a key={href} href={`#${href}`}>
                    {label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {outline ? (
            <div className="outline-result-scroll">
              <div id="create">
                <CreateProjectFromOutlineForm template={template} outline={outline} />
              </div>

              <article id="intro" className="outline-result-section">
                <div className="section-title">简介</div>
                <p>{outline.intro}</p>
              </article>

              <article className="outline-result-section">
                <div className="section-title">模板继承 / 变量迁移 / 标题方向</div>
                <div className="outline-chip-group">
                  {(outline.templateInheritance ?? []).map((item) => (
                    <span key={item} className="chip">
                      {item}
                    </span>
                  ))}
                  {(outline.variableMapping ?? []).map((item) => (
                    <span key={item} className="chip">
                      {item}
                    </span>
                  ))}
                  {outline.titleOptions.map((title) => (
                    <span key={title} className="chip">
                      {title}
                    </span>
                  ))}
                </div>
              </article>

              <article id="setting" className="outline-result-section two-up">
                <div>
                  <div className="section-title">世界观</div>
                  <p>{outline.worldSetting}</p>
                </div>
                <div>
                  <div className="section-title">主角设定</div>
                  <p>{outline.protagonist}</p>
                </div>
              </article>

              <article className="outline-result-section">
                <div className="section-title">人物功能表</div>
                <div className="outline-chip-group">
                  {outline.characters.map((item) => (
                    <span key={item} className="chip">
                      {item}
                    </span>
                  ))}
                </div>
              </article>

              <article id="chapters" className="outline-result-section">
                <div className="section-title">前 10 章</div>
                <ol className="outline-chapter-list">
                  {outline.first10Chapters.map((chapter, index) => (
                    <li key={`${index}-${chapter.slice(0, 16)}`}>
                      <span>{index + 1}</span>
                      <p>{chapter}</p>
                    </li>
                  ))}
                </ol>
              </article>

              <article id="pacing" className="outline-result-section two-up">
                <div>
                  <div className="section-title">前 100 章节奏表</div>
                  <p>{outline.first100Pacing}</p>
                </div>
                <div>
                  <div className="section-title">爽点分布</div>
                  <p>{outline.pleasureDistribution}</p>
                </div>
              </article>

              <article id="foreshadowing" className="outline-result-section">
                <div className="section-title">伏笔安排</div>
                <div className="outline-chip-group">
                  {outline.foreshadowingPlan.map((item) => (
                    <span key={item} className="chip">
                      {item}
                    </span>
                  ))}
                </div>
              </article>

              <article id="selling" className="outline-result-section">
                <div className="section-title">卖点</div>
                <div className="outline-chip-group">
                  {outline.coreSellingPoints.map((point) => (
                    <span key={point} className="chip">
                      {point}
                    </span>
                  ))}
                </div>
              </article>
            </div>
          ) : (
            <div className="empty-state outline-empty">
              <strong>还没有生成大纲</strong>
              <span>先提交左侧变量，系统会输出简介、前 10 章、前 100 章节奏和模板迁移说明。</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
