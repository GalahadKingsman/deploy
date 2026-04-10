import React from 'react';
import { Button } from '../primitives/Button.js';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sp-8) var(--sp-4)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--fg)',
          marginBottom: description ? 'var(--sp-2)' : 'var(--sp-4)',
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: 'var(--text-md)',
            color: 'var(--muted-fg)',
            marginBottom: actionLabel ? 'var(--sp-4)' : 0,
            maxWidth: '400px',
          }}
        >
          {description}
        </div>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
