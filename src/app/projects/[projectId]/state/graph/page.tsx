import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/panel";
import { StateRelationGraph } from "@/components/state-relation-graph";
import { buildStateRelationGraphs, shortText } from "@/lib/state-graphs";
import { getProjectWritingState } from "@/lib/projects";

export default async function ProjectStateGraphPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const state = await getProjectWritingState(projectId);

  if (!state) {
    notFound();
  }

  const {
    characterGraph,
    forceGraph,
    foreshadowingGraph,
    plotProgressGraph,
    powerGraph,
    resourceGraph,
    knowledgeGraph,
    causalityGraph,
    relationshipNodes,
    openForeshadowings
  } = buildStateRelationGraphs(state);
  const extendedGraphs = [
    {
      title: "伏笔 / 悬念网",
      description: "查看伏笔是否未回收、部分回收或已回收，并挂载到相关人物和地点。",
      graphTitle: "伏笔悬念",
      graphDescription: "伏笔节点连接人物、地点和回收状态，避免后续章节忘记埋线或提前泄底。",
      graph: foreshadowingGraph
    },
    {
      title: "主线 / 支线推进网",
      description: "查看当前阶段、短期目标、开放问题和下一步里程碑。",
      graphTitle: "主线推进",
      graphDescription: "主线目标在中心，阶段目标、支线任务和待推进事项围绕展开。",
      graph: plotProgressGraph
    },
    {
      title: "战力 / 能力体系网",
      description: "查看境界、金手指、能力边界、限制和代价。",
      graphTitle: "战力体系",
      graphDescription: "把能力和限制放在同一张图里，防止战力突然膨胀或规则前后冲突。",
      graph: powerGraph
    },
    {
      title: "资源 / 收益网",
      description: "查看功法、线索、道具、收益和章节回报。",
      graphTitle: "资源收益",
      graphDescription: "沉淀主角已经拿到的资源和线索，后续任务卡可以继续调用。",
      graph: resourceGraph
    },
    {
      title: "知情 / 秘密网",
      description: "查看每个人知道什么、不知道什么、有什么秘密或误判。",
      graphTitle: "知情边界",
      graphDescription: "防止人物突然知道不该知道的信息，也方便设计信息差爽点。",
      graph: knowledgeGraph
    },
    {
      title: "章节因果网",
      description: "查看章节之间的事件承接、收益和章末钩子链条。",
      graphTitle: "章节因果",
      graphDescription: "每章台账按顺序连接，帮助检查前后章是否断裂。",
      graph: causalityGraph
    }
  ];

  return (
    <div className="grid analysis-graph-page state-graph-page">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="pill success">状态图谱</div>
            <h1>长篇创作状态关系网</h1>
            <p>人物、地图、伏笔、主线、战力、资源、知情边界和章节因果都接入图谱，支持全屏、缩放、拖拽、重置布局和小地图。</p>
          </div>
          <div className="hero-actions">
            <Link className="button" href={`/projects/${projectId}/state`}>
              返回状态维护
            </Link>
            <span className="chip">人物节点 {characterGraph.nodes.length}</span>
            <span className="chip">地图节点 {forceGraph.nodes.length}</span>
            <span className="chip">图谱 {extendedGraphs.length + 2}</span>
          </div>
        </div>
      </section>

      <Panel title="人物关系网络" description="默认只显示人物节点和真实人物关系；伏笔与地点放到地图/势力图里，避免第一章就过度复杂。">
        <StateRelationGraph
          title="人物关系"
          description="主角只是中心锚点；只有关系变化明确提到两个人以上时，才画成交叉边。"
          nodes={characterGraph.nodes}
          edges={characterGraph.edges}
        />

        <div className="graph-support-grid">
          <div className="graph-support-card">
            <div className="task-title">关系变化</div>
            {relationshipNodes.length === 0 ? (
              <div className="muted">暂无关系变化。</div>
            ) : (
              <div className="tag-row">
                {relationshipNodes.map((item) => (
                  <span key={item} className="tag">
                    {shortText(item, item, 34)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="graph-support-card">
            <div className="task-title">当前用途</div>
            <div className="muted">用于检查人物关系、阵营变化、角色出场线索是否已经接入后续章节任务卡。</div>
          </div>
        </div>
      </Panel>

      <Panel title="地图 / 势力网络" description="地点、势力、当前地图和未回收伏笔独立成图，用画布查看层级和挂载关系。">
        <StateRelationGraph
          title="地图与势力"
          description="地点、势力和伏笔分层挂载，默认展开，不需要每次手动拖开。"
          nodes={forceGraph.nodes}
          edges={forceGraph.edges}
        />

        <div className="graph-support-grid">
          <div className="graph-support-card">
            <div className="task-title">未回收伏笔挂载</div>
            {openForeshadowings.length === 0 ? (
              <div className="muted">暂无未回收伏笔。</div>
            ) : (
              <div className="tag-row">
                {openForeshadowings.map((item) => (
                  <span key={item.id} className="tag warning-tag">
                    {item.name}
                    {item.relatedLocation ? ` · ${item.relatedLocation}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="graph-support-card">
            <div className="task-title">当前用途</div>
            <div className="muted">用于检查地图推进、势力层级和伏笔位置，避免章节生成时漏掉已建立的空间关系。</div>
          </div>
        </div>
      </Panel>

      {extendedGraphs.map((item) => (
        <Panel key={item.title} title={item.title} description={item.description}>
          <StateRelationGraph
            title={item.graphTitle}
            description={item.graphDescription}
            nodes={item.graph.nodes}
            edges={item.graph.edges}
          />
        </Panel>
      ))}
    </div>
  );
}
