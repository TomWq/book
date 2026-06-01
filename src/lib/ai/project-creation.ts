import {
  attachAiTokenUsage,
  getAiTokenUsage,
  requestAiJson
} from "@/lib/ai/client";

export type ProjectCreationAssistAction = "titles" | "protagonists" | "description";
export type TitleNamingStyle = "fanqie" | "qidian";
export type TagTaxonomyStyle = "fanqie" | "qidian";
export type DescriptionWritingStyle = "fanqie" | "qidian";
export type WorkLengthType = "short" | "medium" | "long" | "epic";
export type ProjectCreationCharacterRole = "男主" | "女主" | "男配" | "女配";
export type ProjectCreationCharacterInput = {
  role: ProjectCreationCharacterRole;
  name?: string;
};

export type ProjectCreationAssistInput = {
  action: ProjectCreationAssistAction;
  name?: string;
  titleConcept?: string;
  genre?: string;
  targetReader?: string;
  tags?: string[];
  protagonistNames?: string[];
  protagonistCharacters?: ProjectCreationCharacterInput[];
  coreSellingPoint?: string;
  goldenFinger?: string;
  openingHook?: string;
  workLengthType?: WorkLengthType;
  targetTotalWords?: number;
  description?: string;
  titleNamingStyle?: TitleNamingStyle;
  tagTaxonomyStyle?: TagTaxonomyStyle;
  descriptionWritingStyle?: DescriptionWritingStyle;
  avoidTitles?: string[];
};

export type ProjectCreationAssistResult = {
  titles: string[];
  protagonistNames: string[];
  protagonistCharacters: ProjectCreationCharacterInput[];
  description: string;
};

const maxProjectCharacters = 20;

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function cleanTitleText(value: string) {
  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[“"‘'「『【\[（(]+/, "")
    .replace(/[”"’'」』】\]）)]+$/, "")
    .trim();
}

function titleFingerprint(value: string) {
  return cleanTitleText(value)
    .replace(/[《》“”"‘'「」『』【】[\]（）()：:，,。.!！?？、\s_-]+/g, "")
    .toLowerCase();
}

function titleBigrams(value: string) {
  const chars = Array.from(titleFingerprint(value));

  if (chars.length <= 1) {
    return chars;
  }

  return chars.slice(0, -1).map((char, index) => `${char}${chars[index + 1]}`);
}

function titleSimilarity(a: string, b: string) {
  const left = titleBigrams(a);
  const right = titleBigrams(b);

  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightCounts = new Map<string, number>();
  right.forEach((item) => rightCounts.set(item, (rightCounts.get(item) ?? 0) + 1));
  const overlap = left.reduce((sum, item) => {
    const count = rightCounts.get(item) ?? 0;

    if (count <= 0) {
      return sum;
    }

    rightCounts.set(item, count - 1);
    return sum + 1;
  }, 0);

  return (2 * overlap) / (left.length + right.length);
}

function isTitleTooClose(candidate: string, avoidTitle: string) {
  const candidateKey = titleFingerprint(candidate);
  const avoidKey = titleFingerprint(avoidTitle);

  if (!candidateKey || !avoidKey) {
    return false;
  }

  if (candidateKey === avoidKey) {
    return true;
  }

  if ((candidateKey.length >= 4 || avoidKey.length >= 4) && (candidateKey.includes(avoidKey) || avoidKey.includes(candidateKey))) {
    return true;
  }

  return titleSimilarity(candidateKey, avoidKey) >= 0.72;
}

function uniqueTitles(titles: string[], avoidTitles: string[]) {
  return titles.reduce<string[]>((result, title) => {
    const cleanTitle = cleanTitleText(title);

    if (!cleanTitle) {
      return result;
    }

    const isRepeated = result.some((item) => isTitleTooClose(cleanTitle, item));
    const isAvoided = avoidTitles.some((item) => isTitleTooClose(cleanTitle, item));

    if (!isRepeated && !isAvoided) {
      result.push(cleanTitle);
    }

    return result;
  }, []);
}

function titleCharacterLength(value: string) {
  return Array.from(value.replace(/\s/g, "")).length;
}

type TitleQualityOptions = {
  style: TitleNamingStyle;
  titleConcept?: string;
  directLabelTerms?: string[];
  strict?: boolean;
};

function titleQualityScore(title: string, options: TitleQualityOptions) {
  const cleanTitle = cleanTitleText(title);
  const compactTitle = cleanTitle.replace(/\s+/g, "");
  const compactFingerprint = titleFingerprint(cleanTitle);
  const length = titleCharacterLength(cleanTitle);
  const titleConceptFingerprint = titleFingerprint(options.titleConcept ?? "");
  const hardRejectPatterns = [
    /我的?[^，,：:]{0,10}(修为|工资|月薪|境界|系统|金手指)/,
    /(使我|让我|令我)/,
    /我[^，,：:]{0,8}(成仙|暴涨|起飞|渡劫|逆袭|无敌)/,
    /(工资条上写着|上写着|决定境界|决定修为|挂钩)/,
    /(指南|手册|攻略|速成)$/,
    /[：:][^：:]*[、，,][^：:]*[、，,]/,
    /^(打工|加班).{0,6}(使|让|令)?我/
  ];

  if (!compactTitle || !compactFingerprint) {
    return -100;
  }

  if (options.style === "qidian" && (length < 2 || length > 12)) {
    return -90;
  }

  if (options.style === "fanqie" && (length < 4 || length > 24)) {
    return -80;
  }

  if (hardRejectPatterns.some((pattern) => pattern.test(compactTitle))) {
    return -70;
  }

  let score = 100;

  if (/[，,。.!！?？；;]/.test(cleanTitle)) {
    score -= 18;
  }

  if (/[：:]/.test(cleanTitle)) {
    score -= 8;
  }

  if (/(^我|我的|我靠|我在|我把|我被)/.test(compactTitle)) {
    score -= 32;
  }

  if (/(打工使我|加班使我|月薪百万|工资条|暴涨|杀疯|起飞|震惊|竟然|居然)/.test(compactTitle)) {
    score -= 24;
  }

  if (/(打工人|打工|加班|工资|月薪)/.test(compactTitle)) {
    score -= 10;
  }

  if (/(了|啦|吗|吧|啊)$/.test(compactTitle)) {
    score -= 14;
  }

  if (titleConceptFingerprint.length >= 8 && titleConceptFingerprint.includes(compactFingerprint)) {
    score -= 26;
  }

  const directLabelHits = (options.directLabelTerms ?? [])
    .map((item) => titleFingerprint(item))
    .filter((item) => item.length >= 2 && compactFingerprint.includes(item)).length;

  if (directLabelHits >= 2) {
    score -= 18;
  } else if (directLabelHits === 1 && compactFingerprint.length <= 6) {
    score -= 12;
  }

  if (options.style === "qidian") {
    if (length >= 3 && length <= 8) {
      score += 8;
    }

    if (/[录传纪书令图谱]/.test(compactTitle)) {
      score += 4;
    }
  } else {
    if (length >= 8 && length <= 18) {
      score += 7;
    }

    if (/(开局|觉醒|绑定|破境|反派|天命|长生|通天|万界|幕后|被迫|全宗|全城)/.test(compactTitle)) {
      score += 4;
    }
  }

  return score;
}

function normalizeTitles(titles: string[], avoidTitles: string[], qualityOptions?: TitleQualityOptions) {
  const uniqueCandidates = uniqueTitles(titles, avoidTitles);

  if (!qualityOptions) {
    return uniqueCandidates.slice(0, 8);
  }

  const scoredTitles = uniqueCandidates
    .map((title, index) => ({
      title,
      index,
      score: titleQualityScore(title, qualityOptions)
    }))
    .filter((item) => !qualityOptions.strict || item.score >= 62)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  return scoredTitles.map((item) => item.title).slice(0, 8);
}

function normalizeResult(
  value: Partial<ProjectCreationAssistResult>,
  avoidTitles: string[] = [],
  titleQualityOptions?: TitleQualityOptions
) {
  return attachAiTokenUsage({
    titles: normalizeTitles(list(value.titles), avoidTitles, titleQualityOptions),
    protagonistNames: list(value.protagonistNames).slice(0, maxProjectCharacters),
    protagonistCharacters: normalizeCharacters(value.protagonistCharacters),
    description: String(value.description ?? "").trim()
  }, getAiTokenUsage(value));
}

function normalizeCharacterRole(value: unknown, fallback: ProjectCreationCharacterRole = "男主"): ProjectCreationCharacterRole {
  return value === "男主" || value === "女主" || value === "男配" || value === "女配" ? value : fallback;
}

function normalizeCharacters(value: unknown): ProjectCreationCharacterInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item, index): ProjectCreationCharacterInput[] => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const raw = item as { role?: unknown; name?: unknown };
      const name = String(raw.name ?? "").trim();

      if (!name) {
        return [];
      }

      return [{
        role: normalizeCharacterRole(raw.role, index === 1 ? "女主" : "男主"),
        name
      }];
    })
    .slice(0, maxProjectCharacters);
}

function titleCraftRules(titleNamingStyle: TitleNamingStyle) {
  const sharedRules = [
    "书名不是标签改写。genre、tags、goldenFinger 是幕后创作约束，不是必须出现在书名里的词。",
    "优先把标签翻译成一个具体的读者钩子：主角处境、第一轮危机、反差身份、关键动作、隐藏秘密或命运问题。",
    "默认不要直接使用用户选择的主分类、题材标签、主题标签、角色标签、金手指类型词；除非用户在 titleConcept 中明确要求某个词必须进标题。",
    "不要把主分类、题材、角色标签、金手指类型直接连成一个标题。",
    "关系类标签只能转成关系张力、阵营牵引或剧情矛盾，不要写成低质占有式卖点。",
    "性格类标签不要直接写成标签词，要体现为行动方式、选择代价、布局方式或剧情结果。",
    "高频类型词可以使用，但不能成为标题唯一卖点；每个标题都要有一个具体新信息。",
    "同一批 6 个标题必须走不同卖点方向，不要围绕同一个名词反复变体。",
    "严禁把用户构思压缩成低质梗句、口号句、吐槽句或关键词拼接句。",
    "严禁这类书名质感：打工使我渡劫、我的修为和工资挂钩、月薪百万，我成仙了、工资条上写着：筑基、金丹、元婴、打工人修仙指南、加班使我修为暴涨。",
    "遇到“打工/工资/月薪/修为/境界”这类直白设定时，要转成更有书架感的概念、制度、命运或冲突，不要直接写成段子。"
  ];

  return titleNamingStyle === "qidian"
    ? [
        ...sharedRules,
        "起点风格要短、稳、耐看，优先 2-8 个中文字符，最多 12 字；用意象、职业、制度、命运主题和世界观名词承载卖点。",
        "起点短标题也不能空泛，不要只生成类型词或角色标签词。",
        "起点短标题可以从制度、暗线、身份、命运、城市规则、能力代价里取意象；不要照搬这些规则里的词。"
      ]
    : [
        ...sharedRules,
        "番茄风格可以更直给，但要像一个剧情钩子，而不是标签清单。建议 8-20 个中文字符，最多 24 字。",
        "番茄标题优先使用“处境 + 反差动作 + 爽点后果”的结构，可以用冒号，但冒号前后都必须有剧情信息。",
        "番茄标题可以从开局误判、第一次反击、隐藏身份、规则漏洞、关系张力里找钩子；不要照搬这些规则里的词。"
      ];
}

function descriptionTask(descriptionWritingStyle: DescriptionWritingStyle) {
  return descriptionWritingStyle === "qidian"
    ? [
        "根据已有设想润色或扩写作品简介。风格偏起点：设定质感更强，语气更稳，少喊口号，少用标签堆叠。",
        "简介要交代主角身份、世界规则、开局异常、核心矛盾和长期悬念；可以保留爽点，但不要写成平台标签广告。",
        "不要用【标签+标签+卖点】开头，不要使用“爆爽”“杀疯了”“全员震惊”等番茄式强刺激表达。",
        "控制在 180-420 字，不能低俗、血腥、违法，不能照搬已有作品。只返回 description 字段，不要额外字段。"
      ].join("")
    : [
        "根据已有设想润色或扩写作品简介。风格偏番茄小说：开头可用【标签+标签+卖点】概括，随后交代主角处境、危机、金手指/关键机制、第一轮爽点和追读钩子。",
        "表达要直接、强冲突、强期待，让读者迅速知道爽点在哪里。",
        "控制在 180-420 字，不能低俗、血腥、违法，不能照搬已有作品。只返回 description 字段，不要额外字段。"
      ].join("");
}

function descriptionStyleRules(descriptionWritingStyle: DescriptionWritingStyle) {
  return descriptionWritingStyle === "qidian"
    ? [
        "简介风格偏起点：重设定可信度、长期悬念、主角选择和世界规则。",
        "少用强营销语、少用感叹句，避免把简介写成短视频推文。",
        "可以制造期待，但要通过问题、代价、秘密和世界变化来制造期待。"
      ]
    : [
        "简介风格偏番茄：开头快、卖点清楚、冲突直给，尽快抛出压制、反击和追读钩子。",
        "可以使用更强的情绪词和节奏句，但不要低俗擦边或夸张到失真。",
        "读完第一屏要知道主角为什么被压、靠什么翻盘、后面还有什么更大的爽点。"
      ];
}

export async function generateProjectCreationAssistWithAi(input: ProjectCreationAssistInput) {
  const titleNamingStyle = input.titleNamingStyle === "qidian" ? "qidian" : "fanqie";
  const tagTaxonomyStyle = input.tagTaxonomyStyle === "qidian" ? "qidian" : "fanqie";
  const descriptionWritingStyle = input.descriptionWritingStyle === "qidian" ? "qidian" : "fanqie";
  const characterSlots = (input.protagonistCharacters?.length
    ? input.protagonistCharacters
    : (input.protagonistNames ?? []).map((name, index) => ({ role: normalizeCharacterRole(index === 1 ? "女主" : "男主"), name }))
  )
    .map((item, index) => ({
      role: normalizeCharacterRole(item.role, index === 1 ? "女主" : "男主"),
      name: String(item.name ?? "").trim()
    }))
    .slice(0, maxProjectCharacters);
  const requestedCharacterSlots = characterSlots.length > 0
    ? characterSlots
    : [
        { role: "男主" as const, name: "" },
        { role: "女主" as const, name: "" }
      ];
  const actionConfig: Record<
    ProjectCreationAssistAction,
    {
      task: string;
      outputSchema: Record<string, string>;
      temperature: number;
      maxTokens: number;
    }
  > = {
    titles: {
      task:
        titleNamingStyle === "qidian"
          ? "先在内部生成至少 12 个方向并质检，最后只返回 6 个中文网文新书名。风格偏起点：更短、更传统、更有类型辨识度和意象感，优先 2-8 个中文字符，最多 12 字。可以使用职业身份、世界观概念、核心意象、命运主题来命名，但严禁照搬任何现有作品名、角色名、专有名词。避免番茄式长句、第一人称设问、逗号标题、强行解释剧情的标题。"
          : "先在内部生成至少 12 个方向并质检，最后只返回 6 个中文网文新书名。风格偏番茄小说：标题本身要直接带出人物处境、反差动作、爽点后果或追读悬念。不要把构思原句压缩成标题，不要照搬任何现有作品名、角色名、专有名词。标题可以比起点更直给，但不要写成一句简介、吐槽句或短视频段子；建议 8-20 个中文字符，最多 24 字。",
      outputSchema: {
        titles: "string[]"
      },
      temperature: 0.85,
      maxTokens: 1200
    },
    protagonists: {
      task:
        "只为新建作品表单里的人物栏生成中文角色名。必须逐行理解 characterSlots 的 role：男主/男配只能生成男性气质姓名，女主/女配只能生成女性气质姓名；不要把女主、女配生成男性名。已有 name 的行不要强行改名，空白行必须给出对应姓名。名字要像中文网文角色，易读、好记、有辨识度，避免生僻字堆砌，避免像真实公众人物。",
      outputSchema: {
        protagonistCharacters: "Array<{ role: '男主' | '女主' | '男配' | '女配'; name: string }>",
        protagonistNames: "string[]"
      },
      temperature: 0.8,
      maxTokens: 520
    },
    description: {
      task: descriptionTask(descriptionWritingStyle),
      outputSchema: {
        description: "string"
      },
      temperature: 0.65,
      maxTokens: 1000
    }
  };
  const currentTask = actionConfig[input.action];
  const titleSeedName = input.action === "titles" && input.titleConcept?.trim() ? "" : (input.name ?? "").trim();
  const directLabelTerms =
    input.action === "titles" && !input.titleConcept?.trim()
      ? [input.genre, ...(input.tags ?? []), input.goldenFinger]
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      : [];
  const styleRules = [
    titleNamingStyle === "qidian"
      ? "书名优先短、稳、耐看，有类型气质和记忆点；不要把完整剧情塞进标题，不要使用“我都……怎么……”这类番茄长标题句式。"
      : "书名可以比起点更直给，突出强冲突、强卖点、强反差，但不要写成一句简介，也不要长到像推文标题。",
    input.action === "titles" && input.titleConcept?.trim()
      ? "如果提供了起名构思 titleConcept，优先依据它来命名；不要把它原句压缩成标题，也不要让上一轮生成出的 title 反过来主导这一轮。"
      : null,
    input.action === "titles"
      ? `必须理解 genre、targetReader 和 tags 背后的读者期待。当前标签体系是${tagTaxonomyStyle === "qidian" ? "起点分类，genre 是大类，tags 是子类" : "番茄分类，genre 是主分类，tags 是主题/角色"}；默认不要把这些标签词直接写进书名，优先体现冲突、场景、动作、秘密和追读问题。`
      : null,
    ...(input.action === "titles" ? titleCraftRules(titleNamingStyle) : []),
    input.action === "titles" && input.titleConcept?.trim()
      ? "如果构思里出现现成作品名、角色名或专有名词，不要直接照搬进书名，要转成原创意象、身份或冲突。"
      : null,
    input.action === "titles" && input.avoidTitles?.length
      ? "用户正在重新生成书名。必须避开 avoidTitles 中已经出现过的标题和核心名词，不要只做同义改写或换序。"
      : null,
    directLabelTerms.length > 0
      ? "directLabelTerms 是用户选择的分类/标签原词。生成书名时默认不要直接使用这些词，要转成原创意象、动作、场景或冲突。"
      : null,
    input.action === "description"
      ? "简介要先让读者知道主角是谁、被什么压住、靠什么翻盘、后面有什么更大期待。"
      : "本次只处理当前任务，不要顺手补充其他字段。",
    input.action === "description" && input.targetTotalWords
      ? `简介需要符合当前作品体量：${input.workLengthType ?? "medium"}，目标约 ${Math.round(input.targetTotalWords / 10000)} 万字；不要把短篇写成长篇无限升级，也不要把长篇写成很快收尾。`
      : null,
    input.action === "protagonists"
      ? [
          "人物取名必须按 requestedCharacterSlots 顺序返回 protagonistCharacters。",
          "每个返回项都要包含 role 和 name；protagonistNames 也要按相同顺序给出 name。",
          "男主、男配使用男性姓名；女主、女配使用女性姓名。不要让女主/女配出现明显男性名。",
          "不同角色的名字要有差异，不要同音堆叠，不要套用同一个姓氏模板。"
        ].join("")
      : null,
    ...(input.action === "description" ? descriptionStyleRules(descriptionWritingStyle) : []),
    "如果用户已经输入内容，请保留核心意思并增强网文吸引力。",
    "所有输出必须服务当前题材和标签，不要生成泛泛模板话。"
  ].filter((item): item is string => Boolean(item));

  const mergedAvoidTitles = (extraAvoidTitles: string[] = []) =>
    Array.from(new Set([...(input.avoidTitles ?? []), ...extraAvoidTitles].map(cleanTitleText).filter(Boolean))).slice(0, 100);
  const titleQualityOptions: TitleQualityOptions = {
    style: titleNamingStyle,
    titleConcept: input.titleConcept,
    directLabelTerms,
    strict: true
  };
  const buildMessages = (compact = false, extraAvoidTitles: string[] = []) => [
      {
        role: "system" as const,
        content:
          "你是中文网文平台的新书立项编辑，擅长番茄、起点、七猫等平台常见的书名、简介和主角命名包装。请严格输出 JSON，不要输出解释。你的目标是帮作者生成原创方案，不能复制已有作品名、简介、角色和专有设定。"
      },
      {
        role: "user" as const,
        content: JSON.stringify(
          {
            task: currentTask.task,
            currentProject: {
              name: titleSeedName,
              titleConcept: input.titleConcept,
              genre: input.genre,
              targetReader: input.targetReader,
              tags: input.tags ?? [],
              protagonistNames: input.protagonistNames ?? [],
              characterSlots,
              requestedCharacterSlots,
              coreSellingPoint: input.coreSellingPoint,
              goldenFinger: input.goldenFinger,
              openingHook: input.openingHook,
              workLengthType: input.workLengthType,
              targetTotalWords: input.targetTotalWords,
              description: input.description,
              titleNamingStyle,
              tagTaxonomyStyle,
              descriptionWritingStyle,
              avoidTitles: mergedAvoidTitles(extraAvoidTitles),
              directLabelTerms
            },
            styleRules,
            retryMode: compact ? "compact_title_retry" : "standard",
            compactRetryRules: compact
              ? [
                  "只返回 titles 数组，不要返回其他字段。",
                  titleNamingStyle === "qidian"
                    ? "每个标题控制在 2-10 个中文字符，绝对不要超过 12 个中文字符。"
                    : "每个标题控制在 8-18 个中文字符，绝对不要超过 24 个中文字符。",
                  "不要复述 titleConcept 的原句，不要使用现成作品或角色名。",
                  "必须避开 avoidTitles 和本轮已拒绝的重复标题，不要只换一个字、换词序或换同义词。",
                  "优先生成有人物身份反差、具体动作、第一章危机和追读钩子的标题。",
                  "不要把 genre 和 tags 直接拼成标题。",
                  "不要使用“我的”“使我”“让我”“工资条上写着”“决定境界”“指南”“暴涨”“月薪百万，我成仙了”这类低质句式。"
                ]
              : [],
            outputSchema: currentTask.outputSchema
          },
          null,
          2
        )
      }
    ];

  try {
    const response = await requestAiJson<Partial<ProjectCreationAssistResult>>({
      messages: buildMessages(),
      temperature: currentTask.temperature,
      maxTokens: currentTask.maxTokens
    });

    const normalized = normalizeResult(
      response,
      mergedAvoidTitles(),
      input.action === "titles" ? titleQualityOptions : undefined
    );
    const generatedTitles = list(response.titles).map(cleanTitleText).filter(Boolean);
    const rejectedTitles = input.action === "titles"
      ? generatedTitles.filter((title) => !normalized.titles.some((item) => titleFingerprint(item) === titleFingerprint(title)))
      : [];

    if (input.action === "titles" && titleNamingStyle === "fanqie") {
      const acceptableTitles = normalized.titles.filter((title) => titleCharacterLength(title) <= 24);
      const hasEnoughShortTitles = acceptableTitles.length >= 3;
      const looksTooLong = normalized.titles.length > 0 && normalized.titles.every((title) => titleCharacterLength(title) > 24);

      if (!hasEnoughShortTitles || looksTooLong || normalized.titles.length < 3) {
        const compactResponse = await requestAiJson<Partial<ProjectCreationAssistResult>>({
          messages: buildMessages(true, rejectedTitles),
          temperature: 0.65,
          maxTokens: 900
        });

        const compactNormalized = normalizeResult(compactResponse, mergedAvoidTitles(rejectedTitles), titleQualityOptions);
        const compactShortTitles = compactNormalized.titles.filter((title) => titleCharacterLength(title) <= 24);

        return attachAiTokenUsage({
          ...compactNormalized,
          titles: compactShortTitles.length > 0 ? compactShortTitles : compactNormalized.titles
        }, getAiTokenUsage(compactResponse));
      }

      return attachAiTokenUsage({
        ...normalized,
        titles: acceptableTitles
      }, getAiTokenUsage(response));
    }

    if (input.action === "titles" && normalized.titles.length < 3) {
      const retryResponse = await requestAiJson<Partial<ProjectCreationAssistResult>>({
        messages: buildMessages(true, rejectedTitles),
        temperature: 0.7,
        maxTokens: 900
      });

      return normalizeResult(retryResponse, mergedAvoidTitles(rejectedTitles), titleQualityOptions);
    }

    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (input.action === "titles" && message.includes("长度限制")) {
      const response = await requestAiJson<Partial<ProjectCreationAssistResult>>({
        messages: buildMessages(true),
        temperature: 0.65,
        maxTokens: 900
      });

      return normalizeResult(response, mergedAvoidTitles(), titleQualityOptions);
    }

    throw error;
  }
}
