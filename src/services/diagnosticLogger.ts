// High-Performance In-App Diagnostic Logging System for Fluency AI
// Intercepts and buffers console logs, voice lifecycle events, audio hardware states,
// and AI network requests so learners can inspect or copy logs directly on mobile devices.

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogCategory = 'SYSTEM' | 'VOICE' | 'AUDIO' | 'MIC' | 'STT' | 'AI' | 'TTS' | 'AUTH' | 'PWA';

export interface LogEntry {
  id: string;
  timestamp: string;
  timeMs: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: unknown;
}

const STORAGE_KEY_LOGS = 'fluency_diagnostic_logs';
const MAX_LOGS_MEMORY = 400;
const MAX_LOGS_PERSIST = 150;

class DiagnosticLoggerService {
  private logs: LogEntry[] = [];
  private listeners = new Set<(logs: LogEntry[]) => void>();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Load persisted logs from previous session
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LOGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.logs = parsed.slice(-MAX_LOGS_PERSIST);
        }
      }
    } catch {
      /* ignore */
    }

    // Intercept native console methods without breaking standard output
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = (...args: unknown[]) => {
      originalLog.apply(console, args);
      this.handleConsoleCapture('info', args);
    };

    console.info = (...args: unknown[]) => {
      originalInfo.apply(console, args);
      this.handleConsoleCapture('info', args);
    };

    console.warn = (...args: unknown[]) => {
      originalWarn.apply(console, args);
      this.handleConsoleCapture('warn', args);
    };

    console.error = (...args: unknown[]) => {
      originalError.apply(console, args);
      this.handleConsoleCapture('error', args);
    };

    // Record initial device snapshot
    this.recordDeviceSnapshot();
  }

  private detectCategory(msg: string): LogCategory {
    const lower = msg.toLowerCase();
    if (lower.includes('mic') || lower.includes('recorder') || lower.includes('voice')) return 'VOICE';
    if (lower.includes('speechrecognition') || lower.includes('stt') || lower.includes('transcript')) return 'STT';
    if (lower.includes('audiocontext') || lower.includes('audio') || lower.includes('visualizer')) return 'AUDIO';
    if (lower.includes('gemini') || lower.includes('freellm') || lower.includes('tutor') || lower.includes('ai')) return 'AI';
    if (lower.includes('tts') || lower.includes('speechsyn') || lower.includes('speak')) return 'TTS';
    if (lower.includes('auth') || lower.includes('login') || lower.includes('session') || lower.includes('sync')) return 'AUTH';
    if (lower.includes('pwa') || lower.includes('service worker') || lower.includes('manifest') || lower.includes('install')) return 'PWA';
    return 'SYSTEM';
  }

  private handleConsoleCapture(level: LogLevel, args: unknown[]) {
    try {
      const firstArg = args[0];
      const message = typeof firstArg === 'string' ? firstArg : JSON.stringify(firstArg);
      const category = this.detectCategory(message);
      const details = args.length > 1 ? args.slice(1) : undefined;
      this.addEntry(level, category, message, details, false);
    } catch {
      /* ignore */
    }
  }

  private addEntry(level: LogLevel, category: LogCategory, message: string, details?: unknown, notify = true) {
    const now = new Date();
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(now.getMilliseconds()).padStart(3, '0'),
      timeMs: Date.now(),
      level,
      category,
      message,
      details,
    };

    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS_MEMORY) {
      this.logs = this.logs.slice(-MAX_LOGS_MEMORY);
    }

    this.persistDebounced();

    if (notify) {
      this.notifyListeners();
    }
  }

  private persistTimeout: number | null = null;
  private persistDebounced() {
    if (typeof window === 'undefined') return;
    if (this.persistTimeout) return;
    this.persistTimeout = window.setTimeout(() => {
      this.persistTimeout = null;
      try {
        const toSave = this.logs.slice(-MAX_LOGS_PERSIST);
        localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(toSave));
      } catch {
        /* storage quota or privacy mode */
      }
    }, 1500);
  }

  private notifyListeners() {
    const copy = [...this.logs];
    this.listeners.forEach((fn) => {
      try {
        fn(copy);
      } catch {
        /* ignore */
      }
    });
  }

  public log(category: LogCategory, message: string, details?: unknown) {
    this.addEntry('info', category, message, details, true);
  }

  public warn(category: LogCategory, message: string, details?: unknown) {
    this.addEntry('warn', category, message, details, true);
  }

  public error(category: LogCategory, message: string, details?: unknown) {
    this.addEntry('error', category, message, details, true);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_LOGS);
      } catch {
        /* ignore */
      }
    }
    this.log('SYSTEM', 'Diagnostic logs cleared by user');
    this.notifyListeners();
  }

  public subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async getDeviceDiagnostics(): Promise<Record<string, unknown>> {
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isStandalone = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );

    let micPermission = 'unknown';
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const res = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        micPermission = res.state;
      } catch {
        micPermission = 'not-queriable';
      }
    }

    const hasGetUserMedia = Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia);
    const hasMediaRecorder = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';
    const hasSpeechRecognition = typeof window !== 'undefined' && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
    const hasAudioContext = typeof window !== 'undefined' && Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

    return {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'N/A',
      screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight} (dpr: ${window.devicePixelRatio || 1})` : 'N/A',
      isMobile,
      isPWAStandalone: isStandalone,
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      audioFeatures: {
        getUserMedia: hasGetUserMedia,
        mediaRecorder: hasMediaRecorder,
        speechRecognition: hasSpeechRecognition,
        audioContext: hasAudioContext,
        micPermission,
      },
    };
  }

  public recordDeviceSnapshot() {
    this.getDeviceDiagnostics().then((diag) => {
      this.log('SYSTEM', 'Fluency AI Diagnostics Initialized', diag);
    });
  }

  public async generateExportText(): Promise<string> {
    const diag = await this.getDeviceDiagnostics();
    const divider = '='.repeat(50);
    const subDivider = '-'.repeat(50);

    const lines: string[] = [
      divider,
      ' FLUENCY AI - SYSTEM DIAGNOSTIC LOG FILE',
      divider,
      `Generated At: ${new Date().toISOString()}`,
      `User-Agent: ${diag.userAgent}`,
      `Screen Size: ${diag.screen}`,
      `PWA Standalone: ${diag.isPWAStandalone ? 'YES' : 'NO'}`,
      `Online Status: ${diag.online ? 'ONLINE' : 'OFFLINE'}`,
      `Microphone Permission: ${(diag.audioFeatures as Record<string, unknown>)?.micPermission}`,
      `getUserMedia Supported: ${(diag.audioFeatures as Record<string, unknown>)?.getUserMedia ? 'YES' : 'NO'}`,
      `SpeechRecognition Supported: ${(diag.audioFeatures as Record<string, unknown>)?.speechRecognition ? 'YES' : 'NO'}`,
      `MediaRecorder Supported: ${(diag.audioFeatures as Record<string, unknown>)?.mediaRecorder ? 'YES' : 'NO'}`,
      subDivider,
      ' RECENT EVENT LOGS (Newest to Oldest):',
      subDivider,
    ];

    const reversed = [...this.logs].reverse();
    for (const l of reversed) {
      let detailStr = '';
      if (l.details !== undefined) {
        try {
          detailStr = ` | Details: ${typeof l.details === 'object' ? JSON.stringify(l.details) : String(l.details)}`;
        } catch {
          detailStr = ' | Details: [Unserializable Object]';
        }
      }
      lines.push(`[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}${detailStr}`);
    }

    lines.push(divider);
    lines.push(' END OF DIAGNOSTIC LOG');
    lines.push(divider);

    return lines.join('\n');
  }
}

export const diagnosticLogger = new DiagnosticLoggerService();
