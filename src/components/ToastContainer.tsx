import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { toast, type ToastItem } from '../services/toast';

export const ToastContainer: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updated) => {
      setItems(updated);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md space-y-2 pointer-events-none"
      aria-live="polite"
    >
      {items.map((item) => {
        const isError = item.type === 'error';
        const isSuccess = item.type === 'success';
        const isWarning = item.type === 'warning';

        const borderColor = isError
          ? 'border-rose-400 bg-rose-50/95 text-rose-900 shadow-rose-500/10'
          : isSuccess
          ? 'border-emerald-400 bg-emerald-50/95 text-emerald-900 shadow-emerald-500/10'
          : isWarning
          ? 'border-amber-400 bg-amber-50/95 text-amber-900 shadow-amber-500/10'
          : 'border-slate-300 bg-white/95 text-slate-900 shadow-slate-500/10';

        const iconColor = isError
          ? 'text-rose-600'
          : isSuccess
          ? 'text-emerald-600'
          : isWarning
          ? 'text-amber-600'
          : 'text-brand-600';

        const Icon = isError
          ? AlertCircle
          : isSuccess
          ? CheckCircle2
          : isWarning
          ? AlertTriangle
          : Info;

        return (
          <div
            key={item.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-lg backdrop-blur-md transition-all animate-slide-down ${borderColor}`}
          >
            <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 pr-1">
              {item.title && <div className="text-xs font-bold leading-tight mb-0.5">{item.title}</div>}
              <div className="text-xs leading-relaxed break-words font-medium opacity-90">{item.message}</div>
            </div>
            <button
              onClick={() => toast.dismiss(item.id)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 active:scale-95 text-slate-500 transition"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
