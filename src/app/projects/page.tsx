import Link from "next/link";
import { formatProjectStatus, getProjects, type ProjectWithCounts } from "@/lib/projects";
import { Panel } from "@/components/panel";
import { ProjectCover } from "@/components/project-cover";

function ProjectRow({ project }: { project: ProjectWithCounts }) {
  return (
    <Link
      key={project.id}
      href={`/projects/${project.id}`}
      className={`list-item home-project-item ${project.type === "analysis" ? "home-project-item-compact" : ""}`}
    >
      {project.type === "writing" ? (
        <ProjectCover
          title={project.name}
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
        <div className="muted clamped-text three-lines">{project.description || "尚未添加项目说明。"}</div>
        <div className="meta-row">
          <span className="chip project-genre-chip">{project.genre || "未填写题材"}</span>
          <span className="chip">{formatProjectStatus(project.status)}</span>
          {project.type === "writing" ? (
            <>
              <span className="chip">已写 {project._count.chapterDrafts} 章</span>
              <span className="chip">任务卡 {project._count.writingTaskCards}</span>
              <span className="chip">审稿 {project._count.reviewReports}</span>
            </>
          ) : (
            <>
              <span className="chip">导入 {project._count.chapters} 章</span>
              <span className="chip">拆解 {project._count.chapterAnalyses} 章</span>
              <span className="chip">整书分析 {project._count.storyAnalyses}</span>
            </>
          )}
          <span className="chip">{project._count.aiJobs} 个任务</span>
          <span className="chip">{new Date(project.updatedAt).toLocaleString("zh-CN")}</span>
        </div>
      </div>
    </Link>
  );
}

export default async function ProjectsPage() {
  const projects = await getProjects();
  const analysisProjects = projects.filter((project) => project.type === "analysis");
  const writingProjects = projects.filter((project) => project.type === "writing");
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

  return (
    <div className="grid">
      <section className="page-intro">
        <h1>项目中心</h1>
        <p>创作项目和拆书项目分开管理，各自显示对应进度。</p>
      </section>

      <div className="grid two-col">
        <Panel
          title="创作概览"
          description="正文连载、任务卡和一致性审稿。"
        >
          <div className="grid stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {writingStats.map((item) => (
              <div key={item.label} className="stat-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="拆书概览"
          description="文本导入、章节拆解和整书分析。"
        >
          <div className="grid stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            {analysisStats.map((item) => (
              <div key={item.label} className="stat-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid two-col">
        <Panel title="创作项目" description="进入创作台、目录、状态和任务页面。">
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
        </Panel>

        <Panel title="拆书项目" description="进入导入、章节拆解、分析和公式页面。">
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
        </Panel>
      </div>
    </div>
  );
}
