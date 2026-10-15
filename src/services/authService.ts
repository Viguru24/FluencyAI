/**
 * FluencyAI VPS Authentication & Sync Service
 * 
 * Supports:
 * - Node JWT Auth (CosmoWhisper VPS / Ra Server backend)
 * - PocketBase Auth (Self-hosted)
 * - Supabase Auth (Self-hosted GoTrue)
 * 
 * Features:
 * - Sign Up (with display name)
 * - Password Login
 * - Magic Link / OTP Code Login
 * - Google OAuth Redirect & Token Sync
 * - JWT Session Persistence in localStorage & Cookie
 * - Cloud Progress Sync (XP, Streak, CEFR level, progress data)
 * - Display Name & Avatar Profile updates
 */

import type { AuthSession, AuthUser, CEFRLevel, UserProgress } from '../types';
import { formatDisplayName, normalizeUserAvatar } from '../utils/nameFormatter';

export type AuthProviderType = 'node-jwt' | 'pocketbase' | 'supabase';

const STORAGE_TOKEN_KEY = 'fluency_auth_token';
const STORAGE_USER_KEY = 'fluency_auth_user';
const STORAGE_ENDPOINT_KEY = 'fluency_auth_provider_url';
const STORAGE_PROVIDER_TYPE_KEY = 'fluency_auth_provider_type';

/** Get configured auth provider URL from env or localStorage */
export function getAuthProviderUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_ENDPOINT_KEY);
    if (custom && custom.trim().length > 0) return custom.trim().replace(/\/$/, '');
  }
  const envUrl = (import.meta as any).env?.VITE_AUTH_PROVIDER_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, '');
  }
  // Default to live VPS endpoint
  return 'https://api.cosmowhisper.com';
}

/** Set custom auth provider URL */
export function setAuthProviderUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const clean = url.trim().replace(/\/$/, '');
    localStorage.setItem(STORAGE_ENDPOINT_KEY, clean);
    window.dispatchEvent(new CustomEvent('fluency_auth_config_changed', { detail: { url: clean } }));
  }
}

/** Get configured provider type */
export function getAuthProviderType(): AuthProviderType {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_PROVIDER_TYPE_KEY);
    if (custom === 'pocketbase' || custom === 'supabase' || custom === 'node-jwt') {
      return custom;
    }
  }
  const envType = (import.meta as any).env?.VITE_AUTH_PROVIDER_TYPE;
  if (envType === 'pocketbase' || envType === 'supabase' || envType === 'node-jwt') {
    return envType;
  }
  return 'node-jwt';
}

/** Set custom provider type */
export function setAuthProviderType(type: AuthProviderType): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_PROVIDER_TYPE_KEY, type);
    window.dispatchEvent(new CustomEvent('fluency_auth_config_changed', { detail: { type } }));
  }
}

// Cookie helper
function setSessionCookie(token: string) {
  if (typeof document === 'undefined') return;
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `fluency_session_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure}`;
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'fluency_session_token=; path=/; max-age=0; SameSite=Lax';
}

// Active subscribers for auth state changes
type AuthListener = (session: AuthSession | null) => void;
const listeners = new Set<AuthListener>();

class AuthService {
  private currentSession: AuthSession | null = null;
  private isInitialized = false;

  constructor() {
    this.initSession();
  }

  /**
   * Initialize session from localStorage or OAuth callback query parameters
   */
  private initSession() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Check for OAuth redirect query parameters: ?token=...&user=...
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      const urlUserStr = urlParams.get('user');

      if (urlToken) {
        let parsedUser: AuthUser | null = null;
        if (urlUserStr) {
          try {
            parsedUser = JSON.parse(decodeURIComponent(urlUserStr));
          } catch {
            parsedUser = null;
          }
        }

        const session: AuthSession = {
          token: urlToken,
          user: parsedUser || {
            id: 'vps-oauth',
            email: 'user@fluencyai.com',
            name: 'Fluency Learner',
            xp: 0,
            streak: 0,
            level: 'B1',
          },
        };

        this.saveSession(session);

        // Remove token/user from URL without full page reload
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
        return;
      }
    } catch (e) {
      console.warn('[AuthService] Could not parse OAuth URL parameters', e);
    }

    // 2. Read from localStorage
    try {
      const token = localStorage.getItem(STORAGE_TOKEN_KEY);
      const userJson = localStorage.getItem(STORAGE_USER_KEY);
      if (token && userJson) {
        const parsed = JSON.parse(userJson);
        if (parsed.name) parsed.name = formatDisplayName(parsed.name);
        if (parsed.picture) parsed.picture = normalizeUserAvatar(parsed.picture);
        this.currentSession = {
          token,
          user: parsed,
        };
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(parsed));
        setSessionCookie(token);
        // Refresh profile in background to get latest server stats
        this.fetchCurrentUser().catch(() => {});
      }
    } catch (e) {
      console.warn('[AuthService] Failed to restore session from localStorage', e);
    }
  }

  /** Save session in memory, localStorage, and cookie */
  private saveSession(session: AuthSession | null) {
    this.currentSession = session;
    if (typeof window !== 'undefined') {
      if (session) {
        localStorage.setItem(STORAGE_TOKEN_KEY, session.token);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(session.user));
        setSessionCookie(session.token);
      } else {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
        clearSessionCookie();
      }
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of listeners) {
      try {
        listener(this.currentSession);
      } catch (err) {
        console.error('[AuthService] Listener error', err);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('fluency_auth_state_changed', { detail: this.currentSession })
      );
    }
  }

  /** Subscribe to authentication state updates */
  public onAuthStateChange(listener: AuthListener): () => void {
    listeners.add(listener);
    // Fire immediately with current state
    listener(this.currentSession);
    return () => {
      listeners.delete(listener);
    };
  }

  /** Get active session */
  public getSession(): AuthSession | null {
    return this.currentSession;
  }

  /** Get active JWT token */
  public getToken(): string | null {
    return this.currentSession?.token || null;
  }

  /** Get active user */
  public getUser(): AuthUser | null {
    return this.currentSession?.user || null;
  }

  /** Check if currently authenticated */
  public isAuthenticated(): boolean {
    return Boolean(this.currentSession?.token);
  }

  /**
   * Sign Up with Email and Password
   */
  public async signUp(params: {
    email: string;
    password: string;
    name?: string;
  }): Promise<{ session: AuthSession; message?: string }> {
    const baseUrl = getAuthProviderUrl();
    const providerType = getAuthProviderType();

    if (providerType === 'pocketbase') {
      const res = await fetch(`${baseUrl}/api/collections/users/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          passwordConfirm: params.password,
          name: params.name || params.email.split('@')[0],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'PocketBase Sign-up failed');
      return this.loginWithPassword({ email: params.email, password: params.password });
    }

    if (providerType === 'supabase') {
      const res = await fetch(`${baseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          data: { name: params.name || params.email.split('@')[0] },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || data.error_description || 'Supabase Sign-up failed');
      const session: AuthSession = {
        token: data.access_token,
        user: {
          id: data.user?.id || 'sb-user',
          email: data.user?.email || params.email,
          name: data.user?.user_metadata?.name || params.name || params.email.split('@')[0],
          xp: 0,
          streak: 0,
          level: 'B1',
        },
      };
      this.saveSession(session);
      return { session, message: 'Account created successfully' };
    }

    // Default: Node JWT VPS Backend
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Sign-up failed');
    }

    if (data.token && data.user) {
      const session: AuthSession = { token: data.token, user: data.user };
      this.saveSession(session);
      return { session, message: data.message };
    }

    // Fallback: auto-login after signup
    return this.loginWithPassword({ email: params.email, password: params.password });
  }

  /**
   * Log In with Email and Password
   */
  public async loginWithPassword(params: {
    email: string;
    password: string;
  }): Promise<{ session: AuthSession }> {
    const baseUrl = getAuthProviderUrl();
    const providerType = getAuthProviderType();

    if (providerType === 'pocketbase') {
      const res = await fetch(`${baseUrl}/api/collections/users/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: params.email, password: params.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid credentials');
      const session: AuthSession = {
        token: data.token,
        user: {
          id: data.record.id,
          email: data.record.email,
          name: formatDisplayName(data.record.name || data.record.email.split('@')[0]),
          picture: normalizeUserAvatar(
            data.record.avatar
              ? (data.record.avatar.startsWith('http') || data.record.avatar.startsWith('data:')
                  ? data.record.avatar
                  : /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(data.record.avatar)
                  ? data.record.avatar
                  : `${baseUrl}/api/files/users/${data.record.id}/${data.record.avatar}`)
              : null
          ),
          xp: data.record.xp ?? 0,
          streak: data.record.streak ?? 0,
          level: data.record.level || 'B1',
        },
      };
      this.saveSession(session);
      return { session };
    }

    if (providerType === 'supabase') {
      const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: params.email, password: params.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.msg || 'Invalid credentials');
      const session: AuthSession = {
        token: data.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: formatDisplayName(data.user.user_metadata?.name || data.user.email.split('@')[0]),
          picture: normalizeUserAvatar(data.user.user_metadata?.avatar_url || null),
          xp: 0,
          streak: 0,
          level: 'B1',
        },
      };
      this.saveSession(session);
      return { session };
    }

    // Default: Node JWT VPS Backend
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Invalid email or password');
    }

    const session: AuthSession = {
      token: data.token,
      user: {
        ...data.user,
        name: formatDisplayName(data.user?.name),
        picture: normalizeUserAvatar(data.user?.picture),
      },
    };
    this.saveSession(session);
    return { session };
  }

  /**
   * Request Magic Link / OTP Code
   */
  public async requestMagicOtp(email: string): Promise<{ message: string }> {
    const baseUrl = getAuthProviderUrl();
    const res = await fetch(`${baseUrl}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Failed to send security code');
    }
    return { message: data.message || 'Security code sent to your email' };
  }

  /**
   * Verify Magic Link / OTP Code
   */
  public async verifyMagicOtp(params: {
    email: string;
    code: string;
  }): Promise<{ session: AuthSession }> {
    const baseUrl = getAuthProviderUrl();
    const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Invalid or expired code');
    }

    const session: AuthSession = {
      token: data.token,
      user: data.user,
    };
    this.saveSession(session);
    return { session };
  }

  /**
   * Start Google OAuth Flow
   */
  public loginWithGoogle(redirectUri?: string): void {
    if (typeof window === 'undefined') return;
    const baseUrl = getAuthProviderUrl();
    const returnTarget = redirectUri || window.location.origin;
    const authUrl = `${baseUrl}/api/auth/google?platform=fluency&redirect=${encodeURIComponent(returnTarget)}`;
    window.location.href = authUrl;
  }

  /**
   * Direct Google OAuth Token Sync (e.g., from Google One-Tap or Google Identity Services)
   */
  public async syncGoogleToken(params: {
    idToken: string;
    email: string;
    name?: string;
    picture?: string;
  }): Promise<{ session: AuthSession }> {
    const baseUrl = getAuthProviderUrl();
    const res = await fetch(`${baseUrl}/api/auth/google-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Google token verification failed');
    }

    const session: AuthSession = {
      token: data.token,
      user: data.user,
    };
    this.saveSession(session);
    return { session };
  }

  /**
   * Fetch current authenticated user profile from VPS
   */
  public async fetchCurrentUser(): Promise<AuthUser | null> {
    const token = this.getToken();
    if (!token) return null;

    const baseUrl = getAuthProviderUrl();
    try {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Token expired or invalidated
          this.logout();
        }
        return null;
      }

      const data = await res.json();
      if (data.user && this.currentSession) {
        this.currentSession.user = { ...this.currentSession.user, ...data.user };
        this.saveSession(this.currentSession);
        return this.currentSession.user;
      }
    } catch (e) {
      console.warn('[AuthService] Could not refresh user profile from VPS', e);
    }
    return this.getUser();
  }

  /**
   * Sync User XP, Streak, CEFR Level & Progress directly to VPS database
   */
  public async syncProgress(payload: {
    xp?: number;
    completedXP?: number;
    streak?: number;
    streakDays?: number;
    level?: CEFRLevel;
    progress_data?: any;
    name?: string;
    picture?: string;
  }): Promise<{ success: boolean; user?: AuthUser }> {
    const token = this.getToken();
    if (!token) {
      return { success: false };
    }

    const baseUrl = getAuthProviderUrl();
    try {
      const res = await fetch(`${baseUrl}/api/auth/progress`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.user && this.currentSession) {
        this.currentSession.user = { ...this.currentSession.user, ...data.user };
        this.saveSession(this.currentSession);
        return { success: true, user: this.currentSession.user };
      }
      return { success: res.ok, user: data.user };
    } catch (err) {
      console.warn('[AuthService] Progress sync failed (will retry on next activity)', err);
      return { success: false };
    }
  }

  /**
   * Update Display Name and Avatar Picture
   */
  public async updateProfile(payload: {
    name?: string;
    picture?: string;
  }): Promise<{ success: boolean; user?: AuthUser }> {
    const cleanName = payload.name ? formatDisplayName(payload.name) : undefined;
    const cleanPicture = payload.picture ? normalizeUserAvatar(payload.picture) : undefined;

    // 1. Immediately update local session (Local-First!)
    if (this.currentSession) {
      this.currentSession.user = {
        ...this.currentSession.user,
        ...(cleanName ? { name: cleanName } : {}),
        ...(cleanPicture ? { picture: cleanPicture } : {}),
      };
      this.saveSession(this.currentSession);
    }

    const token = this.getToken();
    if (!token) return { success: true, user: this.currentSession?.user };

    const baseUrl = getAuthProviderUrl();
    const providerType = getAuthProviderType();

    try {
      if (providerType === 'pocketbase') {
        const userId = this.currentSession?.user.id;
        if (userId) {
          const pbBody: Record<string, any> = {};
          if (cleanName) pbBody.name = cleanName;
          if (cleanPicture && (cleanPicture.startsWith('http') || cleanPicture.startsWith('data:'))) {
            pbBody.avatar = cleanPicture;
          }
          await fetch(`${baseUrl}/api/collections/users/records/${userId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pbBody),
          }).catch(() => {});
        }
        return { success: true, user: this.currentSession?.user };
      }

      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(cleanName ? { name: cleanName } : {}),
          ...(cleanPicture ? { picture: cleanPicture } : {}),
        }),
      });

      const data = await res.json();
      if (res.ok && data.user && this.currentSession) {
        this.currentSession.user = {
          ...this.currentSession.user,
          ...data.user,
          name: formatDisplayName(data.user.name || this.currentSession.user.name),
          picture: normalizeUserAvatar(data.user.picture || this.currentSession.user.picture),
        };
        this.saveSession(this.currentSession);
      }
    } catch (e) {
      console.warn('[AuthService] Remote profile update failed, kept local copy', e);
    }

    return { success: true, user: this.currentSession?.user };
  }

  /**
   * Log Out and clear all session storage and cookies
   */
  public logout(): void {
    this.saveSession(null);
  }
}

// Singleton instance
export const authService = new AuthService();

/**
 * Helper to sync local UserProgress state with authenticated VPS account
 */
export function mergeUserProgressWithRemote(
  local: UserProgress,
  remoteUser: AuthUser | null
): UserProgress {
  if (!remoteUser) return local;

  const rawName = remoteUser.name || local.name;
  const formattedName = formatDisplayName(rawName);

  const merged: UserProgress = {
    ...local,
    name: formattedName || rawName,
    email: remoteUser.email || local.email,
    id: remoteUser.id,
    avatar: normalizeUserAvatar(remoteUser.picture) || local.avatar,
    level: remoteUser.level || local.level,
    completedXP: Math.max(local.completedXP, remoteUser.xp ?? 0),
    streakDays: Math.max(local.streakDays, remoteUser.streak ?? 0),
  };

  if (remoteUser.progress_data && typeof remoteUser.progress_data === 'object') {
    if (Array.isArray(remoteUser.progress_data.completedScenarioIds)) {
      merged.completedScenarioIds = Array.from(
        new Set([...merged.completedScenarioIds, ...remoteUser.progress_data.completedScenarioIds])
      );
    }
    if (typeof remoteUser.progress_data.completedMinutes === 'number') {
      merged.completedMinutes = Math.max(
        merged.completedMinutes,
        remoteUser.progress_data.completedMinutes
      );
    }
  }

  return merged;
}
