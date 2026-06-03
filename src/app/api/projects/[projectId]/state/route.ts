import {
  cleanupProjectWritingState,
  createCharacterProfile,
  createCustomRelationGraph,
  createCustomRelationGraphEdge,
  createCustomRelationGraphNode,
  createForeshadowing,
  deleteCharacterProfile,
  deleteCustomRelationGraph,
  deleteCustomRelationGraphEdge,
  deleteCustomRelationGraphNode,
  deleteForeshadowing,
  getProjectWritingState,
  updateCharacterProfile,
  updateCustomRelationGraph,
  updateCustomRelationGraphNode,
  updateForeshadowing,
  updatePlotState,
  updateProjectMetadata,
  updateWritingBible
} from "@/lib/projects";

export const runtime = "nodejs";

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value ?? "")
        .split(/\r?\n|，|、/)
        .map((item) => item.trim())
        .filter(Boolean);
}

type GraphSource =
  | { kind: "character"; id: string }
  | { kind: "characterField"; id: string; field: "abilityBoundary" | "knownInformation" | "unknownInformation" | "secret" | "currentState" | "relationshipToProtagonist" }
  | { kind: "foreshadowing"; id: string }
  | { kind: "customGraphNode"; graphId: string; nodeId: string }
  | { kind: "plotStateField"; field: "currentMap" | "mainGoal" | "shortTermGoal" | "currentStage" | "nextStageGoal"; value: string }
  | { kind: "plotStateLine"; field: "mapAndForces" | "powerSystemState" | "resourceState"; value: string }
  | { kind: "plotStateList"; field: "relationshipChanges" | "openThreads" | "resolvedThreads" | "nextMilestones" | "unresolvedQuestions"; value: string };

function graphSource(value: unknown): GraphSource | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const kind = String(source.kind ?? "");

  if (kind === "character" || kind === "foreshadowing") {
    return source.id ? source as unknown as GraphSource : null;
  }

  if (kind === "customGraphNode") {
    return source.graphId && source.nodeId ? source as unknown as GraphSource : null;
  }

  if (kind === "characterField") {
    return source.id && "field" in source ? source as unknown as GraphSource : null;
  }

  if (kind === "plotStateField" || kind === "plotStateLine" || kind === "plotStateList") {
    return "field" in source ? source as unknown as GraphSource : null;
  }

  return null;
}

function status(value: unknown) {
  const rawStatus = String(value ?? "");
  return rawStatus === "partial" || rawStatus === "closed" ? rawStatus : "open";
}

function textLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function replaceLine(current: string, previous: string, next: string) {
  const lines = textLines(current);
  const index = lines.findIndex((item) => item === previous);

  if (index >= 0) {
    lines[index] = next;
  } else {
    lines.push(next);
  }

  return Array.from(new Set(lines.filter(Boolean))).join("\n");
}

function removeLine(current: string, previous: string) {
  return textLines(current).filter((item) => item !== previous).join("\n");
}

function replaceListItem(current: string[], previous: string, next: string) {
  const index = current.findIndex((item) => item === previous);
  const lines = [...current];

  if (index >= 0) {
    lines[index] = next;
  } else {
    lines.push(next);
  }

  return Array.from(new Set(lines.map((item) => item.trim()).filter(Boolean)));
}

function removeListItem(current: string[], previous: string) {
  return current.filter((item) => item !== previous);
}

async function updatePlotStateFromCurrent(projectId: string, mutate: (state: NonNullable<Awaited<ReturnType<typeof getProjectWritingState>>>["plotState"]) => void) {
  const state = await getProjectWritingState(projectId);

  if (!state) {
    throw new Error("项目不存在");
  }

  const plotState = {
    ...state.plotState,
    unresolvedQuestions: [...state.plotState.unresolvedQuestions],
    openThreads: [...state.plotState.openThreads],
    resolvedThreads: [...state.plotState.resolvedThreads],
    nextMilestones: [...state.plotState.nextMilestones],
    relationshipChanges: [...state.plotState.relationshipChanges]
  };
  mutate(plotState);

  return updatePlotState(projectId, {
    currentVolume: plotState.currentVolume,
    currentMap: plotState.currentMap,
    mainGoal: plotState.mainGoal,
    shortTermGoal: plotState.shortTermGoal,
    currentStage: plotState.currentStage,
    currentEnemy: plotState.currentEnemy,
    unresolvedQuestions: plotState.unresolvedQuestions,
    openThreads: plotState.openThreads,
    resolvedThreads: plotState.resolvedThreads,
    nextMilestones: plotState.nextMilestones,
    nextStageGoal: plotState.nextStageGoal,
    powerSystemState: plotState.powerSystemState,
    mapAndForces: plotState.mapAndForces,
    resourceState: plotState.resourceState,
    relationshipChanges: plotState.relationshipChanges
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const state = await getProjectWritingState(projectId);

  if (!state) {
    return Response.json({ error: "项目不存在" }, { status: 404 });
  }

  return Response.json(state);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const currentState = await getProjectWritingState(projectId);

  if (!currentState) {
    return Response.json({ error: "项目不存在" }, { status: 404 });
  }

  try {
    if (action === "update_project") {
      const project = await updateProjectMetadata(projectId, {
        name: currentState.project.name,
        genre: currentState.project.genre,
        description: String(body.description ?? "")
      });

      return Response.json({ project });
    }

    if (action === "update_bible") {
      const bible = await updateWritingBible(projectId, {
        workType: currentState.bible.workType,
        targetReader: currentState.bible.targetReader,
        corePleasure: String(body.corePleasure ?? ""),
        protagonistDesire: String(body.protagonistDesire ?? ""),
        worldRules: String(body.worldRules ?? ""),
        goldenFingerRules: String(body.goldenFingerRules ?? ""),
        powerSystem: String(body.powerSystem ?? ""),
        narrativeTaboos: String(body.narrativeTaboos ?? ""),
        immutableSettings: String(body.immutableSettings ?? ""),
        styleGuide: String(body.styleGuide ?? "")
      });

      return Response.json({ bible });
    }

    if (action === "update_plot_state") {
      const plotState = await updatePlotState(projectId, {
        currentVolume: String(body.currentVolume ?? ""),
        currentMap: String(body.currentMap ?? ""),
        mainGoal: String(body.mainGoal ?? ""),
        shortTermGoal: String(body.shortTermGoal ?? ""),
        currentStage: String(body.currentStage ?? ""),
        currentEnemy: String(body.currentEnemy ?? ""),
        unresolvedQuestions: list(body.unresolvedQuestions),
        openThreads: list(body.openThreads),
        resolvedThreads: list(body.resolvedThreads),
        nextMilestones: list(body.nextMilestones),
        nextStageGoal: String(body.nextStageGoal ?? ""),
        powerSystemState: String(body.powerSystemState ?? ""),
        mapAndForces: String(body.mapAndForces ?? ""),
        resourceState: String(body.resourceState ?? ""),
        relationshipChanges: list(body.relationshipChanges)
      });

      return Response.json({ plotState });
    }

    if (action === "create_character") {
      const character = await createCharacterProfile(projectId, {
        name: String(body.name ?? ""),
        identity: String(body.identity ?? ""),
        currentGoal: String(body.currentGoal ?? ""),
        longTermGoal: String(body.longTermGoal ?? ""),
        secret: String(body.secret ?? ""),
        relationshipToProtagonist: String(body.relationshipToProtagonist ?? ""),
        attitude: String(body.attitude ?? ""),
        abilityBoundary: String(body.abilityBoundary ?? ""),
        voice: String(body.voice ?? ""),
        knownInformation: String(body.knownInformation ?? ""),
        unknownInformation: String(body.unknownInformation ?? ""),
        lastAppearance: String(body.lastAppearance ?? ""),
        currentState: String(body.currentState ?? "")
      });

      return Response.json({ character }, { status: 201 });
    }

    if (action === "update_character") {
      const character = await updateCharacterProfile(
        projectId,
        String(body.characterId ?? ""),
        {
          name: String(body.name ?? ""),
          identity: String(body.identity ?? ""),
          currentGoal: String(body.currentGoal ?? ""),
          longTermGoal: String(body.longTermGoal ?? ""),
          secret: String(body.secret ?? ""),
          relationshipToProtagonist: String(body.relationshipToProtagonist ?? ""),
          attitude: String(body.attitude ?? ""),
          abilityBoundary: String(body.abilityBoundary ?? ""),
          voice: String(body.voice ?? ""),
          knownInformation: String(body.knownInformation ?? ""),
          unknownInformation: String(body.unknownInformation ?? ""),
          lastAppearance: String(body.lastAppearance ?? ""),
          currentState: String(body.currentState ?? "")
        }
      );

      return Response.json({ character });
    }

    if (action === "delete_character") {
      const result = await deleteCharacterProfile(projectId, String(body.characterId ?? ""));
      return Response.json({ result });
    }

    if (action === "create_foreshadowing") {
      const foreshadowing = await createForeshadowing(projectId, {
        name: String(body.name ?? ""),
        plantedChapter: String(body.plantedChapter ?? ""),
        relatedCharacters: list(body.relatedCharacters),
        relatedLocation: String(body.relatedLocation ?? ""),
        status: status(body.status),
        expectedRevealChapter: String(body.expectedRevealChapter ?? ""),
        revealMethod: String(body.revealMethod ?? ""),
        hiddenInformation: String(body.hiddenInformation ?? "")
      });

      return Response.json({ foreshadowing }, { status: 201 });
    }

    if (action === "update_foreshadowing") {
      const foreshadowing = await updateForeshadowing(
        projectId,
        String(body.foreshadowingId ?? ""),
        {
          name: String(body.name ?? ""),
          plantedChapter: String(body.plantedChapter ?? ""),
          relatedCharacters: list(body.relatedCharacters),
          relatedLocation: String(body.relatedLocation ?? ""),
          status: status(body.status),
          expectedRevealChapter: String(body.expectedRevealChapter ?? ""),
          revealMethod: String(body.revealMethod ?? ""),
          hiddenInformation: String(body.hiddenInformation ?? "")
        }
      );

      return Response.json({ foreshadowing });
    }

    if (action === "delete_foreshadowing") {
      const result = await deleteForeshadowing(projectId, String(body.foreshadowingId ?? ""));
      return Response.json({ result });
    }

    if (action === "create_custom_graph") {
      const graph = await createCustomRelationGraph(projectId, {
        title: String(body.title ?? ""),
        description: String(body.description ?? "")
      });

      return Response.json({ graph }, { status: 201 });
    }

    if (action === "update_custom_graph") {
      const graph = await updateCustomRelationGraph(projectId, String(body.graphId ?? ""), {
        title: String(body.title ?? ""),
        description: String(body.description ?? "")
      });

      return Response.json({ graph });
    }

    if (action === "delete_custom_graph") {
      const result = await deleteCustomRelationGraph(projectId, String(body.graphId ?? ""));
      return Response.json({ result });
    }

    if (action === "custom_graph_create_node") {
      const result = await createCustomRelationGraphNode(projectId, String(body.graphId ?? ""), {
        label: String(body.text ?? body.title ?? ""),
        meta: String(body.meta ?? ""),
        sub: String(body.sub ?? ""),
        type: body.nodeType,
        tone: body.tone,
        targetNodeId: String(body.targetNodeId ?? ""),
        relationLabel: String(body.relationLabel ?? ""),
        relationTone: body.relationTone
      });

      return Response.json(result, { status: 201 });
    }

    if (action === "custom_graph_update_node") {
      const source = graphSource(body.source);

      if (source?.kind !== "customGraphNode") {
        throw new Error("这个自定义节点不存在或不能编辑");
      }

      const result = await updateCustomRelationGraphNode(projectId, source.graphId, source.nodeId, {
        label: String(body.title ?? ""),
        meta: String(body.meta ?? ""),
        sub: String(body.sub ?? body.text ?? ""),
        type: body.nodeType,
        tone: body.tone
      });

      return Response.json(result);
    }

    if (action === "custom_graph_delete_node") {
      const source = graphSource(body.source);

      if (source?.kind !== "customGraphNode") {
        throw new Error("这个自定义节点不存在或不能删除");
      }

      const graph = await deleteCustomRelationGraphNode(projectId, source.graphId, source.nodeId);
      return Response.json({ graph });
    }

    if (action === "custom_graph_create_edge") {
      const edge = await createCustomRelationGraphEdge(projectId, String(body.graphId ?? ""), {
        from: String(body.from ?? ""),
        to: String(body.to ?? ""),
        label: String(body.label ?? ""),
        tone: body.tone
      });

      return Response.json(edge, { status: 201 });
    }

    if (action === "custom_graph_delete_edge") {
      const graph = await deleteCustomRelationGraphEdge(projectId, String(body.graphId ?? ""), String(body.edgeId ?? ""));
      return Response.json({ graph });
    }

    if (action === "graph_create_item") {
      const itemType = String(body.itemType ?? "");
      const text = String(body.text ?? body.name ?? "").trim();

      if (!text) {
        throw new Error("新增内容不能为空");
      }

      if (itemType === "character") {
        const character = await createCharacterProfile(projectId, {
          name: text,
          identity: String(body.meta ?? "图谱新增人物"),
          currentGoal: "",
          longTermGoal: "",
          secret: "",
          relationshipToProtagonist: "",
          attitude: "",
          abilityBoundary: "",
          voice: "",
          knownInformation: "",
          unknownInformation: "",
          lastAppearance: "",
          currentState: String(body.sub ?? "")
        });

        return Response.json({ character }, { status: 201 });
      }

      if (itemType === "foreshadowing") {
        const foreshadowing = await createForeshadowing(projectId, {
          name: text,
          plantedChapter: String(body.meta ?? ""),
          relatedCharacters: list(body.relatedCharacters),
          relatedLocation: String(body.relatedLocation ?? ""),
          status: status(body.status),
          expectedRevealChapter: String(body.expectedRevealChapter ?? ""),
          revealMethod: String(body.revealMethod ?? ""),
          hiddenInformation: String(body.sub ?? "")
        });

        return Response.json({ foreshadowing }, { status: 201 });
      }

      const plotState = await updatePlotStateFromCurrent(projectId, (plotState) => {
        if (itemType === "mapAndForces" || itemType === "powerSystemState" || itemType === "resourceState") {
          plotState[itemType] = Array.from(new Set([...textLines(plotState[itemType]), text])).join("\n");
        }
        if (itemType === "relationshipChanges" || itemType === "openThreads" || itemType === "nextMilestones" || itemType === "unresolvedQuestions") {
          plotState[itemType] = Array.from(new Set([...plotState[itemType], text]));
        }
      });

      return Response.json({ plotState }, { status: 201 });
    }

    if (action === "graph_update_node") {
      const source = graphSource(body.source);

      if (!source) {
        throw new Error("这个节点暂不支持直接编辑");
      }

      const title = String(body.title ?? "").trim();
      const meta = String(body.meta ?? "").trim();
      const sub = String(body.sub ?? "").trim();
      const text = String(body.text ?? "").trim();

      if (source.kind === "character" || source.kind === "characterField") {
        const state = await getProjectWritingState(projectId);
        const character = state?.characters.find((item) => item.id === source.id);

        if (!character) {
          throw new Error("人物不存在或已被删除");
        }

        const characterInput = {
          name: source.kind === "character" ? title || character.name : character.name,
          identity: source.kind === "character" ? meta || character.identity : character.identity,
          currentGoal: character.currentGoal,
          longTermGoal: character.longTermGoal,
          secret: source.kind === "characterField" && source.field === "secret" ? text : character.secret,
          relationshipToProtagonist: source.kind === "characterField" && source.field === "relationshipToProtagonist" ? text : character.relationshipToProtagonist,
          attitude: character.attitude,
          abilityBoundary: source.kind === "characterField" && source.field === "abilityBoundary" ? text : character.abilityBoundary,
          voice: character.voice,
          knownInformation: source.kind === "characterField" && source.field === "knownInformation" ? text : character.knownInformation,
          unknownInformation: source.kind === "characterField" && source.field === "unknownInformation" ? text : character.unknownInformation,
          lastAppearance: character.lastAppearance,
          currentState: source.kind === "character"
            ? sub || character.currentState
            : source.field === "currentState"
              ? text
              : character.currentState
        };
        const updated = await updateCharacterProfile(projectId, source.id, characterInput);

        return Response.json({ character: updated });
      }

      if (source.kind === "foreshadowing") {
        const state = await getProjectWritingState(projectId);
        const foreshadowing = state?.foreshadowings.find((item) => item.id === source.id);

        if (!foreshadowing) {
          throw new Error("伏笔不存在或已被删除");
        }

        const updated = await updateForeshadowing(projectId, source.id, {
          name: title || foreshadowing.name,
          plantedChapter: foreshadowing.plantedChapter,
          relatedCharacters: foreshadowing.relatedCharacters,
          relatedLocation: foreshadowing.relatedLocation,
          status: status(body.status ?? foreshadowing.status),
          expectedRevealChapter: foreshadowing.expectedRevealChapter,
          revealMethod: foreshadowing.revealMethod,
          hiddenInformation: sub || foreshadowing.hiddenInformation
        });

        return Response.json({ foreshadowing: updated });
      }

      const plotState = await updatePlotStateFromCurrent(projectId, (plotState) => {
        if (source.kind === "plotStateField") {
          plotState[source.field] = text || title || meta;
        }
        if (source.kind === "plotStateLine") {
          plotState[source.field] = replaceLine(plotState[source.field], source.value, text || meta || title);
        }
        if (source.kind === "plotStateList") {
          plotState[source.field] = replaceListItem(plotState[source.field], source.value, text || meta || title);
        }
      });

      return Response.json({ plotState });
    }

    if (action === "graph_delete_node") {
      const source = graphSource(body.source);

      if (!source) {
        throw new Error("这个节点暂不支持直接删除");
      }

      if (source.kind === "character") {
        const result = await deleteCharacterProfile(projectId, source.id);
        return Response.json({ result });
      }

      if (source.kind === "foreshadowing") {
        const result = await deleteForeshadowing(projectId, source.id);
        return Response.json({ result });
      }

      if (source.kind === "characterField") {
        const state = await getProjectWritingState(projectId);
        const character = state?.characters.find((item) => item.id === source.id);

        if (!character) {
          throw new Error("人物不存在或已被删除");
        }

        const updated = await updateCharacterProfile(projectId, source.id, {
          name: character.name,
          identity: character.identity,
          currentGoal: character.currentGoal,
          longTermGoal: character.longTermGoal,
          secret: source.field === "secret" ? "" : character.secret,
          relationshipToProtagonist: source.field === "relationshipToProtagonist" ? "" : character.relationshipToProtagonist,
          attitude: character.attitude,
          abilityBoundary: source.field === "abilityBoundary" ? "" : character.abilityBoundary,
          voice: character.voice,
          knownInformation: source.field === "knownInformation" ? "" : character.knownInformation,
          unknownInformation: source.field === "unknownInformation" ? "" : character.unknownInformation,
          lastAppearance: character.lastAppearance,
          currentState: source.field === "currentState" ? "" : character.currentState
        });

        return Response.json({ character: updated });
      }

      const plotState = await updatePlotStateFromCurrent(projectId, (plotState) => {
        if (source.kind === "plotStateField") {
          plotState[source.field] = "";
        }
        if (source.kind === "plotStateLine") {
          plotState[source.field] = removeLine(plotState[source.field], source.value);
        }
        if (source.kind === "plotStateList") {
          plotState[source.field] = removeListItem(plotState[source.field], source.value);
        }
      });

      return Response.json({ plotState });
    }

    if (action === "cleanup_state") {
      const result = await cleanupProjectWritingState(projectId);
      return Response.json({ result });
    }

    return Response.json({ error: "未知状态动作" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "状态保存失败" },
      { status: 400 }
    );
  }
}
