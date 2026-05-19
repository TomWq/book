import { attachAiTokenUsage, getAiTokenUsage, requestAiJson } from "@/lib/ai/client";

export type OutlineTemplateInput = {
  name: string;
  genre: string;
  openingHook: string;
  mainLoop: string;
  chapterPacing: string;
  formula: string;
  migrationAdvice: string;
};

export type OutlineVariables = {
  genre: string;
  protagonist: string;
  goldenFinger: string;
  worldBackground: string;
  pleasureDensity: string;
  romanceStrength: string;
  darknessLevel: string;
  targetReader: string;
  estimatedLength: string;
};

export type OutlineResult = {
  titleOptions: string[];
  logline: string;
  intro: string;
  templateInheritance: string[];
  variableMapping: string[];
  coreSellingPoints: string[];
  worldSetting: string;
  protagonist: string;
  characters: string[];
  first10Chapters: string[];
  first100Pacing: string;
  foreshadowingPlan: string[];
  pleasureDistribution: string;
};

export type OutlineRunResult = OutlineResult & {
  usedAi: boolean;
  usedFallback: boolean;
};

function fallbackOutline(template: OutlineTemplateInput, variables: OutlineVariables): OutlineResult {
  const genre = variables.genre || template.genre || "都市逆袭";
  const protagonist = variables.protagonist || "被轻视的隐藏强者";
  const goldenFinger = variables.goldenFinger || "系统";
  const worldBackground = variables.worldBackground || `${genre}背景`;
  const pleasureDensity = variables.pleasureDensity || template.chapterPacing || "2-3章一个小爽点";
  const romanceStrength = variables.romanceStrength || "弱线";
  const darknessLevel = variables.darknessLevel || "中等";
  const targetReader = variables.targetReader || "网文读者";
  const estimatedLength = variables.estimatedLength || "80-120万字";

  return {
    titleOptions: [
      `${genre}：${protagonist}从退场开始翻盘`,
      `开局被看轻，我靠${goldenFinger}改写命运`,
      `所有人都误会我，直到${goldenFinger}觉醒`
    ],
    logline: `${protagonist}在被误判和压制的开局中获得${goldenFinger}，沿着“${template.formula}”的节奏逐步升级，并把旧局面一层层掀开。`,
    intro: `这是一本面向${targetReader}的${genre}新书方案。故事保留模板中的情绪曲线：先制造压制与误判，再释放反击、收益和新麻烦，并控制${pleasureDensity}的节奏，同时保持${romanceStrength}和${darknessLevel}强度。`,
    templateInheritance: [
      `主循环：${template.mainLoop}`,
      `节奏公式：${template.chapterPacing}`,
      `故事公式：${template.formula}`
    ],
    variableMapping: [
      `题材变量：${genre}`,
      `主角变量：${protagonist}`,
      `金手指变量：${goldenFinger}`,
      `世界背景变量：${worldBackground}`,
      `爽点密度：${pleasureDensity}`,
      `感情线强度：${romanceStrength}`,
      `黑暗程度：${darknessLevel}`,
      `目标读者：${targetReader}`,
      `预计篇幅：${estimatedLength}`
    ],
    coreSellingPoints: [
      `沿用模板主循环：${template.mainLoop}`,
      `核心爽点公式：${template.formula}`,
      `金手指：${goldenFinger}`,
      `主角模型：${protagonist}`,
      `世界背景：${worldBackground}`
    ],
    worldSetting: `${worldBackground}下，资源、身份和信息差决定人物地位；${darknessLevel}压迫感和${romanceStrength}情绪线共同构成持续反馈，主角需要通过${goldenFinger}不断打开更高层冲突。`,
    protagonist,
    characters: ["主角", "第一压制者", "误判主角的旁观者", "提供关键资源的盟友", "更高层敌人"],
    first10Chapters: [
      "第1章：压制开局，主角被集体误判。",
      `第2章：${goldenFinger}出现，但只给出有限帮助。`,
      "第3章：第一次小反击，旁观者态度出现松动。",
      "第4章：反派加码，主角获得关键线索或资源。",
      "第5章：主角用信息差反压对手。",
      "第6章：新敌人登场，冲突层级抬高。",
      "第7章：主角获得阶段性收益，但留下隐患。",
      "第8章：伏笔第一次显形，旧事牵出更大势力。",
      "第9章：大爽点前的压制加深。",
      "第10章：集中打脸，主角地位第一次明显上升。"
    ],
    first100Pacing:
      `1-10章完成开局压制和第一次反击；11-30章保持${pleasureDensity}；31-60章切入更高层势力；61-100章完成一次地图或势力升级，目标篇幅约${estimatedLength}。`,
    foreshadowingPlan: [
      "第1章埋主角旧身份或旧伤。",
      "第5章埋金手指限制。",
      "第18章埋更高层敌人线索。",
      "第45章回收第一条身份伏笔。"
    ],
    pleasureDistribution:
      pleasureDensity || "2-3章一个小爽点，8-10章一个大爽点，30章左右完成一次冲突层级升级。"
  };
}

export async function generateOutlineWithAi(
  template: OutlineTemplateInput,
  variables: OutlineVariables,
  useAi: boolean
): Promise<OutlineRunResult> {
  if (!useAi) {
    return {
      ...fallbackOutline(template, variables),
      usedAi: false,
      usedFallback: true
    };
  }

  try {
    const response = await requestAiJson<Partial<OutlineResult>>({
      messages: [
        {
          role: "system",
          content:
            "你是网文新书策划助手。请严格输出 JSON，不要输出多余说明。你要把一个成功模板迁移到新题材，生成可执行的新书大纲，并明确区分模板继承内容与新题材变量。"
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              template,
              variables,
              outputSchema: {
                titleOptions: "string[]",
                logline: "string",
                intro: "string",
                templateInheritance: "string[]",
                variableMapping: "string[]",
                coreSellingPoints: "string[]",
                worldSetting: "string",
                protagonist: "string",
                characters: "string[]",
                first10Chapters: "string[]",
                first100Pacing: "string",
                foreshadowingPlan: "string[]",
                pleasureDistribution: "string"
              }
            },
            null,
            2
          )
        }
      ],
      temperature: 0.4,
      maxTokens: 2200
    });
    const fallback = fallbackOutline(template, variables);

    return attachAiTokenUsage({
      titleOptions: Array.isArray(response.titleOptions) ? response.titleOptions : fallback.titleOptions,
      logline: response.logline || fallback.logline,
      intro: response.intro || fallback.intro,
      templateInheritance: Array.isArray(response.templateInheritance)
        ? response.templateInheritance
        : fallback.templateInheritance,
      variableMapping: Array.isArray(response.variableMapping)
        ? response.variableMapping
        : fallback.variableMapping,
      coreSellingPoints: Array.isArray(response.coreSellingPoints)
        ? response.coreSellingPoints
        : fallback.coreSellingPoints,
      worldSetting: response.worldSetting || fallback.worldSetting,
      protagonist: response.protagonist || fallback.protagonist,
      characters: Array.isArray(response.characters) ? response.characters : fallback.characters,
      first10Chapters: Array.isArray(response.first10Chapters)
        ? response.first10Chapters
        : fallback.first10Chapters,
      first100Pacing: response.first100Pacing || fallback.first100Pacing,
      foreshadowingPlan: Array.isArray(response.foreshadowingPlan)
        ? response.foreshadowingPlan
        : fallback.foreshadowingPlan,
      pleasureDistribution: response.pleasureDistribution || fallback.pleasureDistribution,
      usedAi: true,
      usedFallback: false
    }, getAiTokenUsage(response));
  } catch {
    return {
      ...fallbackOutline(template, variables),
      usedAi: false,
      usedFallback: true
    };
  }
}
