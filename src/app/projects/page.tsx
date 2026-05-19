import Link from "next/link";
import { formatProjectStatus, getProjects } from "@/lib/projects";
import { Panel } from "@/components/panel";

export default async function ProjectsPage() {
  const projects = await getProjects();
  const analysisProjects = projects.filter((project) => project.type === "analysis").length;
  const writingProjects = projects.filter((project) => project.type === "writing").length;
  const importedChapters = projects.reduce((total, project) => total + project._count.chapters, 0);
  const writtenChapters = projects.reduce((total, project) => total + project._count.chapterDrafts, 0);

  return (
    <div className="grid">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="pill success">项目中心</div>
            <h1>拆书项目和创作项目统一管理</h1>
            <p>所有文本、章节、公式、模板和长篇状态都从项目进入。先建项目，再导入文本或进入创作工作台。</p>
          </div>
          <div className="hero-actions">
            <Link href="/projects/new/analysis" className="button">
              新建拆书
            </Link>
            <Link href="/projects/new" className="button primary">
              新建作品
            </Link>
          </div>
        </div>

        <div className="grid stats">
          <div className="stat-card">
            <strong>{projects.length}</strong>
            <span>全部项目</span>
          </div>
          <div className="stat-card">
            <strong>{analysisProjects}</strong>
            <span>拆书项目</span>
          </div>
          <div className="stat-card">
            <strong>{writingProjects}</strong>
            <span>创作项目</span>
          </div>
          <div className="stat-card">
            <strong>{importedChapters}</strong>
            <span>已导入章节</span>
          </div>
          <div className="stat-card">
            <strong>{writtenChapters}</strong>
            <span>已写正文</span>
          </div>
        </div>
      </section>

      <Panel title="项目列表" description="选择项目后进入导入、分析、创作、状态和任务页面。">
        <div className="project-list">
          {projects.length === 0 ? (
            <div className="empty-state">
              <strong>还没有项目</strong>
              <span>拆书项目用于提公式，创作项目用于长篇状态管理。两个入口已经拆开。</span>
              <div className="hero-actions">
                <Link href="/projects/new/analysis" className="button">
                  创建拆书项目
                </Link>
                <Link href="/projects/new" className="button primary">
                  创建作品
                </Link>
              </div>
            </div>
          ) : (
            projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="project-card-row">
                <div className="project-card-main">
                  <div className="project-card-title-row">
                    <strong>{project.name}</strong>
                    <span className={`pill ${project.type === "analysis" ? "success" : "warning"}`}>
                      {project.type === "analysis" ? "拆书" : "创作"}
                    </span>
                  </div>
                  <div className="project-card-meta">
                    <span className="chip">{project.genre || "未填写题材"}</span>
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
                      </>
                    )}
                    <span className="chip">{project._count.aiJobs} 个任务</span>
                  </div>
                </div>
                <div className="project-card-time">
                  <span>更新时间</span>
                  <strong>{new Date(project.updatedAt).toLocaleString("zh-CN")}</strong>
                </div>
              </Link>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
