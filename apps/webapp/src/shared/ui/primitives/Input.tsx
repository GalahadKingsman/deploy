import React from 'react';
import { cn } from '../utils/cn.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, className, style, id, ...props }: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = !!error;

  const inputStyles: React.CSSProperties = {
    width: '100%',
    padding: 'var(--sp-3)',
    fontSize: 'var(--text-md)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--fg)',
    backgroundColor: 'var(--card)',
    border: `1px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
    borderRadius: 'var(--r-md)',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            marginBottom: 'var(--sp-2)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--fg)',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(className)}
        style={{
          ...inputStyles,
          ...style,
        }}
        {...props}
      />
      {error && (
        <p
          style={{
            margin: 'var(--sp-1) 0 0',
            fontSize: 'var(--text-xs)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </p>
      )}
      {!error && hint && (
        <p
          style={{
            margin: 'var(--sp-1) 0 0',
            fontSize: 'var(--text-xs)',
            color: 'var(--muted-fg)',
          }}
        >
          {hint}
        </p>
      )}
      <style>{`
        input:focus {
          border-color: var(--accent) !important;
        }
        input::placeholder {
          color: var(--muted-fg);
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}
