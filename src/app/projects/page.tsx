import Link from "next/link";
import { formatProjectStatus, getProjects, type ProjectWithCounts } from "@/lib/projects";
import { ProjectCover } from "@/components/project-cover";

function ProjectRow({ project }: { project: ProjectWithCounts }) {
  const updatedAt = new Date(project.updatedAt).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <Link
      key={project.id}
      href={`/projects/${project.id}`}
      className={`list-item home-project-item ${project.type === "analysis" ? "home-project-item-compact" : ""}`}
    >
      {project.type === "writing" ? (
        <ProjectCover
          title={project.name}
          authorName={project.authorName}
          coverImageUrl={project.coverImageUrl}
          fallbackLabel="书"
          size="sm"
        />
      ) : null}
      <div className="home-project-copy">
        <div className="project-card-title-row">
          <strong>{project.name}</strong>
          <span className={`pill ${project.type === "analysis" ? "success" : "warning"}`}>
            {project.type === "analysis" ? "拆书" : "创作"}
          </span>
        </div>
        <div className="muted clamped-text two-lines">{project.description || "尚未添加项目说明。"}</div>
        <div className="meta-row">
          <span className="chip project-genre-chip">{project.genre || "未填写题材"}</span>
          <span className="chip">{formatProjectStatus(project.status)}</span>
          {project.type === "writing" ? (
            <>
              <span className="chip">已写 {project._count.chapterDrafts} 章</span>
              <span className="chip">任务卡 {project._count.writingTaskCards}</span>
            </>
          ) : (
            <>
              <span className="chip">导入 {project._count.chapters} 章</span>
              <span className="chip">拆解 {project._count.chapterAnalyses} 章</span>
              <span className="chip">分析 {project._count.storyAnalyses}</span>
            </>
          )}
          <span className="chip">更新 {updatedAt}</span>
        </div>
      </div>
    </Link>
  );
}

export default async function ProjectsPage() {
  const projects = await getProjects();
  const analysisProjects = projects.filter((project) => project.type === "analysis");
  const writingProjects = projects.filter((project) => project.type === "writing");
  const latestWritingProject = writingProjects[0];
  const latestAnalysisProject = analysisProjects[0];
  const writingStats = [
    { label: "创作项目", value: writingProjects.length },
    { label: "已写正文", value: writingProjects.reduce((total, project) => total + project._count.chapterDrafts, 0) },
    { label: "任务卡", value: writingProjects.reduce((total, project) => total + project._count.writingTaskCards, 0) },
    { label: "审稿报告", value: writingProjects.reduce((total, project) => total + project._count.reviewReports, 0) }
  ];
  const analysisStats = [
    { label: "拆书项目", value: analysisProjects.length },
    { label: "已导入章节", value: analysisProjects.reduce((total, project) => total + project._count.chapters, 0) },
    { label: "章节拆解", value: analysisProjects.reduce((total, project) => total + project._count.chapterAnalyses, 0) },
    { label: "整书分析", value: analysisProjects.reduce((total, project) => total + project._count.storyAnalyses, 0) }
  ];
  const summaryStats = [
    { label: "全部项目", value: projects.length, tone: "neutral" },
    { label: "创作项目", value: writingProjects.length, tone: "writing" },
    { label: "已写正文", value: writingStats[1].value, tone: "writing" },
    { label: "拆书项目", value: analysisProjects.length, tone: "analysis" },
    { label: "导入章节", value: analysisStats[1].value, tone: "analysis" },
    { label: "AI 任务", value: projects.reduce((total, project) => total + project._count.aiJobs, 0), tone: "neutral" }
  ];

  return (
    <div className="project-center-page">
      <section className="project-center-hero">
        <div>
          <span className="project-center-kicker">项目中心</span>
          <h1>今天从哪个项目继续？</h1>
          <p>左手推进连载，右手拆解爆款。</p>
          <div className="project-center-mini-stats" aria-label="项目总览">
            {summaryStats.map((item) => (
              <span key={item.label}>
                <strong>{item.value}</strong>
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <div className="project-center-launchpad" aria-label="快捷入口">
          <Link
            href={latestWritingProject ? `/projects/${latestWritingProject.id}/writing` : "/projects/new"}
            className="project-launch-card project-launch-writing"
          >
            <span>创作工作台</span>
            <strong>{latestWritingProject ? latestWritingProject.name : "新建创作项目"}</strong>
            <em>{latestWritingProject ? `已写 ${latestWritingProject._count.chapterDrafts} 章` : "从设定、目录和任务卡开始"}</em>
          </Link>
          <Link
            href={latestAnalysisProject ? `/projects/${latestAnalysisProject.id}/chapters` : "/projects/new/analysis"}
            className="project-launch-card project-launch-analysis"
          >
            <span>拆书工作台</span>
            <strong>{latestAnalysisProject ? latestAnalysisProject.name : "新建拆书项目"}</strong>
            <em>{latestAnalysisProject ? `导入 ${latestAnalysisProject._count.chapters} 章 · 拆解 ${latestAnalysisProject._count.chapterAnalyses} 章` : "导入文本，沉淀公式"}</em>
          </Link>
        </div>
      </section>

      <div className="project-center-board">
        <section className="project-center-section project-center-section-writing">
          <div className="project-center-section-head">
            <div>
              <h2>创作项目</h2>
              <p>进入创作台、目录、状态和任务页面。</p>
            </div>
            <div className="project-center-section-stats">
              <span>正文 {writingStats[1].value}</span>
              <span>审稿 {writingStats[3].value}</span>
            </div>
          </div>
          <div className="project-list">
            {writingProjects.length === 0 ? (
              <div className="empty-state">
                <strong>还没有创作项目</strong>
                <span>创建作品后，这里会显示正文、任务卡和审稿进度。</span>
                <Link href="/projects/new" className="button primary">
                  创建作品
                </Link>
              </div>
            ) : (
              writingProjects.map((project) => <ProjectRow key={project.id} project={project} />)
            )}
          </div>
        </section>

        <section className="project-center-section project-center-section-analysis">
          <div className="project-center-section-head">
            <div>
              <h2>拆书项目</h2>
              <p>进入导入、章节拆解、分析和公式页面。</p>
            </div>
            <div className="project-center-section-stats">
              <span>导入 {analysisStats[1].value}</span>
              <span>拆解 {analysisStats[2].value}</span>
            </div>
          </div>
          <div className="project-list">
            {analysisProjects.length === 0 ? (
              <div className="empty-state">
                <strong>还没有拆书项目</strong>
                <span>导入样本文本后，这里会显示分章和拆解进度。</span>
                <Link href="/projects/new/analysis" className="button">
                  创建拆书项目
                </Link>
              </div>
            ) : (
              analysisProjects.map((project) => <ProjectRow key={project.id} project={project} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
