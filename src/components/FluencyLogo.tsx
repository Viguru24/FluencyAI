import React from 'react';

interface FluencyLogoProps {
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
    rounded: 'rounded-xl',
    textSize: 'text-base sm:text-lg',
    subSize: 'text-[10px]',
    badgeGap: 'gap-2 sm:gap-2.5',
    tagPadding: 'px-1.5 py-0.5 text-[9px]',
  },
  md: {
    iconSize: 'w-11 h-11',
    rounded: 'rounded-2xl',
    textSize: 'text-xl',
    subSize: 'text-[11px]',
    badgeGap: 'gap-3',
    tagPadding: 'px-2 py-0.5 text-[10px]',
  },
  lg: {
    iconSize: 'w-14 h-14',
    rounded: 'rounded-2xl',
    textSize: 'text-2xl',
    subSize: 'text-xs',
    badgeGap: 'gap-3.5',
    tagPadding: 'px-2.5 py-1 text-xs',
  },
  xl: {
    iconSize: 'w-20 h-20',
    rounded: 'rounded-3xl',
    textSize: 'text-3xl',
    subSize: 'text-sm',
    badgeGap: 'gap-4',
    tagPadding: 'px-3 py-1 text-xs',
  },
};

export const FluencyLogo: React.FC<FluencyLogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = true,
  subtitleText = 'English Speaking Companion',
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
      {/* 3D App Emblem Badge */}
      <div
        className={`relative ${cfg.iconSize} ${cfg.rounded} bg-white dark:bg-gradient-to-b dark:from-[#1e293b] dark:to-[#0f172a] p-1 border border-slate-200/90 dark:border-cyan-500/30 shadow-md shadow-slate-200/80 dark:shadow-cyan-950/40 overflow-hidden flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}
      >
        {/* Subtle Ambient Glow Behind Emblem */}
        <div className="absolute inset-0 bg-radial from-cyan-500/10 via-emerald-500/5 to-transparent dark:from-cyan-500/25 dark:via-emerald-500/15 dark:to-transparent pointer-events-none" />
        
        {/* Authentic Stylized F & Waveform Emblem (Cutout) */}
        <img
          src="/logo-mark.png"
          alt="Fluency AI Emblem"
          className="w-full h-full object-contain relative z-10 drop-shadow-sm dark:drop-shadow-[0_2px_8px_rgba(6,182,212,0.35)]"
          loading="eager"
        />

        {/* Live Active Pill Indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center z-20">
          <span className="text-[7px] sm:text-[8px] font-black text-white leading-none">✓</span>
        </div>
      </div>

      {/* Typography: FLUENCY AI */}
      {showText && (
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 leading-none">
            <span
              className={`font-black tracking-tight ${cfg.textSize} text-slate-900 dark:text-white transition-colors truncate`}
            >
              FLUENCY
            </span>
            <span
              className={`font-black tracking-tight ${cfg.textSize} bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent flex-shrink-0`}
            >
              AI
            </span>
            <span
              className={`hidden sm:inline-flex items-center font-black uppercase tracking-wider rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700 flex-shrink-0 ${cfg.tagPadding}`}
            >
              Tutor
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

export default FluencyLogo;
