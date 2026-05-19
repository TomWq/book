import Link from "next/link";
import { ApiButton, ApiForm } from "@/components/api-form";
import { Panel } from "@/components/panel";
import { getProjectAnalysis } from "@/lib/projects";

const PAGE_SIZE = 20;

function numberParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default async function ProjectChaptersPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const { chapters, chapterAnalyses } = await getProjectAnalysis(projectId);
  const sortedChapters = [...chapters].sort(
    (a, b) => a.chapterNumber - b.chapterNumber || a.orderIndex - b.orderIndex
  );
  const analysisByChapterId = new Map(chapterAnalyses.map((item) => [item.chapterId, item]));
  const totalPages = Math.max(1, Math.ceil(sortedChapters.length / PAGE_SIZE));
  const currentPage = Math.min(totalPages, numberParam(query.page));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageChapters = sortedChapters.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = sortedChapters.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(sortedChapters.length, pageStart + PAGE_SIZE);
  const analyzedCount = chapterAnalyses.length;
  const withHookCount = chapterAnalyses.filter((item) => Boolean(item.cliffhanger)).length;
  const nextStep =
    sortedChapters.length === 0
      ? {
          label: "下一步",
          title: "先导入原文并完成分章",
          description: "上传 TXT 或粘贴文本后，系统会自动拆出章节，再回到这里校正标题和顺序。",
          href: `/projects/${projectId}/import`,
          action: "去导入文本"
        }
      : analyzedCount === 0
        ? {
            label: "下一步",
            title: "章节已拆开，接下来开始 AI 拆解",
            description: "不用删除多余章节，可以在分析页选择前 10 章、前 30 章、单章或指定区间开始分析。",
            href: `/projects/${projectId}/analysis`,
            action: "去选择分析范围"
          }
        : analyzedCount < sortedChapters.length
          ? {
              label: "继续推进",
              title: "已有部分章节分析，可以继续补分析",
              description: `当前已分析 ${analyzedCount.toLocaleString("zh-CN")} / ${sortedChapters.length.toLocaleString("zh-CN")} 章，可继续选择章节区间补充拆解。`,
              href: `/projects/${projectId}/analysis`,
              action: "继续章节分析"
            }
          : {
              label: "下一步",
              title: "章节已完成拆解，去查看整书分析",
              description: "可以查看节奏、爽点、主循环和可迁移公式，再保存为模板用于新书创作。",
              href: `/projects/${projectId}/analysis`,
              action: "查看整书分析"
            };

  return (
    <div className="grid">
      <section className="chapter-next-step">
        <div>
          <span>{nextStep.label}</span>
          <strong>{nextStep.title}</strong>
          <p>{nextStep.description}</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href={nextStep.href}>
            {nextStep.action}
          </Link>
          {sortedChapters.length > 0 ? (
            <Link className="button" href={`/projects/${projectId}/import`}>
              继续导入
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid two-col">
      <Panel title="章节列表" description="支持编辑、删除和上下调整，作为分章后的人工校正入口。">
        <div className="meta-row" style={{ marginBottom: 14 }}>
          <span className="chip">{sortedChapters.length} 章</span>
          <span className="chip">{analyzedCount} 个拆解结果</span>
          <span className="chip">{withHookCount} 个带钩子章节</span>
          {sortedChapters.length > PAGE_SIZE ? (
            <span className="chip">
              当前 {rangeStart}-{rangeEnd} 章 / 每页 {PAGE_SIZE} 章
            </span>
          ) : null}
        </div>
        {sortedChapters.length > PAGE_SIZE ? (
          <div className="chapter-pagination">
            <div className="muted">
              章节较多时分页校正，避免一次性加载几百章正文。
            </div>
            <div className="hero-actions">
              {currentPage > 1 ? (
                <Link className="button" href={`/projects/${projectId}/chapters?page=${currentPage - 1}`}>
                  上一页
                </Link>
              ) : null}
              <span className="chip">
                第 {currentPage} / {totalPages} 页
              </span>
              {currentPage < totalPages ? (
                <Link className="button" href={`/projects/${projectId}/chapters?page=${currentPage + 1}`}>
                  下一页
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="chapter-cards">
          {sortedChapters.length === 0 ? (
            <div className="empty-state">
              <strong>暂无章节</strong>
              <span>先到导入页上传文本，系统自动分章后再回来校正标题和顺序。</span>
              <Link className="button" href={`/projects/${projectId}/import`}>
                去导入页
              </Link>
            </div>
          ) : (
            pageChapters.map((chapter, index) => {
              const globalIndex = pageStart + index;
              const analysis = analysisByChapterId.get(chapter.id);
              const hasAnalysis = Boolean(analysis);

              return (
                <div key={chapter.id} className="chapter-editor">
                  <ApiForm
                    className="chapter-editor-main"
                    endpoint={`/api/projects/${projectId}/chapters/${chapter.id}`}
                    method="PATCH"
                  >
                    <div className="chapter-card-head">
                      <div className="chapter-index">第 {chapter.chapterNumber} 章</div>
                      <input name="title" defaultValue={chapter.title} aria-label="章节标题" />
                      <span className="chip">{chapter.charCount.toLocaleString("zh-CN")} 字</span>
                    </div>

                    {hasAnalysis ? (
                      <div className="analysis-snippets">
                        <section>
                          <span>冲突</span>
                          <p>{analysis?.conflict ?? "待分析"}</p>
                        </section>
                        <section>
                          <span>爽点</span>
                          <p>{analysis?.payoff ?? "待分析"}</p>
                        </section>
                        <section>
                          <span>钩子</span>
                          <p>{analysis?.cliffhanger ?? "待分析"}</p>
                        </section>
                      </div>
                    ) : (
                      <div className="analysis-placeholder">
                        <strong>还没有 AI 分析结果</strong>
                        <span>完成章节拆解后，这里才会显示冲突、爽点和钩子。</span>
                      </div>
                    )}

                    <details className="chapter-content-editor">
                      <summary>编辑章节正文</summary>
                      <textarea
                        name="content"
                        defaultValue={chapter.content}
                        aria-label={`第${chapter.chapterNumber}章正文`}
                      />
                    </details>

                    <div className="hero-actions">
                      <button className="button" type="submit">
                        保存
                      </button>
                    </div>
                  </ApiForm>
                  <div className="chapter-card-actions">
                    <ApiButton
                      endpoint={`/api/projects/${projectId}/chapters/${chapter.id}`}
                      method="PATCH"
                      body={{ action: "move", direction: "up" }}
                      label="上移"
                      disabled={globalIndex === 0}
                    />
                    <ApiButton
                      endpoint={`/api/projects/${projectId}/chapters/${chapter.id}`}
                      method="PATCH"
                      body={{ action: "move", direction: "down" }}
                      label="下移"
                      disabled={globalIndex === sortedChapters.length - 1}
                    />
                    <ApiButton
                      endpoint={`/api/projects/${projectId}/chapters/${chapter.id}`}
                      method="DELETE"
                      label="删除"
                      className="button danger"
                      confirmMessage="确定删除这个章节吗？删除后对应章节内容需要重新导入或手动补章。"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
        {sortedChapters.length > PAGE_SIZE ? (
          <div className="chapter-pagination chapter-pagination-bottom">
            <div className="hero-actions">
              {currentPage > 1 ? (
                <Link className="button" href={`/projects/${projectId}/chapters?page=${currentPage - 1}`}>
                  上一页
                </Link>
              ) : null}
              <span className="chip">
                第 {currentPage} / {totalPages} 页
              </span>
              {currentPage < totalPages ? (
                <Link className="button" href={`/projects/${projectId}/chapters?page=${currentPage + 1}`}>
                  下一页
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title="手动补章" description="用于分章后补录漏掉的章节或拆错的章节。">
        <ApiForm className="forms" endpoint={`/api/projects/${projectId}/chapters`} resetOnSuccess>
          <div className="field">
            <div className="field-label">章节标题</div>
            <input name="title" placeholder="例如：第 31 章 误入黑市" />
          </div>
          <div className="field">
            <div className="field-label">章节内容</div>
            <textarea
              name="content"
              placeholder="把分章漏掉或需要重建的章节内容贴到这里。"
            />
          </div>
          <button className="button" type="submit">
            新增章节
          </button>
        </ApiForm>
        <div className="quote-box">
          如果某一章被拆错了，先修正文和标题，再回到分析页重新跑一遍拆解。
        </div>
      </Panel>
      </div>
    </div>
  );
}
