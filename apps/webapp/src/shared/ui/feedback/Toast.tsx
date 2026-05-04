import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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

  const contextValue = useMemo<ToastContextValue>(() => ({ show }), [show]);

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
      background: 'linear-gradient(180deg, rgba(61,220,151,0.95) 0%, rgba(61,220,151,0.80) 100%)',
      color: 'rgba(10, 14, 18, 0.95)',
    },
    error: {
      background: 'linear-gradient(180deg, rgba(239,83,80,0.95) 0%, rgba(239,83,80,0.82) 100%)',
      color: '#fff',
    },
    info: {
      background: 'var(--card-grad)',
      backgroundColor: 'var(--card)',
      color: 'var(--fg)',
      border: '1px solid rgba(255,255,255,0.12)',
    },
  };

  return (
    <ToastContext.Provider value={contextValue}>
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
                boxShadow: 'var(--shadow-soft)',
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
