import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'fluency_theme';

/**
 * Returns current active theme from localStorage or system preference.
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore localstorage errors
  }
  return 'light';
}

/**
 * Applies the theme to the DOM, documentElement class, and meta tags.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Update mobile status bar theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#090d16' : '#0ea5e9');
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }

  // Dispatch custom event for cross-component sync
  window.dispatchEvent(new CustomEvent<ThemeMode>('fluency_theme_changed', { detail: theme }));
}

/**
 * Toggles between light and dark mode.
 */
export function toggleTheme(): ThemeMode {
  const current = getStoredTheme();
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/**
 * Explicitly sets the theme.
 */
export function setTheme(theme: ThemeMode): void {
  applyTheme(theme);
}

/**
 * Initializes theme on application start.
 */
export function initTheme(): ThemeMode {
  const current = getStoredTheme();
  applyTheme(current);
  return current;
}

/**
 * React hook for consuming and updating theme.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvt = e as CustomEvent<ThemeMode>;
      if (customEvt.detail) {
        setThemeState(customEvt.detail);
      } else {
        setThemeState(getStoredTheme());
      }
    };

    window.addEventListener('fluency_theme_changed', handleThemeChange);
    window.addEventListener('storage', handleThemeChange);

    // Watch system preference changes if user hasn't explicitly set one
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (!saved) {
        const next = e.matches ? 'dark' : 'light';
        applyTheme(next);
        setThemeState(next);
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('fluency_theme_changed', handleThemeChange);
      window.removeEventListener('storage', handleThemeChange);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = toggleTheme();
    setThemeState(next);
    return next;
  }, []);

  const setSpecificTheme = useCallback((newTheme: ThemeMode) => {
    setTheme(newTheme);
    setThemeState(newTheme);
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme: toggle,
    setTheme: setSpecificTheme,
  };
}
