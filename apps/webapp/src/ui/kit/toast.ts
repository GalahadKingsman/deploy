type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

type ToastListener = (toasts: Toast[]) => void;

class ToastStore {
  private toasts: Toast[] = [];
  private listeners: ToastListener[] = [];
  // Use browser-compatible timer type (ReturnType<typeof setTimeout>)
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  subscribe(listener: ToastListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  add(type: ToastType, message: string) {
    // Guarantee unique ID: timestamp + random + counter
    const id = `${Date.now()}-${Math.random()}-${this.toasts.length}`;
    const toast: Toast = { id, type, message };
    this.toasts.push(toast);
    this.notify();

    // Auto-dismiss after 3000ms - store timer for cleanup
    const timer = setTimeout(() => {
      this.remove(id);
    }, 3000);
    this.timers.set(id, timer);

    return id;
  }

  remove(id: string) {
    // Clear timer if exists (manual close or auto-dismiss)
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clearAll() {
    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.toasts = [];
    this.notify();
  }

  getToasts(): Toast[] {
    return [...this.toasts];
  }
}

const store = new ToastStore();

export const toast = {
  success: (message: string) => store.add('success', message),
  error: (message: string) => store.add('error', message),
  info: (message: string) => store.add('info', message),
  subscribe: (listener: ToastListener) => store.subscribe(listener),
  remove: (id: string) => store.remove(id),
  clearAll: () => store.clearAll(),
};
