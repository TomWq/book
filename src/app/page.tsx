import Link from "next/link";
import { redirect } from "next/navigation";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getBillingMode } from "@/lib/billing-mode";
import {
  getCurrentUser,
  getDashboardStats,
  formatProjectStatus,
  getProjects,
  getRecentAiJobs,
  getTemplates
} from "@/lib/projects";
import { Panel } from "@/components/panel";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user?.role === "admin") {
    redirect("/admin");
  }

  if (!user && isDesktopRuntime() && getBillingMode() === "subscription") {
    redirect("/activate");
  }

  if (!user) {
    const workflows = [
      {
        label: "拆书项目",
        title: "把别人的爆款拆成可复用结构",
        description: "适合先研究样本，沉淀公式、模板和爽点节奏。",
        steps: ["导入原文", "自动分章", "逐章拆解", "整书节奏", "保存模板"],
        href: "/login?next=/projects/new/analysis",
        action: "开始拆书"
      },
      {
        label: "创作新书",
        title: "把自己的新书按状态持续写下去",
        description: "适合已经有题材方向，直接建立作品、设定和章节台账。",
        steps: ["新建作品", "完善设定", "生成任务卡", "生成正文", "更新状态"],
        href: "/register",
        action: "创建新书"
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
            {/* <div className="pill success">AI 网文写作助手</div> */}
            <h1>从拆懂爆款开始，写一本不跑偏的长篇。</h1>
            <p>
              拆章节节奏、爽点和主循环，沉淀可迁移模板，再用任务卡、章节台账和项目状态管理持续推进连载。
            </p>
            <div className="hero-actions">
              <Link href="/register" className="button primary">
                免费开始
              </Link>
              <Link href="/login?next=/projects/new/analysis" className="button hero-secondary">
                先拆一本书
              </Link>
            </div>
            <div className="public-proof">
              <span><strong>30 章</strong>拆书验收链路</span>
              <span><strong>前 100 章</strong>节奏规划</span>
              <span><strong>人物 / 伏笔 / 地图</strong>长篇状态管理</span>
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
                <Link href={workflow.href} className="public-track-action">
                  {workflow.action}
                </Link>
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

  const [stats, projects, templates, workQueue] = await Promise.all([
    getDashboardStats(),
    getProjects(),
    getTemplates(),
    getRecentAiJobs()
  ]);
  const hasProject = projects.length > 0;
  const hasTemplate = templates.length > 0;
  const writingProject = projects.find((project) => project.type === "writing");

  return (
    <>
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="pill success">工作台</div>
            <h1>今天先做哪一步？</h1>
            <p>
              从导入拆书、模板迁移到长篇创作管理，所有入口都在这里。优先处理未完成的项目和任务。
            </p>
          </div>
          <div className="hero-actions">
            <Link href="/projects/new/analysis" className="button">
              新建拆书项目
            </Link>
            <Link href="/templates" className="button">
              查看模板库
            </Link>
            <Link href="/projects/new" className="button primary">
              新建创作项目
            </Link>
          </div>
        </div>

        <div className="grid stats">
          {stats.map((item) => (
            <div key={item.label} className="stat-card">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="grid stats">
          <Link href="/projects/new/analysis" className="stat-card">
            <strong>开始拆书</strong>
            <span>上传文本，自动分章并提炼结构</span>
          </Link>
          <Link href={hasProject ? "/projects" : "/projects/new/analysis"} className="stat-card">
            <strong>{hasProject ? "继续项目" : "创建项目"}</strong>
            <span>{hasProject ? "查看最近拆解和写作进度" : "建立第一个拆书或创作项目"}</span>
          </Link>
          <Link href={hasTemplate ? "/templates" : "/projects"} className="stat-card">
            <strong>{hasTemplate ? "迁移模板" : "沉淀模板"}</strong>
            <span>{hasTemplate ? "选择模板生成新题材大纲" : "完成整书分析后保存公式"}</span>
          </Link>
          <Link href={writingProject ? `/projects/${writingProject.id}/writing` : "/projects/new"} className="stat-card">
            <strong>{writingProject ? "继续创作" : "创建长篇"}</strong>
            <span>任务卡、正文、台账和审稿闭环</span>
          </Link>
        </div>
      </section>

      <div className="dashboard-workbench">
        <div className="dashboard-main">
          <Panel title="最近项目" description="拆书项目与创作项目统一管理">
            <div className="list">
              {projects.length === 0 ? (
                <div className="section-card">暂无项目，先新建一个项目开始。</div>
              ) : (
                projects.slice(0, 4).map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="list-item">
                    <div className="row">
                      <strong>{project.name}</strong>
                      <span className={`pill ${project.status === "ready" ? "success" : "warning"}`}>
                        {formatProjectStatus(project.status)}
                      </span>
                    </div>
                    <div className="kpi">{project.genre || "未填写题材"}</div>
                    <div className="muted">{project.description || "尚未添加项目说明。"}</div>
                    <div className="meta-row">
                      <span className="chip">{project._count.chapters} 章</span>
                      <span className="chip">{new Date(project.updatedAt).toLocaleString("zh-CN")}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Panel>

          <Panel title="模板库预览" description="把成功结构变成可迁移资产">
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

        <aside className="dashboard-side">
          <Panel title="待处理任务" description="只显示待处理、处理中或失败后需要关注的任务">
            <div className="timeline">
              {workQueue.length === 0 ? (
                <div className="section-card">暂无待处理任务。导入文本、分析章节或生成正文时才会出现在这里。</div>
              ) : (
                workQueue.map((item) => (
                  <div key={item.title} className="timeline-item">
                    <div className="row">
                      <strong>{item.title}</strong>
                      <span className="pill warning">{item.status}</span>
                    </div>
                    <div className="meta-row">
                      <span className="chip">进度 {item.progress}</span>
                    </div>
                    <div className="usage-bar" aria-hidden="true">
                      <span style={{ width: `${item.progressPercent ?? 0}%` }} />
                    </div>
                    <div className="muted">{item.detail}</div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="下一步建议" description="按当前项目进度给出最短路径。">
            <div className="list">
              {!hasProject ? (
                <Link href="/projects/new/analysis" className="list-item">
                  <strong>创建第一个项目</strong>
                  <div className="muted">拆书项目用于提公式，创作项目用于管理长篇状态。</div>
                </Link>
              ) : null}
              {hasProject && !hasTemplate ? (
                <Link href="/projects" className="list-item">
                  <strong>完成一次整书分析</strong>
                  <div className="muted">分析完成后保存模板，才能进入新题材迁移。</div>
                </Link>
              ) : null}
              {hasTemplate ? (
                <Link href="/templates" className="list-item">
                  <strong>从模板生成大纲</strong>
                  <div className="muted">选择一个模板，填入题材变量，生成前 10 章和前 100 章节奏。</div>
                </Link>
              ) : null}
              {writingProject ? (
                <Link href={`/projects/${writingProject.id}/writing`} className="list-item">
                  <strong>继续长篇创作</strong>
                  <div className="muted">先生成任务卡，再生成正文、台账和一致性审稿。</div>
                </Link>
              ) : null}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
