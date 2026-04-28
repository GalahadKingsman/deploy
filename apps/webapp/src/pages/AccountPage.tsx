import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Skeleton,
  EmptyState,
  ErrorState,
  ListItem,
  useToast,
} from '../shared/ui/index.js';
import { useMe } from '../shared/queries/useMe.js';
import { useMyExpertSubscription } from '../shared/queries/useMyExpertSubscription.js';
import { useMyReferral } from '../shared/queries/useMyReferral.js';
import { useMyCommissions } from '../shared/queries/useMyCommissions.js';
import { useMyReferralStats } from '../shared/queries/useMyReferralStats.js';
import { deriveExpertCtaState } from '../features/account/expertCtaState.js';
import { BecomeExpertCard } from '../features/account/BecomeExpertCard.js';
import { getTelegramDisplayUser, type TelegramDisplayUser } from '../shared/auth/telegram.js';
import type { ContractsV1 } from '@tracked/shared';

type DisplayUser = ContractsV1.UserV1 | TelegramDisplayUser | null;

const rawSupport = import.meta.env.VITE_SUPPORT_TG_LINK as string | undefined;
const SUPPORT_LINK =
  typeof rawSupport === 'string' && rawSupport.trim()
    ? rawSupport.trim()
    : 'https://t.me/somefunc';

const mockStats = {
  progress: { completed: 12, total: 30, label: 'Прогресс' },
};

// Copy to clipboard helper with fallback
async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: create temporary textarea
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

function openSupportLink(): void {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(SUPPORT_LINK);
  } else {
    window.open(SUPPORT_LINK, '_blank', 'noopener,noreferrer');
  }
}

// Placeholder shown when no avatar or while image is loading
function AvatarPlaceholderCircle({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: 'var(--accent)',
        opacity: 0.2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: Math.round(size * 0.6),
          height: Math.round(size * 0.6),
          borderRadius: '50%',
          backgroundColor: 'var(--accent)',
          opacity: 0.5,
        }}
      />
    </div>
  );
}

// URLs we've already loaded — при возврате в профиль аватар не мигает плейсхолдером
const loadedAvatarUrls = new Set<string>();

// Avatar: image from URL (with placeholder until loaded) or placeholder only
function UserAvatar({ user }: { user: DisplayUser }) {
  const src = user?.avatarUrl ?? null;
  const size = 64;
  const alreadyLoaded = src ? loadedAvatarUrls.has(src) : false;
  const [loaded, setLoaded] = React.useState(alreadyLoaded);

  const handleLoad = React.useCallback(() => {
    setLoaded(true);
    if (src) loadedAvatarUrls.add(src);
  }, [src]);

  if (!src) {
    return <AvatarPlaceholderCircle size={size} />;
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <AvatarPlaceholderCircle size={size} />
        </div>
      )}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="eager"
        onLoad={handleLoad}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          position: 'relative',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      />
    </div>
  );
}

function displayName(user: DisplayUser): string {
  if (!user) return 'Пользователь';
  const first = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (first) return first;
  if (user.username) return user.username;
  return 'Пользователь';
}

// Copy icon (icon-only, no lucide dependency)
function CopyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// Profile Card Component
// isPro: show "Pro" badge only when expert (expired/active), not for student (none).
// tgId: only when in Telegram (initDataUnsafe.user.id) — show number + icon-only copy; in browser show nothing.
function ProfileCard({
  user,
  isPro,
  tgId,
}: {
  user: DisplayUser;
  isPro: boolean;
  tgId: string | null;
}) {
  const name = displayName(user);
  const handle = user?.username ? `@${user.username}` : '';
  const toast = useToast();

  const handleCopyTgId = React.useCallback(async () => {
    if (!tgId) return;
    const ok = await copyToClipboard(tgId);
    if (ok && window.Telegram?.WebApp?.showPopup) {
      window.Telegram.WebApp.showPopup({ title: 'Скопировано', message: 'TG ID скопирован.' });
    } else if (ok && toast?.show) {
      toast.show({ title: 'Скопировано', variant: 'success' });
    }
  }, [tgId, toast]);

  return (
    <Card style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
        }}
      >
        <UserAvatar user={user} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: displayName + Pro badge in one line; name truncates, badge stays visible */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 'var(--sp-1)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--fg)',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>
            {isPro && (
              <span
                style={{
                  flex: '0 0 auto',
                  padding: 'var(--sp-1) var(--sp-2)',
                  backgroundColor: 'var(--accent)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--bg)',
                  fontWeight: 'var(--font-weight-medium)',
                }}
              >
                Pro
              </span>
            )}
          </div>
          {/* Row 2: @username */}
          {handle && (
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--muted-fg)',
                marginBottom: tgId ? 'var(--sp-1)' : 'var(--sp-2)',
              }}
            >
              {handle}
            </div>
          )}
          {/* Row 3: TG ID + copy icon */}
          {tgId && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                marginBottom: 'var(--sp-2)',
              }}
            >
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>{tgId}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyTgId}
                aria-label="Copy ID"
                style={{
                  padding: 'var(--sp-1)',
                  minWidth: 32,
                  minHeight: 32,
                }}
              >
                <CopyIcon size={16} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Referral Card Component
function ReferralCard() {
  const toast = useToast();
  const { data, isLoading } = useMyReferral();
  const { data: commissionsData } = useMyCommissions();
  const { data: stats } = useMyReferralStats();
  const referralCode = data?.code ?? '';
  const referralLink = referralCode ? `${window.location.origin}/?ref=${referralCode}` : '';
  const commissions = commissionsData?.items ?? [];
  const totalCents = commissions.reduce((sum, c) => sum + (c.amountCents ?? 0), 0);

  const handleCopy = async () => {
    const success = await copyToClipboard(referralLink);
    if (success) {
      toast.show({
        title: 'Ссылка скопирована',
        variant: 'success',
      });
    } else {
      toast.show({
        title: 'Не удалось скопировать',
        variant: 'error',
      });
    }
  };

  return (
    <Card style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
      <div
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--fg)',
          marginBottom: 'var(--sp-4)',
        }}
      >
        Реферальная программа
      </div>
      <div style={{ marginBottom: 'var(--sp-3)' }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--muted-fg)',
            marginBottom: 'var(--sp-2)',
          }}
        >
          Реферальный код:
        </div>
        <div
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--fg)',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}
        >
          {isLoading ? '…' : referralCode || '—'}
        </div>
      </div>
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--muted-fg)',
            marginBottom: 'var(--sp-2)',
          }}
        >
          Реферальная ссылка:
        </div>
        <div
          style={{
            display: 'flex',
            gap: 'var(--sp-2)',
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--fg)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: 'var(--sp-3)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 'var(--r-md)',
            }}
            title={referralLink || ''}
          >
            {isLoading ? '…' : referralLink || '—'}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            disabled={!referralLink || isLoading}
            style={{
              flex: '0 0 auto',
              minWidth: 44,
              minHeight: 44,
              borderRadius: 12,
              padding: '0 14px',
            }}
            aria-label="Скопировать ссылку"
          >
            ⧉
          </Button>
        </div>
      </div>
      <Button
        variant="primary"
        onClick={handleCopy}
        style={{ width: '100%', height: 44, borderRadius: 12, fontWeight: 'var(--font-weight-semibold)' }}
        disabled={!referralLink || isLoading}
      >
        Скопировать ссылку
      </Button>

      <div style={{ marginTop: 'var(--sp-4)' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', marginBottom: 'var(--sp-2)' }}>
          Начисления (beta)
        </div>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--sp-2)' }}>
          {Math.round(totalCents / 100).toLocaleString('ru-RU')} ₽
        </div>
        {stats && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', marginBottom: 'var(--sp-3)' }}>
            Приглашено: {stats.enrollmentsCount} · Заказы: {stats.ordersCount} · Оплачено: {stats.paidOrdersCount}
          </div>
        )}
        {commissions.length === 0 ? (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Пока нет начислений.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {commissions.slice(0, 5).map((c) => (
              <div
                key={c.id}
                style={{
                  padding: 'var(--sp-2)',
                  background: 'var(--card-2)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--fg)',
                }}
              >
                +{Math.round((c.amountCents ?? 0) / 100).toLocaleString('ru-RU')} ₽ · orderId: {c.orderId}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// Stats Row Component
function StatsRow() {
  const { data: me } = useMe();
  const streakDays = Math.max(0, Number(me?.user?.streakDays ?? 0) || 0);
  const avgScore = ((): number | null => {
    const raw = (me?.user as any)?.homeworkAvgScore;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    return Math.max(0, Math.min(5, raw));
  })();

  const Stars = ({ avg }: { avg: number | null }) => {
    if (avg == null) return <span>—</span>;
    const v = Math.max(0, Math.min(5, avg));
    const fill = `${(v / 5) * 100}%`;
    return (
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          lineHeight: 1,
          letterSpacing: 2,
          userSelect: 'none',
        }}
        aria-label={`Рейтинг ${v.toFixed(2)} из 5`}
      >
        <span style={{ color: 'rgba(255,255,255,0.22)' }}>★★★★★</span>
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            overflow: 'hidden',
            width: fill,
            whiteSpace: 'nowrap',
            color: 'var(--warning-fg, var(--fg))',
            pointerEvents: 'none',
          }}
        >
          ★★★★★
        </span>
      </span>
    );
  };
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-3)',
        marginBottom: 'var(--sp-4)',
      }}
    >
      <Card style={{ flex: 1, padding: 'var(--sp-4)' }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--muted-fg)',
            marginBottom: 'var(--sp-2)',
          }}
        >
          {mockStats.progress.label}
        </div>
        <div
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--fg)',
          }}
        >
          {mockStats.progress.completed}/{mockStats.progress.total}
        </div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--muted-fg)',
            marginTop: 'var(--sp-1)',
          }}
        >
          уроков
        </div>
      </Card>
      <Card style={{ flex: 1, padding: 'var(--sp-4)' }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--muted-fg)',
            marginBottom: 'var(--sp-2)',
          }}
        >
          Streak
        </div>
        <div
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--fg)',
          }}
        >
          {streakDays}
        </div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--muted-fg)',
            marginTop: 'var(--sp-1)',
          }}
        >
          дней
        </div>
      </Card>
      <Card style={{ flex: 1, padding: 'var(--sp-4)' }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--muted-fg)',
            marginBottom: 'var(--sp-2)',
          }}
        >
          Средний балл
        </div>
        <div
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--fg)',
          }}
        >
          <Stars avg={avgScore} />
        </div>
      </Card>
    </div>
  );
}

// Actions List Component (expert CTA is in BecomeExpertCard)
function ActionsList() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const isAdmin = me?.user?.platformRole === 'admin' || me?.user?.platformRole === 'owner';

  return (
    <div>
      <ListItem
        title="Мои заказы"
        subtitle="Покупки и статусы"
        right="›"
        onClick={() => navigate('/account/orders')}
      />
      {isAdmin && (
        <ListItem
          title="Admin: payments"
          subtitle="Заказы / mark paid"
          right="›"
          onClick={() => navigate('/admin/payments')}
        />
      )}
      {isAdmin && (
        <ListItem
          title="Admin: experts"
          subtitle="Эксперты / роли / подписка"
          right="›"
          onClick={() => navigate('/admin/experts')}
        />
      )}
      <ListItem
        title="Поддержка"
        subtitle="Помощь и обратная связь"
        right="›"
        onClick={openSupportLink}
      />
      <ListItem
        title="Язык"
        subtitle="Русский (RU)"
        right="›"
        onClick={() => navigate('/settings')}
      />
    </div>
  );
}

// DEV-only: force expert CTA state from ?expertCta=none|expired|active (browser test without MSW)
function getForcedExpertCtaState(
  searchParams: URLSearchParams,
): 'none' | 'expired' | 'active' | null {
  if (!import.meta.env.DEV) return null;
  const p = searchParams.get('expertCta');
  if (p === 'none' || p === 'expired' || p === 'active') return p;
  return null;
}

// Expert CTA block: subscription state → NONE / EXPIRED / ACTIVE (Story 5.4)
// Best-effort: any error → NONE (student). Card always visible, CTA always clickable.
function ExpertCtaBlock() {
  const [searchParams] = useSearchParams();
  const expertCtaParam = searchParams.get('expertCta') as 'none' | 'expired' | 'active' | null;
  const expertCta =
    expertCtaParam && ['none', 'expired', 'active'].includes(expertCtaParam)
      ? expertCtaParam
      : undefined;

  const forcedState = getForcedExpertCtaState(searchParams);
  const { data, isLoading } = useMyExpertSubscription({ expertCta });
  const subscription = data ?? null;
  const state = forcedState ?? deriveExpertCtaState(subscription);

  if (isLoading && forcedState == null) {
    return (
      <Card style={{ marginBottom: 'var(--sp-4)', padding: 'var(--sp-4)' }}>
        <Skeleton width="40%" height="20px" style={{ marginBottom: 'var(--sp-2)' }} />
        <Skeleton width="100%" height="16px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="40px" radius="md" />
      </Card>
    );
  }

  return <BecomeExpertCard state={state} subscription={subscription} />;
}

// Loading State
function LoadingState() {
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Skeleton width="60%" height="24px" style={{ marginBottom: 'var(--sp-2)' }} />
      <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-4)' }} />
      <Skeleton width="100%" height="200px" radius="lg" style={{ marginBottom: 'var(--sp-4)' }} />
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <Skeleton width="100%" height="100px" radius="lg" />
        <Skeleton width="100%" height="100px" radius="lg" />
        <Skeleton width="100%" height="100px" radius="lg" />
      </div>
      <Skeleton width="100%" height="60px" radius="md" style={{ marginBottom: 'var(--sp-2)' }} />
      <Skeleton width="100%" height="60px" radius="md" style={{ marginBottom: 'var(--sp-2)' }} />
      <Skeleton width="100%" height="60px" radius="md" />
    </div>
  );
}

// Main AccountPage Component
export function AccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = searchParams.get('state') || 'default';
  const { data: meData } = useMe();
  const expertCtaParam = searchParams.get('expertCta') as 'none' | 'expired' | 'active' | null;
  const expertCta =
    expertCtaParam && ['none', 'expired', 'active'].includes(expertCtaParam)
      ? expertCtaParam
      : undefined;
  const { data: subData } = useMyExpertSubscription({ expertCta });

  const user: DisplayUser = meData?.user ?? getTelegramDisplayUser() ?? null;
  const forcedState = getForcedExpertCtaState(searchParams);
  const expertState = forcedState ?? deriveExpertCtaState(subData ?? null);
  const tgId = getTelegramDisplayUser()?.telegramId ?? null;

  // Loading state
  if (state === 'loading') {
    return <LoadingState />;
  }

  // Empty state
  if (state === 'empty') {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <EmptyState
          title="Профиль пока пуст"
          description="Начните обучение, чтобы увидеть свой прогресс"
          actionLabel="Перейти в обучение"
          onAction={() => {
            navigate('/learn');
          }}
        />
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <ErrorState
          title="Не удалось загрузить профиль"
          description="Попробуйте ещё раз"
          actionLabel="Повторить"
          onAction={() => {
            navigate('/account');
          }}
        />
      </div>
    );
  }

  // Default state
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <ProfileCard user={user} isPro={expertState === 'active'} tgId={tgId} />

      <ExpertCtaBlock />

      {/* Реферальная программа — только у эксперта с активной подпиской (приглашение других экспертов) */}
      {expertState === 'active' && <ReferralCard />}

      {/* Stats Row */}
      <StatsRow />

      {/* Actions List */}
      <ActionsList />
    </div>
  );
}
