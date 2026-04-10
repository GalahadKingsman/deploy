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
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Стать экспертом</CardTitle>
          <CardDescription>
            Создайте эксперт-аккаунт, чтобы публиковать курсы и зарабатывать.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="primary"
            onClick={() => navigate('/creator/onboarding')}
            style={{ width: '100%' }}
          >
            Начать (0₽)
          </Button>
        </CardContent>
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
