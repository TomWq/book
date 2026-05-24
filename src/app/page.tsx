import Link from "next/link";
import { redirect } from "next/navigation";
import { isDesktopRuntime } from "@/lib/app-runtime";
import {
  getCurrentUserAccess,
  formatProjectStatus,
  getProjectWritingState,
  getProjects,
  getTemplates,
  type ProjectWithCounts
} from "@/lib/projects";
import { Panel } from "@/components/panel";
import { ProjectCover } from "@/components/project-cover";
import { countTextCharacters, isSameLocalDay } from "@/lib/writing-stats";

function ProjectListItem({
  project,
  mode,
  writtenCharacters
}: {
  project: ProjectWithCounts;
  mode: "analysis" | "writing";
  writtenCharacters?: number;
}) {
  return (
    <Link key={project.id} href={`/projects/${project.id}`} className="list-item home-project-item">
      <ProjectCover
        title={project.name}
        coverImageUrl={project.coverImageUrl}
        fallbackLabel={mode === "writing" ? "书" : "拆"}
        size="sm"
      />
      <div className="home-project-copy">
        <div className="row">
          <strong>{project.name}</strong>
          <span className={`pill ${project.status === "ready" ? "success" : "warning"}`}>
            {formatProjectStatus(project.status)}
          </span>
        </div>
        <div className="muted clamped-text three-lines">{project.description || "尚未添加项目说明。"}</div>
        <div className="meta-row">
          <span className="chip project-genre-chip">{project.genre || "未填写题材"}</span>
          {mode === "writing" ? (
            <>
              <span className="chip">已写 {project._count.chapterDrafts} 章</span>
              <span className="chip">累计 {(writtenCharacters ?? 0).toLocaleString("zh-CN")} 字</span>
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
          <span className="chip">{new Date(project.updatedAt).toLocaleString("zh-CN")}</span>
        </div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const { user, isAdmin } = await getCurrentUserAccess();
  const desktopRuntime = isDesktopRuntime();

  if (isAdmin && !desktopRuntime) {
    redirect("/admin");
  }

  if (!user && desktopRuntime) {
    redirect("/activate");
  }

  if (!user) {
    const workflows = [
      {
        label: "拆书项目",
        title: "把别人的爆款拆成可复用结构",
        description: "适合先研究样本，沉淀公式、模板和爽点节奏。",
        steps: ["导入原文", "自动分章", "逐章拆解", "整书节奏", "保存模板"]
      },
      {
        label: "创作新书",
        title: "把自己的新书按状态持续写下去",
        description: "适合已经有题材方向，直接建立作品、设定和章节台账。",
        steps: ["新建作品", "完善设定", "生成任务卡", "生成正文", "更新状态"]
      }
    ];
    const audiences = [
      {
        label: "写作者",
        title: "直接走创作新书流程",
        description: "先定书名、简介、主角和世界观，再用任务卡推进每一章。",
        points: ["创作圣经", "章节任务卡", "人物 / 伏笔 / 地图状态"]
      },
      {
        label: "拆书博主",
        title: "优先走拆书项目流程",
        description: "不只给摘要，而是拆冲突、压制、爽点释放和章末钩子。",
        points: ["逐章结构化拆解", "爽点前后因果", "整书主循环"]
      },
      {
        label: "内容策划",
        title: "先拆书，再迁移到新书",
        description: "把成熟结构沉淀成模板，再换题材、主角和世界观生成新书方向。",
        points: ["故事公式", "前 10 章大纲", "前 100 章节奏"]
      }
    ];

    return (
      <div className="public-home">
        <section className="public-landing-hero">
          <div className="public-hero-scene" aria-hidden="true">
            <div className="manuscript-card manuscript-card-main">
              <span>章节任务卡</span>
              <strong>第 12 章：压制、反击、收益、钩子</strong>
              <small>人物状态 / 伏笔 / 地图势力同步读取</small>
            </div>
            <div className="manuscript-card manuscript-card-left">
              <span>爆款公式</span>
              <strong>误判 → 挑衅 → 反击 → 资源到账</strong>
            </div>
            <div className="manuscript-card manuscript-card-bottom">
              <span>长篇台账</span>
              <strong>人物知道什么、伏笔回收到哪、战力是否失控</strong>
            </div>
          </div>

          <div className="public-hero-content">
            <h1>从拆懂爆款开始，写一本不跑偏的长篇。</h1>
            <p>
              拆章节节奏、爽点和主循环，沉淀可迁移模板，再用任务卡、章节台账和项目状态管理持续推进连载。
            </p>
            <div className="public-privacy-note">
              <strong>本地优先，保护创作隐私</strong>
              <span>作品、草稿、设定和项目数据保存在你的电脑里，不上传到我们的服务器。</span>
            </div>
            <div className="hero-actions">
              <Link href="/download" className="button primary">
                下载客户端
              </Link>
            </div>
            <div className="public-proof">
              <span><strong>30 章</strong>拆书验收链路</span>
              <span><strong>前 100 章</strong>节奏规划</span>
              <span><strong>人物 / 伏笔 / 地图</strong>长篇状态管理</span>
              <span><strong>本地数据</strong>隐私保护</span>
            </div>
          </div>
        </section>

        <section className="public-flow-section">
          <div className="public-flow-copy">
            <span className="audience-label">两套工作流</span>
            <h2>拆书和创作，不应该挤成同一条流程</h2>
            <p>一个入口负责拆爆款、沉淀模板；一个入口负责建新书、写正文、维护长篇状态。</p>
          </div>
          <div className="public-workflow-board">
            {workflows.map((workflow) => (
              <div key={workflow.label} className="public-workflow-track">
                <div className="public-track-head">
                  <span>{workflow.label}</span>
                  <strong>{workflow.title}</strong>
                  <p>{workflow.description}</p>
                </div>
                <ol className="public-track-steps">
                  {workflow.steps.map((step, index) => (
                    <li key={step}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{step}</strong>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className="public-audience-band">
          <div className="public-audience-copy">
            <span className="audience-label">适合谁</span>
            <h2>不同用户进来的第一步不一样</h2>
            <p>
              拆书用户先看懂爆款，作者先创建新书，策划可以把两条流程接起来，最后都沉淀为可复用资产。
            </p>
            {/* <Link href="/login" className="button">
              进入工作台
            </Link> */}
          </div>

          <div className="public-audience-list">
            {audiences.map((item) => (
              <div key={item.label} className="public-audience-row">
                <span>{item.label}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  <small>{item.points.join(" / ")}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const [projects, templates] = await Promise.all([
    getProjects(),
    getTemplates()
  ]);
  const writingProjects = projects.filter((project) => project.type === "writing");
  const analysisProjects = projects.filter((project) => project.type === "analysis");
  const writingProject = writingProjects[0];
  const analysisProject = analysisProjects[0];
  const today = new Date();
  const writingStates = await Promise.all(writingProjects.map((project) => getProjectWritingState(project.id)));
  const allDrafts = writingStates.flatMap((state) => state?.drafts ?? []);
  const writtenCharactersByProject = new Map<string, number>();

  writingStates.forEach((state) => {
    if (!state) {
      return;
    }

    writtenCharactersByProject.set(
      state.project.id,
      state.drafts.reduce((total, draft) => total + countTextCharacters(draft.content), 0)
    );
  });

  const todayDrafts = allDrafts.filter((draft) => isSameLocalDay(draft.createdAt, today));
  const todayCharacters = todayDrafts.reduce((total, draft) => total + countTextCharacters(draft.content), 0);
  const totalCharacters = allDrafts.reduce((total, draft) => total + countTextCharacters(draft.content), 0);
  const writingStats = [
    { label: "今日字数", value: todayCharacters.toLocaleString("zh-CN") },
    { label: "累计字数", value: totalCharacters.toLocaleString("zh-CN") },
    { label: "今日章节", value: todayDrafts.length },
    { label: "已写正文", value: writingProjects.reduce((total, project) => total + project._count.chapterDrafts, 0) },
    { label: "任务卡", value: writingProjects.reduce((total, project) => total + project._count.writingTaskCards, 0) },
    { label: "审稿报告", value: writingProjects.reduce((total, project) => total + project._count.reviewReports, 0) }
  ];
  const analysisStats = [
    { label: "拆书项目", value: analysisProjects.length },
    { label: "已导入章节", value: analysisProjects.reduce((total, project) => total + project._count.chapters, 0) },
    { label: "章节拆解", value: analysisProjects.reduce((total, project) => total + project._count.chapterAnalyses, 0) },
    { label: "模板", value: templates.length }
  ];

  return (
    <>
      <section className="page-intro">
        <h1>今天先走哪条线？</h1>
        <p>创作和拆书分开看：写书看正文、任务卡和审稿；拆书看导入、拆解和模板沉淀。</p>
      </section>

      <div className="grid two-col">
        <div className="grid">
          <Panel
            title="创作工作区"
            description="只看长篇创作进度：正文、任务卡、台账和审稿。"
            action={
              <div className="panel-action-row">
                <Link href="/stats" className="button">
                  创作统计
                </Link>
                <Link href={writingProject ? `/projects/${writingProject.id}/writing` : "/projects/new"} className="button primary">
                  {writingProject ? "继续创作" : "新建创作项目"}
                </Link>
              </div>
            }
          >
            <div className="grid stats" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {writingStats.map((item) => (
                <div key={item.label} className="stat-card">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="创作项目" description="显示正文连载和创作闭环状态。">
            <div className="list">
              {writingProjects.length === 0 ? (
                <div className="empty-state">
                  <strong>还没有创作项目</strong>
                  <span>新建作品后，这里会显示正文、任务卡和审稿进度。</span>
                  <Link href="/projects/new" className="button primary">
                    新建创作项目
                  </Link>
                </div>
              ) : (
                writingProjects.slice(0, 4).map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    mode="writing"
                    writtenCharacters={writtenCharactersByProject.get(project.id) ?? 0}
                  />
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="grid">
          <Panel
            title="拆书工作区"
            description="只看结构分析进度：导入、分章、拆解和模板。"
            action={
              <Link href={analysisProject ? `/projects/${analysisProject.id}/chapters` : "/projects/new/analysis"} className="button">
                {analysisProject ? "继续拆书" : "新建拆书项目"}
              </Link>
            }
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

          <Panel title="拆书项目" description="显示导入、章节拆解和公式沉淀状态。">
            <div className="list">
              {analysisProjects.length === 0 ? (
                <div className="empty-state">
                  <strong>还没有拆书项目</strong>
                  <span>导入样本文本后，这里会显示分章和拆解进度。</span>
                  <Link href="/projects/new/analysis" className="button">
                    新建拆书项目
                  </Link>
                </div>
              ) : (
                analysisProjects.slice(0, 4).map((project) => (
                  <ProjectListItem key={project.id} project={project} mode="analysis" />
                ))
              )}
            </div>
          </Panel>

          <Panel title="模板库预览" description="拆书沉淀出的公式，可以继续迁移到新题材。">
            <div className="list">
              {templates.length === 0 ? (
                <div className="section-card">模板库还空着，先在分析页保存一个模板。</div>
              ) : (
                templates.slice(0, 3).map((template) => (
                  <Link key={template.id} href={`/templates/${template.id}`} className="list-item">
                    <div className="row">
                      <strong>{template.name}</strong>
                      <span className="pill">{template.genre}</span>
                    </div>
                    <div className="muted">{template.openingHook}</div>
                    <div className="meta-row">
                      {template.tags.map((tag) => (
                        <span key={tag} className="chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
