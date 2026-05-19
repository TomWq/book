export default function Loading() {
  return (
    <div className="route-loading" aria-live="polite">
      <div>
        <strong>正在加载页面</strong>
        <span>请稍等，正在读取工作区数据。</span>
      </div>
      <div className="usage-bar" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
