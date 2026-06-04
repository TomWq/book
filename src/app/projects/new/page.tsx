import Link from "next/link";
import { Panel } from "@/components/panel";
import { getCurrentUser } from "@/lib/projects";
import { ProjectForm } from "./project-form";

function displayAssistantName(value?: string) {
  return String(value ?? "").trim() || "墨澜";
}

export default async function NewProjectPage() {
  const user = await getCurrentUser();
  const assistantName = displayAssistantName(user?.assistantName);

  return (
    <div className="grid">
      <section className="hero book-create-hero">
        <div className="hero-top">
          <div>
            <h1>新建作品，不只是新建一个空项目</h1>
            <p>这里专门创建要写的新书。先把书名、读者、题材标签、主角和简介定下来，后续创作圣经、任务卡和长篇状态才有可读取的基础。</p>
          </div>
          <div className="hero-actions">
            <Link href="/projects/new/analysis" className="button">
              新建拆书项目
            </Link>
            <span className="chip">书名</span>
            <span className="chip">标签</span>
            <span className="chip">主角</span>
            <span className="chip">简介</span>
          </div>
        </div>
      </section>

      <section className="new-project-guide">
        <div>
          <span>{assistantName}建议</span>
          <strong>第一次创建作品，不用把所有设定都想完</strong>
          <p>先选读者和题材标签，再让 AI 试起书名、主角名和简介。创建成功后，建议先生成长篇规划 / 总纲节奏，再去写第一章任务卡。</p>
        </div>
        <ol>
          <li><span>1</span>选读者与标签</li>
          <li><span>2</span>AI 起名和取主角</li>
          <li><span>3</span>生成简介和总纲</li>
        </ol>
      </section>

      <Panel
          title="作品基础信息"
          description="这些信息会同步成为后续状态管理的初始设定。只想上传原文做拆解，请使用独立的拆书项目入口。"
      >
        <ProjectForm />
      </Panel>
    </div>
  );
}
