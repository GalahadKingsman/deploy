import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isTelegramMiniApp } from '../../shared/auth/telegram.js';
import type { ExpertCtaState } from './expertCtaState.js';
import type { ContractsV1 } from '@tracked/shared';
import { MiniAppRowAction } from '../../ui/kit/MiniAppRowAction.js';

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

const ExpertLayersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M3 7l9-4 9 4-9 4-9-4Z" />
    <path d="M21 10l-9 4-9-4" opacity="0.7" />
    <path d="M21 14l-9 4-9-4" opacity="0.4" />
  </svg>
);

const ExpiredIcon = () => (
  <span style={{ fontWeight: 700, fontSize: 16, lineHeight: 1 }} aria-hidden>
    !
  </span>
);

export function BecomeExpertCard({ state, subscription }: BecomeExpertCardProps) {
  const navigate = useNavigate();

  const periodEnd = subscription?.currentPeriodEnd ?? null;
  const periodEndFormatted = formatPeriodEnd(periodEnd);

  if (state === 'none') {
    return (
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <MiniAppRowAction
          title="Стать экспертом"
          subtitle="Создавайте курсы и зарабатывайте"
          onClick={() => navigate('/creator/onboarding')}
          icon={<ExpertLayersIcon />}
        />
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <MiniAppRowAction
          title="Подписка истекла"
          subtitle={
            periodEndFormatted
              ? `Доступ ограничен · до ${periodEndFormatted}`
              : 'Доступ к эксперт‑функциям ограничен'
          }
          onClick={() => navigate('/creator/onboarding')}
          icon={<ExpiredIcon />}
        />
      </div>
    );
  }

  // state === 'active'
  const periodText = periodEndFormatted ? ` до ${periodEndFormatted}` : '';
  const cabinetCta = (
    <>
      <div className="edify-featured-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </div>
      <div className="edify-featured-text">
        <div className="edify-featured-title">Открыть кабинет</div>
        <div className="edify-featured-sub">Курсы · Команда · Контент</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--accent)' }} aria-hidden>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </>
  );

  return (
    <div className="edify-status-block" style={{ marginBottom: 'var(--sp-4)' }}>
      <div className="edify-status-row">
        <div className="edify-status-dot" />
        <div style={{ fontSize: 13, color: 'var(--fg)' }}>
          <strong>Вы эксперт.</strong>
          <span style={{ color: 'var(--text-secondary)' }}> Подписка активна{periodText}.</span>
        </div>
      </div>
      {isTelegramMiniApp() ? (
        <Link to="/expert" className="edify-featured-row">
          {cabinetCta}
        </Link>
      ) : (
        <button type="button" className="edify-featured-row" onClick={() => navigate('/expert')}>
          {cabinetCta}
        </button>
      )}
    </div>
  );
}
