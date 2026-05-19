"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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
import type { RelationGraphEdge, RelationGraphNode } from "@/lib/state-graphs";
import { shortText } from "@/lib/state-graphs";

type StateFlowNodeData = {
  eyebrow: string;
  title: string;
  meta: string;
  sub: string;
  tone: NonNullable<RelationGraphNode["tone"]>;
  type: RelationGraphNode["type"];
};

type StateFlowNode = Node<StateFlowNodeData, "stateNode">;

type StateRelationGraphProps = {
  title: string;
  description: string;
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
};

const toneColor: Record<NonNullable<RelationGraphNode["tone"]>, string> = {
  core: "#4ecd9d",
  danger: "#ff6b91",
  neutral: "#82a5ff",
  success: "#58c894",
  warning: "#ffbb4c"
};

function StateFlowNodeCard({ data }: NodeProps<StateFlowNode>) {
  const hasSub = Boolean(data.sub.trim());

  return (
    <div className={`rf-state-node ${data.tone} ${data.type ?? "neutral"}`}>
      <Handle className="rf-port input-port" type="target" position={Position.Left} />
      <Handle className="rf-port output-port" type="source" position={Position.Right} />
      <div className="rf-state-node-head">
        <span>{data.eyebrow}</span>
        <strong>{data.title}</strong>
      </div>
      <div className="rf-state-node-body">
        <div className="rf-param">
          <span>状态</span>
          <strong>{shortText(data.meta, data.meta || "待补充", 34)}</strong>
        </div>
        {hasSub ? (
          <div className="rf-state-sub">{shortText(data.sub, data.sub, 56)}</div>
        ) : null}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  stateNode: StateFlowNodeCard
};

function nodeColor(node: Node) {
  const tone = (node.data as Partial<StateFlowNodeData> | undefined)?.tone ?? "neutral";

  return toneColor[tone];
}

function fallbackPoint(index: number, total: number) {
  const perRow = Math.max(4, Math.ceil(Math.sqrt(total)));

  return {
    x: 80 + (index % perRow) * 280,
    y: 80 + Math.floor(index / perRow) * 170
  };
}

function buildStateFlow(nodes: RelationGraphNode[], edges: RelationGraphEdge[]) {
  const flowNodes: StateFlowNode[] = nodes.map((node, index) => ({
    id: node.id,
    type: "stateNode",
    position:
      typeof node.x === "number" && typeof node.y === "number"
        ? { x: node.x, y: node.y }
        : fallbackPoint(index, nodes.length),
    data: {
      eyebrow:
        node.type === "core"
          ? "Core"
          : node.type === "person"
            ? "Character"
            : node.type === "place"
              ? "Place"
              : node.type === "force"
                ? "Force"
                : node.type === "power"
                  ? "Power"
                  : node.type === "resource"
                    ? "Resource"
                    : node.type === "knowledge"
                      ? "Knowledge"
                      : node.type === "event"
                        ? "Event"
                        : "Thread",
      title: node.label || "未命名节点",
      meta: node.meta || "",
      sub: node.sub || "",
      tone: node.tone ?? "neutral",
      type: node.type
    }
  }));
  const validNodeIds = new Set(flowNodes.map((node) => node.id));
  const shouldShowEdgeLabels = edges.length <= 12;
  const flowEdges: Edge[] = edges
    .filter((edge) => validNodeIds.has(edge.from) && validNodeIds.has(edge.to))
    .map((item) => {
      const color = toneColor[item.tone ?? "neutral"];

      return {
        id: item.id,
        source: item.from,
        target: item.to,
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color
        },
        style: {
          stroke: color,
          strokeWidth: item.tone === "danger" ? 1.9 : 1.45,
          opacity: item.tone === "neutral" ? 0.58 : 0.78
        },
        label: shouldShowEdgeLabels && item.label && item.label.length <= 10 ? item.label : undefined,
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
    });

  return { nodes: flowNodes, edges: flowEdges };
}

export function StateRelationGraph({
  title,
  description,
  nodes,
  edges
}: StateRelationGraphProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<StateFlowNodeData | null>(null);
  const initialGraph = useMemo(() => buildStateFlow(nodes, edges), [edges, nodes]);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialGraph.edges);
  const resetLayout = useCallback(() => {
    setFlowNodes(initialGraph.nodes);
    setFlowEdges(initialGraph.edges);
  }, [initialGraph.edges, initialGraph.nodes, setFlowEdges, setFlowNodes]);
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
  const handleNodeClick = useCallback((_event: ReactMouseEvent, node: Node) => {
    setSelectedNode((node as StateFlowNode).data);
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

  useEffect(() => {
    setSelectedNode(null);
  }, [initialGraph]);

  return (
    <div className="relation-graph-section">
      <div className="analysis-board-toolbar">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <div className="chip-row">
          <span className="chip">节点 {nodes.length}</span>
          <span className="chip">关系 {flowEdges.length}</span>
          <span className="chip">点击节点看全文</span>
          <span className="chip">React Flow</span>
        </div>
      </div>

      <div ref={shellRef} className="react-flow-shell structure-flow state-flow">
        <div className="flow-reading-guide">
          <span>阅读方向</span>
          <strong>左 → 右</strong>
          <em>同列上 → 下，点击节点看全文</em>
        </div>
        <div className="flow-toolbar">
          <button type="button" onClick={toggleFullscreen}>
            {isFullscreen ? "退出全屏" : "全屏查看"}
          </button>
          <button type="button" onClick={resetLayout}>
            重置布局
          </button>
        </div>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          nodeTypes={nodeTypes}
          minZoom={0.16}
          maxZoom={1.8}
          fitView
          fitViewOptions={{ padding: 0.2, duration: 0 }}
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
        {selectedNode ? (
          <aside className="state-node-detail" aria-label="节点完整内容">
            <div className="state-node-detail-head">
              <div>
                <span>{selectedNode.eyebrow}</span>
                <strong>{selectedNode.title}</strong>
              </div>
              <button type="button" onClick={() => setSelectedNode(null)}>
                关闭
              </button>
            </div>
            <div className="state-node-detail-body">
              <div>
                <span>状态</span>
                <p>{selectedNode.meta || "暂无状态内容。"}</p>
              </div>
              <div>
                <span>补充内容</span>
                <p>{selectedNode.sub || "暂无补充内容。"}</p>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
