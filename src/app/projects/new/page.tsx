import Link from "next/link";
import { Panel } from "@/components/panel";
import { ProjectForm } from "./project-form";

export default function NewProjectPage() {
  return (
    <div className="grid">
      <section className="hero book-create-hero">
        <div className="hero-top">
          <div>
            <div className="pill success">创建入口</div>
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

      <Panel
          title="作品基础信息"
          description="这些信息会同步成为后续状态管理的初始设定。只想上传原文做拆解，请使用独立的拆书项目入口。"
      >
        <ProjectForm />
      </Panel>
    </div>
  );
}
