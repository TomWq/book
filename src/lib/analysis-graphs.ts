import type { getProjectAnalysis, StoredChapterAnalysis } from "@/lib/projects";
import { normalizeCharacterMentions, normalizeCharacterName } from "@/lib/analysis";
import type { RelationGraphEdge, RelationGraphNode } from "@/lib/state-graphs";
import { shortText } from "@/lib/state-graphs";

type AnalysisState = Awaited<ReturnType<typeof getProjectAnalysis>>;
type RelationGraph = {
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
};

function uniqueTextList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function graphPoint(
  index: number,
  centerX: number,
  centerY: number,
  perRing: number,
  radiusX: number,
  radiusY: number
) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / perRing;

  return {
    x: Math.round(centerX + Math.cos(angle) * radiusX),
    y: Math.round(centerY + Math.sin(angle) * radiusY)
  };
}

function chapterTitleById(analysis: AnalysisState, chapterId: string) {
  const chapter = analysis.chapters.find((item) => item.id === chapterId);

  return chapter ? `第 ${chapter.chapterNumber} 章 ${chapter.title}` : "章节";
}

function chapterNumberById(analysis: AnalysisState, chapterId: string) {
  return analysis.chapters.find((item) => item.id === chapterId)?.chapterNumber ?? 0;
}

function topItems(values: string[], limit: number) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const text = value.trim();

    if (!text || text.length > 90) {
      return;
    }

    counts.set(text, (counts.get(text) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, limit)
    .map(([text, count]) => ({ text, count }));
}

function topCharacterItems(values: string[], limit: number) {
  return topItems(normalizeCharacterMentions(values), limit);
}

function normalizeRelationEntity(value: string) {
  return normalizeCharacterName(value) || value.trim();
}

function dominantPleasureType(chapter: StoredChapterAnalysis) {
  return chapter.pleasurePoints[0]?.type || "爽点待识别";
}

function gridPoint(
  index: number,
  startX: number,
  startY: number,
  columns: number,
  gapX = 300,
  gapY = 156
) {
  return {
    x: startX + (index % columns) * gapX,
    y: startY + Math.floor(index / columns) * gapY
  };
}

function analysisCenterNode(projectName: string, meta: string, sub?: string): RelationGraphNode {
  return {
    id: "analysis-extra-core",
    label: projectName,
    meta,
    sub,
    tone: "core",
    type: "core",
    x: 70,
    y: 220
  };
}

function buildAnalysisBoardGraph(
  projectName: string,
  meta: string,
  sub: string,
  items: RelationGraphNode[],
  edgeLabel: string
): RelationGraph {
  const nodes: RelationGraphNode[] = [
    analysisCenterNode(projectName, meta, sub),
    ...items.map((item, index) => ({
      ...item,
      ...gridPoint(index, 380, 90, 3)
    }))
  ];

  return {
    nodes,
    edges: items.map((item, index) => ({
      id: `analysis-extra-${item.id}-${index}`,
      from: "analysis-extra-core",
      to: item.id,
      label: edgeLabel,
      tone: item.tone === "danger" ? "danger" : item.tone === "success" ? "success" : item.tone === "warning" ? "warning" : "neutral"
    }))
  };
}

function chapterLabel(analysis: AnalysisState, chapter: StoredChapterAnalysis) {
  return `第 ${chapterNumberById(analysis, chapter.chapterId)} 章`;
}

function buildAnalysisForeshadowingGraph(projectName: string, analysis: AnalysisState, chapters: StoredChapterAnalysis[]): RelationGraph {
  const clueItems = chapters
    .flatMap((chapter) => [
      ...chapter.newInformation.map((item) => ({ chapter, text: item, type: "新增信息" })),
      ...chapter.stateChanges.map((item) => ({ chapter, text: item, type: "状态变化" })),
      { chapter, text: chapter.cliffhanger, type: "章末钩子" }
    ])
    .filter((item) => /伏笔|线索|秘密|真相|身份|令牌|遗物|传承|幕后|钩子|悬念|疑问/.test(item.text))
    .slice(0, 28);

  return buildAnalysisBoardGraph(
    projectName,
    "伏笔悬念",
    "从新增信息、状态变化和章末钩子里提取",
    clueItems.map((item, index) => ({
      id: `analysis-foreshadow-${index}`,
      label: item.type,
      meta: shortText(item.text, item.text, 38),
      sub: chapterLabel(analysis, item.chapter),
      tone: "warning",
      type: "thread"
    })),
    "埋线"
  );
}

function buildAnalysisPlotGraph(projectName: string, analysis: AnalysisState, chapters: StoredChapterAnalysis[], storyAnalysis: AnalysisState["storyAnalysis"]): RelationGraph {
  const items = uniqueTextList([
    storyAnalysis?.openingHook ?? "",
    storyAnalysis?.mainLoop ?? "",
    storyAnalysis?.pacing ?? "",
    ...chapters.flatMap((chapter) => [chapter.mainEvent, chapter.conflict, chapter.readerHook])
  ]).slice(0, 24);

  return buildAnalysisBoardGraph(
    projectName,
    "主线推进",
    "开局、主循环、冲突和读者钩子的推进规律",
    items.map((item, index) => ({
      id: `analysis-plot-${index}`,
      label: index === 0 ? "开局/主线" : /冲突|压制|危机/.test(item) ? "冲突推进" : "节奏节点",
      meta: shortText(item, item, 38),
      tone: /冲突|压制|危机/.test(item) ? "danger" : "neutral",
      type: "thread"
    })),
    "推进"
  );
}

function buildAnalysisPowerGraph(projectName: string, chapters: StoredChapterAnalysis[], storyAnalysis: AnalysisState["storyAnalysis"]): RelationGraph {
  const powerItems = uniqueTextList([
    storyAnalysis?.goldenFingerMechanism ?? "",
    ...chapters.flatMap((chapter) => [
      ...chapter.newInformation,
      ...chapter.stateChanges,
      chapter.payoff,
      chapter.pressurePoint
    ])
  ])
    .filter((item) => /修为|境界|战力|能力|金手指|系统|灵力|功法|传承|血脉|限制|代价|突破|修炼|丹药|法器/.test(item))
    .slice(0, 24);

  return buildAnalysisBoardGraph(
    projectName,
    "战力体系",
    "从金手指、境界、能力、限制和战力变化中提取",
    powerItems.map((item, index) => ({
      id: `analysis-power-${index}`,
      label: /限制|代价|不足|无法/.test(item) ? "限制 / 代价" : "能力节点",
      meta: shortText(item, item, 38),
      tone: /限制|代价|不足|无法/.test(item) ? "danger" : "warning",
      type: "power"
    })),
    "能力"
  );
}

function buildAnalysisResourceGraph(projectName: string, chapters: StoredChapterAnalysis[]): RelationGraph {
  const resourceItems = uniqueTextList(
    chapters.flatMap((chapter) => [
      chapter.payoff,
      ...chapter.newInformation,
      ...chapter.stateChanges
    ])
  )
    .filter((item) => /获得|收益|奖励|资源|功法|丹药|装备|法器|线索|证据|令牌|名额|身份|权限|传承|遗物/.test(item))
    .slice(0, 28);

  return buildAnalysisBoardGraph(
    projectName,
    "资源收益",
    "从每章 payoff、新增信息和状态变化中提取",
    resourceItems.map((item, index) => ({
      id: `analysis-resource-${index}`,
      label: /线索|证据|令牌|身份/.test(item) ? "线索" : "收益",
      meta: shortText(item, item, 38),
      tone: /线索|证据|令牌|身份/.test(item) ? "warning" : "success",
      type: "resource"
    })),
    "回报"
  );
}

function buildAnalysisKnowledgeGraph(projectName: string, analysis: AnalysisState, chapters: StoredChapterAnalysis[]): RelationGraph {
  const relations = chapters
    .flatMap((chapter) =>
      (chapter.entityRelations ?? []).map((relation) => ({
        chapter,
        source: normalizeRelationEntity(relation.source),
        target: normalizeRelationEntity(relation.target),
        type: relation.type.trim(),
        evidence: relation.evidence.trim()
      }))
    )
    .filter((item) => item.source && item.target && item.evidence)
    .slice(0, 18);
  const nodes: RelationGraphNode[] = [
    analysisCenterNode(projectName, "知情秘密", "原书的信息差、误判、身份和秘密线索"),
    ...relations.map((item, index) => ({
      id: `analysis-knowledge-${index}`,
      label: `${item.source} -> ${item.target}`,
      meta: shortText(item.type, item.type, 26),
      sub: `${chapterLabel(analysis, item.chapter)}：${shortText(item.evidence, item.evidence, 48)}`,
      tone: /敌|误判|秘密|威胁|冲突/.test(`${item.type}${item.evidence}`) ? "danger" as const : "neutral" as const,
      type: "knowledge" as const,
      ...gridPoint(index, 380, 90, 3)
    }))
  ];

  return {
    nodes,
    edges: relations.map((_, index) => ({
      id: `analysis-knowledge-edge-${index}`,
      from: "analysis-extra-core",
      to: `analysis-knowledge-${index}`,
      label: "信息",
      tone: "neutral" as const
    }))
  };
}

function buildAnalysisCausalityGraph(projectName: string, analysis: AnalysisState, chapters: StoredChapterAnalysis[]): RelationGraph {
  const nodes: RelationGraphNode[] = [
    {
      ...analysisCenterNode(projectName, "章节因果", "事件 -> 冲突 -> 收益 -> 钩子"),
      x: 40,
      y: 190
    },
    ...chapters.slice(0, 36).map((chapter, index) => ({
      id: `analysis-causality-${chapter.id}`,
      label: chapterLabel(analysis, chapter),
      meta: shortText(chapter.mainEvent || chapter.conflict, chapter.mainEvent || chapter.conflict, 34),
      sub: shortText(chapter.cliffhanger || chapter.payoff, "钩子待识别", 46),
      tone: chapter.pleasurePoints.length > 0 ? "success" as const : "neutral" as const,
      type: "event" as const,
      x: 330 + index * 270,
      y: index % 2 === 0 ? 90 : 300
    }))
  ];
  const causalChapters = chapters.slice(0, 36);

  return {
    nodes,
    edges: [
      ...(causalChapters[0]
        ? [{
            id: `analysis-causality-start-${causalChapters[0].id}`,
            from: "analysis-extra-core",
            to: `analysis-causality-${causalChapters[0].id}`,
            label: "开始",
            tone: "success" as const
          }]
        : []),
      ...causalChapters.slice(1).map((chapter, index) => ({
        id: `analysis-causality-${causalChapters[index].id}-${chapter.id}`,
        from: `analysis-causality-${causalChapters[index].id}`,
        to: `analysis-causality-${chapter.id}`,
        label: "承接",
        tone: "neutral" as const
      }))
    ]
  };
}

export function buildAnalysisRelationGraphs(projectName: string, analysis: AnalysisState) {
  const analyzedChapters = analysis.chapterAnalyses
    .slice()
    .sort((a, b) => chapterNumberById(analysis, a.chapterId) - chapterNumberById(analysis, b.chapterId))
    .slice(0, 60);
  const storyAnalysis = analysis.storyAnalysis;
  const chapterGraphWidth = Math.max(1180, 1020 + Math.ceil(analyzedChapters.length / 18) * 180);
  const chapterGraphHeight = Math.max(640, 600 + Math.ceil(analyzedChapters.length / 18) * 120);
  const chapterCenterX = chapterGraphWidth / 2;
  const chapterCenterY = chapterGraphHeight / 2;
  const pleasureTypes = uniqueTextList([
    ...(storyAnalysis?.topPleasureTypes ?? []),
    ...analyzedChapters.flatMap((chapter) => chapter.pleasurePoints.map((point) => point.type))
  ]).slice(0, 12);
  const chapterNodes: RelationGraphNode[] = [
    {
      id: "analysis-core",
      label: "结构公式",
      meta: storyAnalysis?.genre || "等待整书分析",
      sub: shortText(storyAnalysis?.mainLoop ?? "", "主循环待识别", 34),
      tone: "core",
      type: "core",
      x: Math.round(chapterCenterX),
      y: Math.round(chapterCenterY)
    },
    ...analyzedChapters.map((chapter, index) => {
      const ringIndex = Math.floor(index / 18);
      const perRing = Math.min(18, analyzedChapters.length - ringIndex * 18);
      const point = graphPoint(
        index % 18,
        chapterCenterX,
        chapterCenterY,
        perRing,
        400 + ringIndex * 130,
        210 + ringIndex * 82
      );

      return {
        id: `chapter-${chapter.id}`,
        label: `第 ${chapterNumberById(analysis, chapter.chapterId)} 章`,
        meta: shortText(dominantPleasureType(chapter), "爽点待识别", 18),
        sub: shortText(chapter.payoff || chapter.cliffhanger, "结构待识别", 30),
        tone: chapter.pleasurePoints.length > 0 ? "success" : "neutral",
        type: "thread",
        ...point
      } satisfies RelationGraphNode;
    }),
    ...pleasureTypes.map((type, index) => ({
      id: `pleasure-${index}`,
      label: type,
      meta: "爽点类型",
      tone: "warning" as const,
      type: "thread" as const,
      x: 130 + (index % 6) * 178,
      y: chapterGraphHeight - 90 - Math.floor(index / 6) * 88
    }))
  ];
  const chapterEdges: RelationGraphEdge[] = [
    ...analyzedChapters.map((chapter) => ({
      id: `core-${chapter.id}`,
      from: "analysis-core",
      to: `chapter-${chapter.id}`,
      label: "拆解",
      tone: "neutral" as const
    })),
    ...analyzedChapters.slice(0, -1).map((chapter, index) => ({
      id: `seq-${chapter.id}-${analyzedChapters[index + 1].id}`,
      from: `chapter-${chapter.id}`,
      to: `chapter-${analyzedChapters[index + 1].id}`,
      label: "下一章",
      tone: "success" as const
    })),
    ...analyzedChapters.flatMap((chapter) =>
      chapter.pleasurePoints.slice(0, 2).flatMap((point) => {
        const pleasureIndex = pleasureTypes.findIndex((type) => type === point.type);

        return pleasureIndex >= 0
          ? [{
              id: `chapter-pleasure-${chapter.id}-${pleasureIndex}`,
              from: `chapter-${chapter.id}`,
              to: `pleasure-${pleasureIndex}`,
              label: "爽点",
              tone: "warning" as const
            }]
          : [];
      })
    )
  ];
  const structureRelations = analyzedChapters
    .flatMap((chapter) =>
      (chapter.entityRelations ?? []).map((relation) => ({
        source: normalizeRelationEntity(relation.source),
        target: normalizeRelationEntity(relation.target),
        type: relation.type.trim(),
        evidence: relation.evidence.trim(),
        chapterNumber: relation.chapterNumber ?? chapterNumberById(analysis, chapter.chapterId)
      }))
    )
    .filter(
      (relation) =>
        relation.source &&
        relation.target &&
        relation.source !== relation.target &&
        relation.type &&
        relation.evidence
    )
    .slice(0, 80);
  const relationCharacterHints = structureRelations.flatMap((relation) => [
    normalizeCharacterName(relation.source),
    normalizeCharacterName(relation.target)
  ]);
  const characterItems = topCharacterItems([
    ...analyzedChapters.flatMap((chapter) => chapter.newCharacters),
    ...relationCharacterHints
  ], 28);
  const knownCharacterNames = new Set(characterItems.map((item) => item.text));
  const relationTargets = structureRelations
    .map((relation) => relation.target)
    .filter((target) => !knownCharacterNames.has(target));
  const clueItems = topItems([
    ...analyzedChapters.flatMap((chapter) => chapter.newInformation),
    ...analyzedChapters.flatMap((chapter) => chapter.stateChanges),
    ...relationTargets
  ], 24);
  const structureWidth = Math.max(1180, 1080 + Math.ceil((characterItems.length + clueItems.length) / 20) * 160);
  const structureHeight = Math.max(620, 580 + Math.ceil(clueItems.length / 8) * 80);
  const structureCenterX = structureWidth / 2;
  const structureCenterY = structureHeight / 2;
  const structureNodes: RelationGraphNode[] = [
    {
      id: "source-core",
      label: projectName,
      meta: "拆书中心",
      sub: shortText(storyAnalysis?.formula ?? "", "公式待提取", 34),
      tone: "core",
      type: "core",
      x: Math.round(structureCenterX),
      y: Math.round(structureCenterY)
    },
    ...characterItems.map((item, index) => {
      const point = graphPoint(
        index,
        structureCenterX,
        structureCenterY,
        Math.max(8, characterItems.length),
        390,
        190
      );

      return {
        id: `character-${index}`,
        label: item.text,
        meta: `出现 ${item.count} 次`,
        tone: "success",
        type: "person",
        ...point
      } satisfies RelationGraphNode;
    }),
    ...clueItems.map((item, index) => ({
      id: `clue-${index}`,
      label: "线索 / 状态",
      meta: shortText(item.text, item.text, 28),
      tone: "warning" as const,
      type: "thread" as const,
      x: 130 + (index % 8) * 136,
      y: structureHeight - 90 - Math.floor(index / 8) * 82
    })),
    ...(storyAnalysis?.mapProgression
      ? [{
          id: "map-progression",
          label: "地图推进",
          meta: shortText(storyAnalysis.mapProgression, storyAnalysis.mapProgression, 28),
          tone: "neutral" as const,
          type: "place" as const,
          x: Math.round(structureCenterX),
          y: 88
        }]
      : [])
  ];
  const structureEdges: RelationGraphEdge[] = [
    ...characterItems.map((_, index) => ({
      id: `core-character-${index}`,
      from: "source-core",
      to: `character-${index}`,
      label: "人物",
      tone: "success" as const
    })),
    ...clueItems.map((_, index) => ({
      id: `core-clue-${index}`,
      from: "source-core",
      to: `clue-${index}`,
      label: "线索",
      tone: "warning" as const
    })),
    ...(storyAnalysis?.mapProgression
      ? [{
          id: "core-map",
          from: "source-core",
          to: "map-progression",
          label: "地图",
          tone: "neutral" as const
        }]
      : [])
  ];

  return {
    chapterRhythmGraph: {
      nodes: chapterNodes,
      edges: chapterEdges
    },
    structureGraph: {
      nodes: structureNodes,
      edges: structureEdges
    },
    foreshadowingGraph: buildAnalysisForeshadowingGraph(projectName, analysis, analyzedChapters),
    plotProgressGraph: buildAnalysisPlotGraph(projectName, analysis, analyzedChapters, storyAnalysis),
    powerGraph: buildAnalysisPowerGraph(projectName, analyzedChapters, storyAnalysis),
    resourceGraph: buildAnalysisResourceGraph(projectName, analyzedChapters),
    knowledgeGraph: buildAnalysisKnowledgeGraph(projectName, analysis, analyzedChapters),
    causalityGraph: buildAnalysisCausalityGraph(projectName, analysis, analyzedChapters),
    topPleasureTypes: pleasureTypes,
    topCharacters: characterItems,
    topClues: clueItems,
    structureRelations,
    analyzedChapterTitles: analyzedChapters.map((chapter) => chapterTitleById(analysis, chapter.chapterId)),
    chapterCards: analyzedChapters.map((chapter) => {
      const sourceChapter = analysis.chapters.find((item) => item.id === chapter.chapterId);

      return {
        id: chapter.id,
        chapterNumber: sourceChapter?.chapterNumber ?? 0,
        title: sourceChapter?.title ?? "未命名章节",
        summary: chapter.summary,
        conflict: chapter.conflict,
        pressurePoint: chapter.pressurePoint,
        payoff: chapter.payoff,
        cliffhanger: chapter.cliffhanger,
        readerHook: chapter.readerHook,
        pleasureTypes: uniqueTextList(chapter.pleasurePoints.map((point) => point.type)).slice(0, 3)
      };
    }),
    structureBoard: {
      formula: storyAnalysis?.formula ?? "",
      mainLoop: storyAnalysis?.mainLoop ?? "",
      pacing: storyAnalysis?.pacing ?? "",
      mapProgression: storyAnalysis?.mapProgression ?? "",
      supportingRoles: storyAnalysis?.supportingRoles ?? "",
      villainFunction: storyAnalysis?.villainFunction ?? ""
    }
  };
}
