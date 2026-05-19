import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { Panel } from "@/components/panel";
import { getProject, getProjectAnalysis, getProjectChapters, getProjectWritingState } from "@/lib/projects";

export default async function ProjectOverviewPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, chapters, analysis, writingState] = await Promise.all([
    getProject(projectId),
    getProjectChapters(projectId),
    getProjectAnalysis(projectId),
    getProjectWritingState(projectId)
  ]);

  if (!project) {
    notFound();
  }
  const workflowSteps =
    project.type === "analysis"
      ? [
          {
            title: "导入与分章",
            detail: project._count.chapters > 0 ? `${project._count.chapters} 章已就绪` : "等待导入文本",
            done: project._count.chapters > 0,
            href: `/projects/${projectId}/import`
          },
          {
            title: "章节拆解",
            detail:
              project._count.chapterAnalyses > 0
                ? `${project._count.chapterAnalyses} 章已拆解`
                : "等待 AI 分析章节",
            done: project._count.chapterAnalyses > 0,
            href: `/projects/${projectId}/chapters`
          },
          {
            title: "公式与模板",
            detail: analysis.storyAnalysis ? "可保存为模板" : "等待整书分析",
            done: Boolean(analysis.storyAnalysis),
            href: `/projects/${projectId}/analysis`
          },
          {
            title: "迁移到新题材",
            detail: analysis.storyAnalysis ? "保存模板后生成大纲" : "先完成公式提取",
            done: false,
            href: analysis.storyAnalysis ? `/projects/${projectId}/analysis` : `/projects/${projectId}/analysis`
          }
        ]
      : [
          {
            title: "创作圣经",
            detail: "维护世界观、金手指、禁区",
            done: true,
            href: `/projects/${projectId}/state`
          },
          {
            title: "章节任务卡",
            detail: "每章开写前先定剧情任务",
            done: project._count.writingTaskCards > 0,
            href: `/projects/${projectId}/writing`
          },
          {
            title: "正文与台账",
            detail: "写完后沉淀长期记忆",
            done: project._count.chapterDrafts > 0,
            href: `/projects/${projectId}/writing`
          },
          {
            title: "一致性审稿",
            detail: "检查设定、伏笔、人物和 AI 味",
            done: project._count.reviewReports > 0,
            href: `/projects/${projectId}/writing`
          }
        ];

  return (
    <div className="grid">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className={`pill ${project.type === "analysis" ? "success" : "warning"}`}>
              {project.type === "analysis" ? "拆书项目" : "创作项目"}
            </div>
            <h1>{project.name}</h1>
            <p>{project.description || "还没有填写项目说明。"}</p>
          </div>
          <div className="hero-actions">
            <Link href={`/projects/${projectId}/jobs`} className="button">
              任务队列
            </Link>
            <Link href={`/projects/${projectId}/${project.type === "analysis" ? "import" : "writing"}`} className="button">
              进入下一步
            </Link>
            <DeleteProjectButton projectId={projectId} projectName={project.name} />
          </div>
        </div>

        {project.type === "writing" ? (
          <div className="grid stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="stat-card">
              <strong>{project._count.chapterDrafts}</strong>
              <span>已写正文</span>
            </div>
            <div className="stat-card">
              <strong>{project._count.writingTaskCards}</strong>
              <span>任务卡</span>
            </div>
            <div className="stat-card">
              <strong>{project._count.chapterLedgers}</strong>
              <span>章节台账</span>
            </div>
            <div className="stat-card">
              <strong>{project._count.reviewReports}</strong>
              <span>审稿报告</span>
            </div>
          </div>
        ) : (
          <div className="grid stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="stat-card">
              <strong>{project._count.chapters}</strong>
              <span>已导入章节</span>
            </div>
            <div className="stat-card">
              <strong>{project._count.chapterAnalyses}</strong>
              <span>关键爽点</span>
            </div>
            <div className="stat-card">
              <strong>{project._count.storyAnalyses}</strong>
              <span>整书分析</span>
            </div>
            <div className="stat-card">
              <strong>{project._count.aiJobs}</strong>
              <span>AI 任务</span>
            </div>
          </div>
        )}
      </section>

      <Panel title="当前流程" description="项目应该沿着产品主链路推进，不做泛聊天式写作。">
        <div className="workflow-grid">
          {workflowSteps.map((step, index) => (
            <Link key={step.title} href={step.href} className="workflow-item">
              <div className="row">
                <strong>
                  {index + 1}. {step.title}
                </strong>
                <span className={`pill ${step.done ? "success" : "warning"}`}>
                  {step.done ? "已完成" : "待推进"}
                </span>
              </div>
              <div className="muted">{step.detail}</div>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid two-col">
      <Panel title="项目概览" description="这是当前项目的结构摘要。">
        <div style={{ height: 16 }} />
        <div className="quote-box">{analysis.storyAnalysis?.mainLoop ?? "当前还没有分析结果。"}</div>
        <div style={{ height: 12 }} />
        <div className="hero-actions">
          <Link href={`/projects/${projectId}/jobs`} className="button">
            查看任务队列
          </Link>
          <Link href={`/projects/${projectId}/${project.type === "analysis" ? "import" : "writing"}`} className="button">
            进入下一步
          </Link>
        </div>
      </Panel>

      <Panel title="最近章节" description="用于预览节奏和连载状态。">
        <div className="list">
          {project.type === "writing" ? (
            writingState?.drafts.length ? (
              writingState.drafts.slice(0, 4).map((draft) => (
                <div key={draft.id} className="list-item">
                  <div className="row">
                    <strong>
                      第 {draft.chapterNumber} 章 · {draft.title}
                    </strong>
                    <span className="chip">{draft.content.length} 字</span>
                  </div>
                  <div className="muted">
                    {draft.content.slice(0, 80)}
                    {draft.content.length > 80 ? "…" : ""}
                  </div>
                  <div className="row">
                    <div className="footer-note">更新时间：{new Date(draft.updatedAt).toLocaleString("zh-CN")}</div>
                    <Link className="button" href={`/projects/${projectId}/writing/${draft.id}`}>
                      阅读正文
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <strong>暂时还没有正文</strong>
                <span>先进入创作工作台，生成任务卡和章节正文。</span>
                <Link href={`/projects/${projectId}/writing`} className="button">
                  开始创作
                </Link>
              </div>
            )
          ) : chapters.length === 0 ? (
            <div className="empty-state">
              <strong>暂时还没有章节</strong>
              <span>
                先去导入文本，系统会自动分章并开始拆解。
              </span>
              <Link href={`/projects/${projectId}/import`} className="button">
                开始下一步
              </Link>
            </div>
          ) : (
            chapters.slice(-4).map((chapter) => (
              <div key={chapter.id} className="list-item">
                <div className="row">
                  <strong>
                    第 {chapter.chapterNumber} 章 · {chapter.title}
                  </strong>
                  <span className="chip">{chapter.charCount} 字</span>
                </div>
                <div className="muted">
                  {chapter.content.slice(0, 80)}
                  {chapter.content.length > 80 ? "…" : ""}
                </div>
                <div className="footer-note">导入时间：{new Date(chapter.createdAt).toLocaleString("zh-CN")}</div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
    </div>
  );
}
