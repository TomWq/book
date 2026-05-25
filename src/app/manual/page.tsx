import { readFileSync } from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Panel } from "@/components/panel";

export const metadata = {
  title: "使用手册 - AI 网文写作助手"
};

function readManual() {
  return readFileSync(path.join(process.cwd(), "USER_MANUAL.md"), "utf8");
}

export default function ManualPage() {
  const manual = readManual();

  return (
    <div className="manual-page">
      <section className="page-intro manual-intro">
        <div>
          <h1>使用手册</h1>
          <p>从首次激活、AI 配置，到创作新书、拆书模板、审稿修改和备份恢复，按真实使用流程整理。</p>
        </div>
      </section>

      <Panel title="完整说明" description="这份内容会随版本持续更新，直接在客户端内阅读即可。">
        <article className="manual-reader">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{manual}</ReactMarkdown>
        </article>
      </Panel>
    </div>
  );
}
