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
    <Link
      key={project.id}
      href={`/projects/${project.id}`}
      className={`list-item home-project-item ${mode === "analysis" ? "home-project-item-compact" : ""}`}
    >
      {mode === "writing" ? (
        <ProjectCover
          title={project.name}
          coverImageUrl={project.coverImageUrl}
          fallbackLabel="书"
          size="sm"
        />
      ) : null}
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

function FirstCreationFlow({
  writingProject,
  hasTaskCard,
  hasDraft
}: {
  writingProject?: ProjectWithCounts;
  hasTaskCard: boolean;
  hasDraft: boolean;
}) {
  const steps = [
    {
      index: "01",
      title: "创建第一本书",
      description: "先用 AI 帮你打样书名、简介、主角名和题材标签。",
      href: "/projects/new",
      state: writingProject ? "done" : "active",
      action: writingProject ? "已创建" : "开始创建"
    },
    {
      index: "02",
      title: "生成第一章任务卡",
      description: "把开局钩子拆成可执行的章节目标、冲突和章末悬念。",
      href: writingProject ? `/projects/${writingProject.id}/writing` : "/projects/new",
      state: hasTaskCard ? "done" : writingProject ? "active" : "locked",
      action: hasTaskCard ? "已生成" : writingProject ? "去生成" : "先创建作品"
    },
    {
      index: "03",
      title: "写出第一段正文",
      description: "任务卡生成后，直接进入正文生成和审稿闭环。",
      href: writingProject ? `/projects/${writingProject.id}/writing` : "/projects/new",
      state: hasDraft ? "done" : hasTaskCard ? "active" : "locked",
      action: hasDraft ? "已完成" : hasTaskCard ? "去写正文" : "等待任务卡"
    }
  ];

  return (
    <section className="first-flow-card">
      <div className="first-flow-copy">
        <span>新手首流程</span>
        <h2>先完成第一本书的第一章</h2>
        <p>不用先研究所有功能。跟着这 3 步走，先把作品雏形和第一章跑通，后面再慢慢扩展台账、审稿和模板。</p>
      </div>
      <div className="first-flow-steps">
        {steps.map((step) => (
          <Link key={step.index} href={step.href} className={`first-flow-step ${step.state}`}>
            <span>{step.index}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
              <small>{step.action}</small>
            </div>
          </Link>
        ))}
      </div>
    </section>
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
              <strong>{desktopRuntime ? "本地优先，保护创作隐私" : "网页入口，快速进入工作台"}</strong>
              <span>
                {desktopRuntime
                  ? "作品、草稿、设定和项目数据保存在你的电脑里，不上传到我们的服务器。"
                  : "无需安装客户端，登录后即可使用拆书、模板和长篇创作管理能力。"}
              </span>
            </div>
            <div className="hero-actions">
              <Link href="/activate" className="button primary">
                进入工作台
              </Link>
              <Link href="/download" className="button">
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
            <Link href="/activate" className="button">
              进入工作台
            </Link>
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
  const hasWritingTaskCard = writingProjects.some((project) => project._count.writingTaskCards > 0);
  const hasWritingDraft = writingProjects.some((project) => project._count.chapterDrafts > 0);
  const showFirstCreationFlow = writingProjects.length === 0;
  const writtenChapterCount = writingProjects.reduce((total, project) => total + project._count.chapterDrafts, 0);
  const taskCardCount = writingProjects.reduce((total, project) => total + project._count.writingTaskCards, 0);
  const reviewReportCount = writingProjects.reduce((total, project) => total + project._count.reviewReports, 0);
  const importedChapterCount = analysisProjects.reduce((total, project) => total + project._count.chapters, 0);
  const analyzedChapterCount = analysisProjects.reduce((total, project) => total + project._count.chapterAnalyses, 0);
  const storyAnalysisCount = analysisProjects.reduce((total, project) => total + project._count.storyAnalyses, 0);
  const aiJobCount = projects.reduce((total, project) => total + project._count.aiJobs, 0);
  const featuredWritingCharacters = writingProject ? writtenCharactersByProject.get(writingProject.id) ?? 0 : 0;
  const latestTemplate = templates[0];
  const switchableWritingProjects = writingProjects.filter((project) => project.id !== writingProject?.id).slice(0, 4);
  const writingPulse = [
    { label: "今日字数", value: todayCharacters.toLocaleString("zh-CN") },
    { label: "累计字数", value: totalCharacters.toLocaleString("zh-CN") },
    { label: "正文", value: `${writtenChapterCount} 章` },
    { label: "审稿", value: `${reviewReportCount} 份` }
  ];
  const analysisPipeline = [
    { label: "样本", value: `${analysisProjects.length} 个`, detail: "拆书项目" },
    { label: "导入", value: `${importedChapterCount} 章`, detail: "原文分章" },
    { label: "拆解", value: `${analyzedChapterCount} 章`, detail: "冲突爽点钩子" },
    { label: "整书", value: `${storyAnalysisCount} 份`, detail: "节奏与公式" }
  ];
  const continueWritingHref = writingProject ? `/projects/${writingProject.id}/writing` : "/projects/new";
  const continueAnalysisHref = analysisProject ? `/projects/${analysisProject.id}/chapters` : "/projects/new/analysis";

  return (
    <div className="home-dashboard">
      <section className="home-studio-hero">
        <div className="home-focus-panel">
          <div className="home-focus-copy">
            <span className="home-kicker">今日续写</span>
            <h1>{writingProject ? writingProject.name : "先开一本能长期写下去的新书"}</h1>
            <p>
              {writingProject?.description ||
                "从书名、主角和开局钩子开始，把第一章任务卡跑通，再进入正文、台账和审稿闭环。"}
            </p>
          </div>

          <div className="home-focus-body">
            {writingProject ? (
              <ProjectCover
                title={writingProject.name}
                coverImageUrl={writingProject.coverImageUrl}
                fallbackLabel="新书"
                size="lg"
                className="home-focus-cover"
              />
            ) : (
              <div className="book-cover home-default-book-cover" aria-hidden="true">
                <div className="book-cover-title">书本名称</div>
                <div className="book-cover-author">作者名称</div>
              </div>
            )}
            <div className="home-focus-meta">
              <div className="home-status-strip" aria-label="创作状态">
                {writingPulse.map((item) => (
                  <span key={item.label}>
                    <strong>{item.value}</strong>
                    {item.label}
                  </span>
                ))}
              </div>
              <div className="home-focus-note">
                <strong>{writingProject ? "下一步：回到章节任务卡" : "下一步：创建作品骨架"}</strong>
                <span>
                  {writingProject
                    ? `这本书已经写了 ${writingProject._count.chapterDrafts} 章，累计 ${featuredWritingCharacters.toLocaleString("zh-CN")} 字。`
                    : "先确定书名、题材、主角和核心爽点，再让任务卡负责后续章节节奏。"}
                </span>
              </div>
              <div className="home-focus-actions">
                <Link href={continueWritingHref} className="button primary">
                  {writingProject ? "继续创作" : "新建创作项目"}
                </Link>
                <Link href="/projects" className="button">
                  查看项目中心
                </Link>
              </div>
              {switchableWritingProjects.length > 0 ? (
                <div className="home-project-switcher" aria-label="切换创作作品">
                  <span>切换作品</span>
                  <div>
                    {switchableWritingProjects.map((project) => (
                      <Link key={project.id} href={`/projects/${project.id}/writing`}>
                        {project.name}
                      </Link>
                    ))}
                    {writingProjects.length > switchableWritingProjects.length + 1 ? (
                      <Link href="/projects">更多</Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="home-command-panel" aria-label="首页快捷入口">
          <Link href={continueWritingHref} className="home-command-card home-command-primary">
            <span>写</span>
            <strong>{writingProject ? "进入创作工作台" : "创建一本新书"}</strong>
            <em>
              {writingProject ? `任务卡 ${taskCardCount} · AI 任务 ${aiJobCount}` : "书名、简介、主角、题材先跑通。"}
            </em>
          </Link>
          <Link href={continueAnalysisHref} className="home-command-card">
            <span>拆</span>
            <strong>{analysisProject ? "继续拆书项目" : "导入一本样书"}</strong>
            <em>
              {analysisProject
                ? `${analysisProject.name} · 已拆 ${analysisProject._count.chapterAnalyses} 章`
                : "先拆结构，再把公式沉淀成模板。"}
            </em>
          </Link>
          <Link href={latestTemplate ? `/templates/${latestTemplate.id}` : "/templates"} className="home-command-card">
            <span>模</span>
            <strong>{latestTemplate ? latestTemplate.name : "模板库还在等待第一条公式"}</strong>
            <em>
              {latestTemplate
                ? `${latestTemplate.genre} · 可继续迁移到新题材`
                : "从整书分析页保存模板后，这里会变成迁移入口。"}
            </em>
          </Link>
        </aside>
      </section>

      {showFirstCreationFlow ? (
        <FirstCreationFlow
          writingProject={writingProject}
          hasTaskCard={hasWritingTaskCard}
          hasDraft={hasWritingDraft}
        />
      ) : null}

      <div className="home-stage-board">
        <section className="home-lane home-writing-lane">
          <div className="home-lane-head">
            <div>
              <span>创作线</span>
              <h2>最近写作项目</h2>
              <p>只保留能帮你回到正文、任务卡和审稿闭环的信息。</p>
            </div>
            <Link href="/stats" className="button">
              创作统计
            </Link>
          </div>
          <div className="home-lane-body">
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
                writingProjects.slice(0, 3).map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    mode="writing"
                    writtenCharacters={writtenCharactersByProject.get(project.id) ?? 0}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="home-lane home-analysis-lane">
          <div className="home-lane-head">
            <div>
              <span>拆书线</span>
              <h2>从样本到模板</h2>
              <p>把导入、章节拆解、整书分析和模板沉淀放成一条流水线。</p>
            </div>
            <Link href={continueAnalysisHref} className="button">
              {analysisProject ? "继续拆书" : "新建拆书项目"}
            </Link>
          </div>
          <div className="home-pipeline">
            {analysisPipeline.map((item, index) => (
              <div key={item.label} className="home-pipeline-step">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
                <em>{item.detail}</em>
              </div>
            ))}
          </div>
          <div className="home-lane-body">
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
                analysisProjects.slice(0, 3).map((project) => (
                  <ProjectListItem key={project.id} project={project} mode="analysis" />
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
