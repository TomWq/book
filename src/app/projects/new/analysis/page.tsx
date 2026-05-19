import Link from "next/link";
import { Panel } from "@/components/panel";
import { AnalysisProjectForm } from "./project-form";

export default function NewAnalysisProjectPage() {
  return (
    <div className="grid">
      <section className="hero analysis-create-hero">
        <div className="hero-top">
          <div>
            <div className="pill success">拆书入口</div>
            <h1>新建拆书项目，只保留拆解需要的信息</h1>
            <p>这里不要求主角名、金手指和作品简介。先建立拆书容器，下一步直接导入文本、选择章节区间，再运行分析。</p>
          </div>
          <div className="hero-actions">
            <Link href="/projects/new" className="button">
              新建作品
            </Link>
            <Link href="/projects" className="button">
              返回项目中心
            </Link>
          </div>
        </div>
      </section>

      <div className="analysis-create-layout">
        <Panel
          title="拆书项目信息"
          description="只填写拆书时真正有用的内容，创建后会进入文本导入页。"
        >
          <AnalysisProjectForm />
        </Panel>

        <aside className="analysis-create-side">
          <Panel title="创建后做什么" description="拆书链路不需要先补创作设定。">
            <div className="list compact-list">
              <div className="task-block">
                <div className="task-title">1. 导入文本</div>
                <div className="muted">上传 TXT 或粘贴原文，系统先自动分章。</div>
              </div>
              <div className="task-block">
                <div className="task-title">2. 选择章节范围</div>
                <div className="muted">可以只分析前 10 章、前 30 章，或指定章节区间。</div>
              </div>
              <div className="task-block">
                <div className="task-title">3. 提取结构</div>
                <div className="muted">逐章拆冲突、压制、爽点、钩子，再总结公式和模板。</div>
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
