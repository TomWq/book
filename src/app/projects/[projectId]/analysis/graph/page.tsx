import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisFlowGraph } from "@/components/analysis-flow-graph";
import { CollapsibleGraphPanel } from "@/components/collapsible-graph-panel";
import { Panel } from "@/components/panel";
import { StateRelationGraph } from "@/components/state-relation-graph";
import { buildAnalysisRelationGraphs } from "@/lib/analysis-graphs";
import { getProject, getProjectAnalysis } from "@/lib/projects";
import { shortText } from "@/lib/state-graphs";

export default async function ProjectAnalysisGraphPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, analysis] = await Promise.all([
    getProject(projectId),
    getProjectAnalysis(projectId)
  ]);

  if (!project) {
    notFound();
  }

  const graphs = buildAnalysisRelationGraphs(project.name, analysis);
  const hasAnalysis = analysis.chapterAnalyses.length > 0;
  const extendedGraphs = [
    {
      title: "伏笔 / 悬念网",
      description: "从新增信息、状态变化和章末钩子里提取原书埋线方式。",
      graphTitle: "伏笔悬念",
      graphDescription: "查看原书如何埋线、保留疑问和制造追读压力。",
      graph: graphs.foreshadowingGraph
    },
    {
      title: "主线 / 支线推进网",
      description: "从开局、主循环、冲突和读者钩子中观察推进规律。",
      graphTitle: "主线推进",
      graphDescription: "拆出原书的主线建立、阶段压力和支线牵引。",
      graph: graphs.plotProgressGraph
    },
    {
      title: "战力 / 能力体系网",
      description: "从金手指、境界、能力、限制和代价中提取战力结构。",
      graphTitle: "战力体系",
      graphDescription: "查看原书如何控制升级、限制、代价和能力兑现。",
      graph: graphs.powerGraph
    },
    {
      title: "资源 / 收益网",
      description: "从爽点回报、新增信息和状态变化中观察章节回报。",
      graphTitle: "资源收益",
      graphDescription: "拆出原书每章给读者的资源、线索、身份或情绪收益。",
      graph: graphs.resourceGraph
    },
    {
      title: "知情 / 秘密网",
      description: "从人物关系里查看信息差、秘密、误判和人物认知关系。",
      graphTitle: "知情秘密",
      graphDescription: "看谁与谁发生了信息关系，以及证据来自哪一章。",
      graph: graphs.knowledgeGraph
    },
    {
      title: "章节因果网",
      description: "按章节顺序查看事件、冲突、收益和钩子的承接。",
      graphTitle: "章节因果",
      graphDescription: "检查原书章节之间如何一章推一章。",
      graph: graphs.causalityGraph
    }
  ];

  return (
    <div className="grid analysis-graph-page">
      <section className="hero">
        <div className="hero-top">
          <div>
            <h1>拆书结构图谱</h1>
            <p>这里看的是原书的商业结构：章节节奏、爽点、人物、线索、伏笔、主线、战力、资源、知情边界和章节因果。</p>
          </div>
          <div className="hero-actions">
            <Link className="button" href={`/projects/${projectId}/analysis`}>
              返回整书分析
            </Link>
            <span className="chip">已分析 {analysis.chapterAnalyses.length} 章</span>
            <span className="chip">导入 {analysis.chapters.length} 章</span>
            <span className="chip">图谱 {extendedGraphs.length + 2}</span>
          </div>
        </div>
      </section>

      {!hasAnalysis ? (
        <Panel title="还没有可视化数据" description="先完成章节拆解后，这里会自动生成拆书图谱。">
          <div className="empty-state compact-empty">
            <strong>图谱依赖章节分析结果</strong>
            <span>先去分析页选择前几章、单章或指定区间。分析完成后，图谱会自动读取拆解结果。</span>
            <Link className="button primary" href={`/projects/${projectId}/analysis`}>
              去分析章节
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          <CollapsibleGraphPanel
            title="章节节奏 / 爽点画布"
            description="默认只看节点、参数和流向；长内容点开节点详情再看。"
            nodeCount={graphs.chapterCards.length}
            edgeCount={Math.max(0, graphs.chapterCards.length - 1)}
          >
            <div className="analysis-board-shell">
              <div className="analysis-board-toolbar">
                <div>
                  <strong>节点式章节流程</strong>
                  <span>类似工作流画布，章节是节点，爽点、冲突和钩子是参数，不把全文摊在画布上。</span>
                </div>
                <div className="chip-row">
                  <span className="chip">章节 {graphs.chapterCards.length}</span>
                  <span className="chip">爽点 {graphs.topPleasureTypes.length}</span>
                  <span className="chip">折叠详情</span>
                </div>
              </div>

              <AnalysisFlowGraph
                mode="chapter"
                chapters={graphs.chapterCards}
                topPleasureTypes={graphs.topPleasureTypes}
                structureBoard={graphs.structureBoard}
              />
            </div>
          </CollapsibleGraphPanel>

          <CollapsibleGraphPanel
            title="人物 / 线索 / 地图画布"
            description="拆书侧只展示从章节分析里聚合出的结构元素，按类型分层，不混成一团。"
            nodeCount={graphs.topCharacters.length + graphs.topClues.length + graphs.structureRelations.length}
            edgeCount={graphs.structureRelations.length}
          >
            <div className="analysis-board-shell">
              <div className="analysis-board-toolbar">
                <div>
                  <strong>结构元素画布</strong>
                  <span>人物、线索、地图和公式分栏查看；后续内容增加时也不会挤在中心点周围。</span>
                </div>
                <div className="chip-row">
                  <span className="chip">人物 {graphs.topCharacters.length}</span>
                  <span className="chip">线索 {graphs.topClues.length}</span>
                  <span className="chip">关系 {graphs.structureRelations.length}</span>
                  <span className="chip">分层视图</span>
                </div>
              </div>

              <AnalysisFlowGraph
                mode="structure"
                characters={graphs.topCharacters}
                clues={graphs.topClues}
                relations={graphs.structureRelations}
                structureBoard={graphs.structureBoard}
              />

              <div className="analysis-board-note">
                <strong>说明</strong>
                <span>
                  这里的数据来自章节 AI 拆解结果。人物列会尽量过滤“把句子误识别成人名”的内容；真正复杂的人物关系和地图势力，创作状态页仍会继续用关系图谱维护。
                </span>
              </div>
            </div>
          </CollapsibleGraphPanel>

          {extendedGraphs.map((item) => (
            <CollapsibleGraphPanel
              key={item.title}
              title={item.title}
              description={item.description}
              nodeCount={item.graph.nodes.length}
              edgeCount={item.graph.edges.length}
            >
              <StateRelationGraph
                title={item.graphTitle}
                description={item.graphDescription}
                nodes={item.graph.nodes}
                edges={item.graph.edges}
              />
            </CollapsibleGraphPanel>
          ))}

          <Panel title="高频结构摘录" description="保留原来底部的文字汇总，但只作为辅助，不再承担主要图谱阅读。">
            <div className="graph-support-grid">
              <div className="graph-support-card">
                <div className="task-title">高频爽点</div>
                {graphs.topPleasureTypes.length === 0 ? (
                  <div className="muted">暂无爽点类型。</div>
                ) : (
                  <div className="tag-row">
                    {graphs.topPleasureTypes.map((item) => (
                      <span key={item} className="tag warning-tag">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="graph-support-card">
                <div className="task-title">线索 / 状态</div>
                {graphs.topClues.length === 0 ? (
                  <div className="muted">章节分析里暂未识别线索。</div>
                ) : (
                  <div className="tag-row">
                    {graphs.topClues.slice(0, 12).map((item) => (
                      <span key={item.text} className="tag warning-tag">
                        {shortText(item.text, item.text, 38)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
