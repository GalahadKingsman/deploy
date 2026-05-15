import React from 'react';
import { useParams } from 'react-router-dom';
import { Skeleton, useToast } from '../shared/ui/index.js';
import {
  useExpertCourseEnrollments,
  useExtendEnrollment,
  useRevokeEnrollment,
  useEnrollByUsername,
  useExpertCourseInvites,
  useCreateCourseInvite,
  useRevokeCourseInvite,
} from '../shared/queries/useExpertCourseAccess.js';
import { webappEnv } from '../shared/env/env.js';
import { config } from '../shared/config/flags.js';
import { PageScreen } from '../ui/edify/PageScreen.js';
import { FormField, FormInput } from '../ui/edify/FormField.js';
import { ExpertListRow } from '../ui/edify/ExpertListRow.js';

export function ExpertCourseAccessPage() {
  const toast = useToast();
  const { expertId = '', courseId = '' } = useParams<{ expertId: string; courseId: string }>();
  const { data, isLoading, error, refetch } = useExpertCourseEnrollments(expertId, courseId);
  const invites = useExpertCourseInvites(expertId, courseId);
  const createInvite = useCreateCourseInvite(expertId, courseId);
  const revokeInvite = useRevokeCourseInvite(expertId, courseId);
  const extend = useExtendEnrollment(expertId, courseId);
  const revoke = useRevokeEnrollment(expertId, courseId);
  const enrollUsername = useEnrollByUsername(expertId, courseId);
  const [usernameManual, setUsernameManual] = React.useState('');
  const [grantDaysByRow, setGrantDaysByRow] = React.useState<Record<string, string>>({});
  const [inviteMaxUses, setInviteMaxUses] = React.useState('1');
  const storageKey = `revoked-invite-codes:${expertId}:${courseId}`;
  const [revokedInviteCodes, setRevokedInviteCodes] = React.useState<Record<string, true>>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(storageKey) : null;
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return {};
      const out: Record<string, true> = {};
      for (const v of parsed) {
        if (typeof v === 'string' && v.trim()) out[v] = true;
      }
      return out;
    } catch {
      return {};
    }
  });

  React.useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(storageKey) : null;
      if (!raw) {
        setRevokedInviteCodes({});
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setRevokedInviteCodes({});
        return;
      }
      const out: Record<string, true> = {};
      for (const v of parsed) {
        if (typeof v === 'string' && v.trim()) out[v] = true;
      }
      setRevokedInviteCodes(out);
    } catch {
      setRevokedInviteCodes({});
    }
  }, [storageKey]);

  React.useEffect(() => {
    try {
      const codes = Object.keys(revokedInviteCodes);
      window.localStorage?.setItem(storageKey, JSON.stringify(codes));
    } catch {
      // ignore
    }
  }, [revokedInviteCodes, storageKey]);

  const buildTelegramInviteUrl = (code: string) => {
    const unameRaw = (webappEnv as { VITE_TELEGRAM_BOT_USERNAME?: string }).VITE_TELEGRAM_BOT_USERNAME
      ? String((webappEnv as { VITE_TELEGRAM_BOT_USERNAME?: string }).VITE_TELEGRAM_BOT_USERNAME).trim().replace(/^@/, '')
      : '';
    if (!unameRaw) return null;
    return `https://t.me/${encodeURIComponent(unameRaw)}?start=${encodeURIComponent(`inv_${code}`)}`;
  };

  const buildWebInviteUrl = (code: string) =>
    `${config.STUDENT_WEB_BASE_URL}/invite/${encodeURIComponent(code)}`;

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return { ok: true as const };
      }
    } catch {
      // fallback
    }
    try {
      const tg = (
        window as unknown as {
          Telegram?: { WebApp?: { showPopup?: (o: { title: string; message: string }) => void } };
        }
      ).Telegram?.WebApp;
      tg?.showPopup?.({
        title: 'Ссылка создана',
        message: 'Не удалось скопировать автоматически. Нажмите и удерживайте ссылку, чтобы скопировать.',
      });
    } catch {
      // ignore
    }
    return { ok: false as const };
  };

  if (!expertId || !courseId) {
    return (
      <PageScreen>
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Некорректный маршрут</div>
        </div>
      </PageScreen>
    );
  }

  if (isLoading) {
    return (
      <PageScreen>
        <div className="edify-brand" aria-hidden="true" />
        <Skeleton width="55%" height={32} radius="lg" style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={220} radius="lg" />
      </PageScreen>
    );
  }

  if (error || !data) {
    return (
      <PageScreen>
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Не удалось загрузить</div>
          <button type="button" className="edify-btn-primary-outline" style={{ marginTop: 16, width: 'auto' }} onClick={() => refetch()}>
            Повторить
          </button>
        </div>
      </PageScreen>
    );
  }

  const rows = data.items ?? [];
  const inviteRows = (invites.data?.items ?? []).filter((i) => !revokedInviteCodes[i.code]);
  const hasTgBot = Boolean(buildTelegramInviteUrl('x'));

  return (
    <PageScreen>
      <div className="edify-brand" aria-hidden="true" />

      <div className="edify-content-header">
        <div className="edify-eyebrow">EXPERT · ACCESS</div>
        <h1 className="edify-h edify-h--lg">Доступ к курсу</h1>
        <p className="edify-subtitle" style={{ marginTop: 8 }}>
          Зачисления, продление по дням, отзыв.
        </p>
      </div>

      <nav className="edify-nav-panel" aria-label="Курс">
        <ExpertListRow
          to={`/expert/${expertId}/courses/${courseId}`}
          title="Обзор курса"
          subtitle="Модули, доступ и настройки"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          }
        />
      </nav>

      <div className="edify-panel">
        <h2 className="edify-panel__title">Инвайт-ссылка на зачисление</h2>
        <p className="edify-panel__desc">
          Браузерная ссылка ведёт на сайт edify.su. Telegram — через бота. Ученик должен быть авторизован; лимит
          срабатываний ограничивается. Отправляйте полную ссылку, не только код.
        </p>
        <div className="edify-panel__body edify-panel__body--tight">
          <div className="edify-toolbar" style={{ alignItems: 'flex-end' }}>
            <FormField label="Лимит активаций">
              <FormInput
                className="edify-field__input--narrow"
                placeholder="1"
                value={inviteMaxUses}
                onChange={(e) => setInviteMaxUses(e.target.value)}
                inputMode="numeric"
              />
            </FormField>
            <button
              type="button"
              className="edify-btn-solid edify-btn-solid--inline"
              disabled={createInvite.isPending}
              onClick={async () => {
                const n = parseInt(inviteMaxUses.trim() || '1', 10);
                if (!Number.isFinite(n) || n < 1 || n > 10_000) {
                  toast.show({ title: 'Лимит: 1…10000', variant: 'info' });
                  return;
                }
                try {
                  const created = await createInvite.mutateAsync({ maxUses: n });
                  const toCopy = buildWebInviteUrl(created.code);
                  const copied = await copyText(toCopy);
                  toast.show({
                    title: copied.ok ? 'Ссылка скопирована' : 'Инвайт создан',
                    message: copied.ok ? undefined : toCopy,
                    variant: 'success',
                  });
                } catch {
                  toast.show({ title: 'Ошибка', message: 'Не удалось создать инвайт', variant: 'error' });
                }
              }}
            >
              Создать ссылку
            </button>
          </div>

          {!hasTgBot ? (
            <p className="edify-field__hint" style={{ margin: 0 }}>
              Для ссылки t.me/… задайте <code>VITE_TELEGRAM_BOT_USERNAME</code> при сборке. Без неё доступна ссылка{' '}
              <code>…/invite/&lt;код&gt;</code>.
            </p>
          ) : null}

          {invites.isLoading ? <p className="edify-field__hint">Загрузка инвайтов…</p> : null}
          {invites.isError ? <p className="edify-field__hint">Не удалось загрузить инвайты.</p> : null}
          {inviteRows.length === 0 && !invites.isLoading ? (
            <p className="edify-field__hint">Инвайтов пока нет.</p>
          ) : null}

          {inviteRows.map((i) => {
            const tgLink = buildTelegramInviteUrl(i.code);
            const webLink = buildWebInviteUrl(i.code);
            const limit = i.maxUses == null ? '∞' : String(i.maxUses);
            const used = i.usesCount ?? 0;
            const exhausted = i.maxUses != null && used >= i.maxUses;
            return (
              <div key={i.id} className="edify-invite-card">
                <div className="edify-invite-card__head">
                  <span className="edify-invite-card__code">{i.code}</span>
                  <span className={`edify-invite-card__stat${exhausted ? ' is-exhausted' : ''}`}>
                    использований: {used}/{limit}
                  </span>
                  {i.expiresAt ? (
                    <span className="edify-invite-card__stat">до: {new Date(i.expiresAt).toLocaleString('ru-RU')}</span>
                  ) : null}
                </div>
                <div>
                  <div className="edify-invite-card__link-label">Ссылка для ученика (браузер / Mini App)</div>
                  <div className="edify-invite-card__link">{webLink}</div>
                </div>
                {tgLink ? (
                  <div>
                    <div className="edify-invite-card__link-label">Или Telegram</div>
                    <div className="edify-invite-card__link">{tgLink}</div>
                  </div>
                ) : null}
                <p className="edify-invite-card__hint">
                  В боте: <code>/inv {i.code}</code>
                </p>
                <div className="edify-card-actions">
                  <button
                    type="button"
                    className="edify-btn-primary-outline"
                    onClick={async () => {
                      const copied = await copyText(webLink);
                      toast.show({
                        title: copied.ok ? 'Скопировано' : 'Ссылка готова',
                        message: copied.ok ? undefined : webLink,
                        variant: 'success',
                      });
                    }}
                  >
                    Копировать ссылку
                  </button>
                  <button
                    type="button"
                    className="edify-btn-secondary"
                    disabled={revokeInvite.isPending}
                    onClick={async () => {
                      try {
                        await revokeInvite.mutateAsync({ code: i.code });
                        setRevokedInviteCodes((s) => ({ ...s, [i.code]: true }));
                        toast.show({ title: 'Отозвано', variant: 'success' });
                      } catch {
                        toast.show({ title: 'Ошибка', variant: 'error' });
                      }
                    }}
                  >
                    Отозвать
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="edify-panel">
        <h2 className="edify-panel__title">Зачислить по Telegram username</h2>
        <p className="edify-panel__desc">@username — пользователь должен хотя бы раз открыть Mini App.</p>
        <div className="edify-composer">
          <input
            type="text"
            className="edify-composer__input"
            placeholder="@someuser"
            value={usernameManual}
            onChange={(e) => setUsernameManual(e.target.value)}
          />
          <button
            type="button"
            className="edify-composer__submit"
            disabled={enrollUsername.isPending}
            onClick={async () => {
              const u = usernameManual.trim();
              if (!u) return;
              try {
                await enrollUsername.mutateAsync({ username: u });
                setUsernameManual('');
                toast.show({ title: 'Зачислено', variant: 'success' });
              } catch {
                toast.show({ title: 'Ошибка', message: 'Не удалось зачислить', variant: 'error' });
              }
            }}
          >
            Зачислить
          </button>
        </div>
      </div>

      <div className="edify-panel">
        <h2 className="edify-panel__title">Ученики</h2>
        <p className="edify-panel__desc">{rows.length} записей</p>
        <div className="edify-panel__body edify-panel__body--tight">
          {rows.length === 0 ? <p className="edify-field__hint">Пока нет зачислений.</p> : null}
          {rows.map((row) => {
            const e = row.enrollment;
            const daysStr = grantDaysByRow[e.id] ?? '30';
            const revoked = Boolean(e.revokedAt);
            return (
              <div key={e.id} className={`edify-enrollment-row${revoked ? ' is-revoked' : ''}`}>
                <div className="edify-enrollment-row__title">
                  TG: <strong>{row.studentTelegramUserId}</strong>
                  {row.studentUsername ? ` (@${row.studentUsername})` : ''}
                </div>
                <div>Доступ до: {e.accessEnd ? new Date(e.accessEnd).toLocaleString('ru-RU') : 'без срока'}</div>
                <div style={{ color: revoked ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {revoked ? `Отозван: ${e.revokedAt ? new Date(e.revokedAt).toLocaleString('ru-RU') : ''}` : 'Активен'}
                </div>
                {!revoked ? (
                  <>
                    <div className="edify-composer" style={{ marginTop: 'var(--sp-3)' }}>
                      <input
                        type="text"
                        className="edify-composer__input edify-field__input--narrow"
                        placeholder="Дней"
                        value={daysStr}
                        onChange={(ev) => setGrantDaysByRow((s) => ({ ...s, [e.id]: ev.target.value }))}
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        className="edify-composer__submit"
                        disabled={extend.isPending}
                        onClick={async () => {
                          const n = parseInt(daysStr, 10);
                          if (!Number.isFinite(n) || n < 1) {
                            toast.show({ title: 'Укажите число дней', variant: 'info' });
                            return;
                          }
                          try {
                            await extend.mutateAsync({ enrollmentId: e.id, grantDays: n });
                            toast.show({ title: 'Срок продлён', variant: 'success' });
                          } catch {
                            toast.show({ title: 'Ошибка продления', variant: 'error' });
                          }
                        }}
                      >
                        Продлить
                      </button>
                    </div>
                    <button
                      type="button"
                      className="edify-btn-secondary"
                      style={{ width: '100%', marginTop: 8 }}
                      disabled={revoke.isPending}
                      onClick={async () => {
                        if (!window.confirm('Отозвать доступ у этого ученика?')) return;
                        try {
                          await revoke.mutateAsync({ enrollmentId: e.id });
                          toast.show({ title: 'Доступ отозван', variant: 'success' });
                        } catch {
                          toast.show({ title: 'Ошибка', variant: 'error' });
                        }
                      }}
                    >
                      Отозвать доступ
                    </button>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </PageScreen>
  );
}
