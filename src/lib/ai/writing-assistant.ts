import { requestAiJson, requestAiTextStream } from "@/lib/ai/client";
import type {
  StoredCharacterProfile,
  StoredChapterLedger,
  StoredForeshadowing,
  StoredPlotState,
  StoredProject,
  StoredWritingBible
} from "@/lib/project-types";

export type WritingAssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type WritingAssistantProjectContext = {
  project: StoredProject;
  bible: StoredWritingBible;
  plotState: StoredPlotState;
  characters: StoredCharacterProfile[];
  foreshadowings: StoredForeshadowing[];
  ledgers: StoredChapterLedger[];
};

export type WritingAssistantReply = {
  answer: string;
  refused: boolean;
  suggestions: string[];
};

function shortText(value: string, maxLength = 900) {
  const text = value.trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function listLines(items: string[], maxItems = 8) {
  return items.filter(Boolean).slice(0, maxItems).join("；");
}

const ASSISTANT_JSON_MAX_TOKENS = 2200;
const ASSISTANT_STREAM_MAX_TOKENS = 3600;

function buildProjectContext(context?: WritingAssistantProjectContext | null) {
  if (!context) {
    return "当前没有绑定具体作品。只能提供通用小说创作、拆书、设定和网文写作建议。";
  }

  const { project, bible, plotState } = context;
  const characters = context.characters.slice(0, 8).map((character) => [
    character.name,
    character.identity,
    character.relationshipToProtagonist,
    character.currentGoal,
    character.currentState
  ].filter(Boolean).join(" / "));
  const foreshadowings = context.foreshadowings.slice(0, 8).map((item) => [
    item.name,
    item.status,
    item.hiddenInformation
  ].filter(Boolean).join(" / "));
  const ledgers = context.ledgers.slice(0, 5).map((ledger) => [
    `第${ledger.chapterNumber}章`,
    ledger.title,
    listLines(ledger.events, 4),
    ledger.cliffhanger ? `钩子：${ledger.cliffhanger}` : ""
  ].filter(Boolean).join(" / "));

  return JSON.stringify({
    project: {
      name: project.name,
      genre: project.genre,
      description: shortText(project.description, 500)
    },
    bible: {
      workType: bible.workType,
      targetReader: bible.targetReader,
      corePleasure: shortText(bible.corePleasure),
      protagonistDesire: shortText(bible.protagonistDesire),
      worldRules: shortText(bible.worldRules),
      goldenFingerRules: shortText(bible.goldenFingerRules),
      powerSystem: shortText(bible.powerSystem),
      narrativeTaboos: shortText(bible.narrativeTaboos),
      immutableSettings: shortText(bible.immutableSettings),
      styleGuide: shortText(bible.styleGuide)
    },
    plotState: {
      currentVolume: plotState.currentVolume,
      currentMap: plotState.currentMap,
      mainGoal: plotState.mainGoal,
      shortTermGoal: plotState.shortTermGoal,
      currentStage: plotState.currentStage,
      currentEnemy: plotState.currentEnemy,
      nextStageGoal: plotState.nextStageGoal,
      openThreads: plotState.openThreads.slice(0, 8),
      unresolvedQuestions: plotState.unresolvedQuestions.slice(0, 8),
      nextMilestones: plotState.nextMilestones.slice(0, 8),
      powerSystemState: shortText(plotState.powerSystemState, 500),
      resourceState: shortText(plotState.resourceState, 500)
    },
    characters,
    foreshadowings,
    recentLedgers: ledgers
  }, null, 2);
}

export async function generateWritingAssistantReply(input: {
  question: string;
  history?: WritingAssistantChatMessage[];
  projectContext?: WritingAssistantProjectContext | null;
}) {
  const question = input.question.trim();
  const history = (input.history ?? []).slice(-8).map((message) => ({
    role: message.role,
    content: shortText(message.content, 700)
  }));

  const response = await requestAiJson<Partial<WritingAssistantReply>>({
    messages: [
      {
        role: "system",
        content: [
          "你是 AI 网文写作助手内置的小说创作顾问，只能回答小说创作、网文写作、拆书分析、故事设定、人物动机、剧情推进、章节节奏、爽点设计、伏笔管理、创作圣经、一致性审稿、减少 AI 味、起名、简介、大纲相关问题。",
          "起名范围包括书名、角色名、势力名、地名、组织名、功法名、技能名、道具名、章节名、卷名。起名时必须结合题材、目标读者、平台风格和当前项目设定，不要只把标签词拼起来。",
          "如果用户询问小说创作无关内容，例如天气、股票、编程、法律、医疗、旅行、通用百科、闲聊八卦等，必须礼貌拒答，并引导用户改问小说创作问题。",
          "回答要具体、可执行，优先结合当前项目上下文；不要编造项目里不存在的设定。如果上下文不足，要明确说需要用户补充哪类信息。",
          "不要直接改写数据库或声称已经保存项目状态。你只能提供建议。",
          "严格输出 JSON：{ answer: string, refused: boolean, suggestions: string[] }。suggestions 给 2-4 个可继续追问的问题。",
          "answer 可以使用少量 Markdown 标题、列表和加粗，但不要输出复杂 Markdown 表格；需要对比时优先用分组列表。",
          "如果用户的问题比较宽泛，先给最关键的 3-5 条可执行建议，不要写百科式长文；结尾可以提示用户继续追问某一项。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          scope: "novel_writing_only",
          currentProjectContext: buildProjectContext(input.projectContext),
          conversationHistory: history,
          userQuestion: question
        }, null, 2)
      }
    ],
    temperature: 0.45,
    maxTokens: ASSISTANT_JSON_MAX_TOKENS
  });

  return {
    answer: String(response.answer ?? "").trim() || "我暂时没有生成有效回答，你可以换一种方式描述你的创作问题。",
    refused: Boolean(response.refused),
    suggestions: Array.isArray(response.suggestions)
      ? response.suggestions.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : []
  };
}

export async function* streamWritingAssistantReply(input: {
  question: string;
  history?: WritingAssistantChatMessage[];
  projectContext?: WritingAssistantProjectContext | null;
}) {
  const question = input.question.trim();
  const history = (input.history ?? []).slice(-8).map((message) => ({
    role: message.role,
    content: shortText(message.content, 700)
  }));

  yield* requestAiTextStream({
    messages: [
      {
        role: "system",
        content: [
          "你是 AI 网文写作助手内置的小说创作顾问，只能回答小说创作、网文写作、拆书分析、故事设定、人物动机、剧情推进、章节节奏、爽点设计、伏笔管理、创作圣经、一致性审稿、减少 AI 味、起名、简介、大纲相关问题。",
          "起名范围包括书名、角色名、势力名、地名、组织名、功法名、技能名、道具名、章节名、卷名。起名时必须结合题材、目标读者、平台风格和当前项目设定，不要只把标签词拼起来。",
          "如果用户询问小说创作无关内容，例如天气、股票、编程、法律、医疗、旅行、通用百科、闲聊八卦等，必须礼貌拒答，并引导用户改问小说创作问题。",
          "回答要具体、可执行，优先结合当前项目上下文；不要编造项目里不存在的设定。如果上下文不足，要明确说需要用户补充哪类信息。",
          "不要直接改写数据库或声称已经保存项目状态。你只能提供建议。",
          "直接输出给用户看的中文回答，不要输出 JSON。可以使用少量 Markdown 标题、列表和加粗，但不要输出复杂 Markdown 表格；需要对比时优先用分组列表。",
          "如果用户的问题比较宽泛，先给最关键的 3-5 条可执行建议，不要写百科式长文；结尾可以提示用户继续追问某一项。避免冗长铺垫。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          scope: "novel_writing_only",
          currentProjectContext: buildProjectContext(input.projectContext),
          conversationHistory: history,
          userQuestion: question
        }, null, 2)
      }
    ],
    temperature: 0.45,
    maxTokens: ASSISTANT_STREAM_MAX_TOKENS
  });
}
