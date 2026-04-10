import React, { useEffect } from 'react';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      // Block scroll on body
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Prevent focus trap - block pointer events on main content
      // Find main element (should be unique in AppShell)
      const main = document.querySelector('main');
      let originalPointerEvents: string | null = null;
      if (main) {
        originalPointerEvents = (main as HTMLElement).style.pointerEvents;
        (main as HTMLElement).style.pointerEvents = 'none';
      }

      return () => {
        // Restore original values on cleanup
        document.body.style.overflow = originalOverflow;
        if (main && originalPointerEvents !== null) {
          (main as HTMLElement).style.pointerEvents = originalPointerEvents;
        } else if (main) {
          // Fallback: clear if original was empty string
          (main as HTMLElement).style.pointerEvents = '';
        }
      };
    } else {
      // Ensure cleanup when closing
      document.body.style.overflow = '';
      const main = document.querySelector('main');
      if (main) {
        (main as HTMLElement).style.pointerEvents = '';
      }
    }
  }, [open]);

  // Handle Esc key
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 'var(--z-modal, 2000)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '80vh',
          backgroundColor: 'var(--color-bg-0)',
          borderTopLeftRadius: 'var(--radius-xl, 16px)',
          borderTopRightRadius: 'var(--radius-xl, 16px)',
          zIndex: 'calc(var(--z-modal, 2000) + 1)',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'calc(var(--safe-bottom, 0px) + var(--spacing-6, 8px))',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => {
          // Prevent closing when clicking inside sheet
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-6, 8px) var(--spacing-10, 16px)',
            borderBottom: '1px solid var(--color-stroke)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--color-text-0)',
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-0)',
              cursor: 'pointer',
              padding: 'var(--spacing-3, 4px)',
              fontSize: '24px',
              lineHeight: 1,
              minWidth: '40px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--spacing-10, 16px)',
          }}
        >
          {children}
        </div>
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from {
                transform: translateY(100%);
              }
              to {
                transform: translateY(0);
              }
            }
          `}
        </style>
      </div>
    </>
  );
}
