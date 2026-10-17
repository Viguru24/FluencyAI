import React, { useState, useEffect } from 'react';
import { Sparkles, Volume2, Globe, Download, WifiOff, Check, Crown } from 'lucide-react';
import type { UserProgress, CEFRLevel, NativeLanguage, AuthSession, AIPersona } from '../types';
import { promptPWAInstall, subscribeToInstallPrompt } from '../pwa';
import { playChime } from '../services/speech';
import { getLLMConfig, testGatewayConnection, type LLMConfig } from '../services/llmConfig';
import { AIGatewaySettingsModal } from './AIGatewaySettingsModal';
import { UserProfileModal } from './UserProfileModal';
import { UserAvatar } from './UserAvatar';
import { ThemeToggle } from './ThemeToggle';
import { authService } from '../services/authService';
import { formatDisplayName } from '../utils/nameFormatter';
import { useGamificationStore, getAvailableAudioSpeeds } from '../store/rewardSystem';

interface NavbarProps {
  progress: UserProgress;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
  onOpenInstallGuide: () => void;
  onOpenPlacement?: () => void;
  activePersona?: AIPersona;
  onOpenPersonaSelector?: () => void;
  onOpenRoadmap?: () => void;
  onOpenPricing?: () => void;
  onOpenOnboarding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  progress,
  onUpdateProgress,
  onOpenInstallGuide,
  onOpenPlacement,
  activePersona,
  onOpenPersonaSelector,
  onOpenRoadmap,
  onOpenPricing,
  onOpenOnboarding,
}) => {
  const {
    currentTier,
    currentTierConfig,
    progressToNextTier,
    unlockedPerks,
    totalXP,
  } = useGamificationStore();

  const [canInstall, setCanInstall] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => authService.getSession());
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(getLLMConfig);
  const [isGatewayConnected, setIsGatewayConnected] = useState<boolean>(() => {
    const conf = getLLMConfig();
    return Boolean(conf.apiKey && conf.apiKey.length > 5);
  });

  const checkGateway = async (conf: LLMConfig) => {
    if (!conf.apiKey || conf.apiKey.length < 5) {
      setIsGatewayConnected(false);
      return;
    }
    const res = await testGatewayConnection(conf);
    setIsGatewayConnected(res.ok);
  };

  useEffect(() => {
    const unsub = subscribeToInstallPrompt((available) => {
      setCanInstall(available);
    });

    const handleOnline = () => {
      setIsOnline(true);
      checkGateway(getLLMConfig());
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsGatewayConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const initialConf = getLLMConfig();
    if (initialConf.apiKey && initialConf.apiKey.length >= 5) {
      testGatewayConnection(initialConf).then((res) => {
        setIsGatewayConnected(res.ok);
      });
    }

    const handleConfigChange = (e: Event) => {
      const customEvt = e as CustomEvent<LLMConfig>;
      const updated = customEvt.detail || getLLMConfig();
      setLlmConfig(updated);
      checkGateway(updated);
    };

    window.addEventListener('fluency_llm_config_changed', handleConfigChange);

    const unsubAuth = authService.onAuthStateChange((sess) => {
      setAuthSession(sess);
    });

    return () => {
      unsub();
      unsubAuth();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('fluency_llm_config_changed', handleConfigChange);
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
    const available = getAvailableAudioSpeeds(currentTier)
      .filter((opt) => opt.unlocked)
      .map((opt) => opt.speed);

    const speeds = available.length > 0 ? available : [0.85];
    const currentIndex = speeds.indexOf(progress.audioSpeed);
    const nextSpeed =
      currentIndex >= 0
        ? speeds[(currentIndex + 1) % speeds.length]
        : speeds[0];

    onUpdateProgress((prev) => ({
      ...prev,
      audioSpeed: nextSpeed,
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
    <>
      <header className="sticky top-0 z-40 w-full glass-card border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Logo and Brand Name */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-emerald-400 text-white shadow-soft shadow-brand-500/20">
              <Sparkles className="w-5 h-5 text-amber-200 animate-pulse-subtle" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">✓</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-brand-900 to-brand-700 dark:from-white dark:via-brand-200 dark:to-brand-400 bg-clip-text text-transparent">
                  FluencyAI
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300/60 dark:border-slate-700">
                  Tutor
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block">English Speaking Companion</p>
            </div>
          </div>

          {/* Streamlined Header Controls */}
          <div className="flex items-center gap-1.5">
            {/* Coach Selector Pill */}
            {onOpenPersonaSelector && (
              <button
                onClick={onOpenPersonaSelector}
                title="Switch English Coach"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition active:scale-95 shadow-2xs"
              >
                <span className="text-sm">{activePersona?.avatar || '🧑‍💼'}</span>
                <span className="hidden sm:inline font-bold">{activePersona?.name || 'James'}</span>
              </button>
            )}

            {/* CEFR Level & Audio Speed Menu */}
            <div className="relative flex items-center gap-1">
              <button
                onClick={handleSpeedToggle}
                title="Adjust listening playback speed"
                aria-label="Toggle speech speed"
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition active:scale-95"
              >
                <Volume2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>{progress.audioSpeed}x</span>
              </button>

              <button
                onClick={() => {
                  setShowLevelMenu(!showLevelMenu);
                  setShowLangMenu(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition active:scale-95 shadow-2xs"
                title="Target English Level"
              >
                <span className="px-1.5 py-0.5 rounded-md bg-brand-500/15 dark:bg-brand-500/25 text-brand-600 dark:text-brand-300 text-[10px] font-black">
                  CEFR
                </span>
                <span className="font-extrabold text-slate-900 dark:text-white">{progress.level}</span>
              </button>

              {showLevelMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 shadow-soft-lg border border-slate-200 dark:border-slate-800 py-2 z-50 animate-slide-up">
                  <div className="px-3.5 py-1.5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
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
                      className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition ${
                        progress.level === lvl
                          ? 'text-brand-700 dark:text-white font-black bg-brand-500/15 dark:bg-brand-500/30'
                          : 'text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>
                        Level {lvl} {lvl === 'A1' ? '• Beginner' : lvl === 'B1' ? '• Intermediate' : lvl === 'C1' ? '• Advanced' : ''}
                      </span>
                      {progress.level === lvl && <Check className="w-4 h-4 text-brand-600 dark:text-brand-300 stroke-[3]" />}
                    </button>
                  ))}
                  <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
                  <button
                    onClick={() => {
                      playChime('tap');
                      setShowLevelMenu(false);
                      onOpenPlacement?.();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-black text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Take Placement Check</span>
                  </button>
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
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-95"
                title={`Translations shown in ${progress.nativeLanguage}`}
                aria-label="Select native language for translations"
              >
                <Globe className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              </button>

              {showLangMenu && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 shadow-soft-lg border border-slate-200 dark:border-slate-800 py-2 z-50 animate-slide-up">
                  <div className="px-3.5 py-1.5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
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
                      className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition ${
                        progress.nativeLanguage === lang
                          ? 'text-brand-700 dark:text-white font-black bg-brand-500/15 dark:bg-brand-500/30'
                          : 'text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{lang}</span>
                      {progress.nativeLanguage === lang && <Check className="w-4 h-4 text-brand-600 dark:text-brand-300 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dedicated Dark & Light Mode Button */}
            <ThemeToggle variant="icon-only" />

            {/* Interactive Fluency Tier Pill */}
            <button
              onClick={() => {
                playChime('tap');
                onOpenRoadmap?.();
              }}
              className={`hidden md:flex group items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 shadow-2xs hover:shadow-xs ${currentTierConfig.badgeAccent.pillBg}`}
              title={`Fluency Tier: ${currentTierConfig.name} (${totalXP.toLocaleString()} Lifetime XP) • Click to open Rewards Roadmap`}
            >
              <span className="text-sm leading-none group-hover:scale-110 transition-transform">
                {currentTierConfig.badgeAccent.icon}
              </span>
              <div className="flex flex-col text-left">
                <span className="font-black tracking-tight leading-none text-[11px] text-slate-900 dark:text-white">
                  {currentTierConfig.shortName}
                </span>
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${progressToNextTier}%` }}
                  />
                </div>
              </div>
            </button>

            {/* Pricing / Pro Upgrade Button */}
            {onOpenPricing && (
              <button
                onClick={() => {
                  playChime('tap');
                  onOpenPricing();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 text-amber-700 dark:text-amber-300 border border-amber-300/40 dark:border-amber-500/30 text-xs font-black transition active:scale-95 shadow-2xs group"
                title="View Plans & Pricing"
              >
                <Crown className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
                <span className="hidden sm:inline">Pricing</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500 text-white leading-none">
                  Pro
                </span>
              </button>
            )}

            {/* User Profile, Cloud Sync & Subtle AI Gateway Status Dot */}
            {(() => {
              const rawName = authSession ? authSession.user.name : (progress.name !== 'Alex' ? progress.name : '');
              const formattedName = formatDisplayName(rawName);
              const buttonLabel = formattedName || 'Profile';
              const pictureUrl = authSession?.user?.picture || progress.avatar;

              return (
                <button
                  onClick={() => {
                    playChime('tap');
                    setShowProfileModal(true);
                  }}
                  className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 shadow-2xs ${
                    authSession
                      ? 'bg-gradient-to-r from-brand-50 to-emerald-50/80 dark:from-brand-950/60 dark:to-emerald-950/60 text-brand-900 dark:text-brand-200 border-brand-200 dark:border-brand-800 hover:bg-brand-100'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                  title={
                    isGatewayConnected
                      ? `${buttonLabel} • AI Connected (${llmConfig.model})`
                      : `${buttonLabel} • AI in Mock Mode (Click to configure)`
                  }
                >
                  <UserAvatar
                    picture={pictureUrl}
                    name={formattedName}
                    size="xs"
                    showOnlineDot={Boolean(authSession)}
                    hasDiamondBorder={currentTier === 'diamond' || unlockedPerks.includes('diamond-avatar-border')}
                  />
                  <span className="max-w-[90px] sm:max-w-[130px] truncate font-extrabold text-slate-900 dark:text-slate-100">
                    {buttonLabel}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isGatewayConnected
                        ? 'bg-emerald-500 shadow-xs shadow-emerald-400'
                        : 'bg-rose-500 animate-pulse'
                    }`}
                    title={isGatewayConnected ? 'AI Gateway Connected' : 'AI Gateway Offline'}
                  />
                </button>
              );
            })()}

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

      {/* AI Gateway Settings Modal */}
      {showGatewayModal && (
        <AIGatewaySettingsModal
          isOpen={showGatewayModal}
          onClose={() => setShowGatewayModal(false)}
          onConnectionStatusChange={(ok) => setIsGatewayConnected(ok)}
        />
      )}

      {/* User Profile, Cloud Sync & AI Gateway Settings Modal */}
      {showProfileModal && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          progress={progress}
          onUpdateProgress={onUpdateProgress}
          onOpenPlacement={onOpenPlacement}
          onOpenGatewaySettings={() => setShowGatewayModal(true)}
          onOpenPricing={onOpenPricing}
          onOpenOnboarding={onOpenOnboarding}
          isGatewayConnected={isGatewayConnected}
          llmModelLabel={llmConfig.model}
        />
      )}
    </>
  );
};
