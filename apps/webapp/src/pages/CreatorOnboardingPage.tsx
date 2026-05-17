import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMyExpertSubscription } from '../shared/queries/useMyExpertSubscription.js';
import { deriveExpertCtaState } from '../features/account/expertCtaState.js';
import { config } from '../shared/config/flags.js';
import { isTelegramMiniApp, openExternalHttpsUrl } from '../shared/auth/telegram.js';
import { PageScreen } from '../ui/edify/PageScreen.js';
import { MiniAppRowAction } from '../ui/kit/MiniAppRowAction.js';

const SITE = config.MARKETING_SITE_URL;
const PRICING_URL = `${SITE}/#pricing`;
const PROFILE_URL = `${SITE}/platform/?screen=s-profile`;
const PLATFORM_URL = `${SITE}/platform/`;

const rawSupport = import.meta.env.VITE_SUPPORT_TG_LINK as string | undefined;
const SUPPORT_LINK =
  typeof rawSupport === 'string' && rawSupport.trim() ? rawSupport.trim() : undefined;
const hasSupportLink = Boolean(
  SUPPORT_LINK &&
    (SUPPORT_LINK.startsWith('http') ||
      SUPPORT_LINK.startsWith('tg:') ||
      SUPPORT_LINK.startsWith('//')),
);

function openSupportLink(): void {
  if (!hasSupportLink || !SUPPORT_LINK) return;
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(SUPPORT_LINK);
  } else {
    window.open(SUPPORT_LINK, '_blank', 'noopener,noreferrer');
  }
}

function getForcedState(searchParams: URLSearchParams): 'none' | 'expired' | 'active' | null {
  if (!import.meta.env.DEV) return null;
  const p = searchParams.get('expertCta');
  if (p === 'none' || p === 'expired' || p === 'active') return p;
  return null;
}

const STEPS = [
  {
    title: 'Откройте сайт EDIFY',
    text: 'Перейдите на edify.su в браузере — там оформляется подписка и настройки эксперта.',
  },
  {
    title: 'Войдите в аккаунт',
    text: 'Авторизуйтесь тем же email или способом входа, который будете использовать для курсов.',
  },
  {
    title: 'Оплатите подписку эксперта',
    text: 'На странице тарифов выберите «Стать экспертом» и завершите оплату.',
  },
  {
    title: 'Привяжите Telegram в профиле',
    text: 'В кабинете на сайте: Профиль → «Подключить Telegram». Используйте тот же аккаунт, что в этом mini app.',
  },
] as const;

function SiteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function OnboardingSteps() {
  return (
    <ol className="edify-onboard-steps" aria-label="Как стать экспертом">
      {STEPS.map((step, i) => (
        <li key={step.title} className="edify-onboard-step">
          <span className="edify-onboard-step__num" aria-hidden>
            {i + 1}
          </span>
          <div className="edify-onboard-step__body">
            <div className="edify-onboard-step__title">{step.title}</div>
            <p className="edify-onboard-step__text">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CreatorOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expertCtaParam = searchParams.get('expertCta') as 'none' | 'expired' | 'active' | null;
  const expertCta =
    expertCtaParam && ['none', 'expired', 'active'].includes(expertCtaParam)
      ? expertCtaParam
      : undefined;

  const forcedState = getForcedState(searchParams);
  const { data } = useMyExpertSubscription({ expertCta });
  const state = forcedState ?? deriveExpertCtaState(data ?? null);

  if (state === 'active') {
    return (
      <PageScreen>
        <div className="edify-greeting">
          <div className="edify-eyebrow">EXPERT · ACTIVE</div>
          <h1 className="edify-h edify-h--lg">Кабинет готов</h1>
          <p className="edify-subtitle" style={{ marginTop: 10 }}>
            Подписка активна. Управляйте курсами в mini app или на сайте.
          </p>
        </div>
        {isTelegramMiniApp() ? (
          <Link to="/expert" className="edify-btn-solid" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Открыть кабинет эксперта
          </Link>
        ) : (
          <button type="button" className="edify-btn-solid" style={{ width: '100%' }} onClick={() => navigate('/expert')}>
            Открыть кабинет эксперта
          </button>
        )}
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <MiniAppRowAction
            title="Сайт EDIFY"
            subtitle="Профиль, тарифы, привязка Telegram"
            icon={<SiteIcon />}
            onClick={() => openExternalHttpsUrl(PLATFORM_URL)}
          />
        </div>
      </PageScreen>
    );
  }

  const heroLead =
    state === 'expired'
      ? 'Подписка истекла. Продлите её на сайте и снова привяжите Telegram в профиле, если меняли аккаунт.'
      : 'Оформление эксперта проходит на сайте. После оплаты и привязки Telegram вернитесь сюда — откроется кабинет.';

  return (
    <PageScreen>
      <div className="edify-onboard-hero">
        <div className="edify-eyebrow edify-eyebrow--plain">EDIFY · PLATFORM</div>
        <h1 className="edify-h edify-h--lg" style={{ marginBottom: 8 }}>
          Стать экспертом
        </h1>
        <p className="edify-subtitle">{heroLead}</p>
      </div>

      <OnboardingSteps />

      <div className="edify-onboard-actions">
        <MiniAppRowAction
          title="Тарифы и оплата"
          subtitle="edify.su — подписка «Стать экспертом»"
          icon={<CardIcon />}
          onClick={() => openExternalHttpsUrl(PRICING_URL)}
        />
        <MiniAppRowAction
          title="Профиль на сайте"
          subtitle="Привязка Telegram после входа"
          icon={<TelegramIcon />}
          onClick={() => openExternalHttpsUrl(PROFILE_URL)}
        />
        <MiniAppRowAction
          title="Открыть кабинет на сайте"
          subtitle={SITE.replace(/^https?:\/\//, '')}
          icon={<SiteIcon />}
          onClick={() => openExternalHttpsUrl(PLATFORM_URL)}
        />
      </div>

      {hasSupportLink ? (
        <button type="button" className="edify-onboard-support" onClick={openSupportLink}>
          Вопросы? Написать в поддержку
        </button>
      ) : null}
    </PageScreen>
  );
}
