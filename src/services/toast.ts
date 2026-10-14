// Toast notification service for clear user feedback on API errors and status

export interface ToastItem {
  id: string;
  type: 'error' | 'success' | 'info' | 'warning';
  title?: string;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  const current = [...toasts];
  listeners.forEach((l) => l(current));
}

export const toast = {
  subscribe(fn: ToastListener) {
    listeners.add(fn);
    fn([...toasts]);
    return () => {
      listeners.delete(fn);
    };
  },
  show(item: Omit<ToastItem, 'id'>) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: ToastItem = { ...item, id };
    toasts = [...toasts, newToast];
    notify();

    const duration = item.duration ?? 6000;
    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
    return id;
  },
  error(message: string, title: string = 'AI Request Failed') {
    return toast.show({ type: 'error', title, message });
  },
  success(message: string, title?: string) {
    return toast.show({ type: 'success', title, message });
  },
  info(message: string, title?: string) {
    return toast.show({ type: 'info', title, message });
  },
  warning(message: string, title?: string) {
    return toast.show({ type: 'warning', title, message });
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
};
