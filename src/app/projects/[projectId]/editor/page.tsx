import { notFound } from "next/navigation";
import { Panel } from "@/components/panel";
import {
  ApplySecondDraftButton,
  StreamEditorForm,
  TextComparison
} from "@/components/stream-editor-form";
import { getProjectWritingState } from "@/lib/projects";

const editorModes = [
  "拆书博主版",
  "网文作者版",
  "小说正文增强版"
];

export default async function ProjectEditorPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const state = await getProjectWritingState(projectId);

  if (!state) {
    notFound();
  }

  const latestReport = state.editReports[0];
  const latestDraft = state.drafts[0];
  const draftOptions = state.drafts.map((draft) => ({
    id: draft.id,
    chapterNumber: draft.chapterNumber,
    title: draft.title,
    content: draft.content,
    updatedAt: draft.updatedAt
  }));
  const fallbackText = "本章通过主角的成长，体现了爽点与冲突的结合，整体节奏较为平稳。";

  return (
    <div className="grid">
      <section className="hero">
        <div className="hero-top">
          <div>
            <h1>把 AI 味、模板腔和平均句子改掉</h1>
            <p>二稿编辑面向拆书稿和小说正文，不是简单润色，而是标问题、讲原因、给更有判断力的改写。</p>
          </div>
          <div className="hero-actions">
            <span className="chip">{editorModes.length} 种模式</span>
            <span className="chip">报告 {state.editReports.length}</span>
          </div>
        </div>
      </section>

      <div className="editor-page-grid">
        <Panel title="二稿编辑" description="标出 AI 味句子，再给出更像人写的改写方向。">
          <StreamEditorForm
            projectId={projectId}
            modes={editorModes}
            draftOptions={draftOptions}
            initialDraftId={latestDraft?.id}
            initialText={latestDraft?.content ?? fallbackText}
          />
        </Panel>

        <Panel title="最近一次编辑结果" description="二稿完成后会保存为报告，便于回看和继续修改。">
          {latestReport ? (
            <div className="list">
              <div className="list-item">
                <div className="row">
                  <strong>{latestReport.mode}</strong>
                  <span className="chip">{new Date(latestReport.updatedAt).toLocaleString("zh-CN")}</span>
                </div>
                <div className="muted">识别到 {latestReport.aiFlavorSentences.length} 句 AI 味表达。</div>
              </div>

              <div className="list-item">
                <strong>AI 味句子</strong>
                {latestReport.aiFlavorSentences.length === 0 ? (
                  <div className="muted">没有识别到明显模板腔。</div>
                ) : (
                  <div className="timeline">
                    {latestReport.aiFlavorSentences.map((sentence) => (
                      <div key={sentence} className="timeline-item">
                        <div className="muted">{sentence}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="list-item">
                <strong>问题原因</strong>
                <div className="meta-row">
                  {latestReport.diagnosis.map((item) => (
                    <span key={item} className="chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <TextComparison
                originalText={latestReport.originalText}
                revisedText={latestReport.revisedText}
                title="最近报告对照"
              />
              {latestReport.draftId ? (
                <ApplySecondDraftButton
                  projectId={projectId}
                  draftId={latestReport.draftId}
                  revisedText={latestReport.revisedText}
                />
              ) : (
                <div className="footer-note">这条旧二稿没有绑定章节，重新选择章节生成后可一键替换初稿。</div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <strong>暂无二稿结果</strong>
              <span>输入一段拆书分析或小说正文后，系统会标出 AI 味句子并给出改写版本。</span>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
