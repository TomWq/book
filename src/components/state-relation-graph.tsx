"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/components/confirm-dialog-provider";
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
  id: string;
  eyebrow: string;
  title: string;
  meta: string;
  sub: string;
  tone: NonNullable<RelationGraphNode["tone"]>;
  type: RelationGraphNode["type"];
  source?: RelationGraphNode["source"];
};

type StateFlowNode = Node<StateFlowNodeData, "stateNode">;

type StateRelationGraphProps = {
  projectId?: string;
  customGraphId?: string;
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

const graphNodeTypeOptions: Array<{ value: NonNullable<RelationGraphNode["type"]>; label: string }> = [
  { value: "core", label: "核心" },
  { value: "person", label: "人物" },
  { value: "place", label: "地点" },
  { value: "force", label: "势力" },
  { value: "power", label: "体系" },
  { value: "resource", label: "资源" },
  { value: "knowledge", label: "知情" },
  { value: "thread", label: "线索" },
  { value: "event", label: "事件" }
];

const graphToneOptions: Array<{ value: NonNullable<RelationGraphNode["tone"]>; label: string }> = [
  { value: "neutral", label: "普通" },
  { value: "success", label: "正向" },
  { value: "warning", label: "待处理" },
  { value: "danger", label: "风险 / 对立" },
  { value: "core", label: "核心" }
];

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
      id: node.id,
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
      type: node.type,
      source: node.source
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
  projectId,
  customGraphId,
  title,
  description,
  nodes,
  edges
}: StateRelationGraphProps) {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<StateFlowNodeData | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [graphActionStatus, setGraphActionStatus] = useState("");
  const [graphActionError, setGraphActionError] = useState("");
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

  async function submitGraphAction(body: Record<string, unknown>) {
    if (!projectId) {
      setGraphActionError("当前图谱没有接入编辑接口。");
      return;
    }

    setGraphActionStatus("保存中...");
    setGraphActionError("");
    const response = await fetch(`/api/projects/${projectId}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setGraphActionError(String(payload.error ?? "保存失败"));
      setGraphActionStatus("");
      return;
    }

    setGraphActionStatus("已保存，正在刷新图谱...");
    setSelectedNode(null);
    setIsCreateOpen(false);
    router.refresh();
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedNode?.source) {
      setGraphActionError("这个节点是汇总或历史记录，暂不支持直接编辑。");
      return;
    }

    const formData = new FormData(event.currentTarget);
    void submitGraphAction({
      action: selectedNode.source.kind === "customGraphNode" ? "custom_graph_update_node" : "graph_update_node",
      source: selectedNode.source,
      title: String(formData.get("title") ?? ""),
      meta: String(formData.get("meta") ?? ""),
      sub: String(formData.get("sub") ?? ""),
      text: String(formData.get("text") ?? ""),
      status: String(formData.get("status") ?? ""),
      nodeType: String(formData.get("nodeType") ?? ""),
      tone: String(formData.get("tone") ?? "")
    });
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    void submitGraphAction(customGraphId ? {
      action: "custom_graph_create_node",
      graphId: customGraphId,
      text: String(formData.get("text") ?? ""),
      meta: String(formData.get("meta") ?? ""),
      sub: String(formData.get("sub") ?? ""),
      nodeType: String(formData.get("nodeType") ?? ""),
      tone: String(formData.get("tone") ?? ""),
      targetNodeId: String(formData.get("targetNodeId") ?? ""),
      relationLabel: String(formData.get("relationLabel") ?? ""),
      relationTone: String(formData.get("relationTone") ?? "")
    } : {
      action: "graph_create_item",
      itemType: String(formData.get("itemType") ?? ""),
      text: String(formData.get("text") ?? ""),
      meta: String(formData.get("meta") ?? ""),
      sub: String(formData.get("sub") ?? ""),
      status: String(formData.get("status") ?? ""),
      relatedLocation: String(formData.get("relatedLocation") ?? ""),
      expectedRevealChapter: String(formData.get("expectedRevealChapter") ?? "")
    });
  }

  async function handleDeleteNode() {
    if (!selectedNode?.source) {
      setGraphActionError("这个节点是汇总或历史记录，暂不支持直接删除。");
      return;
    }

    if (!(await confirm({
      title: "删除或清空节点",
      message: `确定删除或清空「${selectedNode.title}」吗？`,
      confirmLabel: "确认删除",
      tone: "danger"
    }))) {
      return;
    }

    void submitGraphAction({
      action: selectedNode.source.kind === "customGraphNode" ? "custom_graph_delete_node" : "graph_delete_node",
      source: selectedNode.source
    });
  }

  function handleCreateEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customGraphId || !selectedNode?.id) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    void submitGraphAction({
      action: "custom_graph_create_edge",
      graphId: customGraphId,
      from: selectedNode.id,
      to: String(formData.get("targetNodeId") ?? ""),
      label: String(formData.get("relationLabel") ?? ""),
      tone: String(formData.get("relationTone") ?? "")
    });
  }

  async function handleDeleteEdge(edgeId: string) {
    if (!customGraphId) {
      return;
    }

    if (!(await confirm({
      title: "删除关系线",
      message: "确定删除这条关系线吗？",
      confirmLabel: "确认删除",
      tone: "danger"
    }))) {
      return;
    }

    void submitGraphAction({
      action: "custom_graph_delete_edge",
      graphId: customGraphId,
      edgeId
    });
  }

  const selectedEditableText = selectedNode?.source && "value" in selectedNode.source
    ? selectedNode.source.value
    : selectedNode?.meta ?? "";
  const selectedIsEntity = selectedNode?.source?.kind === "character" ||
    selectedNode?.source?.kind === "foreshadowing" ||
    selectedNode?.source?.kind === "customGraphNode";
  const selectedIsField = selectedNode?.source?.kind === "characterField" ||
    selectedNode?.source?.kind === "plotStateField" ||
    selectedNode?.source?.kind === "plotStateLine" ||
    selectedNode?.source?.kind === "plotStateList";
  const isCustomGraphNode = selectedNode?.source?.kind === "customGraphNode";
  const selectedConnectedEdges = selectedNode
    ? edges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id)
    : [];
  const nodeTitleById = new Map(nodes.map((node) => [node.id, node.label]));

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
          {projectId ? (
            <button className="graph-inline-button" type="button" onClick={() => setIsCreateOpen((value) => !value)}>
              {customGraphId ? "新增节点" : "新增状态"}
            </button>
          ) : null}
        </div>
      </div>

      {isCreateOpen ? (
        <form className="graph-edit-form graph-create-form" onSubmit={handleCreateSubmit}>
          {customGraphId ? (
            <>
              <div className="split-panels">
                <div className="field">
                  <div className="field-label">节点类型</div>
                  <select name="nodeType" defaultValue="event">
                    {graphNodeTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <div className="field-label">节点状态</div>
                  <select name="tone" defaultValue="neutral">
                    {graphToneOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <div className="field-label">节点名称</div>
                <input name="text" placeholder="例如：炼气期 / 沈家旧债 / 第七条规则" required />
              </div>
              <div className="split-panels">
                <div className="field">
                  <div className="field-label">状态 / 摘要</div>
                  <input name="meta" />
                </div>
                <div className="field">
                  <div className="field-label">补充信息</div>
                  <input name="sub" />
                </div>
              </div>
              <div className="split-panels">
                <div className="field">
                  <div className="field-label">连接到已有节点</div>
                  <select name="targetNodeId" defaultValue="">
                    <option value="">暂不连接</option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>{node.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <div className="field-label">关系说明</div>
                  <input name="relationLabel" placeholder="例如：升级到 / 受制于 / 隐瞒" />
                  <select name="relationTone" defaultValue="neutral">
                    <option value="neutral">普通关系</option>
                    <option value="success">正向关系</option>
                    <option value="warning">待处理关系</option>
                    <option value="danger">冲突关系</option>
                  </select>
                </div>
              </div>
              <button className="button primary" type="submit">保存节点</button>
            </>
          ) : (
            <>
          <div className="field">
            <div className="field-label">新增类型</div>
            <select name="itemType" defaultValue="character">
              <option value="character">人物</option>
              <option value="foreshadowing">伏笔</option>
              <option value="mapAndForces">地图 / 势力</option>
              <option value="powerSystemState">战力 / 能力</option>
              <option value="resourceState">资源 / 线索</option>
              <option value="relationshipChanges">关系变化</option>
              <option value="openThreads">开放线索</option>
              <option value="nextMilestones">里程碑</option>
            </select>
          </div>
          <div className="field">
            <div className="field-label">名称 / 内容</div>
            <input name="text" placeholder="输入要新增的状态节点" required />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">状态 / 身份 / 埋设章节</div>
              <input name="meta" />
            </div>
            <div className="field">
              <div className="field-label">补充信息</div>
              <input name="sub" />
            </div>
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">伏笔状态</div>
              <select name="status" defaultValue="open">
                <option value="open">未回收</option>
                <option value="partial">部分回收</option>
                <option value="closed">已回收</option>
              </select>
            </div>
            <div className="field">
              <div className="field-label">关联地点 / 预计回收</div>
              <input name="relatedLocation" placeholder="关联地点" />
              <input name="expectedRevealChapter" placeholder="预计回收章节" />
            </div>
          </div>
          <button className="button primary" type="submit">保存新增</button>
            </>
          )}
        </form>
      ) : null}
      {!selectedNode && graphActionStatus ? <p className="form-status">{graphActionStatus}</p> : null}
      {!selectedNode && graphActionError ? <p className="form-error">{graphActionError}</p> : null}

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
              {projectId ? (
                <form className="graph-edit-form" onSubmit={handleEditSubmit}>
                  <span>{selectedNode.source ? "编辑源状态" : "只读节点"}</span>
                  {selectedIsEntity ? (
                    <>
                      <input name="title" defaultValue={selectedNode.title} placeholder="名称" />
                      <input name="meta" defaultValue={selectedNode.meta} placeholder="状态 / 身份" />
                      <textarea name="sub" defaultValue={selectedNode.sub} placeholder="补充内容" />
                      {isCustomGraphNode ? (
                        <div className="split-panels">
                          <div className="field">
                            <div className="field-label">节点类型</div>
                            <select name="nodeType" defaultValue={selectedNode.type ?? "event"}>
                              {graphNodeTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <div className="field-label">节点状态</div>
                            <select name="tone" defaultValue={selectedNode.tone ?? "neutral"}>
                              {graphToneOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {selectedNode.source?.kind === "foreshadowing" ? (
                    <select name="status" defaultValue={selectedNode.meta.includes("已回收") ? "closed" : selectedNode.meta.includes("部分") ? "partial" : "open"}>
                      <option value="open">未回收</option>
                      <option value="partial">部分回收</option>
                      <option value="closed">已回收</option>
                    </select>
                  ) : null}
                  {selectedIsField ? (
                    <textarea name="text" defaultValue={selectedEditableText} placeholder="状态内容" />
                  ) : null}
                  {selectedNode.source ? (
                    <div className="hero-actions">
                      <button className="button primary" type="submit">保存修改</button>
                      <button className="button danger" type="button" onClick={handleDeleteNode}>删除 / 清空</button>
                    </div>
                  ) : (
                    <p className="muted">这个节点来自项目汇总、章节台账或历史记录，不能直接在图谱里改。</p>
                  )}
                </form>
              ) : null}
              {customGraphId && selectedNode ? (
                <div className="graph-edit-form custom-edge-editor">
                  <span>关系线</span>
                  {selectedConnectedEdges.length === 0 ? (
                    <p className="muted">这个节点暂时没有关系线。</p>
                  ) : (
                    <div className="custom-edge-list">
                      {selectedConnectedEdges.map((edge) => (
                        <div key={edge.id} className="custom-edge-row">
                          <span>
                            {nodeTitleById.get(edge.from) ?? edge.from}
                            {" -> "}
                            {nodeTitleById.get(edge.to) ?? edge.to}
                            {edge.label ? ` · ${edge.label}` : ""}
                          </span>
                          <button type="button" onClick={() => handleDeleteEdge(edge.id)}>删除</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form className="custom-edge-create" onSubmit={handleCreateEdge}>
                    <select name="targetNodeId" defaultValue="">
                      <option value="">选择要连接的节点</option>
                      {nodes
                        .filter((node) => node.id !== selectedNode.id)
                        .map((node) => (
                          <option key={node.id} value={node.id}>{node.label}</option>
                        ))}
                    </select>
                    <input name="relationLabel" placeholder="关系说明" />
                    <select name="relationTone" defaultValue="neutral">
                      <option value="neutral">普通</option>
                      <option value="success">正向</option>
                      <option value="warning">待处理</option>
                      <option value="danger">冲突</option>
                    </select>
                    <button className="button" type="submit">添加关系线</button>
                  </form>
                </div>
              ) : null}
              {graphActionStatus ? <p className="form-status">{graphActionStatus}</p> : null}
              {graphActionError ? <p className="form-error">{graphActionError}</p> : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
