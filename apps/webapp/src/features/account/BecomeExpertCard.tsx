import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from '../../shared/ui/index.js';
import type { ExpertCtaState } from './expertCtaState.js';
import type { ContractsV1 } from '@tracked/shared';

export interface BecomeExpertCardProps {
  state: ExpertCtaState;
  subscription: ContractsV1.ExpertSubscriptionV1 | null;
}

function formatPeriodEnd(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function BecomeExpertCard({ state, subscription }: BecomeExpertCardProps) {
  const navigate = useNavigate();

  const periodEnd = subscription?.currentPeriodEnd ?? null;
  const periodEndFormatted = formatPeriodEnd(periodEnd);

  if (state === 'none') {
    return (
      <Card
        style={{
          marginBottom: 'var(--sp-4)',
          padding: 'var(--sp-4)',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--r-xl)',
          border: '1px solid rgba(255,255,255,0.10)',
          background:
            'radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 55%, rgba(0,0,0,0) 100%)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7l9-4 9 4-9 4-9-4Z" />
              <path d="M21 10l-9 4-9-4" opacity="0.7" />
              <path d="M21 14l-9 4-9-4" opacity="0.4" />
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div
                style={{
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--fg)',
                }}
              >
                Стать экспертом
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1 }} aria-hidden>
                ›
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', marginTop: 2 }}>
              Создавайте курсы и зарабатывайте
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--sp-3)' }}>
          <Button
            variant="primary"
            onClick={() => navigate('/creator/onboarding')}
            style={{
              width: '100%',
              borderRadius: 12,
              height: 44,
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            Перейти в режим эксперта
          </Button>
        </div>
      </Card>
    );
  }

  if (state === 'expired') {
    return (
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Подписка истекла</CardTitle>
          <CardDescription>
            Доступ к эксперт-функциям ограничен.
            {periodEndFormatted && <> Статус: expired. До: {periodEndFormatted}</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="primary"
            onClick={() => navigate('/creator/onboarding')}
            style={{ width: '100%' }}
          >
            Продлить (0₽)
          </Button>
        </CardContent>
      </Card>
    );
  }

  // state === 'active'
  return (
    <Card style={{ marginBottom: 'var(--sp-4)' }}>
      <CardHeader>
        <CardTitle>Вы эксперт</CardTitle>
        <CardDescription>
          Подписка активна.
          {periodEndFormatted && ` До ${periodEndFormatted}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="primary"
          onClick={() => navigate('/expert')}
          style={{ width: '100%' }}
        >
          Открыть кабинет
        </Button>
      </CardContent>
    </Card>
  );
}
