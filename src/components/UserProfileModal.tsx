import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Sparkles,
  Server,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Flame,
  Award,
  Edit2,
  Check,
  Zap,
  CreditCard,
  Plus,
  Trash2,
  Crown,
  FileText,
  Compass,
  ChevronRight,
} from 'lucide-react';
import {
  authService,
  getAuthProviderUrl,
  setAuthProviderUrl,
  getAuthProviderType,
  setAuthProviderType,
  type AuthProviderType,
} from '../services/authService';
import {
  stripeService,
  detectCardBrand,
  formatCardNumberInput,
  formatExpiryInput,
} from '../services/stripeService';
import type {
  AuthSession,
  UserProgress,
  StripePaymentMethod,
  StripeInvoice,
  SubscriptionDetails,
} from '../types';
import { playChime } from '../services/speech';
import { toast } from '../services/toast';
import { UserAvatar } from './UserAvatar';
import { formatDisplayName, normalizeUserAvatar } from '../utils/nameFormatter';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  progress: UserProgress;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
  onOpenPlacement?: () => void;
  onOpenGatewaySettings?: () => void;
  onOpenPricing?: () => void;
  onOpenOnboarding?: () => void;
  isGatewayConnected?: boolean;
  llmModelLabel?: string;
}

const AVATAR_PRESETS = ['🧑‍💼', '👩‍💼', '🎓', '🚀', '🌟', '🎧', '⚡', '☕', '🇬🇧', '🌍'];

export const UserProfileModal: React.FC<Props> = ({
  isOpen,
  onClose,
  progress,
  onUpdateProgress,
  onOpenPlacement,
  onOpenGatewaySettings,
  onOpenPricing,
  onOpenOnboarding,
  isGatewayConnected,
  llmModelLabel,
}) => {
  const [session, setSession] = useState<AuthSession | null>(() => authService.getSession());
  const [mainTab, setMainTab] = useState<'profile' | 'billing'>('profile');
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'otp' | 'server'>('signin');

  // Sign In / Sign Up Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(() => formatDisplayName(authService.getUser()?.name || progress.name));
  const [editAvatar, setEditAvatar] = useState(() => normalizeUserAvatar(authService.getUser()?.picture || progress.avatar) || '🧑‍💼');

  // VPS Server Config State
  const [serverUrl, setServerUrl] = useState(() => getAuthProviderUrl());
  const [providerType, setProviderState] = useState<AuthProviderType>(() => getAuthProviderType());

  // Stripe & Subscription State
  const [subscription, setSubscription] = useState<SubscriptionDetails>(() =>
    stripeService.getSubscription()
  );
  const [paymentMethods, setPaymentMethods] = useState<StripePaymentMethod[]>(() =>
    stripeService.getPaymentMethods()
  );
  const [invoices, setInvoices] = useState<StripeInvoice[]>(() =>
    stripeService.getInvoices()
  );
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardExp, setNewCardExp] = useState('');
  const [newCardCvc, setNewCardCvc] = useState('');
  const [newCardholderName, setNewCardholderName] = useState(
    () => formatDisplayName(authService.getUser()?.name || progress.name) || 'Alex Morgan'
  );
  const [newCardIsDefault, setNewCardIsDefault] = useState(true);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<StripeInvoice | null>(null);

  // Loading & status states
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = authService.onAuthStateChange((newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setEditName(formatDisplayName(newSession.user.name || ''));
        setEditAvatar(normalizeUserAvatar(newSession.user.picture) || '🧑‍💼');
      }
    });
    return unsub;
  }, []);

  // Listen for Stripe updates
  useEffect(() => {
    const handleSubChange = (e: Event) => {
      const custom = e as CustomEvent<SubscriptionDetails>;
      if (custom.detail) {
        setSubscription(custom.detail);
        setInvoices(stripeService.getInvoices());
      }
    };
    const handlePMChange = (e: Event) => {
      const custom = e as CustomEvent<StripePaymentMethod[]>;
      if (custom.detail) setPaymentMethods(custom.detail);
    };
    window.addEventListener('fluency_subscription_updated', handleSubChange);
    window.addEventListener('fluency_payment_methods_changed', handlePMChange);
    return () => {
      window.removeEventListener('fluency_subscription_updated', handleSubChange);
      window.removeEventListener('fluency_payment_methods_changed', handlePMChange);
    };
  }, []);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    playChime('tap');

    try {
      const { session: newSession } = await authService.loginWithPassword({ email, password });
      playChime('success');
      toast.success(`Welcome back, ${newSession.user.name}!`, 'Signed In');

      // Update local state and sync progress
      onUpdateProgress((prev) => ({
        ...prev,
        name: newSession.user.name || prev.name,
        email: newSession.user.email,
        id: newSession.user.id,
        avatar: newSession.user.picture || prev.avatar,
        level: newSession.user.level || prev.level,
        completedXP: Math.max(prev.completedXP, newSession.user.xp ?? 0),
        streakDays: Math.max(prev.streakDays, newSession.user.streak ?? 0),
      }));

      // Trigger immediate cloud sync
      await authService.syncProgress({
        xp: Math.max(progress.completedXP, newSession.user.xp ?? 0),
        streak: Math.max(progress.streakDays, newSession.user.streak ?? 0),
        level: progress.level,
        name: newSession.user.name || progress.name,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
      toast.error(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please provide an email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    playChime('tap');

    try {
      const { session: newSession } = await authService.signUp({
        email,
        password,
        name: displayName.trim() || undefined,
      });
      playChime('success');
      toast.success(`Account created! Welcome, ${newSession.user.name}!`, 'Account Created');

      onUpdateProgress((prev) => ({
        ...prev,
        name: newSession.user.name || displayName || prev.name,
        email: newSession.user.email,
        id: newSession.user.id,
        avatar: newSession.user.picture || prev.avatar,
      }));

      // Sync local progress to newly created VPS record
      await authService.syncProgress({
        xp: progress.completedXP,
        streak: progress.streakDays,
        level: progress.level,
        name: newSession.user.name || displayName || progress.name,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Account registration failed.');
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    playChime('tap');

    try {
      const res = await authService.requestMagicOtp(email);
      setOtpSent(true);
      playChime('success');
      toast.success(res.message, 'Code Sent');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send security code.');
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otpCode) {
      setErrorMessage('Please enter the 6-digit security code.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    playChime('tap');

    try {
      const { session: newSession } = await authService.verifyMagicOtp({ email, code: otpCode });
      playChime('success');
      toast.success(`Signed in as ${newSession.user.name}!`, 'Magic Link Verified');

      onUpdateProgress((prev) => ({
        ...prev,
        name: newSession.user.name || prev.name,
        email: newSession.user.email,
        id: newSession.user.id,
        avatar: newSession.user.picture || prev.avatar,
        level: newSession.user.level || prev.level,
        completedXP: Math.max(prev.completedXP, newSession.user.xp ?? 0),
        streakDays: Math.max(prev.streakDays, newSession.user.streak ?? 0),
      }));

      await authService.syncProgress({
        xp: Math.max(progress.completedXP, newSession.user.xp ?? 0),
        streak: Math.max(progress.streakDays, newSession.user.streak ?? 0),
        level: progress.level,
        name: newSession.user.name || progress.name,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Code may be invalid or expired.');
      toast.error(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    playChime('tap');
    authService.loginWithGoogle();
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }
    const cleanName = formatDisplayName(editName.trim());
    setIsLoading(true);
    playChime('tap');

    try {
      // 1. Immediately update local progress (Local-First!)
      onUpdateProgress((prev) => ({
        ...prev,
        name: cleanName,
        avatar: editAvatar,
      }));

      // 2. Update authService local session and cloud backend
      await authService.updateProfile({
        name: cleanName,
        picture: editAvatar,
      });

      // 3. Also sync current XP & streak alongside name
      await authService.syncProgress({
        name: cleanName,
        picture: editAvatar,
        xp: progress.completedXP,
        streak: progress.streakDays,
        level: progress.level,
      });

      setIsEditingProfile(false);
      playChime('success');
      toast.success('Profile updated and saved!', 'Profile Saved');
    } catch (err: any) {
      console.warn('[UserProfileModal] Sync warning:', err);
      // Local update was already saved
      setIsEditingProfile(false);
      playChime('success');
      toast.success('Profile updated locally!', 'Profile Saved');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    playChime('tap');

    try {
      const res = await authService.syncProgress({
        xp: progress.completedXP,
        streak: progress.streakDays,
        level: progress.level,
        name: session?.user?.name || progress.name,
        picture: session?.user?.picture || progress.avatar,
        progress_data: {
          completedScenarioIds: progress.completedScenarioIds,
          completedMinutes: progress.completedMinutes,
          dailyGoalMinutes: progress.dailyGoalMinutes,
          dailyGoalXP: progress.dailyGoalXP,
          nativeLanguage: progress.nativeLanguage,
        },
      });

      if (res.user) {
        onUpdateProgress((prev) => ({
          ...prev,
          name: res.user!.name || prev.name,
          completedXP: Math.max(prev.completedXP, res.user!.xp ?? 0),
          streakDays: Math.max(prev.streakDays, res.user!.streak ?? 0),
          level: res.user!.level || prev.level,
        }));
      }

      playChime('success');
      toast.success('XP, streak, and CEFR level synced with VPS database!', 'Cloud Sync Complete');
    } catch (err: any) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    playChime('tap');
    authService.logout();
    toast.success('Logged out from VPS account', 'Signed Out');
  };

  const handleSaveServerConfig = () => {
    playChime('tap');
    setAuthProviderUrl(serverUrl);
    setAuthProviderType(providerType);
    toast.success(`Connected to: ${serverUrl}`, 'Auth Endpoint Saved');
    setActiveTab('signin');
  };

  const handleAddNewCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardNumber.trim()) {
      toast.error('Please enter a card number');
      return;
    }
    const cleanNumber = newCardNumber.replace(/\D/g, '');
    if (cleanNumber.length < 13) {
      toast.error('Card number is incomplete');
      return;
    }
    const cleanExp = newCardExp.replace(/\D/g, '');
    if (cleanExp.length < 4) {
      toast.error('Please enter expiration month and year (MM/YY)');
      return;
    }
    const expM = parseInt(cleanExp.slice(0, 2), 10);
    const expY = parseInt(`20${cleanExp.slice(2, 4)}`, 10);
    if (isNaN(expM) || expM < 1 || expM > 12) {
      toast.error('Invalid expiration month');
      return;
    }

    setIsSavingCard(true);
    playChime('tap');

    try {
      const added = await stripeService.addPaymentMethod({
        cardNumber: newCardNumber,
        expMonth: expM,
        expYear: expY,
        cvc: newCardCvc,
        cardholderName: newCardholderName.trim() || 'Alex Morgan',
        isDefault: newCardIsDefault,
      });

      playChime('success');
      toast.success(
        `Card ending in •••• ${added.last4} saved via Stripe!`,
        'Payment Method Added'
      );
      setPaymentMethods(stripeService.getPaymentMethods());
      setIsAddingCard(false);
      setNewCardNumber('');
      setNewCardExp('');
      setNewCardCvc('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save card');
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleSetDefaultPM = (id: string) => {
    playChime('tap');
    stripeService.setDefaultPaymentMethod(id);
    setPaymentMethods(stripeService.getPaymentMethods());
    toast.success('Default Stripe payment method updated', 'Card Updated');
  };

  const handleRemovePM = (id: string) => {
    playChime('tap');
    stripeService.removePaymentMethod(id);
    setPaymentMethods(stripeService.getPaymentMethods());
    toast.success('Card removed from Stripe wallet', 'Card Removed');
  };

  const handleCancelSub = () => {
    playChime('tap');
    const updated = stripeService.cancelSubscription();
    setSubscription(updated);
    toast.info('Subscription will end at the close of your current billing period.', 'Subscription Canceled');
  };

  const handleReactivateSub = () => {
    playChime('tap');
    const updated = stripeService.reactivateSubscription();
    setSubscription(updated);
    toast.success('Subscription reactivated!', 'Subscription Active');
  };

  const renderCardBrandBadge = (brand: string) => {
    switch (brand) {
      case 'visa':
        return (
          <span className="px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase bg-blue-600 text-white font-mono shadow-2xs">
            VISA
          </span>
        );
      case 'mastercard':
        return (
          <span className="px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase bg-gradient-to-r from-red-500 to-amber-500 text-white font-mono shadow-2xs">
            MC
          </span>
        );
      case 'amex':
        return (
          <span className="px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase bg-sky-700 text-white font-mono shadow-2xs">
            AMEX
          </span>
        );
      case 'discover':
        return (
          <span className="px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase bg-orange-600 text-white font-mono shadow-2xs">
            DISC
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase bg-slate-700 text-white font-mono shadow-2xs">
            CARD
          </span>
        );
    }
  };

  const currentUser = session?.user;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white/95 dark:bg-slate-900/95 dark:border-slate-800 text-slate-900 dark:text-slate-100 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
      >
        {/* Modal Top Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <UserAvatar
              picture={currentUser?.picture || progress.avatar}
              name={formatDisplayName(currentUser?.name || progress.name)}
              size="lg"
              showOnlineDot={Boolean(session)}
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 id="user-profile-title" className="text-base font-extrabold tracking-tight text-white">
                  {currentUser ? formatDisplayName(currentUser.name) : 'Account & Sync'}
                </h3>
                {session ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    VPS Synced
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Local Only
                  </span>
                )}
                {subscription.planTier !== 'free' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-400/20 text-purple-300 border border-purple-400/30">
                    {subscription.planTier === 'lifetime' ? '💎 VIP' : '⚡ PRO'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                {currentUser?.email || 'Self-Hosted VPS Cloud Authentication & Stripe Wallet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
            aria-label="Close profile modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Sub-Navigation Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              playChime('tap');
              setMainTab('profile');
            }}
            className={`py-2 rounded-xl transition flex items-center justify-center gap-2 ${
              mainTab === 'profile'
                ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile &amp; Cloud Sync</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playChime('tap');
              setMainTab('billing');
            }}
            className={`py-2 rounded-xl transition flex items-center justify-center gap-2 ${
              mainTab === 'billing'
                ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Stripe Billing &amp; Cards</span>
            {subscription.planTier !== 'free' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-400" />
            ) : paymentMethods.length > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-bold">
                {paymentMethods.length}
              </span>
            ) : null}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-slide-down">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="leading-tight flex-1">{errorMessage}</div>
            </div>
          )}

          {mainTab === 'profile' ? (
            <>
              {/* VIEW 1: AUTHENTICATED USER DASHBOARD */}
              {session ? (
                <div className="space-y-4">
              {/* Profile Card & Avatar */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-brand-50/40 dark:from-slate-800/80 dark:to-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Profile Details
                  </span>
                  <button
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isEditingProfile ? 'Cancel' : 'Edit Profile'}</span>
                  </button>
                </div>

                {isEditingProfile ? (
                  <div className="space-y-3 pt-1">
                    {/* Live Preview */}
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <UserAvatar
                        picture={editAvatar}
                        name={editName}
                        size="md"
                      />
                      <div>
                        <div className="text-xs font-black text-slate-800 dark:text-white">
                          {formatDisplayName(editName) || 'Your Name'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Live Avatar & Name Preview</div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Your Name (e.g. Louis de Souza)"
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        Pick Avatar Emoji or Icon
                      </label>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {AVATAR_PRESETS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setEditAvatar(emoji)}
                            className={`w-8 h-8 rounded-xl text-lg flex items-center justify-center transition ${
                              editAvatar === emoji
                                ? 'bg-brand-600 text-white shadow-xs scale-105'
                                : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleSaveProfile}
                      disabled={isLoading}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white text-xs font-bold shadow-soft flex items-center justify-center gap-1.5 active:scale-95 transition"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Save Profile</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      picture={currentUser?.picture || progress.avatar}
                      name={formatDisplayName(currentUser?.name || progress.name)}
                      size="lg"
                    />
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white">{formatDisplayName(currentUser?.name || progress.name)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{currentUser?.email}</div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                        <span>Connected to VPS database</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Real-time Synced Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span>XP</span>
                  </div>
                  <div className="text-base font-black text-brand-600 dark:text-brand-400 mt-0.5">
                    {progress.completedXP}
                  </div>
                  <div className="text-[9px] text-slate-400 font-medium">Daily {progress.dailyGoalXP}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Flame className="w-3 h-3 text-amber-500" />
                    <span>Streak</span>
                  </div>
                  <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {progress.streakDays} Days
                  </div>
                  <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">Active</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Award className="w-3 h-3 text-emerald-500" />
                    <span>CEFR</span>
                  </div>
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Level {progress.level}
                  </div>
                  <div className="text-[9px] text-slate-400 font-medium">Fluency Target</div>
                </div>
              </div>

              {/* Membership Plan & Stripe Wallet Quick Access Card */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 border border-brand-200/80 dark:border-brand-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-2xs">
                    <Crown className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>
                        {subscription.planTier === 'lifetime'
                          ? 'Lifetime VIP Pass'
                          : subscription.planTier === 'pro'
                          ? 'Fluency Pro'
                          : 'Free Starter Plan'}
                      </span>
                      {subscription.planTier !== 'free' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {paymentMethods.length > 0
                        ? `${paymentMethods.length} Stripe Card(s) Saved • Click to manage`
                        : 'No cards saved • Tap to add Stripe card'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playChime('tap');
                    setMainTab('billing');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-soft flex items-center gap-1 transition active:scale-95"
                >
                  <span>Billing &amp; Cards</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Retake Placement Check Action Button */}
              {onOpenPlacement && (
                <button
                  onClick={() => {
                    playChime('tap');
                    onClose();
                    onOpenPlacement();
                  }}
                  className="w-full py-2.5 px-3.5 rounded-2xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  <span>Retake 3-Turn CEFR Placement Assessment</span>
                </button>
              )}

              {/* VPS Server Connection Pill */}
              <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-bold text-emerald-950">Ra Server (VPS Node JWT Auth)</div>
                    <div className="text-[11px] font-mono text-emerald-700">{getAuthProviderUrl()}</div>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400 animate-pulse-subtle" />
              </div>

              {/* Action Buttons: Sync Now & Log Out */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white text-xs font-bold shadow-soft flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing with VPS…' : 'Sync Progress Now'}</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="py-2.5 px-3.5 rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* VIEW 2: SIGN IN / SIGN UP TABS */
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <button
                  onClick={() => {
                    setActiveTab('signin');
                    setErrorMessage(null);
                  }}
                  className={`py-1.5 rounded-xl transition ${
                    activeTab === 'signin' ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Password
                </button>
                <button
                  onClick={() => {
                    setActiveTab('otp');
                    setErrorMessage(null);
                  }}
                  className={`py-1.5 rounded-xl transition ${
                    activeTab === 'otp' ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Magic OTP
                </button>
                <button
                  onClick={() => {
                    setActiveTab('signup');
                    setErrorMessage(null);
                  }}
                  className={`py-1.5 rounded-xl transition ${
                    activeTab === 'signup' ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  onClick={() => {
                    setActiveTab('server');
                    setErrorMessage(null);
                  }}
                  className={`py-1.5 rounded-xl transition ${
                    activeTab === 'server' ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  VPS Endpoint
                </button>
              </div>

              {/* TAB 1: PASSWORD LOGIN */}
              {activeTab === 'signin' && (
                <form onSubmit={handleLogin} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1">
                      <Mail className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                      <span>Email Address</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1">
                      <Lock className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                      <span>Password</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white text-xs font-bold shadow-soft flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>Sign In to VPS</span>
                  </button>
                </form>
              )}

              {/* TAB 2: MAGIC OTP / CODE LOGIN */}
              {activeTab === 'otp' && (
                <div className="space-y-3.5">
                  {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1">
                          <Mail className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                          <span>Email Address</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@domain.com"
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                        />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          We will send a 6-digit magic security code to your email.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white text-xs font-bold shadow-soft flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span>Send Magic Login Code</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                          Enter 6-Digit Code sent to {email}
                        </label>
                        <input
                          type="text"
                          required
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="123456"
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center font-mono text-lg font-bold tracking-widest text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOtpSent(false)}
                          className="px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold"
                        >
                          Change Email
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white text-xs font-bold shadow-soft flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Verify &amp; Sign In</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 3: SIGN UP */}
              {activeTab === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1">
                      <User className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                      <span>Your Name / Display Name</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Louis"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1">
                      <Mail className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                      <span>Email Address</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1">
                      <Lock className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                      <span>Password</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white text-xs font-bold shadow-soft flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>Create Account on VPS</span>
                  </button>
                </form>
              )}

              {/* TAB 4: VPS SERVER ENDPOINT SETTINGS */}
              {activeTab === 'server' && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1">
                      <Server className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                      <span>Auth Provider URL (VITE_AUTH_PROVIDER_URL)</span>
                    </label>
                    <input
                      type="text"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="https://api.cosmowhisper.com"
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Default: <code className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">https://api.cosmowhisper.com</code> or local LAN <code className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">http://192.168.1.28:5000</code>.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                      Backend Backend Type
                    </label>
                    <select
                      value={providerType}
                      onChange={(e) => setProviderState(e.target.value as AuthProviderType)}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
                    >
                      <option value="node-jwt">Node JWT Backend (Ra VPS / Express)</option>
                      <option value="pocketbase">PocketBase (Self-Hosted)</option>
                      <option value="supabase">Supabase (Self-Hosted)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSaveServerConfig}
                    className="w-full py-2.5 px-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-soft flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply Server URL</span>
                  </button>
                </div>
              )}

              {/* Divider & Google OAuth Option */}
              {activeTab !== 'server' && (
                <div className="pt-1 space-y-3">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <span className="relative px-3 bg-white text-[11px] font-bold uppercase text-slate-400">
                      Or continue with
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs flex items-center justify-center gap-2.5 active:scale-95 transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google OAuth Redirect</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Appearance & Theme Section */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <span>Theme &amp; Appearance</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Light, Dark, or System mode (Alt+T)
              </div>
            </div>
            <ThemeToggle variant="switch" />
          </div>

          {/* AI Gateway & Model Settings Row */}
          {onOpenGatewaySettings && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  playChime('tap');
                  onClose();
                  onOpenGatewaySettings();
                }}
                className={`w-full p-3 rounded-2xl border text-xs flex items-center justify-between transition active:scale-[0.99] ${
                  isGatewayConnected
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
                    : 'bg-rose-50/80 dark:bg-rose-950/30 hover:bg-rose-100/80 dark:hover:bg-rose-950/50 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      isGatewayConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-400' : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span>AI Voice &amp; LLM Gateway</span>
                      {llmModelLabel && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {llmModelLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] opacity-80">
                      {isGatewayConnected
                        ? 'Connected • Click to change model or API key'
                        : 'Offline / Mock Mode • Click to configure FreeLLMAPI or Gemini key'}
                    </div>
                  </div>
                </div>
                <span className="flex items-center gap-1 font-bold text-brand-700 dark:text-brand-400 flex-shrink-0">
                  <Server className="w-3.5 h-3.5" />
                  <span>Configure</span>
                </span>
              </button>
            </div>
          )}

          {/* Onboarding Restart Banner */}
          {onOpenOnboarding && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Interactive Onboarding</div>
                  <div className="text-[10px] text-slate-400">Replay the simple 4-step setup tour</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  playChime('tap');
                  onClose();
                  onOpenOnboarding();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition active:scale-95"
              >
                Restart Tour
              </button>
            </div>
          )}
            </>
          ) : (
            /* VIEW: STRIPE BILLING & PAYMENT METHODS */
            <div className="space-y-5 animate-fade-in">
              {/* Active Subscription Summary Card */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-brand-50 via-indigo-50/50 to-purple-50/40 dark:from-slate-800/90 dark:via-indigo-950/40 dark:to-purple-950/30 border border-brand-200/90 dark:border-brand-800/80 shadow-soft space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400">
                    Active Membership Plan
                  </span>
                  <div className="flex items-center gap-1.5">
                    {subscription.status === 'active' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {subscription.cancelAtPeriodEnd ? 'Cancels at Period End' : 'Active Subscription'}
                      </span>
                    )}
                    {subscription.status === 'free' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Free Starter
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>
                        {subscription.planTier === 'lifetime'
                          ? '💎 Lifetime Mastery Pass'
                          : subscription.planTier === 'pro'
                          ? `⚡ Fluency Pro (${subscription.billingCycle === 'yearly' ? 'Annual' : 'Monthly'})`
                          : 'Starter Free Plan'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {subscription.planTier === 'lifetime'
                        ? 'Unlimited permanent access to all coaches, accents & future AI updates.'
                        : subscription.renewsAt
                        ? `Next billing cycle: ${subscription.renewsAt}`
                        : 'Essential daily lesson practice with James.'}
                    </p>
                  </div>
                </div>

                {/* Plan Action Row */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-brand-100 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => {
                      playChime('tap');
                      onClose();
                      onOpenPricing?.();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-xs shadow-soft flex items-center justify-center gap-1.5 active:scale-95 transition"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                    <span>{subscription.planTier === 'free' ? 'Upgrade to Pro' : 'Change Plan / View Pricing'}</span>
                  </button>

                  {subscription.planTier === 'pro' && (
                    <button
                      type="button"
                      onClick={subscription.cancelAtPeriodEnd ? handleReactivateSub : handleCancelSub}
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition active:scale-95"
                    >
                      {subscription.cancelAtPeriodEnd ? 'Reactivate Plan' : 'Cancel Renewal'}
                    </button>
                  )}
                </div>
              </div>

              {/* Saved Stripe Payment Methods */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-brand-600" />
                      <span>Stripe Payment Methods</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Encrypted and tokenized via Stripe 256-Bit SSL
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playChime('tap');
                      setIsAddingCard(!isAddingCard);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 text-xs font-bold transition active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingCard ? 'Cancel' : 'Add Card'}</span>
                  </button>
                </div>

                {/* Add New Card Form Drawer */}
                {isAddingCard && (
                  <form
                    onSubmit={handleAddNewCard}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-brand-300 dark:border-brand-700 shadow-soft space-y-3 animate-slide-down"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Enter Card Details
                      </span>
                      {newCardNumber && (
                        <div className="flex items-center gap-1">
                          {renderCardBrandBadge(detectCardBrand(newCardNumber))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newCardholderName}
                        onChange={(e) => setNewCardholderName(e.target.value)}
                        placeholder="e.g. Alex Morgan"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        Card Number
                      </label>
                      <input
                        type="text"
                        required
                        value={newCardNumber}
                        onChange={(e) => setNewCardNumber(formatCardNumberInput(e.target.value))}
                        placeholder="•••• •••• •••• ••••"
                        maxLength={19}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                          Expiry (MM/YY)
                        </label>
                        <input
                          type="text"
                          required
                          value={newCardExp}
                          onChange={(e) => setNewCardExp(formatExpiryInput(e.target.value))}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                          CVC / CVV
                        </label>
                        <input
                          type="password"
                          required
                          value={newCardCvc}
                          onChange={(e) => setNewCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="•••"
                          maxLength={4}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300 pt-1">
                      <input
                        type="checkbox"
                        checked={newCardIsDefault}
                        onChange={(e) => setNewCardIsDefault(e.target.checked)}
                        className="rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span>Set as default Stripe payment method</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSavingCard}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-xs shadow-soft flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
                    >
                      {isSavingCard ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-emerald-200" />
                      )}
                      <span>{isSavingCard ? 'Saving via Stripe…' : 'Save Card with Stripe'}</span>
                    </button>
                  </form>
                )}

                {/* Saved Cards List */}
                {paymentMethods.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400 space-y-1">
                    <CreditCard className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No payment methods saved</p>
                    <p className="text-[11px]">Click "Add Card" to store a Stripe payment method for quick upgrades.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paymentMethods.map((pm) => (
                      <div
                        key={pm.id}
                        className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          pm.isDefault
                            ? 'bg-brand-50/60 dark:bg-brand-950/40 border-brand-400 dark:border-brand-600 ring-1 ring-brand-400/30'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {renderCardBrandBadge(pm.brand)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-mono">
                              <span>•••• {pm.last4}</span>
                              {pm.isDefault && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-brand-600 text-white font-sans">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Expires {pm.expMonth}/{pm.expYear} • {pm.cardholderName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!pm.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultPM(pm.id)}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold transition active:scale-95"
                              title="Set as default payment method"
                            >
                              Make Default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePM(pm.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition active:scale-95"
                            title="Remove card from wallet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Invoices & Billing History */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Invoices &amp; Receipts</span>
                </h4>

                {invoices.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-[11px] text-slate-400">
                    No billing transactions yet. Invoices appear automatically after membership upgrades.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="font-mono text-[11px]">{inv.number}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              {inv.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {inv.date} • {inv.description}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {inv.currency === 'GBP' ? '£' : inv.currency === 'EUR' ? '€' : '$'}
                            {inv.amountPaid.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(inv)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[10px] font-bold"
                            title="View receipt"
                          >
                            Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Onboarding Restart Banner */}
              {onOpenOnboarding && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Interactive Onboarding</div>
                      <div className="text-[10px] text-slate-400">Replay the simple 4-step setup tour</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playChime('tap');
                      onClose();
                      onOpenOnboarding();
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition active:scale-95"
                  >
                    Restart Tour
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Receipt Overlay Modal */}
        {selectedReceipt && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelectedReceipt(null)}
          >
            <div
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-600" />
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Stripe Payment Receipt
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt #:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedReceipt.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date:</span>
                  <span className="text-slate-700 dark:text-slate-300">{selectedReceipt.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Plan:</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">{selectedReceipt.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase">{selectedReceipt.status}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-extrabold">
                  <span>Amount Paid:</span>
                  <span>{selectedReceipt.currency === 'GBP' ? '£' : selectedReceipt.currency === 'EUR' ? '€' : '$'}{selectedReceipt.amountPaid.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  playChime('tap');
                  window.print();
                }}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-soft flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

