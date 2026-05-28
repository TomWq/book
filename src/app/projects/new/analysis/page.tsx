import Link from "next/link";
import { Panel } from "@/components/panel";
import { AnalysisProjectForm } from "./project-form";

export default function NewAnalysisProjectPage() {
  return (
    <div className="grid">
      <section className="hero analysis-create-hero">
        <div className="hero-top">
          <div>
            <h1>新建拆书项目，只保留拆解需要的信息</h1>
            <p>先记录来源、简介、题材和分析目标，下一步导入文本、选择章节区间，再运行分析。</p>
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
          description="简介会作为原书的第一层钩子和商业承诺，参与后续拆解判断。"
        >
          <AnalysisProjectForm />
        </Panel>

        <aside className="analysis-create-side">
          <Panel title="填写建议" description="拆书项目信息只做分析锚点，不提前写新书设定。">
            <div className="list compact-list">
              <div className="task-block">
                <div className="task-title">简介</div>
                <div className="muted">粘平台简介或推荐语，用来判断读者第一眼被什么吸引。</div>
              </div>
              <div className="task-block">
                <div className="task-title">来源</div>
                <div className="muted">记录书名、平台和样本范围，后续保存模板时更好追溯。</div>
              </div>
              <div className="task-block">
                <div className="task-title">目标</div>
                <div className="muted">写清楚要拆开局、爽点、主循环，还是模板迁移。</div>
              </div>
            </div>
          </Panel>

          <Panel title="创建后做什么" description="下一步才进入正文导入和章节分析。">
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
