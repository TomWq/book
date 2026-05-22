import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton, ApiForm } from "@/components/api-form";
import { Panel } from "@/components/panel";
import { getProjectWritingState } from "@/lib/projects";
import { formatReviewText } from "@/lib/review-display";

const genreOptions = [
  "都市逆袭",
  "都市高武",
  "玄幻升级",
  "东方玄幻",
  "修仙",
  "规则怪谈",
  "悬疑脑洞",
  "末世",
  "女频重生",
  "历史权谋",
  "直播爽文",
  "其他"
];

const workTypeOptions = [
  "长篇连载",
  "短篇试写",
  "开局样章",
  "拆书迁移新书",
  "系列文第一卷"
];

const readerOptions = ["男频", "女频", "通用", "网文读者", "小红书读者", "公众号读者"];
const volumeOptions = ["第一卷", "第二卷", "第三卷", "番外卷", "完结卷"];
const mapOptions = ["初始地图", "校园/基地", "城市", "家族/宗门", "秘境/副本", "更高层势力", "全国/天下"];
const styleOptions = ["快节奏强爽点", "悬疑推进", "轻松爽文", "热血升级", "压迫反转", "细腻情绪"];

export default async function ProjectStatePage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const state = await getProjectWritingState(projectId);

  if (!state) {
    notFound();
  }
  const profileCount = state.characters.length;
  const foreshadowingCount = state.foreshadowings.length;
  const maxChapterNumber = Math.max(
    0,
    ...state.taskCards.map((card) => card.chapterNumber),
    ...state.drafts.map((draft) => draft.chapterNumber),
    ...state.ledgers.map((ledger) => ledger.chapterNumber),
    ...state.reviews.map((review) => review.chapterNumber)
  );
  const draftTaskCardIds = new Set(state.drafts.map((draft) => draft.taskCardId));
  const hasUnwrittenTaskCard = state.taskCards.some((card) => !draftTaskCardIds.has(card.id));
  const writingButtonText =
    maxChapterNumber === 0
      ? "去创作第一章"
      : hasUnwrittenTaskCard
        ? `继续写第 ${maxChapterNumber} 章`
        : `继续创作第 ${maxChapterNumber + 1} 章`;
  const openForeshadowingCount = state.foreshadowings.filter((item) => item.status !== "closed").length;
  const latestTaskCard = state.taskCards[0];
  const latestLedger = state.ledgers[0];
  const latestReview = state.reviews[0];
  const latestCharacter = state.characters[0];
  const keySettingCount = [
    state.bible.corePleasure,
    state.bible.protagonistDesire,
    state.bible.worldRules,
    state.bible.goldenFingerRules,
    state.bible.immutableSettings,
    state.plotState.mainGoal,
    state.plotState.nextStageGoal
  ].filter((item) => item.trim()).length;

  return (
    <div className="grid state-page">
      <section className="hero state-hero">
        <div className="hero-top">
          <div>
            <h1>创作圣经、人物、伏笔和主线状态统一维护</h1>
            <p>这里是长篇不跑偏的核心。写作时不是喂全文，而是读取这些结构化状态。</p>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href={`/projects/${projectId}/writing`}>
              {writingButtonText}
            </Link>
            <Link className="button" href={`/projects/${projectId}/state/graph`}>
              查看关系图谱
            </Link>
            <ApiButton
              endpoint={`/api/projects/${projectId}/state`}
              body={{ action: "cleanup_state" }}
              label="清理自动状态"
              confirmMessage="确定清理自动生成的脏状态吗？会移除明显误识别的人物和重复伏笔，并压缩主线状态。"
            />
            <span className="chip">人物 {profileCount}</span>
            <span className="chip">伏笔 {foreshadowingCount}</span>
            <span className="chip">主线 {state.plotState.currentVolume}</span>
          </div>
        </div>
        <div className="state-health-strip">
          <div>
            <span>已推进</span>
            <strong>{maxChapterNumber > 0 ? `第 ${maxChapterNumber} 章` : "尚未开写"}</strong>
          </div>
          <div>
            <span>设定完整度</span>
            <strong>{keySettingCount}/7</strong>
          </div>
          <div>
            <span>人物档案</span>
            <strong>{profileCount} 人</strong>
          </div>
          <div>
            <span>未回收伏笔</span>
            <strong>{openForeshadowingCount} 条</strong>
          </div>
        </div>
      </section>

      <section className="state-command-strip" aria-label="页面维护重点">
        <div className="state-guide">
          <div>
            <strong>1. 定规则</strong>
            <span>创作圣经保存稳定设定：爽点、金手指、世界规则、禁区。</span>
          </div>
          <div>
            <strong>2. 记进度</strong>
            <span>主线状态告诉 AI 当前写到哪、下一步必须推进什么。</span>
          </div>
          <div>
            <strong>3. 管人物</strong>
            <span>人物档案记录目标、秘密、已知/未知信息，避免角色乱知道。</span>
          </div>
          <div>
            <strong>4. 控伏笔</strong>
            <span>伏笔表记录埋设、回收和不能提前透露的信息。</span>
          </div>
        </div>
      </section>

      <div className="state-layout">
        <div className="state-main">
      <details id="project-info" className="state-editor-section">
        <summary>
          <span>
            <strong>作品信息</strong>
            <small>真正要创作的小说名称、题材和一句话设想。</small>
          </span>
          <span className="state-section-tag">{state.project.genre || "未填写题材"}</span>
        </summary>
        <ApiForm
          className="forms"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "update_project" }}
        >
          <div className="split-panels">
            <div className="field">
              <div className="field-label">作品名称</div>
              <input name="name" defaultValue={state.project.name} placeholder="例如：归零之后，我在古代重启人生" />
            </div>
            <div className="field">
              <div className="field-label">题材类型</div>
              <select name="genre" defaultValue={state.project.genre || "都市逆袭"}>
                {state.project.genre && !genreOptions.includes(state.project.genre) ? (
                  <option value={state.project.genre}>{state.project.genre}</option>
                ) : null}
                {genreOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <div className="field-label">故事简介 / 创作设想</div>
            <textarea
              name="description"
              defaultValue={state.project.description}
              placeholder="一句话说明这本新书要写什么，不是原书复述。"
            />
          </div>
          <button className="button primary" type="submit">
            保存作品信息
          </button>
        </ApiForm>
      </details>

      <details id="bible" className="state-editor-section">
        <summary>
          <span>
            <strong>创作圣经</strong>
            <small>稳定设定写在这里，生成任务卡时会读取。</small>
          </span>
          <span className="state-section-tag">规则与禁区</span>
        </summary>
        <ApiForm
          className="forms"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "update_bible" }}
        >
          <div className="split-panels">
            <div className="field">
              <div className="field-label">作品类型</div>
              <select name="workType" defaultValue={state.bible.workType || "长篇连载"}>
                {state.bible.workType && !workTypeOptions.includes(state.bible.workType) ? (
                  <option value={state.bible.workType}>{state.bible.workType}</option>
                ) : null}
                {workTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="field-label">目标读者</div>
              <select name="targetReader" defaultValue={state.bible.targetReader || "网文读者"}>
                {state.bible.targetReader && !readerOptions.includes(state.bible.targetReader) ? (
                  <option value={state.bible.targetReader}>{state.bible.targetReader}</option>
                ) : null}
                {readerOptions.map((reader) => (
                  <option key={reader} value={reader}>
                    {reader}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <div className="field-label">核心爽点</div>
            <textarea name="corePleasure" defaultValue={state.bible.corePleasure} />
          </div>
          <div className="field">
            <div className="field-label">主角底层欲望</div>
            <textarea name="protagonistDesire" defaultValue={state.bible.protagonistDesire} />
          </div>
          <div className="field">
            <div className="field-label">世界规则</div>
            <textarea name="worldRules" defaultValue={state.bible.worldRules} />
          </div>
          <div className="field">
            <div className="field-label">金手指规则</div>
            <textarea name="goldenFingerRules" defaultValue={state.bible.goldenFingerRules} />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">战力 / 能力体系</div>
              <textarea name="powerSystem" defaultValue={state.bible.powerSystem} />
            </div>
            <div className="field">
              <div className="field-label">整体风格</div>
              <textarea
                name="styleGuide"
                defaultValue={state.bible.styleGuide}
                placeholder={`可写风格要求，常用：${styleOptions.join(" / ")}`}
              />
            </div>
          </div>
          <div className="field">
            <div className="field-label">叙事禁区</div>
            <textarea name="narrativeTaboos" defaultValue={state.bible.narrativeTaboos} />
          </div>
          <div className="field">
            <div className="field-label">不能违反的设定</div>
            <textarea name="immutableSettings" defaultValue={state.bible.immutableSettings} />
          </div>
          <button className="button" type="submit">
            保存创作圣经
          </button>
        </ApiForm>
      </details>

      <details id="plot-state" className="state-editor-section" open>
        <summary>
          <span>
            <strong>主线状态</strong>
            <small>告诉 AI 当前写到哪里，下一步必须推进什么。</small>
          </span>
          <span className="state-section-tag">{state.plotState.currentVolume || "第一卷"}</span>
        </summary>
        <ApiForm
          className="forms state-plot-form"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "update_plot_state" }}
          arrayFields={[
            "unresolvedQuestions",
            "openThreads",
            "resolvedThreads",
            "nextMilestones",
            "relationshipChanges"
          ]}
        >
          <div className="split-panels">
            <div className="field">
              <div className="field-label">当前卷</div>
              <select name="currentVolume" defaultValue={state.plotState.currentVolume || "第一卷"}>
                {state.plotState.currentVolume && !volumeOptions.includes(state.plotState.currentVolume) ? (
                  <option value={state.plotState.currentVolume}>{state.plotState.currentVolume}</option>
                ) : null}
                {volumeOptions.map((volume) => (
                  <option key={volume} value={volume}>
                    {volume}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="field-label">当前地图</div>
              <select name="currentMap" defaultValue={state.plotState.currentMap || "初始地图"}>
                {state.plotState.currentMap && !mapOptions.includes(state.plotState.currentMap) ? (
                  <option value={state.plotState.currentMap}>{state.plotState.currentMap}</option>
                ) : null}
                {mapOptions.map((map) => (
                  <option key={map} value={map}>
                    {map}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <div className="field-label">当前主线目标</div>
            <textarea name="mainGoal" defaultValue={state.plotState.mainGoal} />
          </div>
          <div className="field">
            <div className="field-label">短期目标</div>
            <textarea name="shortTermGoal" defaultValue={state.plotState.shortTermGoal} />
          </div>
          <div className="field">
            <div className="field-label">当前阶段</div>
            <textarea name="currentStage" defaultValue={state.plotState.currentStage} />
          </div>
          <div className="field">
            <div className="field-label">当前敌人 / 压力源</div>
            <input name="currentEnemy" defaultValue={state.plotState.currentEnemy} />
          </div>
          <div className="field">
            <div className="field-label">未解决悬念</div>
            <textarea
              name="unresolvedQuestions"
              defaultValue={state.plotState.unresolvedQuestions.join("\n")}
            />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">开放线索</div>
              <textarea name="openThreads" defaultValue={state.plotState.openThreads.join("\n")} />
            </div>
            <div className="field">
              <div className="field-label">已回收线索</div>
              <textarea name="resolvedThreads" defaultValue={state.plotState.resolvedThreads.join("\n")} />
            </div>
          </div>
          <div className="field">
            <div className="field-label">下一批里程碑</div>
            <textarea name="nextMilestones" defaultValue={state.plotState.nextMilestones.join("\n")} />
          </div>
          <div className="field">
            <div className="field-label">下一阶段目标</div>
            <textarea name="nextStageGoal" defaultValue={state.plotState.nextStageGoal} />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">战力状态</div>
              <textarea
                name="powerSystemState"
                defaultValue={state.plotState.powerSystemState}
                placeholder="没有明确战力体系可以留空；只写境界、能力边界、升级条件和代价。"
              />
            </div>
            <div className="field">
              <div className="field-label">地图与势力</div>
              <textarea
                name="mapAndForces"
                defaultValue={state.plotState.mapAndForces}
                placeholder="只写顶层地点、势力、组织和阵营；没有变化可以留空。"
              />
            </div>
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">资源状态</div>
              <textarea
                name="resourceState"
                defaultValue={state.plotState.resourceState}
                placeholder="只写真实获得/失去的资源、道具、线索和身份收益。"
              />
            </div>
            <div className="field">
              <div className="field-label">关系变化</div>
              <textarea name="relationshipChanges" defaultValue={state.plotState.relationshipChanges.join("\n")} />
            </div>
          </div>
          <button className="button" type="submit">
            保存主线状态
          </button>
        </ApiForm>
      </details>

      <details id="characters" className="state-editor-section" open>
        <summary>
          <span>
            <strong>人物档案</strong>
            <small>重点记录人物知道什么、不知道什么。</small>
          </span>
          <span className="state-section-tag">{profileCount} 人</span>
        </summary>
        <details className="state-inline-form">
          <summary>添加人物</summary>
        <ApiForm
          className="forms"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "create_character" }}
          resetOnSuccess
        >
          <div className="split-panels">
            <div className="field">
              <div className="field-label">姓名</div>
              <input name="name" placeholder="秦掌柜" />
            </div>
            <div className="field">
              <div className="field-label">身份</div>
              <input name="identity" placeholder="药铺掌柜 / 旧案知情人" />
            </div>
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">当前目标</div>
              <input name="currentGoal" />
            </div>
            <div className="field">
              <div className="field-label">长期目标</div>
              <input name="longTermGoal" />
            </div>
          </div>
          <div className="field">
            <div className="field-label">秘密</div>
            <textarea name="secret" />
          </div>
          <div className="field">
            <div className="field-label">与主角关系 / 当前态度</div>
            <input name="relationshipToProtagonist" placeholder="关系" />
            <input name="attitude" placeholder="态度" />
          </div>
          <div className="field">
            <div className="field-label">能力边界 / 说话习惯</div>
            <input name="abilityBoundary" placeholder="能力边界" />
            <input name="voice" placeholder="说话习惯" />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">已知信息</div>
              <textarea name="knownInformation" />
            </div>
            <div className="field">
              <div className="field-label">不知道的信息</div>
              <textarea name="unknownInformation" />
            </div>
          </div>
          <div className="field">
            <div className="field-label">最近出场 / 当前状态</div>
            <input name="lastAppearance" placeholder="第几章出场" />
            <input name="currentState" placeholder="当前状态" />
          </div>
          <button className="button" type="submit">
            添加人物
          </button>
        </ApiForm>
        </details>

        <div className="list">
          {state.characters.length === 0 ? (
            <div className="section-card">暂无人物档案。</div>
          ) : (
            state.characters.map((character) => (
              <div key={character.id} className="list-item">
                <div className="row">
                  <strong>{character.name}</strong>
                  <span className="chip">{character.identity || "未填写身份"}</span>
                </div>
                <div className="muted">已知：{character.knownInformation || "未填写"}</div>
                <div className="muted">未知：{character.unknownInformation || "未填写"}</div>
                <div className="muted">状态：{character.currentState || "未填写"}</div>
                <details className="chapter-content-editor">
                  <summary>编辑人物</summary>
                  <ApiForm
                    className="forms"
                    endpoint={`/api/projects/${projectId}/state`}
                    body={{ action: "update_character", characterId: character.id }}
                  >
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">姓名</div>
                        <input name="name" defaultValue={character.name} />
                      </div>
                      <div className="field">
                        <div className="field-label">身份</div>
                        <input name="identity" defaultValue={character.identity} />
                      </div>
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">当前目标</div>
                        <input name="currentGoal" defaultValue={character.currentGoal} />
                      </div>
                      <div className="field">
                        <div className="field-label">长期目标</div>
                        <input name="longTermGoal" defaultValue={character.longTermGoal} />
                      </div>
                    </div>
                    <div className="field">
                      <div className="field-label">秘密</div>
                      <textarea name="secret" defaultValue={character.secret} />
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">与主角关系</div>
                        <input
                          name="relationshipToProtagonist"
                          defaultValue={character.relationshipToProtagonist}
                        />
                      </div>
                      <div className="field">
                        <div className="field-label">当前态度</div>
                        <input name="attitude" defaultValue={character.attitude} />
                      </div>
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">能力边界</div>
                        <input name="abilityBoundary" defaultValue={character.abilityBoundary} />
                      </div>
                      <div className="field">
                        <div className="field-label">说话习惯</div>
                        <input name="voice" defaultValue={character.voice} />
                      </div>
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">已知信息</div>
                        <textarea name="knownInformation" defaultValue={character.knownInformation} />
                      </div>
                      <div className="field">
                        <div className="field-label">不知道的信息</div>
                        <textarea name="unknownInformation" defaultValue={character.unknownInformation} />
                      </div>
                    </div>
                    <div className="split-panels">
                      <div className="field">
                        <div className="field-label">最近出场</div>
                        <input name="lastAppearance" defaultValue={character.lastAppearance} />
                      </div>
                      <div className="field">
                        <div className="field-label">当前状态</div>
                        <input name="currentState" defaultValue={character.currentState} />
                      </div>
                    </div>
                    <div className="hero-actions">
                      <button className="button primary" type="submit">
                        保存人物
                      </button>
                      <ApiButton
                        endpoint={`/api/projects/${projectId}/state`}
                        body={{ action: "delete_character", characterId: character.id }}
                        label="删除人物"
                        className="button danger"
                        confirmMessage={`确定删除人物“${character.name}”吗？删除后不会影响已经生成的章节正文。`}
                      />
                    </div>
                  </ApiForm>
                </details>
              </div>
            ))
          )}
        </div>
      </details>

      <details id="foreshadowings" className="state-editor-section" open>
        <summary>
          <span>
            <strong>伏笔表</strong>
            <small>伏笔独立管理，避免提前爆雷或忘记回收。</small>
          </span>
          <span className="state-section-tag">未回收 {openForeshadowingCount}</span>
        </summary>
        <details className="state-inline-form">
          <summary>添加伏笔</summary>
        <ApiForm
          className="forms"
          endpoint={`/api/projects/${projectId}/state`}
          body={{ action: "create_foreshadowing" }}
          arrayFields={["relatedCharacters"]}
          resetOnSuccess
        >
          <div className="field">
            <div className="field-label">伏笔名称</div>
            <input name="name" placeholder="父亲失踪" />
          </div>
          <div className="split-panels">
            <div className="field">
              <div className="field-label">埋设章节</div>
              <input name="plantedChapter" placeholder="第 3 章" />
            </div>
            <div className="field">
              <div className="field-label">当前状态</div>
              <select name="status" defaultValue="open">
                <option value="open">未回收</option>
                <option value="partial">部分回收</option>
                <option value="closed">已回收</option>
              </select>
            </div>
          </div>
          <div className="field">
            <div className="field-label">关联人物</div>
            <input name="relatedCharacters" placeholder="主角、秦掌柜" />
          </div>
          <div className="field">
            <div className="field-label">关联地点</div>
            <input name="relatedLocation" />
          </div>
          <div className="field">
            <div className="field-label">预计回收章节 / 回收方式</div>
            <input name="expectedRevealChapter" placeholder="45-50" />
            <input name="revealMethod" placeholder="通过账本、证人或旧物回收" />
          </div>
          <div className="field">
            <div className="field-label">不能提前透露的信息</div>
            <textarea name="hiddenInformation" />
          </div>
          <button className="button" type="submit">
            添加伏笔
          </button>
        </ApiForm>
        </details>

        <div className="timeline">
          {state.foreshadowings.length === 0 ? (
            <div className="section-card">暂无伏笔。</div>
          ) : (
            state.foreshadowings.map((item) => (
              <div key={item.id} className="timeline-item">
                <div className="row">
                  <strong>{item.name}</strong>
                  <span className={`pill ${item.status === "closed" ? "success" : "warning"}`}>
                    {item.status === "closed" ? "已回收" : item.status === "partial" ? "部分回收" : "未回收"}
                  </span>
                </div>
                <div className="muted">埋设：{item.plantedChapter || "未填写"}；预计回收：{item.expectedRevealChapter || "未填写"}</div>
                <div className="muted">不能提前透露：{item.hiddenInformation || "未填写"}</div>
              </div>
            ))
          )}
        </div>
      </details>

        </div>

        <aside className="state-side">
          <nav className="state-jump-nav" aria-label="状态维护导航">
            <a href="#project-info">作品</a>
            <a href="#bible">圣经</a>
            <a href="#plot-state">主线</a>
            <a href="#characters">人物</a>
            <a href="#foreshadowings">伏笔</a>
          </nav>
          <Panel title="状态摘要" description="创作页生成任务卡和正文时会读取这些内容。">
            <div className="list compact-list">
              <div className="task-block">
                <div className="task-title">当前故事</div>
                <div className="muted">{state.project.name}</div>
                <div className="muted">{state.project.description || "暂无故事简介"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">当前主线</div>
                <div className="muted">{state.plotState.mainGoal || "未填写主线目标"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">下一步</div>
                <div className="muted">{state.plotState.nextStageGoal || "未填写下一阶段目标"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">核心限制</div>
                <div className="muted">{state.bible.immutableSettings || "未填写不可违反设定"}</div>
              </div>
              <div className="task-block">
                <div className="task-title">状态数量</div>
                <div className="meta-row">
                  <span className="chip">人物 {profileCount}</span>
                  <span className="chip">伏笔 {foreshadowingCount}</span>
                  <span className="chip">台账 {state.ledgers.length}</span>
                  <span className="chip">审稿 {state.reviews.length}</span>
                </div>
              </div>
              <div className="task-block">
                <div className="task-title">最近自动状态</div>
                <div className="muted">
                  {latestTaskCard ? `任务卡：第 ${latestTaskCard.chapterNumber} 章 ${latestTaskCard.title}` : "暂无任务卡"}
                </div>
                <div className="muted">
                  {latestLedger ? `台账：第 ${latestLedger.chapterNumber} 章 ${latestLedger.cliffhanger || latestLedger.payoff}` : "暂无章节台账"}
                </div>
                <div className="muted">
                  {latestReview ? `审稿：第 ${latestReview.chapterNumber} 章 ${formatReviewText(latestReview.overall)}` : "暂无审稿报告"}
                </div>
              </div>
              <div className="task-block">
                <div className="task-title">最近更新人物</div>
                <div className="muted">
                  {latestCharacter
                    ? `${latestCharacter.name}：${latestCharacter.currentState || latestCharacter.identity || "未填写状态"}`
                    : "暂无人物档案"}
                </div>
              </div>
              <Link className="button primary" href={`/projects/${projectId}/writing`}>
                {writingButtonText}
              </Link>
              <Link className="button" href={`/projects/${projectId}/state/graph`}>
                查看关系图谱
              </Link>
            </div>
          </Panel>
        </aside>
    </div>
    </div>
  );
}
