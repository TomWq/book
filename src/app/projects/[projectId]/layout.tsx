import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectNav } from "@/components/project-nav";
import { getProject } from "@/lib/projects";

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
  { key: "writing", label: "创作", href: "writing", exact: true },
  { key: "writing-chapters", label: "目录", href: "writing/chapters" },
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

  return (
    <div className="grid" style={{ gap: 18 }}>
      <section className="panel">
        <div className="project-shell-head">
          <div className="project-shell-copy">
            <div className="pill">{project.type === "analysis" ? "拆书项目" : "创作项目"}</div>
            <h2>{project.name}</h2>
            <p>{project.description || "尚未填写项目说明。"}</p>
            <div className="project-shell-meta">
              <span className="chip">{project.genre || "未填写题材"}</span>
              <span className="chip">
                {project.type === "writing"
                  ? `已写 ${project._count.chapterDrafts} 章`
                  : `导入 ${project._count.chapters} 章`}
              </span>
              <span className="chip">{new Date(project.updatedAt).toLocaleString("zh-CN")}</span>
            </div>
          </div>
          <div className="project-shell-actions">
            <Link href="/projects" className="button">
              返回项目中心
            </Link>
          </div>
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
