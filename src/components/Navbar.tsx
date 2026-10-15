import React, { useState, useEffect } from 'react';
import { Sparkles, Volume2, Globe, Download, WifiOff, Check, Server, User } from 'lucide-react';
import type { UserProgress, CEFRLevel, NativeLanguage, AuthSession } from '../types';
import { promptPWAInstall, subscribeToInstallPrompt } from '../pwa';
import { playChime } from '../services/speech';
import { getLLMConfig, testGatewayConnection, type LLMConfig } from '../services/llmConfig';
import { AIGatewaySettingsModal } from './AIGatewaySettingsModal';
import { UserProfileModal } from './UserProfileModal';
import { authService } from '../services/authService';

interface NavbarProps {
  progress: UserProgress;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
  onOpenInstallGuide: () => void;
  onOpenJamesTest?: () => void;
  onOpenPlacement?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  progress,
  onUpdateProgress,
  onOpenInstallGuide,
  onOpenJamesTest,
  onOpenPlacement,
}) => {
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
    <>
      <header className="sticky top-0 z-40 w-full glass-card border-b border-slate-200/80 shadow-sm transition-all">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
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

            {/* Quick controls: Speed, Lang, Level, Install */}
            <div className="flex items-center gap-1.5">
              {/* Audio Speech Speed Toggle */}
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
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      onClick={() => {
                        playChime('tap');
                        setShowLevelMenu(false);
                        onOpenPlacement?.();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-bold text-brand-600 hover:bg-brand-50 transition flex items-center gap-1.5"
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

              {/* User Profile & VPS Cloud Sync Button */}
              <button
                onClick={() => {
                  playChime('tap');
                  setShowProfileModal(true);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 shadow-2xs ${
                  authSession
                    ? 'bg-gradient-to-r from-brand-50 to-emerald-50/80 text-brand-900 border-brand-200 hover:bg-brand-100'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title={
                  authSession
                    ? `Signed in as ${authSession.user.name} • VPS Synced`
                    : 'Sign in to sync your XP, streak, and level with VPS backend'
                }
              >
                <div className="relative flex items-center justify-center w-5 h-5 rounded-lg bg-white border border-slate-200/80 text-xs shadow-2xs overflow-hidden flex-shrink-0">
                  {authSession?.user?.picture ? (
                    authSession.user.picture.startsWith('http') || authSession.user.picture.startsWith('data:') ? (
                      <img src={authSession.user.picture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{authSession.user.picture}</span>
                    )
                  ) : progress.avatar ? (
                    <span>{progress.avatar}</span>
                  ) : (
                    <User className="w-3.5 h-3.5 text-brand-700" />
                  )}
                  {authSession && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                  )}
                </div>
                <span className="max-w-[80px] truncate font-extrabold text-slate-900">
                  {authSession ? authSession.user.name : progress.name !== 'Alex' ? progress.name : 'Sign In'}
                </span>
              </button>

              {/* James Test Area Button */}
              {onOpenJamesTest && (
                <button
                  onClick={() => {
                    playChime('tap');
                    onOpenJamesTest();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-brand-600 hover:from-amber-400 hover:to-brand-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
                  title="Open James Test Lab (Talk to James directly, 0 word prep)"
                >
                  <span>🧑‍💼</span>
                  <span>Test James</span>
                </button>
              )}

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

          {/* AI Gateway Settings live connection status pill button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                playChime('tap');
                setShowGatewayModal(true);
              }}
              title={
                isGatewayConnected
                  ? `AI Gateway Connected (${llmConfig.provider === 'freellmapi' ? 'FreeLLMAPI on port 31415' : 'Direct Gemini'})`
                  : 'AI Gateway Offline / Mock Mode — Click to Add Unified Key'
              }
              aria-label="AI Gateway Settings"
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-[0.99] shadow-2xs ${
                isGatewayConnected
                  ? 'bg-emerald-50/95 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50/95 text-rose-800 border-rose-200 hover:bg-rose-100 animate-pulse-subtle'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isGatewayConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-400' : 'bg-rose-500'
                  }`}
                />
                <span className="font-bold tracking-tight">
                  {isGatewayConnected
                    ? llmConfig.provider === 'freellmapi'
                      ? '🟢 FreeLLMAPI Connected'
                      : '🟢 Gemini Connected'
                    : '🔴 Offline / Mock Mode — Click to Add Key'}
                </span>
                {isGatewayConnected && (
                  <span className="hidden sm:inline text-[10px] text-emerald-600 font-mono font-medium">
                    ({llmConfig.model})
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Server className="w-3 h-3 text-brand-600" />
                <span>AI Gateway Settings</span>
              </span>
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

      {/* User Profile & VPS Cloud Sync Modal */}
      {showProfileModal && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          progress={progress}
          onUpdateProgress={onUpdateProgress}
          onOpenPlacement={onOpenPlacement}
        />
      )}
    </>
  );
};
