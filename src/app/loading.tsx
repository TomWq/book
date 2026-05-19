export default function Loading() {
  return (
    <div className="route-loading" aria-live="polite">
      <div className="route-loading-head">
        <span className="loading-indicator" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <div>
          <strong>正在读取工作台</strong>
          <span>同步项目、模板和近期任务。</span>
        </div>
      </div>

      <div className="route-loading-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
