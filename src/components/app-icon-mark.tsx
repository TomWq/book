export function AppIconMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 1024 1024" role="img" focusable="false">
        <defs>
          <linearGradient id="app-icon-bg" x1="164" y1="116" x2="860" y2="918" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1A2440" />
            <stop offset="0.48" stopColor="#11172A" />
            <stop offset="1" stopColor="#090C17" />
          </linearGradient>
          <radialGradient id="app-icon-aura-top" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(334 190) rotate(63) scale(500)">
            <stop offset="0" stopColor="#7CCBFF" stopOpacity="0.52" />
            <stop offset="0.45" stopColor="#3B6DE8" stopOpacity="0.18" />
            <stop offset="1" stopColor="#101729" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="app-icon-aura-gold" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(706 600) rotate(122) scale(430)">
            <stop offset="0" stopColor="#FFD77A" stopOpacity="0.45" />
            <stop offset="0.48" stopColor="#B47A2E" stopOpacity="0.16" />
            <stop offset="1" stopColor="#0A0D17" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="app-icon-rim" x1="178" y1="126" x2="812" y2="914" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8FCFFF" stopOpacity="0.78" />
            <stop offset="0.42" stopColor="#334A8F" stopOpacity="0.24" />
            <stop offset="1" stopColor="#F2B85B" stopOpacity="0.58" />
          </linearGradient>
          <linearGradient id="app-icon-page" x1="284" y1="270" x2="748" y2="754" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFF8E8" />
            <stop offset="0.52" stopColor="#F4E4BE" />
            <stop offset="1" stopColor="#C99A55" />
          </linearGradient>
          <linearGradient id="app-icon-page-shade" x1="312" y1="310" x2="720" y2="744" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.72" />
            <stop offset="1" stopColor="#734D20" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="app-icon-ink" x1="418" y1="230" x2="664" y2="770" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#BFE8FF" />
            <stop offset="0.42" stopColor="#618CFF" />
            <stop offset="1" stopColor="#F0B75E" />
          </linearGradient>
          <linearGradient id="app-icon-nib" x1="488" y1="312" x2="604" y2="764" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFF5D6" />
            <stop offset="0.52" stopColor="#F1B95E" />
            <stop offset="1" stopColor="#A96D2A" />
          </linearGradient>
        </defs>
        <rect x="74" y="74" width="876" height="876" rx="206" fill="#050712" />
        <rect x="96" y="96" width="832" height="832" rx="188" fill="url(#app-icon-bg)" />
        <rect x="96" y="96" width="832" height="832" rx="188" fill="url(#app-icon-aura-top)" />
        <rect x="96" y="96" width="832" height="832" rx="188" fill="url(#app-icon-aura-gold)" />
        <rect x="114" y="114" width="796" height="796" rx="170" fill="none" stroke="url(#app-icon-rim)" strokeWidth="10" opacity="0.72" />
        <path d="M284 310c38-26 83-38 136-35 60 3 112 26 156 68 42-42 94-65 154-68 25-1 46 0 64 5 25 7 42 30 42 56v338c0 40-32 72-72 72H632c-40 0-80 18-108 49-28-31-68-49-108-49H292c-40 0-72-32-72-72V378c0-28 16-53 41-65l23-3Z" fill="#050814" opacity="0.54" />
        <path d="M248 328c42-39 98-57 168-53 67 4 123 33 167 86v409c-35-38-82-59-141-64l-152-12c-36-3-64-33-64-69V382c0-21 8-40 22-54Z" fill="url(#app-icon-page)" />
        <path d="M583 361c44-53 100-82 167-86 23-1 44 0 63 5 28 8 48 34 48 63v282c0 36-28 66-64 69l-152 12c-26 2-47 7-62 15V361Z" fill="url(#app-icon-page)" />
        <path d="M248 328c42-39 98-57 168-53 67 4 123 33 167 86v409c-35-38-82-59-141-64l-152-12c-36-3-64-33-64-69V382c0-21 8-40 22-54Z" fill="url(#app-icon-page-shade)" />
        <path d="M583 361c44-53 100-82 167-86 23-1 44 0 63 5 28 8 48 34 48 63v282c0 36-28 66-64 69l-152 12c-26 2-47 7-62 15V361Z" fill="url(#app-icon-page-shade)" />
        <path d="M582 352v424" stroke="#FFF6DE" strokeWidth="18" strokeLinecap="round" opacity="0.68" />
        <path d="M328 408h122M326 492h152M326 576h112M690 408h72M688 492h104M688 576h66" stroke="#372A1A" strokeOpacity="0.56" strokeWidth="28" strokeLinecap="round" />
        <path d="M514 292c-30 95-22 208 24 338l31 88 31-88c46-130 54-243 24-338-15 35-34 58-55 70-22-12-40-35-55-70Z" fill="url(#app-icon-nib)" />
        <path d="M550 612h38l-19 103-19-103Z" fill="#2B1C11" opacity="0.8" />
        <circle cx="569" cy="518" r="28" fill="#FFF7E1" opacity="0.92" />
        <path d="M282 742c118 88 344 106 512 12" stroke="url(#app-icon-ink)" strokeWidth="34" strokeLinecap="round" opacity="0.92" />
        <path d="M284 742c118 88 344 106 512 12" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="10" strokeLinecap="round" />
        <path d="M742 214v54M742 354v54M672 284h54M758 284h54" stroke="#FFF2C0" strokeWidth="20" strokeLinecap="round" opacity="0.92" />
        <circle cx="742" cy="284" r="40" fill="#FFD679" opacity="0.34" />
        <path d="M312 256c75-72 164-104 267-96 78 6 146 34 204 84" fill="none" stroke="#78BFFF" strokeWidth="12" strokeLinecap="round" strokeDasharray="2 34" opacity="0.52" />
        <circle cx="348" cy="232" r="13" fill="#8ED4FF" />
        <circle cx="804" cy="680" r="16" fill="#FFD47A" />
        <circle cx="238" cy="662" r="11" fill="#7CCBFF" />
      </svg>
    </span>
  );
}
