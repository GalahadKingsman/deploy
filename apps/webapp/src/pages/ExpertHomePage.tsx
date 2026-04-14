import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '../shared/ui/index.js';
import { useMyExpertMemberships } from '../shared/queries/useMyExpertMemberships.js';
import { useMyExpertSubscription } from '../shared/queries/useMyExpertSubscription.js';
import { deriveExpertCtaState } from '../features/account/expertCtaState.js';

function pickPrimaryExpertId(items: { expertId: string }[]): string | null {
  if (!items || items.length === 0) return null;
  return items[0]?.expertId ?? null;
}

export function ExpertHomePage() {
  const { data, isLoading, error } = useMyExpertMemberships();
  const { data: subData } = useMyExpertSubscription();
  const subState = deriveExpertCtaState(subData ?? null);
  const activeExpertId = subState === 'active' ? (subData?.expertId ?? null) : null;
  const expertId = activeExpertId ?? pickPrimaryExpertId(data?.items ?? []);

  if (isLoading) {
    return <div style={{ padding: 'var(--sp-4)' }}>Загрузка…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Кабинет эксперта</CardTitle>
            <CardDescription>Не удалось загрузить данные.</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>
              Попробуйте обновить страницу.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!expertId) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Кабинет эксперта</CardTitle>
            <CardDescription>У вас нет экспертского доступа.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="primary" style={{ width: '100%' }}>
              <Link to="/creator/onboarding">Стать экспертом</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Кабинет эксперта</CardTitle>
          <CardDescription>Управляйте курсами и контентом.</CardDescription>
        </CardHeader>
      </Card>
      <Button asChild variant="primary" style={{ width: '100%' }}>
        <Link to={`/expert/${expertId}/courses`}>Курсы</Link>
      </Button>
      <Button asChild variant="secondary" style={{ width: '100%' }}>
        <Link to={`/expert/${expertId}/team`}>Команда</Link>
      </Button>
    </div>
  );
}

