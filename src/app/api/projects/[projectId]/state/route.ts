import {
  cleanupProjectWritingState,
  createCharacterProfile,
  createForeshadowing,
  deleteCharacterProfile,
  getProjectWritingState,
  updateCharacterProfile,
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

  try {
    if (action === "update_project") {
      const project = await updateProjectMetadata(projectId, {
        name: String(body.name ?? ""),
        genre: String(body.genre ?? ""),
        description: String(body.description ?? "")
      });

      return Response.json({ project });
    }

    if (action === "update_bible") {
      const bible = await updateWritingBible(projectId, {
        workType: String(body.workType ?? ""),
        targetReader: String(body.targetReader ?? ""),
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
      const rawStatus = String(body.status ?? "");
      const status = rawStatus === "partial" || rawStatus === "closed" ? rawStatus : "open";
      const foreshadowing = await createForeshadowing(projectId, {
        name: String(body.name ?? ""),
        plantedChapter: String(body.plantedChapter ?? ""),
        relatedCharacters: list(body.relatedCharacters),
        relatedLocation: String(body.relatedLocation ?? ""),
        status,
        expectedRevealChapter: String(body.expectedRevealChapter ?? ""),
        revealMethod: String(body.revealMethod ?? ""),
        hiddenInformation: String(body.hiddenInformation ?? "")
      });

      return Response.json({ foreshadowing }, { status: 201 });
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
