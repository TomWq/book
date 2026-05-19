export type SplitChapter = {
  chapterNumber: number;
  title: string;
  content: string;
  charCount: number;
  orderIndex: number;
};

const chapterHeadingPattern =
  /^(?:\s*)((?:第[零〇一二三四五六七八九十百千万\d]+[章节回卷部篇集]|Chapter\s*\d+|CHAPTER\s*\d+|\d{1,4})[^\n\r]{0,40})\s*$/;

function normalizeLineBreaks(content: string) {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function fallbackTitle(index: number) {
  return `第 ${index} 章`;
}

export function splitNovelText(input: string): SplitChapter[] {
  const content = normalizeLineBreaks(input).trim();

  if (!content) {
    return [];
  }

  const lines = content.split("\n");
  const headingIndexes: Array<{ index: number; title: string }> = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    if (chapterHeadingPattern.test(trimmed)) {
      headingIndexes.push({ index, title: trimmed });
    }
  });

  if (headingIndexes.length === 0) {
    return [
      {
        chapterNumber: 1,
        title: fallbackTitle(1),
        content,
        charCount: content.length,
        orderIndex: 0
      }
    ];
  }

  return headingIndexes.map((heading, index) => {
    const nextHeading = headingIndexes[index + 1];
    const bodyStart = heading.index + 1;
    const bodyEnd = nextHeading?.index ?? lines.length;
    const chapterContent = lines.slice(bodyStart, bodyEnd).join("\n").trim();
    const normalizedContent = chapterContent || heading.title;

    return {
      chapterNumber: index + 1,
      title: heading.title,
      content: normalizedContent,
      charCount: normalizedContent.length,
      orderIndex: index
    };
  });
}
