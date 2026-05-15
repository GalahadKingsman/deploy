import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../shared/ui/index.js';
import { useMyExpertMemberships } from '../shared/queries/useMyExpertMemberships.js';
import { useMyExpertSubscription } from '../shared/queries/useMyExpertSubscription.js';
import { deriveExpertCtaState } from '../features/account/expertCtaState.js';
import { PageScreen } from '../ui/edify/PageScreen.js';

function pickPrimaryExpertId(items: { expertId: string }[]): string | null {
  if (!items || items.length === 0) return null;
  return items[0]?.expertId ?? null;
}

const Chevron = () => (
  <svg className="edify-list-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export function ExpertHomePage() {
  const { data, isLoading, error } = useMyExpertMemberships();
  const { data: subData } = useMyExpertSubscription();
  const subState = deriveExpertCtaState(subData ?? null);
  const activeExpertId = subState === 'active' ? (subData?.expertId ?? null) : null;
  const expertId = activeExpertId ?? pickPrimaryExpertId(data?.items ?? []);

  if (isLoading) {
    return <PageScreen>Загрузка…</PageScreen>;
  }

  if (error) {
    return (
      <PageScreen>
        <Card>
          <CardHeader>
            <CardTitle>Кабинет эксперта</CardTitle>
            <CardDescription>Не удалось загрузить данные.</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Попробуйте обновить страницу.
            </div>
          </CardContent>
        </Card>
      </PageScreen>
    );
  }

  if (!expertId) {
    return (
      <PageScreen>
        <Card>
          <CardHeader>
            <CardTitle>Кабинет эксперта</CardTitle>
            <CardDescription>У вас нет экспертского доступа.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/creator/onboarding" className="edify-btn-solid">
              Стать экспертом
            </Link>
          </CardContent>
        </Card>
      </PageScreen>
    );
  }

  return (
    <PageScreen>
      <div className="edify-greeting">
        <div className="edify-eyebrow">EXPERT</div>
        <h1 className="edify-h edify-h--xl" style={{ marginBottom: 12 }}>
          Кабинет
          <br />
          эксперта
        </h1>
        <p className="edify-subtitle">Управляйте курсами, командой и контентом.</p>
      </div>

      <Link to={`/expert/${expertId}/courses`} className="edify-list-row">
        <div className="edify-list-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <div className="edify-list-text">
          <div className="edify-list-title">Курсы</div>
          <div className="edify-list-sub">Модули, уроки, публикация</div>
        </div>
        <Chevron />
      </Link>

      <Link to={`/expert/${expertId}/team`} className="edify-list-row">
        <div className="edify-list-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="edify-list-text">
          <div className="edify-list-title">Команда</div>
          <div className="edify-list-sub">Роли и доступ к курсам</div>
        </div>
        <Chevron />
      </Link>
    </PageScreen>
  );
}
