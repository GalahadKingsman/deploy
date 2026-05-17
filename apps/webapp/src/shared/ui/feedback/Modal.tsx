import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../primitives/Button.js';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sp-4)',
        overflow: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: 'var(--card-grad)',
          backgroundColor: 'var(--card)',
          border: '1px solid var(--modal-border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-soft)',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            style={{
              padding: 'var(--sp-4)',
              borderBottom: '1px solid var(--modal-header-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--fg)',
              }}
            >
              {title}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        )}
        <div
          style={{
            padding: 'var(--sp-4)',
            overflow: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--modal-overlay)',
          zIndex: -1,
        }}
      />
    </div>,
    document.body,
  );
}
