import Link from "next/link";
import { redirect } from "next/navigation";
import { isDesktopRuntime } from "@/lib/app-runtime";
import {
  getCurrentUserAccess,
  getProjectWritingState,
  getProjects
} from "@/lib/projects";
import {
  buildCharactersByDay,
  countTextCharacters,
  countWritingStreak,
  intensityForCharacters,
  localDateKey,
  localDateLabel,
  recentCalendarDays
} from "@/lib/writing-stats";
import { Panel } from "@/components/panel";

export default async function WritingStatsPage() {
  const { user, isAdmin } = await getCurrentUserAccess();
  const desktopRuntime = isDesktopRuntime();

  if (isAdmin && !desktopRuntime) {
    redirect("/admin");
  }

  if (!user && desktopRuntime) {
    redirect("/activate");
  }

  if (!user) {
    redirect("/login?next=/stats");
  }

  const projects = await getProjects();
  const writingProjects = projects.filter((project) => project.type === "writing");
  const writingStates = await Promise.all(writingProjects.map((project) => getProjectWritingState(project.id)));
  const allDrafts = writingStates.flatMap((state) => state?.drafts ?? []);
  const calendarDays = recentCalendarDays();
  const charactersByDay = buildCharactersByDay(allDrafts);
  const activeCalendarDays = calendarDays.filter((date) => (charactersByDay.get(localDateKey(date)) ?? 0) > 0);
  const showFocusedCalendar = activeCalendarDays.length > 0 && activeCalendarDays.length <= 7;
  const displayCalendarDays = showFocusedCalendar ? activeCalendarDays : calendarDays;
  const calendarDescription = showFocusedCalendar
    ? "先只展示已有正文草稿的创作日期，超过 7 个创作日后再切换为最近 35 天日历。"
    : "按正文草稿生成日期统计最近 35 天字数。";
  const bestDayCharacters = Math.max(0, ...calendarDays.map((date) => charactersByDay.get(localDateKey(date)) ?? 0));
  const totalCharacters = allDrafts.reduce((total, draft) => total + countTextCharacters(draft.content), 0);
  const writingStreak = countWritingStreak(charactersByDay);
  const projectStats = writingStates
    .filter((state): state is NonNullable<typeof state> => Boolean(state))
    .map((state) => ({
      id: state.project.id,
      name: state.project.name,
      drafts: state.drafts.length,
      characters: state.drafts.reduce((total, draft) => total + countTextCharacters(draft.content), 0),
      updatedAt: state.project.updatedAt
    }))
    .sort((a, b) => b.characters - a.characters || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="writing-stats-page">
      <section className="page-intro">
        <h1>创作统计</h1>
        <p>把每日正文产出单独放在这里看，首页只保留进入创作和拆书的主入口。</p>
      </section>

      <Panel
        title="创作日历"
        description={calendarDescription}
        action={
          <Link href="/" className="button">
            返回首页
          </Link>
        }
      >
        <div className="writing-calendar-summary">
          <div>
            <strong>{writingStreak}</strong>
            <span>连续创作天数</span>
          </div>
          <div>
            <strong>{activeCalendarDays.length}</strong>
            <span>近 35 天开写</span>
          </div>
          <div>
            <strong>{bestDayCharacters.toLocaleString("zh-CN")}</strong>
            <span>最高单日字数</span>
          </div>
          <div>
            <strong>{totalCharacters.toLocaleString("zh-CN")}</strong>
            <span>累计正文字数</span>
          </div>
        </div>

        {activeCalendarDays.length ? (
          <>
            <div
              className={`writing-calendar-grid expanded${showFocusedCalendar ? " focused" : ""}`}
              aria-label={showFocusedCalendar ? "已有创作日期字数" : "最近 35 天创作字数"}
            >
              {displayCalendarDays.map((date) => {
                const key = localDateKey(date);
                const characters = charactersByDay.get(key) ?? 0;

                return (
                  <div
                    key={key}
                    className={`writing-calendar-day ${intensityForCharacters(characters)}`}
                    title={`${key}：${characters.toLocaleString("zh-CN")} 字`}
                  >
                    <span>{localDateLabel(date)}</span>
                    <strong>{characters.toLocaleString("zh-CN")}</strong>
                  </div>
                );
              })}
            </div>
            {showFocusedCalendar ? (
              <p className="writing-calendar-note">已隐藏没有产出的空白日期，连续创作超过 7 天后这里会自动展开成最近 35 天日历。</p>
            ) : (
              <div className="writing-calendar-legend">
                <span>少</span>
                <i className="level-0" />
                <i className="level-1" />
                <i className="level-2" />
                <i className="level-3" />
                <i className="level-4" />
                <span>多</span>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state compact">
            <strong>还没有正文草稿</strong>
            <span>写出第一章后，这里会开始记录每天的创作字数。</span>
          </div>
        )}
      </Panel>

      <Panel title="作品产出" description="按作品汇总已生成正文和累计字数。">
        <div className="list">
          {projectStats.length ? (
            projectStats.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}/writing`} className="list-item">
                <div className="row">
                  <strong>{project.name}</strong>
                  <span className="pill">{project.drafts} 章</span>
                </div>
                <div className="meta-row">
                  <span className="chip">累计 {project.characters.toLocaleString("zh-CN")} 字</span>
                  <span className="chip">{new Date(project.updatedAt).toLocaleString("zh-CN")}</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <strong>还没有创作统计</strong>
              <span>生成正文后，这里会显示每日字数和作品产出。</span>
              <Link href="/projects/new" className="button primary">
                新建创作项目
              </Link>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
