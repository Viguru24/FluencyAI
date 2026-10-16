import React, { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../services/themeService';
import { playChime } from '../services/speech';

interface ThemeToggleProps {
  variant?: 'icon-only' | 'pill' | 'switch';
  className?: string;
  showTooltip?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon-only',
  className = '',
  showTooltip = true,
}) => {
  const { isDark, toggleTheme, setTheme } = useTheme();

  // Keyboard shortcut: Alt+T toggles theme from anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        playChime('tap');
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme]);

  const handleToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    playChime('tap');
    toggleTheme();
  };

  const tooltipTitle = isDark
    ? 'Switch to Light Mode (Alt+T)'
    : 'Switch to Dark Mode (Alt+T)';

  if (variant === 'switch') {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-2xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/70 dark:border-slate-700 ${className}`}
        role="group"
        aria-label="Theme selection"
      >
        <button
          type="button"
          onClick={() => {
            if (isDark) {
              playChime('tap');
              setTheme('light');
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            !isDark
              ? 'bg-white text-amber-600 shadow-xs border border-slate-200'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          aria-pressed={!isDark}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isDark) {
              playChime('tap');
              setTheme('dark');
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            isDark
              ? 'bg-slate-900 text-sky-400 shadow-xs border border-slate-700'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          aria-pressed={isDark}
        >
          <Moon className="w-3.5 h-3.5 text-sky-400" />
          <span>Dark</span>
        </button>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={showTooltip ? tooltipTitle : undefined}
        aria-label={tooltipTitle}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
          isDark
            ? 'bg-slate-850 hover:bg-slate-800 text-sky-300 border-slate-700/80 shadow-2xs'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 shadow-2xs'
        } ${className}`}
      >
        {isDark ? (
          <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-indigo-600" />
        )}
        <span>{isDark ? 'Light' : 'Dark'}</span>
      </button>
    );
  }

  // Default: 'icon-only'
  return (
    <button
      type="button"
      onClick={handleToggle}
      title={showTooltip ? tooltipTitle : undefined}
      aria-label={tooltipTitle}
      className={`relative p-2 rounded-xl text-xs font-medium transition-all active:scale-90 border group flex items-center justify-center ${
        isDark
          ? 'bg-slate-850 hover:bg-slate-800 text-amber-300 border-slate-700 hover:border-amber-400/40 shadow-xs shadow-amber-500/10'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 hover:border-slate-300 shadow-2xs'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 transition-transform duration-300 group-hover:-rotate-12" />
      )}
    </button>
  );
};
