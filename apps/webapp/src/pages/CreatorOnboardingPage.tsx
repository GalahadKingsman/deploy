import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from '../shared/ui/index.js';
import { useMyExpertSubscription } from '../shared/queries/useMyExpertSubscription.js';
import { useMyExpertApplication } from '../shared/queries/useMyExpertApplication.js';
import { deriveExpertCtaState } from '../features/account/expertCtaState.js';
import { getTelegramDisplayUser } from '../shared/auth/telegram.js';

const rawSupport = import.meta.env.VITE_SUPPORT_TG_LINK as string | undefined;
const SUPPORT_LINK =
  typeof rawSupport === 'string' && rawSupport.trim() ? rawSupport.trim() : undefined;
const hasSupportLink = Boolean(
  SUPPORT_LINK &&
    (SUPPORT_LINK.startsWith('http') ||
      SUPPORT_LINK.startsWith('tg:') ||
      SUPPORT_LINK.startsWith('//')),
);

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-999999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function openSupportLink(): void {
  if (!hasSupportLink || !SUPPORT_LINK) return;
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(SUPPORT_LINK);
  } else {
    window.open(SUPPORT_LINK, '_blank', 'noopener,noreferrer');
  }
}

// DEV-only: force state from ?expertCta=none|expired|active
function getForcedState(searchParams: URLSearchParams): 'none' | 'expired' | 'active' | null {
  if (!import.meta.env.DEV) return null;
  const p = searchParams.get('expertCta');
  if (p === 'none' || p === 'expired' || p === 'active') return p;
  return null;
}

// DEV-only: force application state from ?expertApp=none|pending|rejected|approved
function getForcedExpertApp(
  searchParams: URLSearchParams,
): 'none' | 'pending' | 'rejected' | 'approved' | null {
  if (!import.meta.env.DEV) return null;
  const p = searchParams.get('expertApp');
  if (p === 'none' || p === 'pending' || p === 'rejected' || p === 'approved') return p;
  return null;
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
  const expertApp = getForcedExpertApp(searchParams) ?? undefined;

  const { data } = useMyExpertSubscription({ expertCta });
  const subscription = data ?? null;
  const state = forcedState ?? deriveExpertCtaState(subscription);

  const { data: appData, submit, isSubmitting, refetch } = useMyExpertApplication({ expertApp });
  const application = appData?.application ?? null;

  const displayUser = getTelegramDisplayUser();
  const username = displayUser?.username ?? '';
  const applicationText = `Хочу стать экспертом. Мой @username: ${username || 'username'}.`;

  const statusLabel =
    state === 'active' ? 'Вы эксперт' : state === 'expired' ? 'Подписка истекла' : 'Вы студент';

  const applicationStatusLabel = !application
    ? 'Нет заявки'
    : application.status === 'pending'
      ? 'Заявка на рассмотрении'
      : application.status === 'rejected'
        ? 'Отклонено'
        : 'Одобрено';

  const handleSubmitApplication = async () => {
    try {
      await submit(applicationText);
      if (window.Telegram?.WebApp?.showPopup) {
        window.Telegram.WebApp.showPopup({
          title: 'Заявка подана',
          message: 'Заявка на рассмотрении. Мы свяжемся с вами после проверки.',
        });
      }
    } catch {
      if (window.Telegram?.WebApp?.showPopup) {
        window.Telegram.WebApp.showPopup({
          title: 'Ошибка',
          message: 'Не удалось отправить заявку. Попробуйте позже.',
        });
      }
    }
  };

  const handleCopyApplication = async () => {
    const ok = await copyToClipboard(applicationText);
    if (ok && window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({
        title: 'Скопировано',
        message: 'Текст заявки скопирован в буфер. Вставьте его в чат поддержки.',
      });
    }
  };

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Стать экспертом</CardTitle>
          <CardDescription>
            {statusLabel}. Статус заявки: {applicationStatusLabel}.{' '}
            {state === 'active'
              ? 'Подписка активна. Ниже — информация для новых экспертов.'
              : state === 'expired'
                ? 'Продлите подписку, чтобы снова публиковать курсы.'
                : application?.status === 'approved'
                  ? 'Ожидайте активации (вручную после одобрения).'
                  : 'Подайте заявку, чтобы стать экспертом.'}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Что получите</CardTitle>
          <CardDescription style={{ whiteSpace: 'pre-line', marginTop: 'var(--sp-2)' }}>
            {
              '• Эксперт-аккаунт: публикация курсов\n• Доступ к аналитике и монетизация\n• Подписка 0₽ на этапе запуска'
            }
          </CardDescription>
        </CardHeader>
      </Card>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Условия</CardTitle>
          <CardDescription style={{ whiteSpace: 'pre-line', marginTop: 'var(--sp-2)' }}>
            {
              '• Заполнить профиль эксперта\n• Принять условия платформы\n• После одобрения заявки доступ включается вручную'
            }
          </CardDescription>
        </CardHeader>
      </Card>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Подписка 0₽ (ручная активация)</CardTitle>
          <CardDescription>
            После одобрения мы активируем доступ. Оплата не требуется.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {application?.status === 'pending' && (
            <>
              <div
                style={{
                  padding: 'var(--sp-3)',
                  background: 'var(--surface)',
                  borderRadius: 'var(--r-md)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--muted-fg)',
                }}
              >
                Заявка на рассмотрении. Мы свяжемся с вами после проверки.
              </div>
              <Button
                variant="secondary"
                onClick={() => refetch()}
                disabled={isSubmitting}
                style={{ width: '100%' }}
              >
                Обновить статус
              </Button>
            </>
          )}
          {application?.status === 'rejected' && (
            <>
              {application.adminNote && (
                <div
                  style={{
                    padding: 'var(--sp-3)',
                    background: 'var(--surface)',
                    borderRadius: 'var(--r-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--muted-fg)',
                  }}
                >
                  Причина: {application.adminNote}
                </div>
              )}
              <Button
                variant="primary"
                onClick={handleSubmitApplication}
                disabled={isSubmitting}
                style={{ width: '100%' }}
              >
                Подать снова
              </Button>
            </>
          )}
          {application?.status === 'approved' && (
            <div
              style={{
                padding: 'var(--sp-3)',
                background: 'var(--surface)',
                borderRadius: 'var(--r-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--muted-fg)',
              }}
            >
              Одобрено. Ожидайте активации (вручную после одобрения).
            </div>
          )}
          {!application && (
            <>
              <Button
                variant="primary"
                onClick={handleSubmitApplication}
                disabled={isSubmitting}
                style={{ width: '100%' }}
              >
                Подать заявку
              </Button>
              {hasSupportLink ? (
                <Button variant="secondary" onClick={openSupportLink} style={{ width: '100%' }}>
                  Написать в поддержку
                </Button>
              ) : (
                <div
                  style={{
                    padding: 'var(--sp-3)',
                    background: 'var(--surface)',
                    borderRadius: 'var(--r-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--muted-fg)',
                  }}
                >
                  Укажи VITE_SUPPORT_TG_LINK в .env и пересобери webapp (pnpm --filter @tracked/webapp
                  build), затем обнови статику на сервере. Пример: https://t.me/your_support
                </div>
              )}
            </>
          )}
          {hasSupportLink && (
            <Button variant="secondary" onClick={handleCopyApplication} style={{ width: '100%' }}>
              Скопировать текст заявки
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate(-1)} style={{ width: '100%' }}>
            Назад
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
