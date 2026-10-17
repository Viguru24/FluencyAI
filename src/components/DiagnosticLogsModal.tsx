import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Copy,
  Download,
  Trash2,
  Terminal,
  Mic,
  Activity,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { diagnosticLogger, type LogEntry, type LogCategory } from '../services/diagnosticLogger';
import { playChime } from '../services/speech';
import { toast } from '../services/toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: { id: 'ALL' | LogCategory; label: string }[] = [
  { id: 'ALL', label: 'All Logs' },
  { id: 'VOICE', label: 'Voice & Mic' },
  { id: 'AI', label: 'AI Tutor' },
  { id: 'STT', label: 'Transcripts' },
  { id: 'AUDIO', label: 'Audio Engine' },
  { id: 'SYSTEM', label: 'System' },
];

export const DiagnosticLogsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterCategory, setFilterCategory] = useState<'ALL' | LogCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, unknown> | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    diagnosticLogger.getDeviceDiagnostics().then(setDeviceInfo);

    const unsubscribe = diagnosticLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    if (filterCategory !== 'ALL' && l.category !== filterCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.message.toLowerCase().includes(q) || l.category.toLowerCase().includes(q);
  });

  const handleCopy = async () => {
    playChime('tap');
    try {
      const text = await diagnosticLogger.generateExportText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('All diagnostic logs copied to clipboard!', 'Logs Copied');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard', 'Copy Error');
    }
  };

  const handleDownload = async () => {
    playChime('tap');
    try {
      const text = await diagnosticLogger.generateExportText();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fluency-diagnostic-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Log file downloaded successfully', 'Downloaded');
    } catch {
      toast.error('Failed to download log file', 'Download Error');
    }
  };

  const handleClear = () => {
    playChime('tap');
    diagnosticLogger.clearLogs();
    toast.info('Diagnostic logs cleared', 'Logs Reset');
  };

  const audioFeatures = deviceInfo?.audioFeatures as Record<string, unknown> | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                Diagnostic &amp; Voice Logs
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Real-time microphone, speech-to-text, and AI event trace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition active:scale-95 flex items-center gap-1 text-xs font-bold"
              title="Copy all logs"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition active:scale-95 flex items-center gap-1 text-xs font-bold"
              title="Download log file"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition active:scale-95"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Device & Hardware Snapshot Card */}
        {deviceInfo && (
          <div className="px-5 py-2.5 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200/70 dark:border-slate-800 text-xs flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
              <Mic className="w-3.5 h-3.5 text-brand-500" />
              <span>Mic Perm:</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                  audioFeatures?.micPermission === 'granted'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : audioFeatures?.micPermission === 'denied'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                {String(audioFeatures?.micPermission || 'unknown')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              <span>STT:</span>
              <span className="font-bold">
                {audioFeatures?.speechRecognition ? 'WebSpeech' : 'AI-Only'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span>Mode:</span>
              <span className="font-bold">
                {deviceInfo.isPWAStandalone ? 'PWA App' : 'Browser Tab'}
              </span>
            </div>

            <div className="ml-auto text-[11px] text-slate-400">
              {logs.length} events logged
            </div>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2 bg-white dark:bg-slate-900">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                  filterCategory === cat.id
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter logs…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Log Stream Body */}
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 font-mono text-[11px] bg-slate-950 text-slate-200 select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No matching diagnostic logs recorded.</p>
              <p className="text-[10px] mt-1 text-slate-600">Events appear live as voice and AI operations run.</p>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const isError = entry.level === 'error';
              const isWarn = entry.level === 'warn';

              return (
                <div
                  key={entry.id}
                  className={`p-2 rounded-lg border transition-colors ${
                    isError
                      ? 'bg-rose-950/40 border-rose-800/50 text-rose-200'
                      : isWarn
                      ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                      : 'bg-slate-900/60 border-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-slate-500 text-[10px]">{entry.timestamp}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                        isError
                          ? 'bg-rose-500 text-white'
                          : isWarn
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {entry.level}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                      {entry.category}
                    </span>
                  </div>

                  <div className="break-words font-semibold leading-relaxed">
                    {entry.message}
                  </div>

                  {entry.details !== undefined && (
                    <pre className="mt-1.5 p-2 rounded bg-black/50 text-[10px] text-slate-400 overflow-x-auto border border-slate-800/60 whitespace-pre-wrap break-all">
                      {typeof entry.details === 'object'
                        ? JSON.stringify(entry.details, null, 2)
                        : String(entry.details)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
