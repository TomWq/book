import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton } from "@/components/api-form";
import { DraftExportActions } from "@/components/draft-export-actions";
import { Panel } from "@/components/panel";
import { getProjectWritingState } from "@/lib/projects";

const PAGE_SIZE = 4;

function numberParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function optionalNumberParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function pageForChapter(chapterNumber: number, drafts: Array<{ chapterNumber: number }>) {
  if (!Number.isFinite(chapterNumber) || chapterNumber <= 0 || drafts.length === 0) {
    return null;
  }

  const index = drafts.findIndex((draft) => draft.chapterNumber >= chapterNumber);
  const safeIndex = index >= 0 ? index : drafts.length - 1;

  return Math.floor(safeIndex / PAGE_SIZE) + 1;
}

function draftPreview(value: string) {
  const text = value
    .replace(/^#\s*第.+?章[^\n]*\n?/, "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 132 ? `${text.slice(0, 132)}...` : text;
}

export default async function WritingChapterDirectoryPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ page?: string | string[]; chapter?: string | string[] }>;
}) {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const writingState = await getProjectWritingState(projectId);

  if (!writingState) {
    notFound();
  }

  const drafts = [...writingState.drafts].sort(
    (a, b) => a.chapterNumber - b.chapterNumber || a.updatedAt.localeCompare(b.updatedAt)
  );
  const totalPages = Math.max(1, Math.ceil(drafts.length / PAGE_SIZE));
  const requestedChapter = optionalNumberParam(query.chapter);
  const jumpPage = requestedChapter ? pageForChapter(requestedChapter, drafts) : null;
  const currentPage = Math.min(totalPages, jumpPage ?? numberParam(query.page));
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageDrafts = drafts.slice(start, start + PAGE_SIZE);
  const pageStart = pageDrafts[0]?.chapterNumber ?? 0;
  const pageEnd = pageDrafts.at(-1)?.chapterNumber ?? 0;
  const chapterInputValue = Array.isArray(query.chapter) ? query.chapter[0] : query.chapter;

  return (
    <div className="grid">
      <Panel
        title="正文目录"
        description={`已生成 ${drafts.length.toLocaleString("zh-CN")} 章正文。目录每页显示 ${PAGE_SIZE} 章，可按章节号快速跳转。`}
      >
        {drafts.length > 0 ? (
          <div className="writing-directory">
            <div className="writing-directory-toolbar">
              <div>
                <div className="mini-label">当前页</div>
                <strong>
                  第 {pageStart}-{pageEnd} 章 / 共 {drafts.length.toLocaleString("zh-CN")} 章
                </strong>
              </div>
              <div className="directory-toolbar-actions">
                <form className="chapter-jump-form" action={`/projects/${projectId}/writing/chapters`} method="get">
                  <label htmlFor="chapter-jump">跳到章节</label>
                  <input
                    id="chapter-jump"
                    name="chapter"
                    type="number"
                    min={1}
                    max={drafts.at(-1)?.chapterNumber ?? drafts.length}
                    defaultValue={chapterInputValue ?? ""}
                    placeholder="如 100"
                  />
                  <button className="button small-button" type="submit">
                    跳转
                  </button>
                </form>
              </div>
            </div>

            <div className="writing-directory-grid">
              {pageDrafts.map((draft) => {
                const ledger = writingState.ledgers.find((item) => item.draftId === draft.id);
                const review = writingState.reviews.find((item) => item.draftId === draft.id);
                const wordCount = draft.content.replace(/\s/g, "").length;
                const updatedAt = new Date(draft.updatedAt).toLocaleString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit"
                });

                return (
                  <article key={draft.id} className="writing-directory-card">
                    <div className="writing-directory-card-head">
                      <div className="chapter-number-badge">第 {draft.chapterNumber} 章</div>
                      <Link className="writing-directory-title" href={`/projects/${projectId}/writing/${draft.id}`}>
                        {draft.title}
                      </Link>
                    </div>
                    <p>{draftPreview(draft.content) || "本章正文暂无可预览内容。"}</p>
                    <div className="writing-directory-meta">
                      <span>{wordCount.toLocaleString("zh-CN")} 字</span>
                      <span>{updatedAt}</span>
                      <span>{ledger ? "已建台账" : "未建台账"}</span>
                      <span>{review ? "已审稿" : "未审稿"}</span>
                    </div>
                    <div className="writing-directory-actions">
                      <Link className="button primary small-button" href={`/projects/${projectId}/writing/${draft.id}`}>
                        阅读正文
                      </Link>
                      <DraftExportActions
                        content={draft.content}
                        projectName={writingState.project.name}
                        chapterNumber={draft.chapterNumber}
                        title={draft.title}
                        compact
                      />
                      <ApiButton
                        endpoint={`/api/projects/${projectId}/writing`}
                        body={{ action: "delete_chapters_from", chapterNumber: draft.chapterNumber }}
                        label="从本章起重写"
                        className="button danger small-button"
                        confirmMessage={`确定从第 ${draft.chapterNumber} 章开始重写吗？会删除第 ${draft.chapterNumber} 章及后续所有任务卡、正文、台账和审稿。`}
                      />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="chapter-pagination chapter-pagination-bottom">
              {currentPage > 1 ? (
                <Link className="button" href={`/projects/${projectId}/writing/chapters?page=${currentPage - 1}`}>
                  上一页
                </Link>
              ) : null}
              <span className="chip">
                第 {currentPage} / {totalPages} 页
              </span>
              {currentPage < totalPages ? (
                <Link className="button" href={`/projects/${projectId}/writing/chapters?page=${currentPage + 1}`}>
                  下一页
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>暂时还没有正文</strong>
            <span>先回创作台生成任务卡和章节正文，生成后会自动进入这里。</span>
            <Link className="button primary" href={`/projects/${projectId}/writing`}>
              返回创作台
            </Link>
          </div>
        )}
      </Panel>
    </div>
  );
}
