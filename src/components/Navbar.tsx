import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  Globe,
  Download,
  WifiOff,
  Check,
  Crown,
  Menu,
  X,
  ChevronDown,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react';
import type { UserProgress, CEFRLevel, NativeLanguage, AuthSession, AIPersona } from '../types';
import { promptPWAInstall, subscribeToInstallPrompt } from '../pwa';
import { playChime } from '../services/speech';
import { getLLMConfig, testGatewayConnection, type LLMConfig } from '../services/llmConfig';
const AIGatewaySettingsModal = React.lazy(() => import('./AIGatewaySettingsModal').then((m) => ({ default: m.AIGatewaySettingsModal })));
const UserProfileModal = React.lazy(() => import('./UserProfileModal').then((m) => ({ default: m.UserProfileModal })));
const DiagnosticLogsModal = React.lazy(() => import('./DiagnosticLogsModal').then((m) => ({ default: m.DiagnosticLogsModal })));
import { UserAvatar } from './UserAvatar';
import { ThemeToggle } from './ThemeToggle';
import { authService } from '../services/authService';
import { formatDisplayName } from '../utils/nameFormatter';
import { useGamificationStore, getAvailableAudioSpeeds } from '../store/rewardSystem';
import { FluencyLogo } from './FluencyLogo';
import { isDevMode } from '../utils/devMode';
import { navigationHistory } from '../services/navigationHistory';

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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
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

  const openGatewayModal = () => {
    playChime('tap');
    setShowGatewayModal(true);
    navigationHistory.pushView('gateway');
  };

  const closeGatewayModal = () => {
    setShowGatewayModal(false);
    navigationHistory.navigateToHome();
  };

  const openProfileModal = () => {
    playChime('tap');
    setShowMobileMenu(false);
    setShowProfileModal(true);
    navigationHistory.pushView('profile');
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    navigationHistory.navigateToHome();
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

    const handleCloseNavModals = () => {
      setShowGatewayModal(false);
      setShowProfileModal(false);
      setShowMobileMenu(false);
      setShowLangMenu(false);
      setShowLevelMenu(false);
    };

    window.addEventListener('fluency_close_nav_modals', handleCloseNavModals);
    window.addEventListener('fluency_llm_config_changed', handleConfigChange);

    const unsubAuth = authService.onAuthStateChange((sess) => {
      setAuthSession(sess);
    });

    return () => {
      unsub();
      unsubAuth();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('fluency_close_nav_modals', handleCloseNavModals);
      window.removeEventListener('fluency_llm_config_changed', handleConfigChange);
    };
  }, []);

  const handleInstallClick = async () => {
    playChime('tap');
    setShowMobileMenu(false);
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

  const rawName = authSession ? authSession.user.name : (progress.name !== 'Alex' ? progress.name : '');
  const formattedName = formatDisplayName(rawName);
  const buttonLabel = formattedName || 'Profile';
  const pictureUrl = authSession?.user?.picture || progress.avatar;

  const devMode = isDevMode();

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-card border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all pt-safe">
        <div className="max-w-5xl mx-auto px-2.5 sm:px-6 py-2 flex items-center justify-between gap-1.5 sm:gap-3 min-w-0">
          {/* Official Brand Logo */}
          <div className="shrink-0 flex items-center">
            <FluencyLogo size="sm" />
          </div>

          {/* Desktop Controls (lg and up: >= 1024px) */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            {/* Clean Status Pill for Production Users / Dev Gateway Pill in Dev Mode */}
            {devMode ? (
              <button
                onClick={openGatewayModal}
                title={`AI Gateway (${llmConfig.model})`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition active:scale-95"
              >
                <span className="shrink-0">{isGatewayConnected ? '🟢' : '🔴'}</span>
                <span className="truncate max-w-[130px]">{llmConfig.model}</span>
              </button>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70 text-xs font-bold shrink-0"
                title="AI English Coach is online and ready"
              >
                <span className="text-[10px] leading-none shrink-0">🟢</span>
                <span>Coach Online</span>
              </span>
            )}

            {/* Coach Selector Pill */}
            {onOpenPersonaSelector && (
              <button
                onClick={onOpenPersonaSelector}
                title="Switch English Coach"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition active:scale-95 shadow-2xs shrink-0"
              >
                <span className="text-sm shrink-0">{activePersona?.avatar || '🧑‍💼'}</span>
                <span className="font-bold">{activePersona?.name || 'James'}</span>
              </button>
            )}

            {/* CEFR Level & Audio Speed Menu */}
            <div className="relative flex items-center gap-1 shrink-0">
              <button
                onClick={handleSpeedToggle}
                title="Adjust listening playback speed"
                aria-label="Toggle speech speed"
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition active:scale-95 shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                <span>{progress.audioSpeed}x</span>
              </button>

              <button
                onClick={() => {
                  setShowLevelMenu(!showLevelMenu);
                  setShowLangMenu(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition active:scale-95 shadow-2xs shrink-0"
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
                      {progress.level === lvl && <Check className="w-4 h-4 text-brand-600 dark:text-brand-300 stroke-[3] shrink-0" />}
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
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Take Placement Check</span>
                  </button>
                </div>
              )}
            </div>

            {/* Native Language Translator Helper */}
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setShowLangMenu(!showLangMenu);
                  setShowLevelMenu(false);
                }}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-95"
                title={`Translations shown in ${progress.nativeLanguage}`}
                aria-label="Select native language for translations"
              >
                <Globe className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
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
                      {progress.nativeLanguage === lang && <Check className="w-4 h-4 text-brand-600 dark:text-brand-300 stroke-[3] shrink-0" />}
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
              className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 shadow-2xs hover:shadow-xs shrink-0 ${currentTierConfig.badgeAccent.pillBg}`}
              title={`Fluency Tier: ${currentTierConfig.name} (${totalXP.toLocaleString()} Lifetime XP) • Click to open Rewards Roadmap`}
            >
              <span className="text-sm leading-none group-hover:scale-110 transition-transform shrink-0">
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 text-amber-700 dark:text-amber-300 border border-amber-300/40 dark:border-amber-500/30 text-xs font-black transition active:scale-95 shadow-2xs group shrink-0"
                title="View Plans & Pricing"
              >
                <Crown className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform shrink-0" />
                <span>Pricing</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500 text-white leading-none">
                  Pro
                </span>
              </button>
            )}

            {/* User Profile & Cloud Sync */}
            <button
              onClick={openProfileModal}
              className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 shadow-2xs shrink-0 ${
                authSession
                  ? 'bg-gradient-to-r from-brand-50 to-emerald-50/80 dark:from-brand-950/60 dark:to-emerald-950/60 text-brand-900 dark:text-brand-200 border-brand-200 dark:border-brand-800 hover:bg-brand-100'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title={
                devMode
                  ? isGatewayConnected
                    ? `${buttonLabel} • AI Connected (${llmConfig.model})`
                    : `${buttonLabel} • AI in Mock Mode (Click to configure)`
                  : `${buttonLabel} • Account & Preferences`
              }
            >
              <UserAvatar
                picture={pictureUrl}
                name={formattedName}
                size="xs"
                showOnlineDot={Boolean(authSession)}
                hasDiamondBorder={currentTier === 'diamond' || unlockedPerks.includes('diamond-avatar-border')}
              />
              <span className="max-w-[140px] truncate font-extrabold text-slate-900 dark:text-slate-100">
                {buttonLabel}
              </span>
              {devMode && (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isGatewayConnected
                      ? 'bg-emerald-500 shadow-xs shadow-emerald-400'
                      : 'bg-rose-500 animate-pulse'
                  }`}
                  title={isGatewayConnected ? 'AI Gateway Connected' : 'AI Gateway Offline'}
                />
              )}
            </button>

            {/* PWA Install Button */}
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white text-xs font-semibold shadow-sm hover:shadow transition active:scale-95 shrink-0"
              title="Install app to your home screen"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Install</span>
            </button>
          </div>

          {/* Mobile & Tablet Controls (< lg): Clean, balanced, never crowded */}
          <div className="flex lg:hidden items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
            {/* Streak Badge (Shown on tablet/wide screens; on mobile < sm, displayed right below in the greeting) */}
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/70 text-xs font-black shrink-0"
              title={`${progress.streakDays} Day Practice Streak`}
            >
              <span className="shrink-0 leading-none">🔥</span>
              <span>{progress.streakDays} Days</span>
            </span>

            {/* Fluency Tier Pill (Shown on tablet/wide screens) */}
            <button
              onClick={() => {
                playChime('tap');
                onOpenRoadmap?.();
              }}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-black transition active:scale-95 shrink-0 ${currentTierConfig.badgeAccent.pillBg}`}
              title={`Fluency Tier: ${currentTierConfig.name}`}
            >
              <span className="shrink-0 leading-none">{currentTierConfig.badgeAccent.icon}</span>
              <span className="text-slate-900 dark:text-white">{currentTierConfig.shortName}</span>
            </button>

            {/* Quick Profile Avatar Button */}
            <button
              onClick={openProfileModal}
              aria-label="Open User Profile"
              className={`relative flex items-center gap-1 p-1 rounded-xl border transition active:scale-95 shrink-0 ${
                authSession
                  ? 'bg-brand-50/90 dark:bg-brand-950/60 border-brand-200 dark:border-brand-800'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <UserAvatar
                picture={pictureUrl}
                name={formattedName}
                size="xs"
                showOnlineDot={Boolean(authSession)}
                hasDiamondBorder={currentTier === 'diamond' || unlockedPerks.includes('diamond-avatar-border')}
              />
            </button>

            {/* High-Contrast Pull-Down Menu Button — Un-squashed on 360px */}
            <button
              onClick={() => {
                playChime('tap');
                setShowMobileMenu((prev) => !prev);
              }}
              aria-expanded={showMobileMenu}
              aria-label="Toggle quick settings pull-down menu"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-black transition active:scale-95 shadow-sm shrink-0 ${
                showMobileMenu
                  ? 'bg-rose-600 text-white border-rose-500 shadow-rose-500/25'
                  : 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white border-brand-400/40 shadow-brand-600/20 hover:from-brand-500 hover:to-indigo-500'
              }`}
            >
              {showMobileMenu ? (
                <>
                  <X className="w-4 h-4 stroke-[2.5] shrink-0" />
                  <span className="hidden xs:inline sm:inline">Close</span>
                </>
              ) : (
                <>
                  <Menu className="w-4 h-4 stroke-[2.5] shrink-0" />
                  <span className="hidden sm:inline">Menu</span>
                  <ChevronDown className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Pull-Down Drawer Menu (< lg) */}
        {showMobileMenu && (
          <div className="lg:hidden border-t border-slate-200/80 dark:border-slate-800/80 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl px-4 py-4 shadow-soft-lg animate-slide-up max-h-[82dvh] overflow-y-auto">
            <div className="space-y-4 max-w-lg mx-auto">
              {/* Top Row: User Profile, Fluency Tier & Coach Online Status */}
              <div className="flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black">
                  <span>🟢</span>
                  <span>Coach Online</span>
                </span>
                <span className="text-[11px] font-black text-amber-700 dark:text-amber-300">
                  🔥 {progress.streakDays}d Streak • {totalXP.toLocaleString()} XP
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={openProfileModal}
                  className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-left transition active:scale-98"
                >
                  <UserAvatar
                    picture={pictureUrl}
                    name={formattedName}
                    size="sm"
                    showOnlineDot={Boolean(authSession)}
                    hasDiamondBorder={currentTier === 'diamond' || unlockedPerks.includes('diamond-avatar-border')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-slate-900 dark:text-white leading-tight break-words">
                      {buttonLabel}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
                      <span className="truncate">
                        {authSession ? 'Cloud Synced' : 'My Profile'}
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    playChime('tap');
                    setShowMobileMenu(false);
                    onOpenRoadmap?.();
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition active:scale-98 ${currentTierConfig.badgeAccent.pillBg}`}
                >
                  <span className="text-xl leading-none shrink-0">{currentTierConfig.badgeAccent.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {currentTierConfig.shortName}
                    </div>
                    <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {totalXP.toLocaleString()} XP • Roadmap
                    </div>
                  </div>
                </button>
              </div>

              {/* Target CEFR Level Selection */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Target English Level (CEFR)
                  </span>
                  {onOpenPlacement && (
                    <button
                      onClick={() => {
                        playChime('tap');
                        setShowMobileMenu(false);
                        onOpenPlacement();
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-black text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Placement Check</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {levels.map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        onUpdateProgress((prev) => ({ ...prev, level: lvl }));
                        playChime('tap');
                      }}
                      className={`py-2 rounded-xl text-xs font-black transition active:scale-95 border ${
                        progress.level === lvl
                          ? 'bg-brand-600 text-white border-brand-500 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Speed & Coach Switcher Row */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleSpeedToggle}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-left transition active:scale-95"
                >
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Voice Speed
                    </div>
                    <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span>{progress.audioSpeed}x Playback</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300 text-[10px] font-black">
                    Tap
                  </span>
                </button>

                {onOpenPersonaSelector && (
                  <button
                    onClick={() => {
                      playChime('tap');
                      setShowMobileMenu(false);
                      onOpenPersonaSelector();
                    }}
                    className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/70 text-left transition active:scale-95"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        AI Coach
                      </div>
                      <div className="text-xs font-black text-indigo-950 dark:text-indigo-200 mt-0.5 truncate flex items-center gap-1">
                        <span>{activePersona?.avatar || '🧑‍💼'}</span>
                        <span className="truncate">{activePersona?.name || 'James'}</span>
                      </div>
                    </div>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                  </button>
                )}
              </div>

              {/* Native Translation Helper Language */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  <Globe className="w-3.5 h-3.5 text-brand-500" />
                  <span>Translation Helper ({progress.nativeLanguage})</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        onUpdateProgress((prev) => ({ ...prev, nativeLanguage: lang }));
                        playChime('tap');
                      }}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-bold truncate transition active:scale-95 border ${
                        progress.nativeLanguage === lang
                          ? 'bg-brand-600 text-white border-brand-500 font-black shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Utility Bar: Theme Toggle, Pro Plans, Install App */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <ThemeToggle variant="pill" />
                  {onOpenPricing && (
                    <button
                      onClick={() => {
                        playChime('tap');
                        setShowMobileMenu(false);
                        onOpenPricing();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 text-amber-700 dark:text-amber-300 border border-amber-300/50 dark:border-amber-500/30 text-xs font-black transition active:scale-95"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span>Pro Plans</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      playChime('tap');
                      setShowMobileMenu(false);
                      setShowLogsModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition active:scale-95"
                    title="Device & Microphone Logs"
                  >
                    <Terminal className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    <span>Logs</span>
                  </button>
                </div>

                <button
                  onClick={handleInstallClick}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install App</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connectivity & Offline Indicator */}
        {!isOnline && (
          <div className="bg-amber-500 text-amber-950 px-4 py-1 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all">
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Offline mode active • Roleplays & audio ready from cache</span>
          </div>
        )}
      </header>

      {/* Backdrop for Mobile Pull-Down Menu */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* AI Gateway Settings Modal */}
      {showGatewayModal && (
        <React.Suspense fallback={null}>
          <AIGatewaySettingsModal
            isOpen={showGatewayModal}
            onClose={closeGatewayModal}
            onConnectionStatusChange={(ok) => setIsGatewayConnected(ok)}
          />
        </React.Suspense>
      )}

      {/* User Profile, Cloud Sync & AI Gateway Settings Modal */}
      {showProfileModal && (
        <React.Suspense fallback={null}>
          <UserProfileModal
            isOpen={showProfileModal}
            onClose={closeProfileModal}
            progress={progress}
            onUpdateProgress={onUpdateProgress}
            onOpenPlacement={onOpenPlacement}
            onOpenGatewaySettings={openGatewayModal}
            onOpenPricing={onOpenPricing}
            onOpenOnboarding={onOpenOnboarding}
            isGatewayConnected={isGatewayConnected}
            llmModelLabel={llmConfig.model}
          />
        </React.Suspense>
      )}

      {/* Device & Voice Diagnostic Logs Modal */}
      {showLogsModal && (
        <React.Suspense fallback={null}>
          <DiagnosticLogsModal
            isOpen={showLogsModal}
            onClose={() => setShowLogsModal(false)}
          />
        </React.Suspense>
      )}
    </>
  );
};
