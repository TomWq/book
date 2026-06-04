import Link from "next/link";
import { formatProjectStatus, getProjects, type ProjectWithCounts } from "@/lib/projects";
import { ProjectCover } from "@/components/project-cover";

type ProjectListType = "writing" | "analysis";

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

function projectTypeParam(value: string | string[] | undefined): ProjectListType {
  const raw = Array.isArray(value) ? value[0] : value;

  return raw === "analysis" ? "analysis" : "writing";
}

export default async function ProjectsPage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string | string[] }>;
}) {
  const query = searchParams ? await searchParams : {};
  const activeType = projectTypeParam(query.type);
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
  const activeProjects = activeType === "writing" ? writingProjects : analysisProjects;
  const activeAiJobs = activeProjects.reduce((total, project) => total + project._count.aiJobs, 0);
  const summaryStats = activeType === "writing"
    ? [
        { label: "创作项目", value: writingProjects.length },
        { label: "已写正文", value: writingStats[1].value },
        { label: "任务卡", value: writingStats[2].value },
        { label: "审稿报告", value: writingStats[3].value },
        { label: "AI 任务", value: activeAiJobs }
      ]
    : [
        { label: "拆书项目", value: analysisProjects.length },
        { label: "已导入章节", value: analysisStats[1].value },
        { label: "章节拆解", value: analysisStats[2].value },
        { label: "整书分析", value: analysisStats[3].value },
        { label: "AI 任务", value: activeAiJobs }
      ];
  const activeSection = activeType === "writing"
    ? {
        title: "创作项目",
        description: "进入创作台、目录、状态和任务页面。",
        className: "project-center-section-writing",
        statLabels: [`正文 ${writingStats[1].value}`, `审稿 ${writingStats[3].value}`],
        emptyTitle: "还没有创作项目",
        emptyDescription: "创建作品后，这里会显示正文、任务卡和审稿进度。",
        emptyHref: "/projects/new",
        emptyAction: "创建作品"
      }
    : {
        title: "拆书项目",
        description: "进入导入、章节拆解、分析和公式页面。",
        className: "project-center-section-analysis",
        statLabels: [`导入 ${analysisStats[1].value}`, `拆解 ${analysisStats[2].value}`],
        emptyTitle: "还没有拆书项目",
        emptyDescription: "导入样本文本后，这里会显示分章和拆解进度。",
        emptyHref: "/projects/new/analysis",
        emptyAction: "创建拆书项目"
      };
  const projectTabs = [
    {
      type: "writing" as const,
      href: "/projects?type=writing",
      label: "创作项目",
      count: writingProjects.length,
      description: "连载、正文、台账"
    },
    {
      type: "analysis" as const,
      href: "/projects?type=analysis",
      label: "拆书项目",
      count: analysisProjects.length,
      description: "导入、拆解、公式"
    }
  ];
  const launchCards = activeType === "writing"
    ? [
        ...(latestWritingProject
          ? [
              {
                href: `/projects/${latestWritingProject.id}/writing`,
                className: "project-launch-card project-launch-writing",
                label: "创作工作台",
                title: latestWritingProject.name,
                meta: `已写 ${latestWritingProject._count.chapterDrafts} 章`
              }
            ]
          : []),
        {
          href: "/projects/new",
          className: "project-launch-card project-launch-writing",
          label: "新建创作项目",
          title: "创建一本新书",
          meta: "从设定、目录和任务卡开始"
        }
      ]
    : [
        ...(latestAnalysisProject
          ? [
              {
                href: `/projects/${latestAnalysisProject.id}/chapters`,
                className: "project-launch-card project-launch-analysis",
                label: "拆书工作台",
                title: latestAnalysisProject.name,
                meta: `导入 ${latestAnalysisProject._count.chapters} 章 · 拆解 ${latestAnalysisProject._count.chapterAnalyses} 章`
              }
            ]
          : []),
        {
          href: "/projects/new/analysis",
          className: "project-launch-card project-launch-analysis",
          label: "新建拆书项目",
          title: "导入一本样书",
          meta: "导入文本，沉淀公式"
        }
      ];

  return (
    <div className="project-center-page">
      <section className="project-center-hero">
        <div>
          <span className="project-center-kicker">项目中心</span>
          <h1>今天从哪个项目继续？</h1>
          <p>{activeType === "writing" ? "集中处理连载、正文和项目状态。" : "集中处理导入、拆解和爆款公式。"}</p>
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
          {launchCards.map((card) => (
            <Link key={`${card.label}-${card.href}`} href={card.href} className={card.className}>
              <span>{card.label}</span>
              <strong>{card.title}</strong>
              <em>{card.meta}</em>
            </Link>
          ))}
        </div>
      </section>

      <nav className="project-type-tabs" aria-label="项目类型筛选">
        <div className="project-type-tab-list">
          {projectTabs.map((tab) => (
            <Link
              key={tab.type}
              href={tab.href}
              className={activeType === tab.type ? "project-type-tab active" : "project-type-tab"}
              aria-current={activeType === tab.type ? "page" : undefined}
            >
              <strong>{tab.label}</strong>
              <span>{tab.count} 个 · {tab.description}</span>
            </Link>
          ))}
        </div>
        {/* <div className="project-type-current">
          当前显示 <strong>{activeSection.title}</strong>
        </div> */}
      </nav>

      <div className="project-center-board project-center-board-single">
        <section className={`project-center-section ${activeSection.className}`}>
          <div className="project-center-section-head">
            <div>
              <h2>{activeSection.title}</h2>
              <p>{activeSection.description}</p>
            </div>
            <div className="project-center-section-stats">
              {activeSection.statLabels.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="project-list">
            {activeProjects.length === 0 ? (
              <div className="empty-state">
                <strong>{activeSection.emptyTitle}</strong>
                <span>{activeSection.emptyDescription}</span>
                <Link href={activeSection.emptyHref} className={activeType === "writing" ? "button primary" : "button"}>
                  {activeSection.emptyAction}
                </Link>
              </div>
            ) : (
              activeProjects.map((project) => <ProjectRow key={project.id} project={project} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
