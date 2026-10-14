import React, { useState, useEffect } from 'react';
import { Sparkles, Volume2, Globe, Download, WifiOff, Check } from 'lucide-react';
import type { UserProgress, CEFRLevel, NativeLanguage } from '../types';
import { promptPWAInstall, subscribeToInstallPrompt } from '../pwa';
import { playChime } from '../services/speech';

interface NavbarProps {
  progress: UserProgress;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
  onOpenInstallGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  progress,
  onUpdateProgress,
  onOpenInstallGuide,
}) => {
  const [canInstall, setCanInstall] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showLevelMenu, setShowLevelMenu] = useState(false);

  useEffect(() => {
    const unsub = subscribeToInstallPrompt((available) => {
      setCanInstall(available);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    playChime('tap');
    if (canInstall) {
      const outcome = await promptPWAInstall();
      if (outcome === 'accepted') {
        playChime('success');
      }
    } else {
      onOpenInstallGuide();
    }
  };

  const handleSpeedToggle = () => {
    playChime('tap');
    onUpdateProgress((prev) => ({
      ...prev,
      audioSpeed: prev.audioSpeed === 0.75 ? 0.9 : prev.audioSpeed === 0.9 ? 1.0 : 0.75,
    }));
  };

  const languages: NativeLanguage[] = [
    'Spanish',
    'Mandarin',
    'Japanese',
    'Portuguese',
    'Arabic',
    'French',
    'Vietnamese',
    'German',
  ];

  const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

  return (
    <header className="sticky top-0 z-40 w-full glass-card border-b border-slate-200/80 shadow-sm transition-all">
      <div className="max-w-xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Logo and Brand Name */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-emerald-400 text-white shadow-soft shadow-brand-500/20">
            <Sparkles className="w-5 h-5 text-amber-200 animate-pulse-subtle" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">✓</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-brand-900 to-brand-700 bg-clip-text text-transparent">
                FluencyAI
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-brand-50 text-brand-700 border border-brand-200/60">
                Tutor
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">English Speaking Companion</p>
          </div>
        </div>

        {/* Quick controls: Speed, Lang, Streak, Install */}
        <div className="flex items-center gap-1.5">
          {/* Audio Speech Speed Toggle (Crucial for non-native learners) */}
          <button
            onClick={handleSpeedToggle}
            title="Adjust listening playback speed"
            aria-label="Toggle speech speed"
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-95"
          >
            <Volume2 className="w-3.5 h-3.5 text-brand-600" />
            <span>{progress.audioSpeed}x</span>
          </button>

          {/* CEFR Level Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowLevelMenu(!showLevelMenu);
                setShowLangMenu(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-bold transition active:scale-95"
              title="Target English Level"
            >
              <span>{progress.level}</span>
            </button>

            {showLevelMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white shadow-soft-lg border border-slate-200 py-2 z-50 animate-slide-up">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Target Proficiency
                </div>
                {levels.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      onUpdateProgress((prev) => ({ ...prev, level: lvl }));
                      setShowLevelMenu(false);
                      playChime('tap');
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between hover:bg-brand-50 transition ${
                      progress.level === lvl ? 'text-brand-600 font-bold bg-brand-50/50' : 'text-slate-700'
                    }`}
                  >
                    <span>
                      Level {lvl} {lvl === 'A1' ? '• Beginner' : lvl === 'B1' ? '• Intermediate' : lvl === 'C1' ? '• Advanced' : ''}
                    </span>
                    {progress.level === lvl && <Check className="w-3.5 h-3.5 text-brand-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Native Language Translator Helper */}
          <div className="relative">
            <button
              onClick={() => {
                setShowLangMenu(!showLangMenu);
                setShowLevelMenu(false);
              }}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition active:scale-95"
              title={`Translations shown in ${progress.nativeLanguage}`}
              aria-label="Select native language for translations"
            >
              <Globe className="w-4 h-4 text-slate-700" />
            </button>

            {showLangMenu && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white shadow-soft-lg border border-slate-200 py-2 z-50 animate-slide-up">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Translation Helper
                </div>
                {languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      onUpdateProgress((prev) => ({ ...prev, nativeLanguage: lang }));
                      setShowLangMenu(false);
                      playChime('tap');
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between hover:bg-brand-50 transition ${
                      progress.nativeLanguage === lang ? 'text-brand-600 font-bold bg-brand-50/50' : 'text-slate-700'
                    }`}
                  >
                    <span>{lang}</span>
                    {progress.nativeLanguage === lang && <Check className="w-3.5 h-3.5 text-brand-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PWA Install Button */}
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white text-xs font-semibold shadow-sm hover:shadow transition active:scale-95"
            title="Install app to your home screen"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Install</span>
          </button>
        </div>
      </div>

      {/* Connectivity & Offline Indicator */}
      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 px-4 py-1 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline mode active • Roleplays and audio vocabulary are ready from cache</span>
        </div>
      )}
    </header>
  );
};
