// PWA Service Worker Registration & Install Prompt Handler

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

export function registerServiceWorker(onUpdate?: () => void) {
  if (typeof window === 'undefined') return;

  // In local development, never cache JS modules in service worker to prevent stale code lockups
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local');

  if (isLocalhost) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          reg.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      });
    }
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Resolves relative to current base path (works on localhost, custom domains, and GitHub Pages)
      const swUrl = new URL('sw.js', window.location.href).pathname;

      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          console.log('[FluencyAI PWA] Service worker registered with scope:', reg.scope);

          reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[FluencyAI PWA] New update available');
                  if (onUpdate) onUpdate();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('[FluencyAI PWA] Service worker registration failed:', error);
        });
    });
  }

  // Capture install prompt for PWA installation button
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach((listener) => listener(true));
  });

  window.addEventListener('appinstalled', () => {
    console.log('[FluencyAI PWA] App was successfully installed!');
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));
  });
}

export function subscribeToInstallPrompt(callback: (canInstall: boolean) => void) {
  installListeners.add(callback);
  queueMicrotask(() => {
    if (installListeners.has(callback)) {
      callback(deferredPrompt !== null);
    }
  });
  return () => {
    installListeners.delete(callback);
  };
}

export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    return 'unavailable';
  }
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));
    return choice.outcome;
  } catch (err) {
    console.warn('[FluencyAI PWA] Install prompt error:', err);
    return 'unavailable';
  }
}
