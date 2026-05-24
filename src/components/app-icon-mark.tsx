export function AppIconMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 1024 1024" role="img" focusable="false">
        <defs>
          <linearGradient id="app-icon-bg" x1="156" y1="128" x2="868" y2="916" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#25314A" />
            <stop offset="0.48" stopColor="#1F5EFF" />
            <stop offset="1" stopColor="#15D68F" />
          </linearGradient>
          <radialGradient id="app-icon-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(724 258) rotate(127) scale(524)">
            <stop offset="0" stopColor="#92F7D1" stopOpacity="0.95" />
            <stop offset="0.36" stopColor="#4DBED0" stopOpacity="0.34" />
            <stop offset="1" stopColor="#0D1324" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="app-icon-page" x1="298" y1="258" x2="710" y2="770" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.62" stopColor="#F2F7FF" />
            <stop offset="1" stopColor="#CAD8FF" />
          </linearGradient>
          <linearGradient id="app-icon-mint" x1="540" y1="594" x2="794" y2="760" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#D6FFF1" />
            <stop offset="0.48" stopColor="#35F1A1" />
            <stop offset="1" stopColor="#0CB5C9" />
          </linearGradient>
        </defs>
        <rect x="78" y="78" width="868" height="868" rx="206" fill="#111827" />
        <rect x="96" y="96" width="832" height="832" rx="190" fill="url(#app-icon-bg)" />
        <rect x="96" y="96" width="832" height="832" rx="190" fill="url(#app-icon-glow)" />
        <circle cx="734" cy="268" r="112" fill="#B9FFE8" opacity="0.16" />
        <path d="M246 298c0-39 31-70 70-70h158c51 0 94 30 114 73v472c-26-29-63-45-107-45H316c-39 0-70-31-70-70V298Z" fill="url(#app-icon-page)" />
        <path d="M588 301c20-43 63-73 114-73h22c39 0 70 31 70 70v360c0 39-31 70-70 70H613c-8 0-16 1-25 2V301Z" fill="url(#app-icon-page)" />
        <path d="M588 300v474" stroke="#FFFFFF" strokeOpacity="0.62" strokeWidth="24" strokeLinecap="round" />
        <path d="M336 388h142M336 486h160M336 584h128M678 388h34M678 486h42" stroke="#1C2740" strokeOpacity="0.68" strokeWidth="34" strokeLinecap="round" />
        <path d="M648 612c40-78 99-131 177-158-27 80-79 143-156 189l-79 47 58-78Z" fill="url(#app-icon-mint)" />
        <path d="M651 615l56 55-117 60 61-115Z" fill="#E9FFF7" />
        <path d="M610 713l-34 18 17-35 17 17Z" fill="#142033" />
        <circle cx="771" cy="356" r="42" fill="#9DFFD8" />
        <circle cx="817" cy="410" r="22" fill="#F8FFFD" opacity="0.95" />
      </svg>
    </span>
  );
}
