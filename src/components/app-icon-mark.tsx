export function AppIconMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <img src="/brand/app-icon.png" alt="" />
    </span>
  );
}
