import React, { useEffect, useState } from 'react';
import { toast, Toast } from './toast.js';

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // Subscribe and cleanup on unmount
    const unsubscribe = toast.subscribe(setToasts);
    return () => {
      unsubscribe();
      // Clear all timers on unmount to prevent leaks
      toast.clearAll();
    };
  }, []);

  if (toasts.length === 0) return null;

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--topbar-h) + var(--safe-top, 0px) + var(--spacing-6, 8px))',
        left: 'var(--spacing-6, 8px)',
        right: 'var(--spacing-6, 8px)',
        zIndex: 'var(--z-toast, 3000)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-4, 6px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-stroke)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: 'var(--spacing-6, 8px) var(--spacing-10, 16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-4, 6px)',
            color: 'var(--color-text-0)',
            fontSize: '14px',
            boxShadow: 'var(--shadow-card)',
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <span style={{ fontSize: '18px' }}>{getIcon(t.type)}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            type="button"
            onClick={() => toast.remove(t.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              padding: 'var(--spacing-2, 2px)',
              fontSize: '18px',
              lineHeight: 1,
            }}
            aria-label="Закрыть"
          >
            ×
          </button>
          <style>
            {`
              @keyframes slideIn {
                from {
                  opacity: 0;
                  transform: translateY(-10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}
          </style>
        </div>
      ))}
    </div>
  );
}
