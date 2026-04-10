import React from 'react';
import { AppShell } from '../ui/shell/index.js';

export function LayoutTestPage() {
  return (
    <AppShell
      title="Edify"
      logo={
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--color-bg-0)',
          }}
        >
          E
        </div>
      }
    >
      <div>
        <p style={{ color: 'var(--color-muted)', margin: '0 0 var(--spacing-12, 24px) 0' }}>
          Проверка скролла и safe-area. Контент не должен скрываться за таббаром.
        </p>

        {/* Тестовые блоки для проверки скролла */}
        <div>
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              style={{
                padding: 'var(--spacing-10, 16px)',
                marginBottom: 'var(--spacing-6, 8px)',
                backgroundColor: 'var(--color-bg-1)',
                borderRadius: 'var(--radius-md, 8px)',
                color: 'var(--color-text-1)',
              }}
            >
              Тестовый блок {i + 1} для проверки скролла и safe-area bottom padding
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
