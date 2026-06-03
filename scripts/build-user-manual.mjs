import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, "USER_MANUAL.md");
const outputDir = path.join(rootDir, "public", "manual");
const htmlPath = path.join(outputDir, "墨澜 · AI 网文写作助手使用手册.html");
const pdfPath = path.join(outputDir, "墨澜 · AI 网文写作助手使用手册.pdf");
const legacyHtmlPath = path.join(outputDir, "AI网文写作助手使用手册.html");
const legacyPdfPath = path.join(outputDir, "AI网文写作助手使用手册.pdf");

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
  let listType = "ul";
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
    out.push(`<${listType}>`);
    for (const item of listItems) {
      out.push(`<li>${inlineMarkdown(item)}</li>`);
    }
    out.push(`</${listType}>`);
    listItems = [];
    listType = "ul";
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
      if (listItems.length > 0 && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(list[1].trim());
      continue;
    }

    const orderedList = line.match(/^\d+\.\s+(.+)$/);
    if (orderedList) {
      flushParagraph();
      if (listItems.length > 0 && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedList[1].trim());
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
  <title>墨澜 · AI 网文写作助手使用手册</title>
  <script>
    (() => {
      try {
        const theme = new URLSearchParams(window.location.search).get("theme");
        if (theme === "dark") {
          document.documentElement.dataset.theme = "dark";
        }
      } catch {}
    })();
  </script>
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
      --page-bg: #f7fafc;
      --hero-bg:
        linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(246, 251, 252, 0.9)),
        radial-gradient(circle at 92% 12%, rgba(43, 191, 208, 0.1), transparent 30%);
      --toc-bg: rgba(255, 255, 255, 0.92);
      --body-text: #324158;
      --heading-text: #213047;
      --code-bg: #eef7f8;
      --code-text: #0f7082;
      --shadow-soft: rgba(34, 48, 74, 0.06);
    }

    :root[data-theme="dark"] {
      color-scheme: dark;
      --ink: #eef5ff;
      --muted: #9aa8bc;
      --line: rgba(148, 163, 184, 0.22);
      --soft: rgba(30, 41, 59, 0.78);
      --accent: #55d8e8;
      --accent-strong: #6fe7f2;
      --paper: #121922;
      --page-bg: #0f141c;
      --hero-bg:
        linear-gradient(135deg, rgba(18, 25, 34, 0.98), rgba(15, 22, 32, 0.92)),
        radial-gradient(circle at 92% 12%, rgba(85, 216, 232, 0.12), transparent 30%);
      --toc-bg: rgba(18, 25, 34, 0.92);
      --body-text: #c8d3e4;
      --heading-text: #eef5ff;
      --code-bg: rgba(85, 216, 232, 0.1);
      --code-text: #8defff;
      --shadow-soft: rgba(0, 0, 0, 0.24);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--ink);
      background: var(--page-bg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.68;
    }

    .shell {
      width: min(1080px, calc(100% - 28px));
      margin: 0 auto;
      padding: 22px 0 36px;
    }

    .hero {
      display: grid;
      gap: 8px;
      padding: 20px 24px;
      border: 1px solid rgba(43, 191, 208, 0.18);
      border-radius: 14px;
      background: var(--hero-bg);
      box-shadow: 0 12px 32px rgba(34, 48, 74, 0.07);
    }

    .hero span {
      width: fit-content;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(43, 191, 208, 0.12);
      color: var(--accent-strong);
      font-size: 12px;
      font-weight: 800;
    }

    .hero h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.22;
      letter-spacing: 0;
    }

    .hero p {
      max-width: 820px;
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }

    .layout {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 18px;
      margin-top: 18px;
      align-items: start;
    }

    .toc {
      position: sticky;
      top: 14px;
      max-height: calc(100vh - 28px);
      overflow: auto;
      display: grid;
      gap: 3px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--toc-bg);
      box-shadow: 0 10px 28px var(--shadow-soft);
    }

    .toc strong {
      margin-bottom: 6px;
      font-size: 14px;
    }

    .toc a {
      padding: 6px 8px;
      border-radius: 8px;
      color: var(--muted);
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.35;
    }

    .toc a:hover {
      background: rgba(43, 191, 208, 0.1);
      color: var(--accent-strong);
    }

    .toc-level-3 {
      padding-left: 18px !important;
      font-weight: 600 !important;
    }

    .manual {
      padding: 26px 30px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--paper);
      box-shadow: 0 12px 32px var(--shadow-soft);
    }

    .manual h1 { display: none; }

    .manual h2 {
      margin: 34px 0 12px;
      padding-top: 14px;
      font-size: 22px;
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
      margin: 22px 0 8px;
      color: var(--heading-text);
      font-size: 17px;
      line-height: 1.35;
    }

    .manual p {
      margin: 9px 0;
      color: var(--body-text);
      font-size: 14px;
    }

    .manual ul,
    .manual ol {
      display: grid;
      gap: 6px;
      margin: 10px 0 14px;
      padding: 0;
      list-style: none;
      counter-reset: manual-list;
    }

    .manual li {
      position: relative;
      padding: 8px 12px 8px 30px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--soft);
      color: var(--body-text);
      font-size: 14px;
    }

    .manual ul li::before {
      content: "";
      position: absolute;
      left: 12px;
      top: 17px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }

    .manual ol li {
      counter-increment: manual-list;
    }

    .manual ol li::before {
      content: counter(manual-list);
      position: absolute;
      left: 9px;
      top: 9px;
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background: rgba(43, 191, 208, 0.12);
      color: var(--accent-strong);
      font-size: 11px;
      font-weight: 800;
      line-height: 16px;
      text-align: center;
    }

    .manual code {
      padding: 2px 6px;
      border-radius: 6px;
      background: var(--code-bg);
      color: var(--code-text);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
    }

    .manual pre {
      overflow: auto;
      padding: 14px;
      border-radius: 10px;
      background: #172033;
      color: #f7fbff;
    }

    .footer {
      margin-top: 18px;
      color: var(--muted);
      text-align: center;
      font-size: 12px;
    }

    @media (max-width: 900px) {
      .shell { width: min(100% - 20px, 760px); padding-top: 14px; }
      .hero { padding: 16px 18px; border-radius: 12px; }
      .hero h1 { font-size: 24px; }
      .layout { grid-template-columns: 1fr; }
      .toc { position: static; max-height: none; }
      .manual { padding: 20px 16px; border-radius: 12px; }
      .manual h2 { font-size: 20px; }
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
      <h1>墨澜 · AI 网文写作助手使用手册</h1>
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
    <div class="footer">© 2026 墨澜 · AI 网文写作助手 · 本地优先，保护创作隐私</div>
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
copyFileSync(htmlPath, legacyHtmlPath);

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
    maxBuffer: 20 * 1024 * 1024,
    timeout: 90_000
  });

  return result.status === 0 && existsSync(pdfPath);
}

function buildPdfFromText() {
  const plainTextPath = path.join(outputDir, "墨澜 · AI 网文写作助手使用手册.txt");
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
  copyFileSync(pdfPath, legacyPdfPath);
  console.log(`[manual] PDF:  ${pdfPath}`);
} else {
  console.warn("[manual] PDF 生成失败，仅生成 HTML。");
}
