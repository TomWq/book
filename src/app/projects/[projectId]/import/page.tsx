import { ImportSourceForm } from "@/components/import-source-form";
import { Panel } from "@/components/panel";

export default async function ProjectImportPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="grid two-col">
      <Panel title="文本导入" description="上传 TXT 或粘贴长文本，系统会先保存原文，再自动分章。">
        <ImportSourceForm projectId={projectId} />
      </Panel>

      <Panel title="导入建议" description="先让系统拿到原文，再进入拆章和分析。">
        <div className="list">
          <div className="section-card">优先上传完整文本，不要只贴片段。</div>
          <div className="section-card">如果是分析书稿，建议先导入前 30 章做验证。</div>
          <div className="section-card">分章后去章节页检查章节标题和顺序，再开始整书分析。</div>
          <div className="quote-box">导入页只负责一个动作：把原文送进项目，并带去章节列表。</div>
        </div>
      </Panel>
    </div>
  );
}
