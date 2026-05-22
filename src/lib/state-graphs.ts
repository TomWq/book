import type { getProjectWritingState } from "@/lib/projects";

export type RelationGraphNode = {
  id: string;
  label: string;
  meta: string;
  sub?: string;
  tone?: "neutral" | "success" | "danger" | "warning" | "core";
  type?: "person" | "place" | "force" | "thread" | "core" | "power" | "resource" | "knowledge" | "event";
  source?:
    | { kind: "character"; id: string }
    | { kind: "characterField"; id: string; field: "abilityBoundary" | "knownInformation" | "unknownInformation" | "secret" | "currentState" | "relationshipToProtagonist" }
    | { kind: "foreshadowing"; id: string }
    | { kind: "customGraphNode"; graphId: string; nodeId: string }
    | { kind: "plotStateField"; field: "currentMap" | "mainGoal" | "shortTermGoal" | "currentStage" | "nextStageGoal"; value: string }
    | { kind: "plotStateLine"; field: "mapAndForces" | "powerSystemState" | "resourceState"; value: string }
    | { kind: "plotStateList"; field: "relationshipChanges" | "openThreads" | "resolvedThreads" | "nextMilestones" | "unresolvedQuestions"; value: string };
  x?: number;
  y?: number;
};

export type RelationGraphEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  tone?: "neutral" | "success" | "danger" | "warning";
};

type WritingState = NonNullable<Awaited<ReturnType<typeof getProjectWritingState>>>;
type RelationGraph = {
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
};

function splitStateLines(value: string) {
  return value
    .split(/\r?\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueTextList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function statusTone(value: string): RelationGraphNode["tone"] {
  if (/已回收|已解决|closed|完成|兑现/.test(value)) {
    return "success";
  }

  if (/未回收|未解决|open|风险|敌|威胁|限制|代价/.test(value)) {
    return "danger";
  }

  if (/部分|待|后续|悬念|伏笔|线索/.test(value)) {
    return "warning";
  }

  return "neutral";
}

function normalizeMapOrForceEntry(value: string) {
  const raw = value.trim();

  if (
    !raw ||
    /待补充|未详细展开|记录当前地图|初始地图与势力关系待补充|大纲世界观|有旧|关系|关联|可能关联|势力：.*与/.test(raw)
  ) {
    return "";
  }

  let text = raw
    .replace(/^(地点|势力|地图|组织|阵营|场景|当前地图)[：:]\s*/, "")
    .replace(/^与/, "")
    .trim();

  text = text
    .split(/——|--|，|。|；|;|\(|（/)
    .map((item) => item.trim())
    .find(Boolean) ?? "";
  text = text.replace(/等具体场景.*$/, "").replace(/关系.*$/, "").trim();

  if (
    !text ||
    /^(她|他|它|我|你|这里|那里|那边|这边|前面|后面|开始|随后|然后|再|又|便|却|就|于是|忽然|突然|慢慢|轻轻|缓缓|沉默|闭上眼|转身|抬头|低头|看向|走向|停下)$/.test(text) ||
    /有旧|关系|关联|可能关联|态度|伏笔/.test(text)
  ) {
    return "";
  }

  if (/^(前厅|大厅|正厅|后山|枯井|后山枯井|房间|院子|庭院|密室|屋顶|书房|厢房|后院|大门|演武场|训练场|广场|山门|内院|外院)$/.test(text)) {
    return "";
  }

  const matched = text.match(/[\u4e00-\u9fa5A-Za-z0-9]{1,12}(家族|宗门|公司|学院|基地|黑市|码头|组织|阵营|联盟|商会|王朝|帝国|宗|家|府|城|楼|局|阁|门|派|宫|谷|村|镇|堂|殿|司|营|军|盟|会|馆|塔|岛|湖|河|国)/);
  const normalized = matched?.[0] ?? text;

  if (
    !matched ||
    normalized.length > 14 ||
    /^(前厅|大厅|正厅|后山|枯井|后山枯井|房间|院子|庭院|密室|屋顶|书房|厢房|后院|大门|演武场|训练场|广场|山门|内院|外院)$/.test(normalized)
  ) {
    return "";
  }

  if (/^(地点|势力|地图|组织|阵营|场景)$/.test(normalized)) {
    return "";
  }

  return normalized;
}

function mapClusterKey(value: string) {
  return value;
}

function preferredMapLabel(current: string | undefined, next: string) {
  if (!current) {
    return next;
  }

  if (current.length <= next.length && /家|府|宗|城|镇|村|国|局|阁|门|派|宫|谷|堂|殿|司|营|军|盟|会|馆|塔|岛|湖|河/.test(current)) {
    return current;
  }

  if (next.length > current.length && next.length <= 8) {
    return next;
  }

  return current;
}

function uniqueMapNodes(values: string[]) {
  const byCluster = values.reduce<Map<string, string>>((items, value) => {
    const normalized = normalizeMapOrForceEntry(value);

    if (!normalized) {
      return items;
    }

    const key = mapClusterKey(normalized);
    items.set(key, preferredMapLabel(items.get(key), normalized));

    return items;
  }, new Map<string, string>());

  return Array.from(byCluster.values());
}

export function shortText(value: string, fallback: string, maxLength = 46) {
  const text = value.trim() || fallback;

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function relationTone(value: string) {
  if (/敌|反派|冲突|压制|怀疑|威胁|对立|打压/.test(value)) {
    return "danger";
  }

  if (/师|盟友|保护|支持|朋友|伙伴|弟子|信任|帮助/.test(value)) {
    return "success";
  }

  return "neutral";
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

function gridPoint(index: number, startX: number, startY: number, columns: number, gapX = 300, gapY = 156) {
  return {
    x: startX + (index % columns) * gapX,
    y: startY + Math.floor(index / columns) * gapY
  };
}

function buildBoardGraph({
  center,
  items,
  edgeLabel = "关联",
  columns,
  startX = 380,
  startY = 96,
  centerX = 70,
  centerY = 260
}: {
  center: RelationGraphNode;
  items: RelationGraphNode[];
  edgeLabel?: string;
  columns?: number;
  startX?: number;
  startY?: number;
  centerX?: number;
  centerY?: number;
}): RelationGraph {
  const resolvedColumns = columns ?? (items.length > 20 ? 5 : items.length > 12 ? 4 : 3);
  const nodes: RelationGraphNode[] = [
    {
      ...center,
      x: centerX,
      y: centerY
    },
    ...items.map((item, index) => ({
      ...item,
      ...gridPoint(index, startX, startY, resolvedColumns, 286, 150)
    }))
  ];

  return {
    nodes,
    edges: items.map((item, index) => ({
      id: `${center.id}-${item.id}-${index}`,
      from: center.id,
      to: item.id,
      label: edgeLabel,
      tone: item.tone === "danger" ? "danger" : item.tone === "success" ? "success" : item.tone === "warning" ? "warning" : "neutral"
    }))
  };
}

function projectCenterNode(state: WritingState, meta: string, sub?: string): RelationGraphNode {
  return {
    id: "project-core",
    label: state.project.name,
    meta,
    sub: sub ?? shortText(state.plotState.mainGoal, "主线目标待补充", 38),
    tone: "core",
    type: "core"
  };
}

function buildForeshadowingGraph(state: WritingState): RelationGraph {
  const foreshadowings = state.foreshadowings.slice(0, 32);
  const threadNodes: RelationGraphNode[] = foreshadowings.map((item, index) => ({
    id: `foreshadow-thread-${item.id}`,
    label: item.name,
    meta: item.status === "closed" ? "已回收" : item.status === "partial" ? "部分回收" : "未回收",
    sub: shortText(item.hiddenInformation || item.revealMethod, "隐藏信息待补充", 52),
    tone: statusTone(item.status),
    type: "thread",
    source: { kind: "foreshadowing" as const, id: item.id },
    ...gridPoint(index, 470, 120, 3, 310, 150)
  }));
  const characterNames = uniqueTextList(foreshadowings.flatMap((item) => item.relatedCharacters)).slice(0, 18);
  const characterNodes: RelationGraphNode[] = characterNames.map((name, index) => ({
    id: `foreshadow-person-${index}`,
    label: name,
    meta: "关联人物",
    tone: "neutral",
    type: "person",
    x: 70,
    y: 120 + index * 118
  }));
  const locationNodes = uniqueMapNodes(foreshadowings.map((item) => item.relatedLocation)).slice(0, 10);
  const placeNodes: RelationGraphNode[] = locationNodes.map((name, index) => ({
    id: `foreshadow-place-${index}`,
    label: name,
    meta: "关联地点",
    tone: "warning",
    type: "place",
    x: 1440,
    y: 120 + index * 118
  }));
  const nodes: RelationGraphNode[] = [
    {
      ...projectCenterNode(state, "伏笔中心", "查看伏笔、人物、地点和回收状态"),
      x: 70,
      y: 40
    },
    ...threadNodes,
    ...characterNodes,
    ...placeNodes
  ];
  const edges: RelationGraphEdge[] = [
    ...threadNodes.map((node) => ({
      id: `project-${node.id}`,
      from: "project-core",
      to: node.id,
      label: "伏笔",
      tone: node.tone === "success" ? "success" as const : "warning" as const
    })),
    ...foreshadowings.flatMap((item) => {
      const threadId = `foreshadow-thread-${item.id}`;
      const personEdges = item.relatedCharacters.flatMap((name) => {
        const personIndex = characterNames.findIndex((itemName) => itemName === name);
        return personIndex >= 0
          ? [{ id: `person-${threadId}-${personIndex}`, from: `foreshadow-person-${personIndex}`, to: threadId, label: "知情/相关", tone: "neutral" as const }]
          : [];
      });
      const normalizedLocation = normalizeMapOrForceEntry(item.relatedLocation);
      const placeIndex = locationNodes.findIndex((name) => normalizedLocation && (name === normalizedLocation || name.includes(normalizedLocation) || normalizedLocation.includes(name)));

      return [
        ...personEdges,
        ...(placeIndex >= 0
          ? [{ id: `place-${threadId}-${placeIndex}`, from: `foreshadow-place-${placeIndex}`, to: threadId, label: "埋设地", tone: "warning" as const }]
          : [])
      ];
    })
  ];

  return { nodes, edges };
}

function buildPlotProgressGraph(state: WritingState): RelationGraph {
  const milestoneNodes = uniqueTextList([
    state.plotState.currentStage,
    state.plotState.shortTermGoal,
    state.plotState.nextStageGoal,
    ...state.plotState.nextMilestones,
    ...state.plotState.openThreads.slice(0, 8),
    ...state.plotState.resolvedThreads.slice(0, 6)
  ]).slice(0, 22);

  const sourceForMilestone = (value: string): RelationGraphNode["source"] => {
    if (value === state.plotState.currentStage) {
      return { kind: "plotStateField", field: "currentStage", value };
    }
    if (value === state.plotState.shortTermGoal) {
      return { kind: "plotStateField", field: "shortTermGoal", value };
    }
    if (value === state.plotState.nextStageGoal) {
      return { kind: "plotStateField", field: "nextStageGoal", value };
    }
    if (state.plotState.nextMilestones.includes(value)) {
      return { kind: "plotStateList", field: "nextMilestones", value };
    }
    if (state.plotState.openThreads.includes(value)) {
      return { kind: "plotStateList", field: "openThreads", value };
    }
    if (state.plotState.resolvedThreads.includes(value)) {
      return { kind: "plotStateList", field: "resolvedThreads", value };
    }
    return undefined;
  };

  return buildBoardGraph({
    center: projectCenterNode(state, "主线目标", shortText(state.plotState.mainGoal, "主线待补充", 48)),
    items: milestoneNodes.map((item, index) => ({
      id: `plot-${index}`,
      label: index === 0 ? "当前阶段" : /已|完成|解决|回收/.test(item) ? "已推进" : "待推进",
      meta: shortText(item, item, 34),
      sub: index === 0 ? "当前剧情位置" : "",
      tone: statusTone(item),
      type: "thread",
      source: sourceForMilestone(item)
    })),
    edgeLabel: "推进",
    columns: 3
  });
}

function buildPowerGraph(state: WritingState): RelationGraph {
  const powerLines = [
    { value: state.bible.goldenFingerRules, source: undefined },
    { value: state.bible.worldRules, source: undefined },
    ...splitStateLines(state.plotState.powerSystemState).map((value) => ({
      value,
      source: { kind: "plotStateLine" as const, field: "powerSystemState" as const, value }
    })),
    ...state.characters
      .filter((character) => character.abilityBoundary.trim())
      .map((character) => ({
        value: character.abilityBoundary,
        source: { kind: "characterField" as const, id: character.id, field: "abilityBoundary" as const }
      }))
  ]
    .filter((item, index, items) => item.value.trim() && items.findIndex((candidate) => candidate.value === item.value) === index)
    .slice(0, 24);

  return buildBoardGraph({
    center: projectCenterNode(state, "战力体系", "境界、能力、限制、代价和克制关系"),
    items: powerLines.map((item, index) => ({
      id: `power-${index}`,
      label: /限制|代价|不能|边界/.test(item.value) ? "限制 / 代价" : index === 0 ? "金手指规则" : "能力节点",
      meta: shortText(item.value, item.value, 38),
      tone: /限制|代价|不能|风险/.test(item.value) ? "danger" : "warning",
      type: "power",
      source: item.source
    })),
    edgeLabel: "约束",
    columns: 3
  });
}

function buildResourceGraph(state: WritingState): RelationGraph {
  const resourceLines = [
    ...splitStateLines(state.plotState.resourceState).map((value) => ({
      value,
      source: { kind: "plotStateLine" as const, field: "resourceState" as const, value }
    })),
    ...state.ledgers.map((ledger) => ({ value: ledger.payoff, source: undefined })),
    ...state.ledgers.flatMap((ledger) => ledger.newClues.map((value) => ({ value, source: undefined })))
  ]
    .filter((item, index, items) => item.value.trim() && items.findIndex((candidate) => candidate.value === item.value) === index)
    .slice(0, 28);

  return buildBoardGraph({
    center: projectCenterNode(state, "资源收益", "功法、线索、道具、权限和阶段性收益"),
    items: resourceLines.map((item, index) => ({
      id: `resource-${index}`,
      label: /线索|证据|秘密|真相/.test(item.value) ? "线索" : /功法|丹药|装备|资源|奖励|获得|拿到/.test(item.value) ? "收益" : "资源",
      meta: shortText(item.value, item.value, 38),
      tone: /线索|秘密|真相/.test(item.value) ? "warning" : "success",
      type: "resource",
      source: item.source
    })),
    edgeLabel: "沉淀",
    columns: 3
  });
}

function buildKnowledgeGraph(state: WritingState): RelationGraph {
  const characters = state.characters.slice(0, 14);
  const nodes: RelationGraphNode[] = [
    {
      ...projectCenterNode(state, "知情边界", "谁知道什么，谁还不知道什么"),
      x: 70,
      y: 70
    },
    ...characters.map((character, index) => ({
      id: `knowledge-person-${character.id}`,
      label: character.name,
      meta: shortText(character.identity, "人物", 28),
      sub: shortText(character.lastAppearance, "出场待确认", 26),
      tone: relationTone(`${character.relationshipToProtagonist}${character.attitude}`) as RelationGraphNode["tone"],
      type: "person" as const,
      source: { kind: "character" as const, id: character.id },
      x: 70,
      y: 220 + index * 140
    })),
    ...characters.flatMap((character, index) => [
      {
        id: `knowledge-known-${character.id}`,
        label: "已知",
        meta: shortText(character.knownInformation, "已知信息待补充", 38),
        tone: "success" as const,
        type: "knowledge" as const,
        source: { kind: "characterField" as const, id: character.id, field: "knownInformation" as const },
        x: 410,
        y: 220 + index * 140
      },
      {
        id: `knowledge-unknown-${character.id}`,
        label: "未知 / 误判",
        meta: shortText(character.unknownInformation || character.secret, "未知信息待补充", 38),
        tone: "danger" as const,
        type: "knowledge" as const,
        source: { kind: "characterField" as const, id: character.id, field: character.unknownInformation ? "unknownInformation" as const : "secret" as const },
        x: 750,
        y: 220 + index * 140
      }
    ])
  ];
  const edges: RelationGraphEdge[] = [
    ...characters.map((character) => ({
      id: `knowledge-core-${character.id}`,
      from: "project-core",
      to: `knowledge-person-${character.id}`,
      label: "人物",
      tone: "neutral" as const
    })),
    ...characters.flatMap((character) => [
      {
        id: `known-${character.id}`,
        from: `knowledge-person-${character.id}`,
        to: `knowledge-known-${character.id}`,
        label: "知道",
        tone: "success" as const
      },
      {
        id: `unknown-${character.id}`,
        from: `knowledge-person-${character.id}`,
        to: `knowledge-unknown-${character.id}`,
        label: "不知道",
        tone: "danger" as const
      }
    ])
  ];

  return { nodes, edges };
}

function buildCausalityGraph(state: WritingState): RelationGraph {
  const ledgers = [...state.ledgers]
    .sort((a, b) => a.chapterNumber - b.chapterNumber || a.updatedAt.localeCompare(b.updatedAt))
    .slice(-24);
  const nodes: RelationGraphNode[] = [
    {
      ...projectCenterNode(state, "章节因果", "事件 -> 收益 -> 钩子 -> 下一章压力"),
      x: 80,
      y: 190
    },
    ...ledgers.map((ledger, index) => ({
      id: `ledger-${ledger.id}`,
      label: `第 ${ledger.chapterNumber} 章`,
      meta: shortText(ledger.title, ledger.title, 28),
      sub: shortText(ledger.cliffhanger || ledger.payoff || ledger.events[0], "钩子待补充", 50),
      tone: "neutral" as const,
      type: "event" as const,
      x: 310 + index * 260,
      y: index % 2 === 0 ? 110 : 290
    }))
  ];
  const edges: RelationGraphEdge[] = [
    ...(ledgers[0]
      ? [{
          id: `core-ledger-${ledgers[0].id}`,
          from: "project-core",
          to: `ledger-${ledgers[0].id}`,
          label: "开始",
          tone: "success" as const
        }]
      : []),
    ...ledgers.slice(1).map((ledger, index) => ({
      id: `ledger-flow-${ledgers[index].id}-${ledger.id}`,
      from: `ledger-${ledgers[index].id}`,
      to: `ledger-${ledger.id}`,
      label: "承接",
      tone: "neutral" as const
    }))
  ];

  return { nodes, edges };
}

function buildCustomGraph(graph: WritingState["customRelationGraphs"][number]): RelationGraph {
  return {
    nodes: graph.nodes.map((node, index) => ({
      id: node.id,
      label: node.label,
      meta: node.meta,
      sub: node.sub,
      tone: node.tone,
      type: node.type,
      source: { kind: "customGraphNode" as const, graphId: graph.id, nodeId: node.id },
      x: node.x ?? 120 + (index % 5) * 260,
      y: node.y ?? 120 + Math.floor(index / 5) * 170
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      tone: edge.tone
    }))
  };
}

export function buildStateRelationGraphs(state: WritingState) {
  const protagonist =
    state.characters.find((character) => /本人|主角/.test(character.relationshipToProtagonist)) ??
    state.characters[0] ??
    null;
  const supportingCharacters = state.characters
    .filter((character) => character.id !== protagonist?.id)
    .slice(0, 48);
  const mapNodes = uniqueMapNodes([
    state.plotState.currentMap,
    ...splitStateLines(state.plotState.mapAndForces),
    ...state.foreshadowings.map((item) => item.relatedLocation)
  ]).slice(0, 10);
  const relationshipNodes = uniqueTextList([
    ...state.plotState.relationshipChanges,
    ...state.characters
      .filter((character) => character.relationshipToProtagonist)
      .map((character) => `${character.name}：${character.relationshipToProtagonist}`)
  ]).slice(0, 10);
  const openForeshadowings = Array.from(
    new Map(
      state.foreshadowings
        .filter((item) => item.status !== "closed")
        .map((item) => [item.name.trim(), item])
    ).values()
  ).slice(0, 4);
  const characterRingCount = Math.max(1, Math.ceil(supportingCharacters.length / 16));
  const characterGraphWidth = Math.max(1180, 1080 + (characterRingCount - 1) * 260);
  const characterGraphHeight = Math.max(620, 600 + (characterRingCount - 1) * 160);
  const characterCenterX = characterGraphWidth / 2;
  const characterCenterY = characterGraphHeight / 2;
  const protagonistId = protagonist?.id ?? "protagonist-placeholder";
  const characterNodes: RelationGraphNode[] = [
    {
      id: protagonistId,
      label: protagonist?.name ?? "主角待补充",
      meta: protagonist?.identity || "主角锚点",
      sub: shortText(protagonist?.currentState ?? "", "当前状态待补充", 34),
      tone: "core",
      type: "core",
      source: protagonist ? { kind: "character", id: protagonist.id } : undefined,
      x: Math.round(characterCenterX),
      y: Math.round(characterCenterY)
    },
    ...supportingCharacters.map((character, index) => {
      const ringIndex = Math.floor(index / 16);
      const indexInRing = index % 16;
      const perRing = Math.min(16, supportingCharacters.length - ringIndex * 16);
      const point = graphPoint(
        indexInRing,
        characterCenterX,
        characterCenterY,
        perRing,
        390 + ringIndex * 135,
        218 + ringIndex * 84
      );

      return {
        id: character.id,
        label: character.name,
        meta: shortText(character.identity, "身份待补充", 24),
        sub: shortText(character.lastAppearance || character.currentState, "状态待补充", 28),
        tone: relationTone(`${character.relationshipToProtagonist}${character.attitude}`) as RelationGraphNode["tone"],
        type: "person" as const,
        source: { kind: "character" as const, id: character.id },
        ...point
      };
    })
  ];
  const relationMentionEdges = state.plotState.relationshipChanges.flatMap((item, index) => {
    const mentioned = state.characters.filter((character) => item.includes(character.name)).slice(0, 4);

    if (mentioned.length >= 2) {
      return mentioned.slice(1).map((character) => ({
        id: `relation-pair-${index}-${character.id}`,
        from: mentioned[0].id,
        to: character.id,
        label: "关联",
        tone: relationTone(item) as RelationGraphEdge["tone"]
      }));
    }

    return [];
  });
  const characterEdges: RelationGraphEdge[] = [
    ...supportingCharacters.map((character) => ({
      id: `protagonist-${character.id}`,
      from: protagonistId,
      to: character.id,
      label: shortText(character.relationshipToProtagonist, "关系", 12),
      tone: relationTone(`${character.relationshipToProtagonist}${character.attitude}`) as RelationGraphEdge["tone"]
    })),
    ...relationMentionEdges
  ];
  const forceGraphWidth = Math.max(1180, 1040 + Math.ceil(mapNodes.length / 12) * 160);
  const forceGraphHeight = Math.max(560, 520 + Math.ceil(openForeshadowings.length / 6) * 96);
  const forceCenterX = forceGraphWidth / 2;
  const forceCenterY = forceGraphHeight / 2;
  const forceNodes: RelationGraphNode[] = [
    {
      id: "project-core",
      label: state.project.name,
      meta: "故事中心",
      sub: shortText(state.plotState.mainGoal, "主线目标待补充", 34),
      tone: "core",
      type: "core",
      x: Math.round(forceCenterX),
      y: Math.round(forceCenterY)
    },
    ...mapNodes.map((item, index) => {
      const ringIndex = Math.floor(index / 18);
      const point = graphPoint(
        index % 18,
        forceCenterX,
        forceCenterY,
        Math.min(18, mapNodes.length - ringIndex * 18),
        390 + ringIndex * 125,
        176 + ringIndex * 82
      );

      return {
        id: `map-${index}`,
        label: index === 0 ? "当前地图" : "势力 / 地点",
        meta: shortText(item, "待补充", 28),
        tone: index === 0 ? "success" : "warning",
        type: index === 0 ? "place" : "force",
        source: index === 0
          ? { kind: "plotStateField" as const, field: "currentMap" as const, value: item }
          : { kind: "plotStateLine" as const, field: "mapAndForces" as const, value: item },
        ...point
      } satisfies RelationGraphNode;
    }),
    ...openForeshadowings.map((item, index) => ({
      id: `foreshadow-${item.id}`,
      label: item.name,
      meta: item.relatedLocation ? `伏笔 · ${shortText(item.relatedLocation, item.relatedLocation, 18)}` : "未回收伏笔",
      sub: shortText(item.expectedRevealChapter, "回收章节待定", 20),
      tone: "neutral" as const,
      type: "thread" as const,
      source: { kind: "foreshadowing" as const, id: item.id },
      x: 140 + (index % 6) * 178,
      y: forceGraphHeight - 90 - Math.floor(index / 6) * 88
    }))
  ];
  const forceEdges: RelationGraphEdge[] = [
    ...mapNodes.map((_, index) => ({
      id: `project-map-${index}`,
      from: "project-core",
      to: `map-${index}`,
      label: index === 0 ? "当前" : "关联",
      tone: index === 0 ? "success" as const : "warning" as const
    })),
    ...openForeshadowings.map((item) => {
      const relatedLocation = normalizeMapOrForceEntry(item.relatedLocation);
      const relatedMapIndex = mapNodes.findIndex((mapNode) =>
        relatedLocation && (mapNode === relatedLocation || mapNode.includes(relatedLocation) || relatedLocation.includes(mapNode))
      );

      return {
        id: `foreshadow-map-${item.id}`,
        from: relatedMapIndex >= 0 ? `map-${relatedMapIndex}` : "project-core",
        to: `foreshadow-${item.id}`,
        label: "伏笔",
        tone: "warning" as const
      };
    })
  ];

  return {
    characterGraph: {
      nodes: characterNodes,
      edges: characterEdges
    },
    forceGraph: {
      nodes: forceNodes,
      edges: forceEdges
    },
    foreshadowingGraph: buildForeshadowingGraph(state),
    plotProgressGraph: buildPlotProgressGraph(state),
    powerGraph: buildPowerGraph(state),
    resourceGraph: buildResourceGraph(state),
    knowledgeGraph: buildKnowledgeGraph(state),
    causalityGraph: buildCausalityGraph(state),
    customGraphs: state.customRelationGraphs.map((graph) => ({
      graph,
      relationGraph: buildCustomGraph(graph)
    })),
    relationshipNodes,
    openForeshadowings
  };
}
