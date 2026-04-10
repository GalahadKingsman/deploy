import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../ui/shell/index.js';
import { Card, Button } from '../../ui/kit/index.js';

export function StubLayout({ description }: { description: string }) {
  const navigate = useNavigate();
  const handleBack = () => {
    // If history is empty (direct entry), navigate to /learn instead of navigate(-1)
    // This prevents closing WebView or unexpected behavior
    if (typeof window !== 'undefined' && window.history.length <= 1) {
      navigate('/learn', { replace: true });
    } else {
      navigate(-1);
    }
  };

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
      <div style={{ padding: 'var(--spacing-10, 16px)' }}>
        <Card variant="default" padding="lg">
          <div style={{ textAlign: 'center', color: 'var(--color-text-0)' }}>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '600',
                margin: '0 0 var(--spacing-6, 8px) 0',
              }}
            >
              В разработке
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--color-muted)',
                margin: '0 0 var(--spacing-10, 16px) 0',
              }}
            >
              {description}
            </p>
            <Button variant="primary" onClick={handleBack}>
              Назад
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
