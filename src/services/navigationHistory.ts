import { stopSpeaking } from './speech';
import { toast } from './toast';

export type FluencyView =
  | 'home'
  | 'lesson'
  | 'placement'
  | 'persona'
  | 'phrasebook'
  | 'custom-scenario'
  | 'warmup'
  | 'free-talk'
  | 'roadmap'
  | 'pricing'
  | 'install-guide'
  | 'onboarding'
  | 'gateway'
  | 'profile';

type ViewChangeHandler = (view: FluencyView) => void;

class NavigationHistoryManager {
  private activeView: FluencyView = 'home';
  private listeners = new Set<ViewChangeHandler>();
  private lastBackPressTime = 0;
  private isInitialized = false;

  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Establish a baseline history buffer so the first back button click on home does not exit the app/PWA
    const currentState = window.history.state;
    if (!currentState || currentState.fluency !== 'home') {
      window.history.replaceState({ fluency: 'root' }, '');
      window.history.pushState({ fluency: 'home' }, '');
    }

    window.addEventListener('popstate', this.handlePopState);
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
    }
    this.isInitialized = false;
    this.listeners.clear();
  }

  subscribe(listener: ViewChangeHandler) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(view: FluencyView) {
    this.listeners.forEach((fn) => {
      try {
        fn(view);
      } catch (err) {
        console.error('[NavigationHistory] Listener error:', err);
      }
    });
  }

  private handlePopState = (event: PopStateEvent) => {
    stopSpeaking();

    // If user was inside a lesson or modal:
    const wasInSubView = this.activeView !== 'home';

    if (wasInSubView) {
      // Return cleanly to the Home page without closing the app!
      this.activeView = 'home';
      this.notify('home');

      // Ensure the history entry reflects home
      if (!event.state || event.state.fluency !== 'home') {
        window.history.replaceState({ fluency: 'home' }, '', window.location.pathname);
      }
      return;
    }

    // If user was ALREADY on the home page:
    const now = Date.now();
    if (now - this.lastBackPressTime < 2000) {
      // User tapped back twice quickly on the home page — allow natural browser/PWA exit
      this.lastBackPressTime = 0;
      return;
    }

    // First back press while on the home page: prevent accidental exit!
    this.lastBackPressTime = now;
    window.history.pushState({ fluency: 'home' }, '', window.location.pathname);
    toast.info('Press back again to exit the app', 'Home Page');
  };

  /**
   * Pushes a new view state to browser history when opening a lesson or modal.
   */
  pushView(view: FluencyView) {
    if (typeof window === 'undefined') return;
    this.activeView = view;
    window.history.pushState(
      { fluency: view, timestamp: Date.now() },
      '',
      view === 'home' ? window.location.pathname : `#${view}`
    );
  }

  /**
   * Returns cleanly to the home page.
   * If in a sub-view with history, pops back; otherwise directly updates state.
   */
  navigateToHome() {
    stopSpeaking();

    if (this.activeView === 'home' && !window.location.hash) {
      this.notify('home');
      return;
    }

    this.activeView = 'home';
    this.notify('home');

    if (typeof window !== 'undefined') {
      if (
        window.location.hash ||
        (window.history.state &&
          window.history.state.fluency &&
          window.history.state.fluency !== 'home' &&
          window.history.state.fluency !== 'root')
      ) {
        try {
          window.history.back();
        } catch {
          window.history.replaceState({ fluency: 'home' }, '', window.location.pathname);
        }
      } else {
        window.history.replaceState({ fluency: 'home' }, '', window.location.pathname);
      }
    }
  }

  getActiveView(): FluencyView {
    return this.activeView;
  }

  setActiveView(view: FluencyView) {
    this.activeView = view;
  }
}

export const navigationHistory = new NavigationHistoryManager();
