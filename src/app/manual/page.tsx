import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Panel } from "@/components/panel";
import { loadManualContent } from "@/lib/manual";

export const metadata = {
  title: "使用手册 - AI 网文写作助手"
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ManualPage() {
  const manual = await loadManualContent();
  const sourceLabel = manual.source === "remote" ? "已同步服务器最新文档" : "正在显示客户端内置文档";
  const sourceMeta = [sourceLabel, manual.updatedAt ? `更新 ${new Date(manual.updatedAt).toLocaleString("zh-CN")}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="manual-page">
      <section className="page-intro manual-intro">
        <div>
          <h1>使用手册</h1>
          <p>从首次激活、AI 配置，到创作新书、拆书模板、审稿修改和备份恢复，按真实使用流程整理。</p>
        </div>
      </section>

      <Panel title="完整说明" description="这份内容会随版本持续更新，直接在客户端内阅读即可。">
        <div className={`manual-source ${manual.source}`}>
          <span>{sourceMeta}</span>
        </div>
        <article className="manual-reader">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{manual.markdown}</ReactMarkdown>
        </article>
      </Panel>
    </div>
  );
}
