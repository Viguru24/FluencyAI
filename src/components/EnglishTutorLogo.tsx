import React from 'react';

interface EnglishTutorLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  subtitleText?: string;
  className?: string;
  onClick?: () => void;
}

const sizeConfig = {
  sm: {
    iconSize: 'w-8 h-8 sm:w-9 sm:h-9',
    textSize: 'text-base sm:text-lg',
    subSize: 'text-[10px]',
    badgeGap: 'gap-2 sm:gap-2.5',
    tagPadding: 'px-1.5 py-0.5 text-[9px]',
  },
  md: {
    iconSize: 'w-10 h-10 sm:w-11 sm:h-11',
    textSize: 'text-xl',
    subSize: 'text-[11px]',
    badgeGap: 'gap-3',
    tagPadding: 'px-2 py-0.5 text-[10px]',
  },
  lg: {
    iconSize: 'w-14 h-14',
    textSize: 'text-2xl',
    subSize: 'text-xs',
    badgeGap: 'gap-3.5',
    tagPadding: 'px-2.5 py-1 text-xs',
  },
  xl: {
    iconSize: 'w-20 h-20',
    textSize: 'text-3xl',
    subSize: 'text-sm',
    badgeGap: 'gap-4',
    tagPadding: 'px-3 py-1 text-xs',
  },
};

/**
 * 100% Vector, scalable English Tutor emblem (eliminates all raster legacy artifacts).
 */
export const EnglishTutorEmblem: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="English Tutor Emblem"
  >
    <defs>
      <linearGradient id="et-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0284c7" />
        <stop offset="50%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
      <linearGradient id="et-glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#818cf8" />
      </linearGradient>
      <filter id="et-shadow" x="-10%" y="-10%" width="120%" height="125%" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0284c7" floodOpacity="0.35" />
      </filter>
    </defs>

    {/* Squircle Background Container */}
    <rect x="6" y="6" width="88" height="88" rx="24" fill="url(#et-bg-grad)" filter="url(#et-shadow)" />

    {/* Inner subtle rim highlight */}
    <rect x="7" y="7" width="86" height="86" rx="23" stroke="white" strokeOpacity="0.25" strokeWidth="2" fill="none" />

    {/* Stylized English Tutor Iconography: Open Academic Book & Speech Wave Wings */}
    <g transform="translate(18, 20)">
      {/* Left Page / Wing */}
      <path
        d="M32 44C20 38 8 40 4 43V14C8 11 20 9 32 15V44Z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Right Page / Wing */}
      <path
        d="M32 44C44 38 56 40 60 43V14C56 11 44 9 32 15V44Z"
        fill="white"
        fillOpacity="0.82"
      />
      {/* Central Spine */}
      <line x1="32" y1="13" x2="32" y2="46" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />

      {/* Graduation / Speech Accent Crest on Top */}
      <path
        d="M32 2L14 9L32 16L50 9L32 2Z"
        fill="#fbbf24"
      />
      <circle cx="32" cy="9" r="2.5" fill="#fef08a" />

      {/* Dynamic Sound Wave Ripple */}
      <path
        d="M22 23C25 21 39 21 42 23"
        stroke="#0284c7"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 29C24 27 40 27 44 29"
        stroke="#0284c7"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  </svg>
);

export const EnglishTutorLogo: React.FC<EnglishTutorLogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = true,
  subtitleText = 'Personal Spoken English Mentor',
  className = '',
  onClick,
}) => {
  const cfg = sizeConfig[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${cfg.badgeGap} select-none min-w-0 ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      {/* 3D App Emblem */}
      <div
        className={`relative ${cfg.iconSize} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}
      >
        <EnglishTutorEmblem />

        {/* Live Active Pill Indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center z-20 shadow-sm">
          <span className="text-[7px] sm:text-[8px] font-black text-white leading-none">✓</span>
        </div>
      </div>

      {/* Typography: ENGLISH TUTOR AI */}
      {showText && (
        <div className="flex flex-col justify-center shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 leading-none shrink-0">
            <span
              className={`font-black tracking-tight ${cfg.textSize} text-slate-900 dark:text-white transition-colors shrink-0`}
            >
              ENGLISH
            </span>
            <span
              className={`font-black tracking-tight ${cfg.textSize} bg-gradient-to-r from-brand-500 via-sky-500 to-indigo-500 bg-clip-text text-transparent shrink-0`}
            >
              TUTOR
            </span>
            <span
              className={`hidden sm:inline-flex items-center font-black uppercase tracking-wider rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700 flex-shrink-0 ${cfg.tagPadding}`}
            >
              AI
            </span>
          </div>

          {showSubtitle && (
            <p
              className={`font-medium text-slate-500 dark:text-slate-400 hidden sm:block mt-1 truncate ${cfg.subSize}`}
            >
              {subtitleText}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Also export as FluencyLogo alias for backwards compatibility if needed during migration
export const FluencyLogo = EnglishTutorLogo;
