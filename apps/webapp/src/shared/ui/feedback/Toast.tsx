import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastMessage {
  title: string;
  message?: string;
  variant: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  show: (toast: ToastMessage) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const show = useCallback((message: ToastMessage) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;

    const duration = toast.durationMs ?? 3000;
    const timer = setTimeout(() => {
      setToast(null);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast]);

  const variantStyles: Record<ToastVariant, React.CSSProperties> = {
    success: {
      backgroundColor: 'var(--accent)',
      color: 'var(--bg)',
    },
    error: {
      backgroundColor: 'var(--danger)',
      color: '#fff',
    },
    info: {
      backgroundColor: 'var(--card)',
      color: 'var(--fg)',
      border: '1px solid var(--border)',
    },
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 'calc(var(--topbar-h) + var(--safe-top, 0px) + var(--sp-3))',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              width: 'min(360px, calc(100vw - (var(--sp-4) * 2)))',
              pointerEvents: 'none',
              willChange: 'transform, opacity',
              animation: 'toastSlideDown 0.3s ease-out',
            }}
          >
            <div
              style={{
                ...variantStyles[toast.variant],
                padding: 'var(--sp-3) var(--sp-4)',
                borderRadius: 'var(--r-md)',
                boxShadow: 'var(--shadow-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--sp-1)',
                pointerEvents: 'auto',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--font-weight-medium)',
                }}
              >
                {toast.title}
              </div>
              {toast.message && (
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    opacity: 0.9,
                  }}
                >
                  {toast.message}
                </div>
              )}
            </div>
            <style>{`
              @keyframes toastSlideDown {
                from {
                  opacity: 0;
                  transform: translateX(-50%) translateY(-6px);
                }
                to {
                  opacity: 1;
                  transform: translateX(-50%) translateY(0);
                }
              }
            `}</style>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
