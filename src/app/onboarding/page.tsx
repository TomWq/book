import Link from "next/link";
import { ApiButton } from "@/components/api-form";
import { Panel } from "@/components/panel";
import { getProjects, getTemplates } from "@/lib/projects";

export const dynamic = "force-dynamic";

function StepCard({
  done,
  title,
  description,
  href,
  action
}: {
  done: boolean;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="list-item">
      <div className="row">
        <strong>{title}</strong>
        <span className={`pill ${done ? "success" : "warning"}`}>{done ? "已完成" : "待完成"}</span>
      </div>
      <div className="muted">{description}</div>
      <div className="hero-actions">
        <Link href={href} className="button">
          {action}
        </Link>
      </div>
    </div>
  );
}

export default async function OnboardingPage() {
  const [projects, templates] = await Promise.all([
    getProjects(),
    getTemplates()
  ]);
  const hasProject = projects.length > 0;
  const hasImportedChapters = projects.some((project) => project._count.chapters > 0);
  const hasAnalysis = projects.some((project) => project._count.storyAnalyses > 0);
  const hasTemplate = templates.length > 0;
  const hasWritingProject = projects.some((project) => project.type === "writing");
  const steps = [
    hasProject,
    hasImportedChapters,
    hasAnalysis,
    hasTemplate,
    hasWritingProject
  ];
  const doneCount = steps.filter(Boolean).length;

  return (
    <div className="grid two-col">
      <Panel title="新手引导" description="按这条路线走一遍，就能跑通产品主链路。">
        <div className="list">
          <div className="list-item">
            <div className="row">
              <strong>完成度</strong>
              <span className="chip">{doneCount} / {steps.length}</span>
            </div>
            <div className="usage-bar" aria-hidden="true">
              <span style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }} />
            </div>
          </div>
          <StepCard
            done={hasProject}
            title="1. 创建拆书项目"
            description="先用轻量入口创建拆书项目，下一步直接导入文本。"
            href="/projects/new/analysis"
            action="新建拆书"
          />
          <StepCard
            done={hasImportedChapters}
            title="2. 导入文本"
            description="上传 TXT 或粘贴长文本，系统自动分章后进入章节页校正。"
            href={projects[0] ? `/projects/${projects[0].id}/import` : "/projects/new/analysis"}
            action="去导入"
          />
          <StepCard
            done={hasAnalysis}
            title="3. 运行分析"
            description="让系统拆解章节、提取爽点、生成整书节奏和故事公式。"
            href={projects[0] ? `/projects/${projects[0].id}/analysis` : "/projects/new/analysis"}
            action="去分析"
          />
          <StepCard
            done={hasTemplate}
            title="4. 保存模板"
            description="把拆解出来的公式沉淀为可迁移模板。"
            href="/templates"
            action="看模板库"
          />
          <StepCard
            done={hasWritingProject}
            title="5. 进入创作"
            description="基于创作圣经、人物、伏笔和主线状态生成任务卡、正文、台账和审稿。"
            href="/projects/new"
            action="新建作品"
          />
        </div>
      </Panel>

      <Panel title="完成引导" description="完成后回到工作台继续使用。">
        <div className="list">
          <div className="quote-box">
            新手引导只是为了跑通第一条链路。真正长期使用时，重点会落在模板库和创作状态管理。
          </div>
          <ApiButton endpoint="/api/onboarding" label="标记为已了解" redirectTo="/" />
          <Link href="/settings/account" className="button">
            查看账号与额度
          </Link>
        </div>
      </Panel>
    </div>
  );
}
