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
    iconSize: 'w-9 h-9',
    rounded: 'rounded-xl',
    textSize: 'text-lg',
    subSize: 'text-[10px]',
    badgeGap: 'gap-2.5',
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
      className={`inline-flex items-center ${cfg.badgeGap} select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
    >
      {/* 3D App Emblem Badge */}
      <div
        className={`relative ${cfg.iconSize} ${cfg.rounded} bg-gradient-to-b from-[#2a323d] to-[#151a22] p-1 border border-slate-700/60 shadow-lg shadow-cyan-950/20 overflow-hidden flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}
      >
        {/* Subtle Ambient Glow Behind Emblem */}
        <div className="absolute inset-0 bg-radial from-cyan-500/20 via-emerald-500/10 to-transparent pointer-events-none" />
        
        {/* Authentic Stylized F & Waveform Emblem */}
        <img
          src="/icon-192.png"
          alt="Fluency AI Emblem"
          className="w-full h-full object-contain relative z-10 drop-shadow-md"
          loading="eager"
        />

        {/* Live Active Pill Indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center z-20">
          <span className="text-[8px] font-black text-white leading-none">✓</span>
        </div>
      </div>

      {/* Typography: FLUENCY AI */}
      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-black tracking-tight ${cfg.textSize} text-slate-900 dark:text-white transition-colors`}
            >
              FLUENCY
            </span>
            <span
              className={`font-black tracking-tight ${cfg.textSize} bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent`}
            >
              AI
            </span>
            <span
              className={`hidden sm:inline-flex items-center font-black uppercase tracking-wider rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700 ${cfg.tagPadding}`}
            >
              Tutor
            </span>
          </div>

          {showSubtitle && (
            <p
              className={`font-medium text-slate-500 dark:text-slate-400 hidden sm:block mt-1 ${cfg.subSize}`}
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
