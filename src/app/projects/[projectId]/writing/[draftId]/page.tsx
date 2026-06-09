import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton } from "@/components/api-form";
import { DraftExportActions } from "@/components/draft-export-actions";
import { DraftRevisionEditor } from "@/components/draft-revision-editor";
import { Panel } from "@/components/panel";
import { getProjectWritingState } from "@/lib/projects";
import { formatReviewText } from "@/lib/review-display";

export default async function ChapterDraftReaderPage({
  params
}: {
  params: Promise<{ projectId: string; draftId: string }>;
}) {
  const { projectId, draftId } = await params;
  const writingState = await getProjectWritingState(projectId);

  if (!writingState) {
    notFound();
  }

  const drafts = [...writingState.drafts].sort(
    (a, b) => a.chapterNumber - b.chapterNumber || a.updatedAt.localeCompare(b.updatedAt)
  );
  const draft = drafts.find((item) => item.id === draftId);

  if (!draft) {
    notFound();
  }

  const currentIndex = drafts.findIndex((item) => item.id === draft.id);
  const previousDraft = currentIndex > 0 ? drafts[currentIndex - 1] : null;
  const nextDraft = currentIndex >= 0 && currentIndex < drafts.length - 1 ? drafts[currentIndex + 1] : null;
  const nearbyDrafts = drafts.slice(
    Math.max(0, currentIndex - 5),
    Math.min(drafts.length, currentIndex + 6)
  );
  const ledger = writingState.ledgers.find((item) => item.draftId === draft.id);
  const review = writingState.reviews.find((item) => item.draftId === draft.id);
  const paragraphs = draft.content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="grid">
      <section className="hero">
        <div className="hero-top">
          <div>
            <h1>
              第 {draft.chapterNumber} 章 · {draft.title}
            </h1>
            <p>
              {writingState.project.name} · {draft.content.replace(/\s/g, "").length.toLocaleString("zh-CN")} 字
            </p>
          </div>
          <div className="hero-actions">
            <DraftExportActions
              content={draft.content}
              projectName={writingState.project.name}
              chapterNumber={draft.chapterNumber}
              title={draft.title}
            />
            <Link className="button" href={`/projects/${projectId}/writing`}>
              返回创作台
            </Link>
            {previousDraft ? (
              <Link className="button" href={`/projects/${projectId}/writing/${previousDraft.id}`}>
                上一章
              </Link>
            ) : null}
            {nextDraft ? (
              <Link className="button primary" href={`/projects/${projectId}/writing/${nextDraft.id}`}>
                下一章
              </Link>
            ) : (
              <Link className="button primary" href={`/projects/${projectId}/writing#task-card-form`}>
                继续写下一章
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="writing-layout">
        <main className="writing-main">
          <Panel title="章节正文" description="这里用于连续阅读已生成的章节草稿。">
            <div className="draft-reader-toolbar">
              <div>
                <div className="mini-label">本章操作</div>
                <strong>复制或导出当前章节</strong>
              </div>
              <DraftExportActions
                content={draft.content}
                projectName={writingState.project.name}
                chapterNumber={draft.chapterNumber}
                title={draft.title}
                compact
              />
            </div>
            <article className="draft-reader">
              {paragraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
              ))}
            </article>
          </Panel>

          <Panel title="正文编辑" description="可按审稿建议套用修改，也可以手动调整全文。">
            <DraftRevisionEditor
              projectId={projectId}
              draftId={draft.id}
              initialContent={draft.content}
              reviewIssues={review?.issues ?? []}
            />
          </Panel>
        </main>

        <aside className="writing-side">
          <Panel title="章节信息" description="查看这章是否已经沉淀进长期状态。">
            <div className="list">
              <div className="task-block">
                <div className="task-title">生成状态</div>
                <div className="meta-row">
                  <span className="chip">草稿</span>
                  {ledger ? <span className="chip">台账</span> : null}
                  {review ? <span className="chip">审稿</span> : null}
                </div>
              </div>
              <div className="task-block">
                <div className="task-title">章节台账</div>
                <div className="muted">
                  {ledger ? "重新提取本章事件、线索、人物变化和未完成任务。" : "为本章生成台账，让后续章节读取这章的长期记忆。"}
                </div>
                <div className="hero-actions">
                  <ApiButton
                    endpoint={`/api/projects/${projectId}/writing`}
                    body={{ action: "create_ledger", draftId: draft.id }}
                    label={ledger ? "重新生成台账" : "生成章节台账"}
                    className="button small-button"
                    confirmMessage={ledger ? `确定重新生成第 ${draft.chapterNumber} 章台账吗？旧台账会被新台账覆盖。` : undefined}
                    successMessage={ledger ? "章节台账已重新生成" : "章节台账已生成"}
                    pendingTitle={ledger ? "正在重新生成章节台账" : "正在生成章节台账"}
                    pendingDescription="正在提取本章事件、人物变化、伏笔、章末钩子和滚入下一章任务。"
                  />
                </div>
              </div>
              {ledger ? (
                <div className="task-block">
                  <div className="task-title">章末钩子</div>
                  <div className="muted">{ledger.cliffhanger}</div>
                </div>
              ) : (
                <div className="empty-state">
                  <strong>还没有章节台账</strong>
                  <span>回到创作台后，可以给本章生成台账，让后续章节能读取这章的长期记忆。</span>
                </div>
              )}
              {ledger?.carryOverTasks?.length ? (
                <div className="task-block">
                  <div className="task-title">滚入下一章</div>
                  <div className="muted">{ledger.carryOverTasks.slice(0, 4).join("；")}</div>
                </div>
              ) : null}
              {review ? (
                <div className="task-block">
                  <div className="task-title">审稿结论</div>
                  <div className="muted">{formatReviewText(review.overall)}</div>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel title="章节目录" description="显示当前章节附近的正文，完整列表可进入总目录。">
            <div className="list">
              {nearbyDrafts.map((item) => (
                <Link
                  key={item.id}
                  className={`task-block ${item.id === draft.id ? "active-chapter-link" : ""}`}
                  href={`/projects/${projectId}/writing/${item.id}`}
                >
                  <div className="row">
                    <strong>第 {item.chapterNumber} 章</strong>
                    {item.id === draft.id ? <span className="pill success">当前</span> : null}
                  </div>
                  <div className="muted">{item.title}</div>
                </Link>
              ))}
              <Link className="button" href={`/projects/${projectId}/writing/chapters`}>
                查看完整章节目录
              </Link>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
