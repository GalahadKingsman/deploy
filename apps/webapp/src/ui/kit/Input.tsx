import React from 'react';
import { SIZES } from './constants.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  error?: string;
  variant?: 'default' | 'search';
}

export function Input({ leftIcon, error, variant = 'default', style, ...props }: InputProps) {
  const searchIcon = (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const baseStyle: React.CSSProperties = {
    width: '100%',
    minHeight: SIZES.INPUT_HEIGHT,
    padding:
      variant === 'search'
        ? 'var(--spacing-4, 6px) var(--spacing-10, 16px)'
        : 'var(--spacing-4, 6px) var(--spacing-6, 8px)',
    backgroundColor: 'var(--color-bg-1)',
    border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-stroke)'}`,
    borderRadius: variant === 'search' ? 'var(--radius-xl, 16px)' : 'var(--radius-md, 8px)',
    color: 'var(--color-text-0)',
    fontSize: '15px',
    outline: 'none',
    transition: 'all 0.2s',
    ...style,
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-3, 4px)',
          width: '100%',
        }}
      >
        {(leftIcon || variant === 'search') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-muted)',
              flexShrink: 0,
              width: '20px',
              height: '20px',
            }}
          >
            {variant === 'search' ? searchIcon : leftIcon}
          </div>
        )}
        <input
          type="text"
          style={baseStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent)';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(79, 195, 247, 0.2)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error
              ? 'var(--color-danger)'
              : 'var(--color-stroke)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          {...props}
        />
      </div>
      {error && (
        <div
          style={{
            marginTop: 'var(--spacing-2, 2px)',
            fontSize: '13px',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
