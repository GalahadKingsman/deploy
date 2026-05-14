import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '../shared/ui/index.js';
import { MiniAppRowAction } from '../ui/kit/MiniAppRowAction.js';
import { isTelegramMiniApp } from '../shared/auth/telegram.js';
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
      {isTelegramMiniApp() ? (
        <>
          <MiniAppRowAction
            to={`/expert/${expertId}/courses`}
            title="Курсы"
            subtitle="Модули, уроки, публикация"
            trailing="chevron"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M8 7h8M8 11h6" opacity="0.6" />
              </svg>
            }
          />
          <MiniAppRowAction
            to={`/expert/${expertId}/team`}
            title="Команда"
            subtitle="Роли и доступ к курсам"
            trailing="chevron"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
        </>
      ) : (
        <>
          <Button asChild variant="primary" style={{ width: '100%' }}>
            <Link to={`/expert/${expertId}/courses`}>Курсы</Link>
          </Button>
          <Button asChild variant="secondary" style={{ width: '100%' }}>
            <Link to={`/expert/${expertId}/team`}>Команда</Link>
          </Button>
        </>
      )}
    </div>
  );
}

