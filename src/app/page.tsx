import Link from "next/link";
import { headers } from "next/headers";
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

type HomeProjectMode = "writing" | "analysis";

function projectModeParam(value: string | string[] | undefined): HomeProjectMode {
  const raw = Array.isArray(value) ? value[0] : value;

  return raw === "analysis" ? "analysis" : "writing";
}

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
          authorName={project.authorName}
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

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string | string[] }>;
}) {
  const pathname = (await headers()).get("x-nw-pathname") ?? "/";
  const query = searchParams ? await searchParams : {};
  const activeMode = projectModeParam(query.type);
  const { user, isAdmin } = await getCurrentUserAccess();
  const desktopRuntime = isDesktopRuntime();

  if (isAdmin && !desktopRuntime) {
    redirect("/admin");
  }

  if (!user && desktopRuntime) {
    redirect("/activate");
  }

  if (user && (desktopRuntime || pathname === "/workspace")) {
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
    const dashboardBaseHref = pathname === "/workspace" ? "/workspace" : "/";
    const modeTabs = [
      {
        type: "writing" as const,
        href: `${dashboardBaseHref}?type=writing`,
        label: "创作线",
        count: writingProjects.length,
        description: "续写、任务卡、审稿"
      },
      {
        type: "analysis" as const,
        href: `${dashboardBaseHref}?type=analysis`,
        label: "拆书线",
        count: analysisProjects.length,
        description: "导入、拆解、模板"
      }
    ];
    const analysisPulse = [
      { label: "拆书项目", value: `${analysisProjects.length} 个` },
      { label: "导入章节", value: `${importedChapterCount} 章` },
      { label: "章节拆解", value: `${analyzedChapterCount} 章` },
      { label: "整书分析", value: `${storyAnalysisCount} 份` }
    ];
    const activePulse = activeMode === "writing" ? writingPulse : analysisPulse;
    const activeHeroTitle = activeMode === "writing"
      ? writingProject?.name ?? "先开一本能长期写下去的新书"
      : analysisProject?.name ?? "先导入一本值得拆解的样书";
    const activeHeroDescription = activeMode === "writing"
      ? writingProject?.description ?? "从书名、主角和开局钩子开始，把第一章任务卡跑通，再进入正文、台账和审稿闭环。"
      : analysisProject?.description ?? "把样本文本切成章节，拆出冲突、爽点、钩子和可迁移的商业结构。";
    const activeNoteTitle = activeMode === "writing"
      ? writingProject ? "下一步：回到章节任务卡" : "下一步：创建作品骨架"
      : analysisProject ? "下一步：继续章节拆解" : "下一步：导入样本文本";
    const activeNoteText = activeMode === "writing"
      ? writingProject
        ? `这本书已经写了 ${writingProject._count.chapterDrafts} 章，累计 ${featuredWritingCharacters.toLocaleString("zh-CN")} 字。`
        : "先确定书名、题材、主角和核心爽点，再让任务卡负责后续章节节奏。"
      : analysisProject
        ? `这个样本已导入 ${analysisProject._count.chapters} 章，完成 ${analysisProject._count.chapterAnalyses} 章拆解。`
        : "先导入样本文本，后面再沉淀章节节奏、爽点公式和迁移模板。";
    const activePrimaryHref = activeMode === "writing" ? continueWritingHref : continueAnalysisHref;
    const activePrimaryAction = activeMode === "writing"
      ? writingProject ? "继续创作" : "新建创作项目"
      : analysisProject ? "继续拆书" : "新建拆书项目";
    const activeProjectCenterHref = activeMode === "writing" ? "/projects?type=writing" : "/projects?type=analysis";
    const homeCommandCards = activeMode === "writing"
      ? [
          {
            href: continueWritingHref,
            className: "home-command-card home-command-primary",
            icon: "写",
            title: writingProject ? "进入创作工作台" : "创建一本新书",
            meta: writingProject ? `任务卡 ${taskCardCount} · 审稿 ${reviewReportCount}` : "书名、简介、主角、题材先跑通。"
          },
          {
            href: "/stats",
            className: "home-command-card",
            icon: "统",
            title: "查看创作统计",
            meta: `今日 ${todayCharacters.toLocaleString("zh-CN")} 字 · 累计 ${totalCharacters.toLocaleString("zh-CN")} 字`
          },
          {
            href: "/projects?type=writing",
            className: "home-command-card",
            icon: "项",
            title: "管理创作项目",
            meta: `${writingProjects.length} 个项目 · ${writtenChapterCount} 章正文`
          }
        ]
      : [
          {
            href: continueAnalysisHref,
            className: "home-command-card home-command-primary",
            icon: "拆",
            title: analysisProject ? "继续拆书项目" : "导入一本样书",
            meta: analysisProject ? `${analysisProject.name} · 已拆 ${analysisProject._count.chapterAnalyses} 章` : "先拆结构，再把公式沉淀成模板。"
          },
          {
            href: latestTemplate ? `/templates/${latestTemplate.id}` : "/templates",
            className: "home-command-card",
            icon: "模",
            title: latestTemplate ? latestTemplate.name : "模板库还在等待第一条公式",
            meta: latestTemplate ? `${latestTemplate.genre} · 可继续迁移到新题材` : "从整书分析页保存模板后，这里会变成迁移入口。"
          },
          {
            href: "/projects?type=analysis",
            className: "home-command-card",
            icon: "项",
            title: "管理拆书项目",
            meta: `${analysisProjects.length} 个样本 · ${analyzedChapterCount} 章拆解`
          }
        ];

    return (
      <div className="home-dashboard">
        <section className="home-studio-hero">
          <div className="home-focus-panel">
            <div className="home-focus-copy">
              <span className="home-kicker">{activeMode === "writing" ? "今日续写" : "今日拆书"}</span>
              <h1>{activeHeroTitle}</h1>
              <p>{activeHeroDescription}</p>
            </div>

            <div className="home-focus-body">
              {activeMode === "writing" && writingProject ? (
                <ProjectCover
                  title={writingProject.name}
                  authorName={writingProject.authorName}
                  coverImageUrl={writingProject.coverImageUrl}
                  fallbackLabel="新书"
                  size="lg"
                  className="home-focus-cover"
                />
              ) : (
                <div className="book-cover home-default-book-cover" aria-hidden="true">
                  <div className="book-cover-title">{activeMode === "writing" ? "书本名称" : "样本拆解"}</div>
                  <div className="book-cover-author">{activeMode === "writing" ? "作者名称" : "结构公式"}</div>
                </div>
              )}
              <div className="home-focus-meta">
                <div className="home-status-strip" aria-label={activeMode === "writing" ? "创作状态" : "拆书状态"}>
                  {activePulse.map((item) => (
                    <span key={item.label}>
                      <strong>{item.value}</strong>
                      {item.label}
                    </span>
                  ))}
                </div>
                <div className="home-focus-note">
                  <strong>{activeNoteTitle}</strong>
                  <span>{activeNoteText}</span>
                </div>
                <div className="home-focus-actions">
                  <Link href={activePrimaryHref} className="button primary">
                    {activePrimaryAction}
                  </Link>
                  <Link href={activeProjectCenterHref} className="button">
                    查看项目中心
                  </Link>
                </div>
                {activeMode === "writing" && switchableWritingProjects.length > 0 ? (
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
            {homeCommandCards.map((card) => (
              <Link key={`${card.icon}-${card.href}`} href={card.href} className={card.className}>
                <span>{card.icon}</span>
                <strong>{card.title}</strong>
                <em>{card.meta}</em>
              </Link>
            ))}
          </aside>
        </section>

        {activeMode === "writing" && showFirstCreationFlow ? (
          <FirstCreationFlow
            writingProject={writingProject}
            hasTaskCard={hasWritingTaskCard}
            hasDraft={hasWritingDraft}
          />
        ) : null}

        <nav className="project-type-tabs home-stage-tabs" aria-label="首页工作线切换">
          <div className="project-type-tab-list">
            {modeTabs.map((tab) => (
              <Link
                key={tab.type}
                href={tab.href}
                className={activeMode === tab.type ? "project-type-tab active" : "project-type-tab"}
                aria-current={activeMode === tab.type ? "page" : undefined}
              >
                <strong>{tab.label}</strong>
                <span>{tab.count} 个 · {tab.description}</span>
              </Link>
            ))}
          </div>
          {/* <div className="project-type-current">
            当前显示 <strong>{activeMode === "writing" ? "创作线" : "拆书线"}</strong>
          </div> */}
        </nav>

        <div className="home-stage-board home-stage-board-single">
          {activeMode === "writing" ? (
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
          ) : (
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
          )}
        </div>
      </div>
    );
  }

  const userHasAccess = Boolean(user);
  const productPillars = [
      {
        label: "构思成型",
        title: "把想法整理成可写项目",
        description: "从题材、主角、卖点到世界规则，先搭出作品骨架，再决定第一章怎么落笔。",
        points: ["书名方向", "核心卖点", "人物功能", "世界规则"],
        image: "/landing/writing.webp",
        href: "/download"
      },
      {
        label: "样本研究",
        title: "看懂一本书为何留人",
        description: "把样本文本拆成开局、冲突、情绪补偿、章末钩子和升级节奏，而不是只给一段摘要。",
        points: ["文本分章", "冲突拆解", "节奏分析", "结构模板"],
        image: "/landing/templates.webp",
        href: "/templates"
      },
      {
        label: "状态校准",
        title: "写完一章，更新世界状态",
        description: "新增人物、线索、伏笔和关系变化会进入台账，下一次生成时不必从零解释前文。",
        points: ["章节台账", "伏笔状态", "人物已知", "审稿建议"],
        image: "/landing/inspirations.webp",
        href: "/inspirations"
      }
    ];

  const creationFlow = [
      "确定作品气质和读者期待",
      "整理主角、规则和叙事边界",
      "生成本章目标与承接任务",
      "写出草稿并做表达二稿",
      "沉淀台账、线索和人物状态"
    ];
  const analysisFlow = [
      "导入想研究的样本文本",
      "按章节切开叙事推进",
      "标出压制、反击和读者钩子",
      "整理可学习的节奏模式",
      "迁移成新的题材方案"
    ];
  const trustItems = [
      {
        title: "作品资料不乱飞",
        text: "草稿、设定、人物档案、伏笔和章节台账优先留在你的本地客户端。"
      },
      {
        title: "模型选择权在你手里",
        text: "支持 OpenAI-compatible 接口，可按预算和习惯接入不同 AI 服务。"
      },
      {
        title: "不是洗稿工具",
        text: "产品强调结构学习、项目管理和原创迁移，不鼓励复刻原作桥段。"
      }
    ];

  return (
      <div className="public-home commercial-home">
        <section className="commercial-hero">
          <div className="commercial-hero-copy">
            <span className="commercial-kicker">墨澜 · AI网文写作助手</span>
            <h1>让一本小说，从灵感开始有章法地长出来。</h1>
            <p>
              先管住设定、人物和章节目标，再让 AI 参与生成。墨澜帮你把一本长篇写作项目持续接下去。
            </p>
            <div className="commercial-actions">
              {userHasAccess ? (
                <a href="/workspace" className="button primary">
                  进入工作台
                </a>
              ) : (
                <Link href="/download" className="button primary">
                  下载桌面端
                </Link>
              )}
            </div>
            <div className="commercial-hero-metrics" aria-label="产品能力概览">
              <span><strong>搭</strong>先把作品骨架、人物和规则搭清楚</span>
              <span><strong>写</strong>每章都有目标、承接和章末余味</span>
              <span><strong>审</strong>写完后检查跑偏、露馅和 AI 味</span>
            </div>
          </div>

          <div className="commercial-product-visual" aria-label="墨澜产品能力预览">
            <div className="commercial-device">
              <div className="commercial-device-bar" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <img src="/landing/homepage.webp" alt="墨澜客户端首页截图" />
            </div>
            <div className="commercial-floating-shot commercial-floating-shot-writing">
              <img src="/landing/writing.webp" alt="新书创作工作台截图" />
              <span>新书创作</span>
            </div>
            <div className="commercial-floating-shot commercial-floating-shot-ideas">
              <img src="/landing/inspirations.webp" alt="灵感中心截图" />
              <span>灵感中心</span>
            </div>
          </div>
        </section>

        <section className="commercial-section commercial-pillars">
          <div className="commercial-section-head">
            <span className="commercial-section-overline">核心能力</span>
            <h2>写作不是一次输出，而是一串需要被照看的决定。</h2>
            <p>墨澜把构思、样本研究、章节推进和状态校准放在一起，让作品资料能持续服务下一章。</p>
          </div>
          <div className="commercial-pillar-grid">
            {productPillars.map((pillar, index) => (
              <article key={pillar.label} className="commercial-pillar">
                <div className="commercial-pillar-copy">
                  <p className="commercial-pillar-meta">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {pillar.label}
                  </p>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="commercial-section commercial-workflows">
          <div className="commercial-section-head commercial-flow-head">
            <span className="commercial-kicker">工作方式</span>
            <h2>先让项目站稳，再让 AI 动笔。</h2>
            <p>
              墨澜不把写作变成一次聊天。它先整理方向、规则、章节目标和前文状态，再把这些约束交给生成与审稿流程。
            </p>
          </div>
          <div className="commercial-flow-board">
            <div className="commercial-flow-track">
              <div className="commercial-flow-track-head">
                <span>新书创作</span>
                <h3>从作品雏形到章节推进</h3>
              </div>
              <ol>
                {creationFlow.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="commercial-flow-track">
              <div className="commercial-flow-track-head">
                <span>样本研究</span>
                <h3>从阅读经验到可用方法</h3>
              </div>
              <ol>
                {analysisFlow.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="commercial-section commercial-trust">
          <div className="commercial-trust-panel">
            <span className="commercial-kicker">创作者边界</span>
            <h2>AI 做助手，作者做判断。</h2>
            <p>
              它负责拆解、提醒、记录和辅助生成；题材取舍、人物命运、表达判断和最终发布，仍然交给创作者自己。
            </p>
            <div className="commercial-trust-list">
              {trustItems.map((item) => (
                <div key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <footer className="commercial-footer">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
            备案号：京ICP备2026030971号-1
          </a>
        </footer>
      </div>
  );

}
