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

export default async function HomePage() {
  const pathname = (await headers()).get("x-nw-pathname") ?? "/";
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
                  authorName={writingProject.authorName}
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

  const userHasAccess = Boolean(user);
  const productPillars = [
      {
        label: "长篇创作中枢",
        title: "每一章都先有任务卡，再写正文",
        description: "创作圣经、人物档案、伏笔、主线状态和最近台账一起进入上下文，控制章节目标和承接关系。",
        points: ["章节任务卡", "流式正文", "章节台账", "一致性审稿"]
      },
      {
        label: "拆书与模板资产",
        title: "把样本拆成可迁移的商业结构",
        description: "导入文本后自动分章，逐章提取冲突、压制、爽点、收益和钩子，再沉淀为模板。",
        points: ["自动分章", "章节拆解", "整书分析", "模板迁移"]
      },
      {
        label: "灵感与二稿系统",
        title: "零散想法不丢，AI 味可以改",
        description: "灵感中心承接桥段、设定、人物和台词；二稿编辑负责检查模板腔、平均句和表达力度。",
        points: ["灵感检索", "AI 润色", "结构化转化", "二稿对照"]
      }
    ];

  const creationFlow = [
      "作品身份与读者标签",
      "创作圣经与状态页",
      "生成章节任务卡",
      "正文草稿与目录管理",
      "台账沉淀与一致性审稿"
    ];
  const analysisFlow = [
      "导入样本文本",
      "自动分章与手动调整",
      "逐章结构化拆解",
      "整书节奏与公式分析",
      "保存模板并迁移新题材"
    ];
  const trustItems = [
      {
        title: "作品数据默认在本机",
        text: "草稿、设定、人物档案、伏笔、章节台账、AI 对话历史默认保存在你的电脑里。"
      },
      {
        title: "AI 服务由你自己配置",
        text: "支持 OpenAI-compatible 接口，DeepSeek、OpenAI、通义、Moonshot、Ollama 等都可按配置接入。"
      },
      {
        title: "客户端优先，网页入口辅助",
        text: "桌面端用于长期创作和本地隐私保护；网页入口只面向特邀用户和授权场景。"
      }
    ];

  return (
      <div className="public-home commercial-home">
        <section className="commercial-hero">
          <div className="commercial-hero-copy">
            <span className="commercial-kicker">桌面端 AI 网文创作工作台</span>
            <h1>拆爆款，管长篇，把灵感稳定写成连载。</h1>
            <p>
              墨澜把拆书分析、模板迁移、灵感整理、章节任务卡、正文生成、章节台账和一致性审稿放进同一个本地客户端。它不是单次聊天写作，而是陪作者持续管理一本长篇。
            </p>
            <div className="commercial-actions">
              {userHasAccess ? (
                <a href="/workspace" className="button primary">
                  进入工作台
                </a>
              ) : (
                <Link href="/download" className="button primary">
                  下载客户端
                </Link>
              )}
              <Link href="/activate?mode=web" className="button">
                特邀用户入口
              </Link>
              <Link href="/manual" className="button commercial-text-button" target="_blank">
                查看使用手册
              </Link>
            </div>
            <div className="commercial-hero-metrics" aria-label="产品能力概览">
              <span><strong>本地保存</strong>作品、草稿、设定与台账</span>
              <span><strong>双工作流</strong>创作项目与拆书项目</span>
              <span><strong>长篇记忆</strong>人物、伏笔、主线状态</span>
            </div>
          </div>

          <div className="commercial-product-visual" aria-label="墨澜产品能力预览">
            <img src="/mascot/molan.png" alt="墨澜 AI 网文写作助手" className="commercial-mascot" />
            <div className="commercial-demo-panel">
              <div className="commercial-demo-head">
                <span>创作工作台</span>
                <strong>《长夜问丹》 第 18 章</strong>
              </div>
              <div className="commercial-demo-columns">
                <div className="commercial-demo-column accent-blue">
                  <small>任务卡</small>
                  <strong>夜探药铺，发现账本异常</strong>
                  <span>承接上一章钩子 / 推进黑市线索</span>
                </div>
                <div className="commercial-demo-column accent-green">
                  <small>章节台账</small>
                  <strong>新增秦掌柜与赤纹丹线索</strong>
                  <span>人物状态、伏笔、资源同步记录</span>
                </div>
              </div>
              <div className="commercial-review-row">
                <span>一致性审稿</span>
                <p>检查人物已知信息、金手指限制、伏笔提前泄露和 AI 味表达。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="commercial-section commercial-pillars">
          <div className="commercial-section-head">
            <span className="commercial-kicker">核心能力</span>
            <h2>现在的墨澜，是一个完整客户端，不只是早期网页入口。</h2>
            <p>首页优先呈现已经成型的产品能力：长期创作、拆书资产、灵感与二稿，而授权和网页入口退到辅助位置。</p>
          </div>
          <div className="commercial-pillar-grid">
            {productPillars.map((pillar) => (
              <article key={pillar.label} className="commercial-pillar">
                <span>{pillar.label}</span>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
                <div>
                  {pillar.points.map((point) => (
                    <small key={point}>{point}</small>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="commercial-section commercial-workflows">
          <div className="commercial-flow-copy">
            <span className="commercial-kicker">两条主线</span>
            <h2>作者可以直接写，策划也可以先拆后写。</h2>
            <p>
              创作线负责把一本新书稳定推进；拆书线负责把样本沉淀成模板。两条线最终都回到同一个项目状态系统。
            </p>
          </div>
          <div className="commercial-flow-board">
            <div className="commercial-flow-track">
              <span>创作项目</span>
              <h3>从新书方向到连续章节</h3>
              <ol>
                {creationFlow.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="commercial-flow-track">
              <span>拆书项目</span>
              <h3>从样本文本到可迁移模板</h3>
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
            <span className="commercial-kicker">为什么更适合长期写作</span>
            <h2>隐私、本地数据和可控 AI，是客户端的商业化重点。</h2>
            <p>
              长篇作者最在意的不是“能不能生成一段”，而是作品资料是否安全、模型是否可控、写到几十章后是否还能接得住前文。
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
          <aside className="commercial-cta-panel">
            <strong>{userHasAccess ? "已经登录，直接回到工作台。" : "准备开始使用墨澜？"}</strong>
            <p>{userHasAccess
              ? "门户页会一直保留在根路径。需要继续写作、拆书或管理项目时，从这里进入工作台首页。"
              : "优先下载桌面客户端。安装后输入授权码，配置自己的 AI 服务，就可以创建作品、拆书、记录灵感和审稿。"}
            </p>
            {userHasAccess ? (
              <a href="/workspace" className="button primary">
                进入工作台首页
              </a>
            ) : (
              <Link href="/download" className="button primary">
                前往下载中心
              </Link>
            )}
            <Link href="/activate?mode=web" className="button">
              网页特邀入口
            </Link>
          </aside>
        </section>
      </div>
  );

}
