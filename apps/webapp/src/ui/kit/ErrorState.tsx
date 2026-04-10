import React from 'react';
import { Button } from './Button.js';

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-12, 24px)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '48px',
          marginBottom: 'var(--spacing-6, 8px)',
        }}
      >
        ⚠️
      </div>
      <h3
        style={{
          margin: '0 0 var(--spacing-4, 6px) 0',
          fontSize: '18px',
          fontWeight: '600',
          color: 'var(--color-text-0)',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: '0 0 var(--spacing-10, 16px) 0',
            fontSize: '14px',
            color: 'var(--color-muted)',
            maxWidth: '300px',
          }}
        >
          {description}
        </p>
      )}
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          Попробовать снова
        </Button>
      )}
    </div>
  );
}
