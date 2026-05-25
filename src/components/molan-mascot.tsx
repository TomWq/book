export function MoLanMascot({ className = "floating-ai-mascot" }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <span className="molan-mascot-shadow" />
      <img className="molan-mascot-frame" src="/mascot/molan.png" alt="" draggable={false} decoding="async" />
    </span>
  );
}
