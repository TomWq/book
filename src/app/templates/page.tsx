import Link from "next/link";
import { Panel } from "@/components/panel";
import { getTemplates } from "@/lib/projects";

export default async function TemplatesPage() {
  const templates = await getTemplates();
  const categories = Array.from(new Set(templates.map((template) => template.genre).filter(Boolean)));

  return (
    <div className="grid two-col">
      <Panel title="模板库" description="把拆出来的爆款结构沉淀成可迁移资产。">
        <div className="meta-row" style={{ marginBottom: 14 }}>
          <span className="chip">{templates.length} 个模板</span>
          <span className="chip">{categories.length} 个题材分类</span>
        </div>
        {templates.length === 0 ? (
          <div className="empty-state">
            <strong>模板库还没有内容</strong>
            <span>先完成一个拆书项目的整书分析，再把故事公式保存进模板库。</span>
            <Link href="/projects" className="button">
              去项目中心
            </Link>
          </div>
        ) : (
          <div className="list">
            {templates.map((template) => (
              <Link key={template.id} href={`/templates/${template.id}`} className="list-item">
                <div className="row">
                  <strong>{template.name}</strong>
                  <span className="pill">{template.genre}</span>
                </div>
                <div className="muted">{template.openingHook}</div>
                <div className="footer-note">{template.mainLoop}</div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="模板使用方式" description="模板不是照搬原作，而是复用结构。">
        <div className="list">
          <div className="section-card">先拆爆款，提炼公式。</div>
          <div className="section-card">再保存为模板，保留可迁移结构。</div>
          <div className="section-card">最后填入新题材变量，生成新书大纲。</div>
          <div className="quote-box">
            模板页后续会成为从“已验证结构”进入“新题材创作”的中间站。
          </div>
        </div>
      </Panel>
    </div>
  );
}
