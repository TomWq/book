import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { Panel } from "@/components/panel";
import { getProject, getProjectAnalysis } from "@/lib/projects";

export default async function ProjectOverviewPage({
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
  const summaryCards =
    project.type === "analysis"
      ? [
          {
            label: "已导入章节",
            value: String(project._count.chapters),
            hint: project._count.chapters > 0 ? "可以开始拆解" : "等待导入文本"
          },
          {
            label: "章节拆解",
            value: String(project._count.chapterAnalyses),
            hint: project._count.chapterAnalyses > 0 ? "已提取结构" : "还没拆解"
          },
          {
            label: "整书分析",
            value: String(project._count.storyAnalyses),
            hint: analysis.storyAnalysis ? "已有公式" : "等待生成"
          },
          {
            label: "AI 任务",
            value: String(project._count.aiJobs),
            hint: "流程执行记录"
          }
        ]
      : [
          {
            label: "已写正文",
            value: String(project._count.chapterDrafts),
            hint: "连载正文数量"
          },
          {
            label: "任务卡",
            value: String(project._count.writingTaskCards),
            hint: "写前先定任务"
          },
          {
            label: "章节台账",
            value: String(project._count.chapterLedgers),
            hint: "已沉淀的状态"
          },
          {
            label: "审稿报告",
            value: String(project._count.reviewReports),
            hint: "一致性检查"
          }
        ];
  const nextHref = `/projects/${projectId}/${project.type === "analysis" ? "import" : "writing"}`;

  return (
    <div className="grid">
      <Panel
        title="当前概览"
        description="这里不再重复作品简介，只保留当前进度、下一步动作和关键统计。"
        action={
          <div className="hero-actions">
            <Link href={`/projects/${projectId}/jobs`} className="button">
              任务队列
            </Link>
            <Link href={nextHref} className="button primary">
              进入下一步
            </Link>
            <DeleteProjectButton projectId={projectId} projectName={project.name} />
          </div>
        }
      >
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
      </Panel>

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

      <Panel title="项目状态" description="继续看这一段就够了，重点是状态沉淀和下一步。">
        <div className="project-summary-grid">
          {summaryCards.map((item) => (
            <div key={item.label} className="project-summary-item">
              <div className="project-summary-value">{item.value}</div>
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </div>
          ))}
        </div>
        <div className="project-summary-actions">
          <Link href={`/projects/${projectId}/jobs`} className="button">
            查看任务队列
          </Link>
          <Link href={nextHref} className="button primary">
            进入下一步
          </Link>
        </div>
      </Panel>
    </div>
  );
}
