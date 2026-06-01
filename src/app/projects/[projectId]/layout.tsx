import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectCoverEditor } from "@/components/project-cover-editor";
import { ProjectNav } from "@/components/project-nav";
import { getProject, getProjectInspirations } from "@/lib/projects";

const analysisProjectNav = [
  { key: "overview", label: "概览", href: "" },
  { key: "import", label: "导入", href: "import" },
  { key: "chapters", label: "原文", href: "chapters" },
  { key: "analysis", label: "分析", href: "analysis", exact: true },
  { key: "analysis-graph", label: "图谱", href: "analysis/graph" },
  { key: "analysis-formula", label: "公式", href: "analysis/formula" },
  { key: "editor", label: "二稿", href: "editor" },
  { key: "jobs", label: "任务", href: "jobs" }
];

const writingProjectNav = [
  { key: "overview", label: "概览", href: "" },
  { key: "writing-chapters", label: "目录", href: "writing/chapters" },
  { key: "writing", label: "创作", href: "writing", exact: true },
  { key: "state", label: "状态", href: "state", exact: true },
  { key: "graph", label: "图谱", href: "state/graph" },
  { key: "editor", label: "二稿", href: "editor" },
  { key: "jobs", label: "任务", href: "jobs" }
];

export default async function ProjectLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const relatedInspirations = await getProjectInspirations(project.id);
  const recentInspirations = relatedInspirations
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const isAnalysisProject = project.type === "analysis";
  const updatedAt = new Date(project.updatedAt).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const projectStats = isAnalysisProject
    ? [
        { label: "导入", value: `${project._count.chapters} 章` },
        { label: "拆解", value: `${project._count.chapterAnalyses} 章` },
        { label: "任务", value: `${project._count.aiJobs} 次` }
      ]
    : [
        { label: "正文", value: `${project._count.chapterDrafts} 章` },
        { label: "台账", value: `${project._count.chapterLedgers} 条` },
        { label: "审稿", value: `${project._count.reviewReports} 份` }
      ];

  return (
    <div className="grid" style={{ gap: 18 }}>
      <section className={`panel project-shell-panel ${isAnalysisProject ? "project-shell-panel-compact" : "project-shell-panel-writing"}`}>
        <div className="project-shell-head">
          {isAnalysisProject ? (
            <div className="project-shell-copy project-shell-copy-analysis">
              <div className="project-shell-title-row">
                <span className="pill project-shell-type">拆书项目</span>
                <h2>{project.name}</h2>
              </div>
              <p className="project-shell-description">{project.description || "尚未填写项目说明。"}</p>
              <div className="project-shell-meta">
                <span className="chip">{project.genre || "未填写题材"}</span>
                <span className="chip">公式 {project._count.storyAnalyses > 0 ? "已生成" : "待生成"}</span>
                <span className="chip">更新 {updatedAt}</span>
              </div>
            </div>
          ) : (
            <div className="project-shell-brand">
              <ProjectCoverEditor
                projectId={project.id}
                title={project.name}
                coverImageUrl={project.coverImageUrl}
                subtitle={project.authorName || "作者"}
              />
              <div className="project-shell-copy">
                <div className="project-shell-title-row">
                  <span className="pill project-shell-type">创作项目</span>
                  <h2>{project.name}</h2>
                </div>
                <p className="project-shell-description">{project.description || "尚未填写项目说明。"}</p>
                <div className="project-shell-meta">
                  <span className="chip">{project.genre || "未填写题材"}</span>
                  <span className="chip">更新 {updatedAt}</span>
                </div>
              </div>
            </div>
          )}
          <aside className="project-shell-side" aria-label="项目状态">
            <div className="project-shell-stat-grid">
              {projectStats.map((item) => (
                <div key={item.label} className="project-shell-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <Link href="/projects" className="button">
              返回项目中心
            </Link>
            <Link href={`/inspirations?projectId=${project.id}`} className="button">
              项目灵感
            </Link>
            <div className="project-shell-inspirations">
              <span>相关灵感 {relatedInspirations.length}</span>
              {recentInspirations.length ? (
                <div>
                  {recentInspirations.map((inspiration) => (
                    <Link key={inspiration.id} href={`/inspirations?projectId=${project.id}`}>
                      {inspiration.title}
                    </Link>
                  ))}
                </div>
              ) : (
                <p>暂无关联灵感</p>
              )}
            </div>
          </aside>
        </div>

        <ProjectNav
          projectId={project.id}
          items={project.type === "analysis" ? analysisProjectNav : writingProjectNav}
        />
      </section>

      {children}
    </div>
  );
}
