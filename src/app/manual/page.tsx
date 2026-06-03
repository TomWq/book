import { ManualHtmlFrame } from "@/components/manual-html-frame";

export const metadata = {
  title: "使用手册 - 墨澜 · AI 网文写作助手"
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const manualHtmlUrl = encodeURI("/manual/墨澜 · AI 网文写作助手使用手册.html");

export default function ManualPage() {
  return (
    <div className="manual-page">
      <section className="page-intro manual-intro">
        <div>
          <h1>使用手册</h1>
          <p>从首次激活、AI 配置，到创作新书、拆书模板、审稿修改和备份恢复，按真实使用流程整理。</p>
        </div>
      </section>

      <section className="manual-embed" aria-label="完整使用手册">
        <div className="manual-source local">
          <span>正在显示客户端内置 HTML 文档</span>
          <a href={manualHtmlUrl} target="_blank" rel="noreferrer">
            新窗口打开
          </a>
        </div>
        <ManualHtmlFrame src={manualHtmlUrl} />
      </section>
    </div>
  );
}
