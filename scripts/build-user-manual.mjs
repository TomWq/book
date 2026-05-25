import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, "USER_MANUAL.md");
const outputDir = path.join(rootDir, "public", "manual");
const htmlPath = path.join(outputDir, "AI网文写作助手使用手册.html");
const pdfPath = path.join(outputDir, "AI网文写作助手使用手册.pdf");

const markdown = readFileSync(sourcePath, "utf8");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function slugify(value, used) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function markdownToHtml(input) {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const usedSlugs = new Map();
  const toc = [];
  const out = [];
  let paragraph = [];
  let listItems = [];
  let inCode = false;
  let codeLines = [];

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }
    out.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }
    out.push("<ul>");
    for (const item of listItems) {
      out.push(`<li>${inlineMarkdown(item)}</li>`);
    }
    out.push("</ul>");
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text, usedSlugs);
      if (level <= 3) {
        toc.push({ level, text, id });
      }
      out.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`);
      continue;
    }

    const list = line.match(/^-\s+(.+)$/);
    if (list) {
      flushParagraph();
      listItems.push(list[1].trim());
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();

  return { body: out.join("\n"), toc };
}

function renderHtmlDocument() {
  const { body, toc } = markdownToHtml(markdown);
  const tocHtml = toc
    .filter((item) => item.level > 1)
    .map((item) => `<a class="toc-level-${item.level}" href="#${item.id}">${escapeHtml(item.text)}</a>`)
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI 网文写作助手使用手册</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #172033;
      --muted: #667085;
      --line: #e6ebf2;
      --soft: #f6f8fb;
      --accent: #2bbfd0;
      --accent-strong: #1293a8;
      --paper: #ffffff;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--ink);
      background:
        radial-gradient(circle at 18% 8%, rgba(43, 191, 208, 0.13), transparent 30%),
        linear-gradient(180deg, #fbfcfe 0%, #eef4f7 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.72;
    }

    .shell {
      width: min(1180px, calc(100% - 48px));
      margin: 0 auto;
      padding: 48px 0 72px;
    }

    .hero {
      min-height: 220px;
      display: grid;
      align-content: end;
      gap: 16px;
      padding: 38px 42px;
      border: 1px solid rgba(43, 191, 208, 0.24);
      border-radius: 22px;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(246, 251, 252, 0.82)),
        radial-gradient(circle at 85% 18%, rgba(43, 191, 208, 0.18), transparent 36%);
      box-shadow: 0 24px 70px rgba(34, 48, 74, 0.1);
    }

    .hero span {
      width: fit-content;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(43, 191, 208, 0.12);
      color: var(--accent-strong);
      font-size: 13px;
      font-weight: 800;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(34px, 5vw, 56px);
      line-height: 1.08;
      letter-spacing: 0;
    }

    .hero p {
      max-width: 760px;
      margin: 0;
      color: var(--muted);
      font-size: 17px;
    }

    .layout {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 28px;
      margin-top: 28px;
      align-items: start;
    }

    .toc {
      position: sticky;
      top: 24px;
      max-height: calc(100vh - 48px);
      overflow: auto;
      display: grid;
      gap: 4px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 18px 44px rgba(34, 48, 74, 0.08);
    }

    .toc strong {
      margin-bottom: 8px;
      font-size: 15px;
    }

    .toc a {
      padding: 7px 10px;
      border-radius: 10px;
      color: var(--muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.35;
    }

    .toc a:hover {
      background: rgba(43, 191, 208, 0.1);
      color: var(--accent-strong);
    }

    .toc-level-3 {
      padding-left: 22px !important;
      font-weight: 600 !important;
    }

    .manual {
      padding: 42px;
      border: 1px solid var(--line);
      border-radius: 22px;
      background: var(--paper);
      box-shadow: 0 24px 70px rgba(34, 48, 74, 0.08);
    }

    .manual h1 { display: none; }

    .manual h2 {
      margin: 52px 0 18px;
      padding-top: 8px;
      font-size: 28px;
      line-height: 1.25;
      letter-spacing: 0;
      border-top: 1px solid var(--line);
    }

    .manual h2:first-child,
    .manual h1 + h2 {
      margin-top: 0;
      border-top: 0;
    }

    .manual h3 {
      margin: 30px 0 12px;
      color: #213047;
      font-size: 20px;
      line-height: 1.35;
    }

    .manual p {
      margin: 12px 0;
      color: #324158;
    }

    .manual ul {
      display: grid;
      gap: 8px;
      margin: 14px 0 18px;
      padding: 0;
      list-style: none;
    }

    .manual li {
      position: relative;
      padding: 11px 14px 11px 34px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--soft);
    }

    .manual li::before {
      content: "";
      position: absolute;
      left: 14px;
      top: 21px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
    }

    .manual code {
      padding: 2px 6px;
      border-radius: 6px;
      background: #eef7f8;
      color: #0f7082;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
    }

    .manual pre {
      overflow: auto;
      padding: 16px;
      border-radius: 14px;
      background: #172033;
      color: #f7fbff;
    }

    .footer {
      margin-top: 28px;
      color: var(--muted);
      text-align: center;
      font-size: 13px;
    }

    @media (max-width: 900px) {
      .shell { width: min(100% - 24px, 760px); padding-top: 24px; }
      .hero { padding: 28px 24px; border-radius: 18px; }
      .layout { grid-template-columns: 1fr; }
      .toc { position: static; max-height: none; }
      .manual { padding: 26px 20px; border-radius: 18px; }
      .manual h2 { font-size: 24px; }
    }

    @media print {
      body { background: #fff; }
      .shell { width: 100%; padding: 0; }
      .hero, .toc, .footer { display: none; }
      .layout { display: block; margin: 0; }
      .manual { border: 0; box-shadow: none; padding: 0; }
      .manual h1 { display: block; }
      .manual h2 { break-after: avoid; }
      .manual h3 { break-after: avoid; }
      .manual li { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <span>用户手册</span>
      <h1>AI 网文写作助手使用手册</h1>
      <p>从激活、AI 配置，到创作新书、拆书模板、审稿修改、备份恢复，一份给真实用户照着走的完整说明。</p>
    </section>
    <div class="layout">
      <aside class="toc">
        <strong>目录</strong>
        ${tocHtml}
      </aside>
      <main class="manual">
        ${body}
      </main>
    </div>
    <div class="footer">© 2026 AI 网文写作助手 · 本地优先，保护创作隐私</div>
  </div>
</body>
</html>`;
}

function plainTextForPdf() {
  return markdown
    .replace(/^# (.+)$/gm, "$1\n")
    .replace(/^## (.+)$/gm, "\n\n$1\n")
    .replace(/^### (.+)$/gm, "\n$1\n")
    .replace(/^- /gm, "• ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(htmlPath, renderHtmlDocument(), "utf8");

const { spawnSync } = await import("node:child_process");

function findChromiumPrinter() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? "";
}

function buildPdfFromHtml() {
  const browserPath = findChromiumPrinter();

  if (!browserPath) {
    return false;
  }

  const fileUrl = `file://${htmlPath}`;
  const result = spawnSync(browserPath, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--print-to-pdf=${pdfPath}`,
    fileUrl
  ], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });

  return result.status === 0 && existsSync(pdfPath);
}

function buildPdfFromText() {
  const plainTextPath = path.join(outputDir, "AI网文写作助手使用手册.txt");
  writeFileSync(plainTextPath, plainTextForPdf(), "utf8");
  const pdf = spawnSync("cupsfilter", [plainTextPath], {
    encoding: null,
    maxBuffer: 20 * 1024 * 1024
  });
  rmSync(plainTextPath, { force: true });

  if (pdf.status === 0 && pdf.stdout?.length) {
    writeFileSync(pdfPath, pdf.stdout);
    return true;
  }

  return false;
}

const pdfGenerated = buildPdfFromHtml() || buildPdfFromText();

console.log(`[manual] HTML: ${htmlPath}`);
if (pdfGenerated) {
  console.log(`[manual] PDF:  ${pdfPath}`);
} else {
  console.warn("[manual] PDF 生成失败，仅生成 HTML。");
}
