"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import { shortText } from "@/lib/state-graphs";

type FlowParam = {
  label: string;
  value: string;
};

type FlowNodeData = {
  eyebrow: string;
  title: string;
  params: FlowParam[];
  tags?: string[];
  details?: FlowParam[];
  tone: "core" | "chapter" | "person" | "clue" | "formula";
};

type AnalysisNode = Node<FlowNodeData, "analysisNode">;

export type AnalysisChapterCard = {
  id: string;
  chapterNumber: number;
  title: string;
  summary: string;
  conflict: string;
  pressurePoint: string;
  payoff: string;
  cliffhanger: string;
  readerHook: string;
  pleasureTypes: string[];
};

export type AnalysisTopItem = {
  text: string;
  count: number;
};

export type AnalysisStructureBoard = {
  formula: string;
  mainLoop: string;
  pacing: string;
  mapProgression: string;
  supportingRoles: string;
  villainFunction: string;
};

export type AnalysisStructureRelation = {
  source: string;
  target: string;
  type: string;
  evidence: string;
  chapterNumber?: number;
};

function cleanParams(params: FlowParam[]) {
  return params.filter((item) => item.value.trim());
}

function AnalysisFlowNode({ data }: NodeProps<AnalysisNode>) {
  const hasDetails = Boolean(data.details?.some((item) => item.value.trim()));

  return (
    <div className={`rf-analysis-node ${data.tone}`}>
      <Handle className="rf-port input-port" type="target" position={Position.Left} />
      <Handle className="rf-port output-port" type="source" position={Position.Right} />
      <div className="rf-analysis-node-head">
        <span>{data.eyebrow}</span>
        <strong>{data.title}</strong>
      </div>
      <div className="rf-analysis-node-body">
        {data.params.map((param) => (
          <div key={`${param.label}-${param.value}`} className="rf-param">
            <span>{param.label}</span>
            <strong>{shortText(param.value, param.value, 34)}</strong>
          </div>
        ))}
        {data.tags?.length ? (
          <div className="rf-tag-row">
            {data.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
        {hasDetails ? (
          <details className="rf-detail nodrag nowheel">
            <summary>详情</summary>
            <dl>
              {data.details?.map((detail) => (
                <div key={`${detail.label}-${detail.value}`}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  analysisNode: AnalysisFlowNode
};

function nodeColor(node: Node) {
  const tone = (node.data as Partial<FlowNodeData> | undefined)?.tone;

  if (tone === "core") {
    return "#4ecd9d";
  }

  if (tone === "person") {
    return "#58c894";
  }

  if (tone === "clue") {
    return "#ffbb4c";
  }

  if (tone === "formula") {
    return "#82a5ff";
  }

  return "#6f86ff";
}

function edge(
  id: string,
  source: string,
  target: string,
  color = "#ffbb4c",
  options: { marker?: boolean; opacity?: number; width?: number; label?: string } = {}
): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    animated: false,
    markerEnd:
      options.marker === false
        ? undefined
        : {
            type: MarkerType.ArrowClosed,
            color
          },
    style: {
      stroke: color,
      strokeWidth: options.width ?? 1.6,
      opacity: options.opacity ?? 1
    },
    label: options.label,
    labelStyle: {
      fill: color,
      fontSize: 11,
      fontWeight: 800
    },
    labelBgStyle: {
      fill: "#181d28",
      fillOpacity: 0.86
    },
    labelBgPadding: [4, 6],
    labelBgBorderRadius: 4
  };
}

function gridPoint(
  index: number,
  columns: number,
  startX: number,
  startY: number,
  gapX = 286,
  gapY = 156
) {
  return {
    x: startX + (index % columns) * gapX,
    y: startY + Math.floor(index / columns) * gapY
  };
}

function buildChapterFlow(
  chapters: AnalysisChapterCard[],
  topPleasureTypes: string[],
  structureBoard: AnalysisStructureBoard
) {
  const nodes: AnalysisNode[] = [
    {
      id: "story-core",
      type: "analysisNode",
      position: { x: 0, y: 120 },
      data: {
        eyebrow: "Story Formula",
        title: "整书结构",
        tone: "core",
        params: cleanParams([
          { label: "主循环", value: structureBoard.mainLoop || "等待整书分析" },
          { label: "节奏", value: structureBoard.pacing || "等待整书分析" }
        ]),
        tags: topPleasureTypes.slice(0, 8),
        details: cleanParams([
          { label: "可复用公式", value: structureBoard.formula },
          { label: "地图推进", value: structureBoard.mapProgression }
        ])
      }
    },
    ...chapters.map((chapter, index) => ({
      id: `chapter-${chapter.id}`,
      type: "analysisNode" as const,
      position: {
        x: 340 + index * 300,
        y: index % 2 === 0 ? 38 : 302
      },
      data: {
        eyebrow: `Chapter ${chapter.chapterNumber}`,
        title: chapter.title,
        tone: "chapter" as const,
        params: cleanParams([
          { label: "爽点", value: chapter.pleasureTypes[0] || chapter.payoff },
          { label: "冲突", value: chapter.conflict },
          { label: "钩子", value: chapter.cliffhanger || chapter.readerHook }
        ]),
        tags: chapter.pleasureTypes.slice(0, 3),
        details: cleanParams([
          { label: "概述", value: chapter.summary },
          { label: "冲突", value: chapter.conflict },
          { label: "压制", value: chapter.pressurePoint },
          { label: "爽点", value: chapter.payoff },
          { label: "钩子", value: chapter.cliffhanger || chapter.readerHook }
        ])
      }
    }))
  ];
  const edges: Edge[] = [
    ...(chapters[0] ? [edge("story-to-first", "story-core", `chapter-${chapters[0].id}`)] : []),
    ...chapters.slice(0, -1).map((chapter, index) =>
      edge(
        `chapter-${chapter.id}-to-${chapters[index + 1].id}`,
        `chapter-${chapter.id}`,
        `chapter-${chapters[index + 1].id}`,
        index % 2 === 0 ? "#ffbb4c" : "#8c7cff"
      )
    )
  ];

  return { nodes, edges };
}

function buildStructureFlow(
  characters: AnalysisTopItem[],
  clues: AnalysisTopItem[],
  structureBoard: AnalysisStructureBoard,
  relations: AnalysisStructureRelation[]
) {
  const formulaItems: FlowParam[] = cleanParams([
    { label: "地图推进", value: structureBoard.mapProgression || "整书分析完成后展示地图推进" },
    { label: "反派功能", value: structureBoard.villainFunction || "整书分析完成后展示反派功能" },
    { label: "配角功能", value: structureBoard.supportingRoles || "整书分析完成后展示配角功能" },
    { label: "可复用公式", value: structureBoard.formula }
  ]);
  const characterStartX = 0;
  const clueStartX = 1380;
  const formulaStartX = 2760;
  const childStartY = 310;
  const nodes: AnalysisNode[] = [
    {
      id: "structure-core",
      type: "analysisNode",
      position: { x: 1370, y: 20 },
      data: {
        eyebrow: "Structure Hub",
        title: "拆书结构元素",
        tone: "core",
        params: [
          { label: "人物", value: `${characters.length} 个` },
          { label: "线索", value: `${clues.length} 条` },
          { label: "公式", value: `${formulaItems.length} 项` }
        ],
        details: cleanParams([
          { label: "主循环", value: structureBoard.mainLoop },
          { label: "节奏", value: structureBoard.pacing }
        ])
      }
    },
    {
      id: "characters-hub",
      type: "analysisNode",
      position: { x: 500, y: 140 },
      data: {
        eyebrow: "Characters Hub",
        title: "人物",
        tone: "person",
        params: [{ label: "总数", value: `${characters.length} 个` }],
        details: [{ label: "说明", value: "章节分析里抽出的稳定人物称呼。" }]
      }
    },
    {
      id: "clues-hub",
      type: "analysisNode",
      position: { x: 1880, y: 140 },
      data: {
        eyebrow: "Clues Hub",
        title: "线索 / 状态",
        tone: "clue",
        params: [{ label: "总数", value: `${clues.length} 条` }],
        details: [{ label: "说明", value: "信息差、状态变化、伏笔和推进内容。" }]
      }
    },
    {
      id: "formula-hub",
      type: "analysisNode",
      position: { x: 2920, y: 140 },
      data: {
        eyebrow: "Formula Hub",
        title: "地图 / 公式",
        tone: "formula",
        params: [{ label: "总数", value: `${formulaItems.length} 项` }],
        details: [{ label: "说明", value: "地图推进、反派功能、配角功能和可复用公式。" }]
      }
    },
    ...characters.map((item, index) => ({
      id: `character-${index}`,
      type: "analysisNode" as const,
      position: gridPoint(index, 4, characterStartX, childStartY, 278, 142),
      data: {
        eyebrow: "Character",
        title: item.text,
        tone: "person" as const,
        params: [{ label: "出现", value: `${item.count} 次` }]
      }
    })),
    ...clues.slice(0, 18).map((item, index) => ({
      id: `clue-${index}`,
      type: "analysisNode" as const,
      position: gridPoint(index, 4, clueStartX, childStartY, 278, 142),
      data: {
        eyebrow: "Clue / State",
        title: shortText(item.text, item.text, 22),
        tone: "clue" as const,
        params: [{ label: "出现", value: `${item.count} 次` }],
        details: [{ label: "完整内容", value: item.text }]
      }
    })),
    ...formulaItems.map((item, index) => ({
      id: `formula-${index}`,
      type: "analysisNode" as const,
      position: gridPoint(index, 2, formulaStartX, childStartY, 278, 142),
      data: {
        eyebrow: "World / Formula",
        title: item.label,
        tone: "formula" as const,
        params: [{ label: "摘要", value: item.value }],
        details: [{ label: item.label, value: item.value }]
      }
    }))
  ];
  const characterNodeByName = new Map(characters.map((item, index) => [item.text, `character-${index}`]));
  const clueNodeByText = new Map(clues.slice(0, 18).map((item, index) => [item.text, `clue-${index}`]));
  const findClueNode = (target: string) => {
    const direct = clueNodeByText.get(target);

    if (direct) {
      return direct;
    }

    const matched = [...clueNodeByText.entries()].find(
      ([text]) => text.includes(target) || target.includes(text)
    );

    return matched?.[1];
  };
  const relationEdges = relations.flatMap((relation, index) => {
    const sourceNode = characterNodeByName.get(relation.source) ?? findClueNode(relation.source);
    const targetNode = characterNodeByName.get(relation.target) ?? findClueNode(relation.target);

    if (!sourceNode || !targetNode || sourceNode === targetNode) {
      return [];
    }

    return [
      edge(`real-relation-${index}`, sourceNode, targetNode, "#ff6b91", {
        marker: true,
        opacity: 0.82,
        width: 1.7,
        label: relation.type.slice(0, 10)
      })
    ];
  });
  const edges: Edge[] = [
    edge("core-to-characters-hub", "structure-core", "characters-hub", "#4ecd9d"),
    edge("core-to-clues-hub", "structure-core", "clues-hub", "#ffbb4c"),
    edge("core-to-formula-hub", "structure-core", "formula-hub", "#82a5ff"),
    ...characters.map((_, index) =>
      edge(`characters-hub-to-${index}`, "characters-hub", `character-${index}`, "#4ecd9d", {
        marker: false,
        opacity: 0.34,
        width: 1.1
      })
    ),
    ...clues.slice(0, 18).map((_, index) =>
      edge(`clues-hub-to-${index}`, "clues-hub", `clue-${index}`, "#ffbb4c", {
        marker: false,
        opacity: 0.32,
        width: 1.1
      })
    ),
    ...formulaItems.map((_, index) =>
      edge(`formula-hub-to-${index}`, "formula-hub", `formula-${index}`, "#82a5ff", {
        marker: false,
        opacity: 0.36,
        width: 1.1
      })
    ),
    ...relationEdges
  ];

  return { nodes, edges };
}

export function AnalysisFlowGraph({
  mode,
  chapters,
  topPleasureTypes,
  characters,
  clues,
  relations,
  structureBoard
}: {
  mode: "chapter" | "structure";
  chapters?: AnalysisChapterCard[];
  topPleasureTypes?: string[];
  characters?: AnalysisTopItem[];
  clues?: AnalysisTopItem[];
  relations?: AnalysisStructureRelation[];
  structureBoard: AnalysisStructureBoard;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const initialGraph = useMemo(
    () =>
      mode === "chapter"
        ? buildChapterFlow(chapters ?? [], topPleasureTypes ?? [], structureBoard)
        : buildStructureFlow(characters ?? [], clues ?? [], structureBoard, relations ?? []),
    [chapters, characters, clues, mode, relations, structureBoard, topPleasureTypes]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);
  const resetLayout = useCallback(() => {
    setNodes(initialGraph.nodes);
    setEdges(initialGraph.edges);
  }, [initialGraph.edges, initialGraph.nodes, setEdges, setNodes]);
  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;

    if (!shell) {
      return;
    }

    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
      return;
    }

    await shell.requestFullscreen();
  }, []);

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    }

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  return (
    <div
      ref={shellRef}
      className={`react-flow-shell ${mode === "chapter" ? "chapter-flow" : "structure-flow"}`}
    >
      <div className="flow-toolbar">
        <button type="button" onClick={toggleFullscreen}>
          {isFullscreen ? "退出全屏" : "全屏查看"}
        </button>
        <button type="button" onClick={resetLayout}>
          重置布局
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        minZoom={0.18}
        maxZoom={1.8}
        fitView
        fitViewOptions={{ padding: 0.18, duration: 0 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        attributionPosition="bottom-left"
      >
        <Background color="#31394b" gap={28} variant={BackgroundVariant.Lines} />
        <Controls position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={nodeColor}
          maskColor="rgba(12, 16, 24, 0.66)"
        />
      </ReactFlow>
    </div>
  );
}
