import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton } from "@/components/api-form";
import { Panel } from "@/components/panel";
import { getProject, getProjectAnalysis } from "@/lib/projects";

export default async function ProjectAnalysisFormulaPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, analysis] = await Promise.all([
    getProject(projectId),
    getProjectAnalysis(projectId)
  ]);

  if (!project) {
    notFound();
  }

  const storyAnalysis = analysis.storyAnalysis;
  const hasStoryAnalysis = Boolean(storyAnalysis);

  return (
    <div className="grid">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className={`pill ${hasStoryAnalysis ? "success" : "warning"}`}>
              {hasStoryAnalysis ? "公式可沉淀" : "等待整书分析"}
            </div>
            <h1>爆款公式与模板沉淀</h1>
            <p>这里承接拆书分析和图谱，把原书的商业结构提炼成可复用模板，再迁移到新题材。</p>
          </div>
          <div className="hero-actions">
            <Link className="button" href={`/projects/${projectId}/analysis/graph`}>
              返回图谱
            </Link>
            {storyAnalysis ? (
              <ApiButton
                endpoint={`/api/projects/${projectId}/template`}
                label="保存为模板"
                redirectPrefix="/templates/"
                redirectDataPath="template.id"
              />
            ) : null}
          </div>
        </div>
      </section>

      {!storyAnalysis ? (
        <Panel title="还没有可沉淀的公式" description="先完成章节拆解和整书分析后，再保存模板。">
          <div className="empty-state compact-empty">
            <strong>公式依赖整书分析</strong>
            <span>可以先去分析页选择前 30 章、单章或指定区间。分析完成后，这里会展示可复用公式。</span>
            <Link className="button primary" href={`/projects/${projectId}/analysis`}>
              去分析章节
            </Link>
          </div>
        </Panel>
      ) : (
        <div className="analysis-layout">
          <div className="analysis-main">
            <Panel title="核心公式" description="这不是复制原文，而是抽象商业结构。">
              <div className="formula-box">
                <div>
                  <div className="mini-label">题材类型</div>
                  <div className="quote-box">{storyAnalysis.genre}</div>
                </div>
                <div>
                  <div className="mini-label">爆款公式</div>
                  <div className="quote-box">{storyAnalysis.formula}</div>
                </div>
                <div>
                  <div className="mini-label">主循环</div>
                  <div className="muted">{storyAnalysis.mainLoop}</div>
                </div>
                <div>
                  <div className="mini-label">节奏判断</div>
                  <div className="muted">{storyAnalysis.pacing}</div>
                </div>
              </div>
            </Panel>

            <Panel title="迁移说明" description="明确哪些能借鉴，哪些必须避开。">
              <div className="list">
                <div className="list-item">
                  <strong>迁移建议</strong>
                  <div className="muted">{storyAnalysis.migrationAdvice}</div>
                </div>
                <div className="list-item">
                  <strong>可迁移结构</strong>
                  <div className="meta-row">
                    {storyAnalysis.usablePatterns.map((item) => (
                      <span key={item} className="chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="list-item">
                  <strong>不建议照搬</strong>
                  <div className="meta-row">
                    {storyAnalysis.avoidCopying.map((item) => (
                      <span key={item} className="chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <aside className="analysis-side">
            <Panel title="下一步" description="把公式沉淀为模板，再进入新题材迁移。">
              <div className="list">
                <div className="list-item">
                  <strong>1. 保存模板</strong>
                  <div className="muted">把当前拆书公式保存到模板库，后续可反复复用。</div>
                </div>
                <div className="list-item">
                  <strong>2. 迁移大纲</strong>
                  <div className="muted">从模板生成新书简介、卖点、前 10 章大纲和前 100 章节奏。</div>
                </div>
                <ApiButton
                  endpoint={`/api/projects/${projectId}/template`}
                  label="保存为模板"
                  redirectPrefix="/templates/"
                  redirectDataPath="template.id"
                />
                <Link className="button" href="/templates">
                  去模板库
                </Link>
              </div>
            </Panel>
          </aside>
        </div>
      )}
    </div>
  );
}
