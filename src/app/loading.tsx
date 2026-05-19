export default function Loading() {
  return (
    <div className="route-loading-stage" aria-live="polite">
      <div className="route-loading-card">
        <div className="route-loading-head">
          <span className="loading-bookmark" aria-hidden="true">书</span>
          <div>
            <strong>正在整理创作状态</strong>
            <span>同步项目、模板、人物和伏笔。</span>
          </div>
          <span className="loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>

        <div className="route-loading-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
