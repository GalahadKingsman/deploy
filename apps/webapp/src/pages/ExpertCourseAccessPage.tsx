import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Skeleton,
  useToast,
} from '../shared/ui/index.js';
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

  // When navigating between courses/experts, re-hydrate from localStorage.
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
      // ignore (private mode / quota)
    }
  }, [revokedInviteCodes, storageKey]);

  if (!expertId || !courseId) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Доступ</CardTitle>
            <CardDescription>Некорректный маршрут</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="50%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="200px" radius="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Доступ</CardTitle>
            <CardDescription>Не удалось загрузить</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={() => refetch()}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = data.items ?? [];
  const inviteRows = (invites.data?.items ?? []).filter((i) => !revokedInviteCodes[i.code]);

  const buildDeepLink = (code: string) => {
    const unameRaw = (webappEnv as any).VITE_TELEGRAM_BOT_USERNAME
      ? String((webappEnv as any).VITE_TELEGRAM_BOT_USERNAME).trim().replace(/^@/, '')
      : '';
    if (!unameRaw) return null;
    // Use startapp to open the Mini App directly (more reliable than start payload for already-started bots).
    return `https://t.me/${encodeURIComponent(unameRaw)}?startapp=${encodeURIComponent(`inv_${code}`)}`;
  };

  const copyText = async (text: string) => {
    // Telegram WebView часто режет navigator.clipboard. Делаем best-effort и не считаем это ошибкой создания.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return { ok: true as const };
      }
    } catch {
      // fallback below
    }
    try {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.showPopup) {
        tg.showPopup({
          title: 'Ссылка создана',
          message: 'Не удалось скопировать автоматически. Нажмите и удерживайте ссылку, чтобы скопировать.',
        });
      }
    } catch {
      // ignore
    }
    return { ok: false as const };
  };

  return (
    <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Доступ к курсу</CardTitle>
          <CardDescription>Зачисления, продление по дням, отзыв.</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" asChild>
            <Link to={`/expert/${expertId}/courses/${courseId}`}>Редактор курса</Link>
          </Button>
          {/* back handled by TopBar */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Инвайт-ссылка на зачисление</CardTitle>
          <CardDescription>
            Сгенерируйте ссылку и отправьте её пользователю. Он откроет бота, нажмёт кнопку Mini App, авторизуется и
            будет автоматически зачислен на курс. Лимит срабатываний ограничивается.
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Input
              label="Лимит активаций"
              placeholder="1"
              value={inviteMaxUses}
              onChange={(e) => setInviteMaxUses(e.target.value)}
              style={{ width: 160 }}
            />
            <Button
              variant="primary"
              disabled={createInvite.isPending}
              onClick={async () => {
                if (!buildDeepLink('test')) {
                  toast.show({
                    title: 'Нужен username бота',
                    message: 'Задайте VITE_TELEGRAM_BOT_USERNAME при сборке фронта.',
                    variant: 'info',
                  });
                  return;
                }
                const n = parseInt(inviteMaxUses.trim() || '1', 10);
                if (!Number.isFinite(n) || n < 1 || n > 10_000) {
                  toast.show({ title: 'Лимит: 1…10000', variant: 'info' });
                  return;
                }
                try {
                  const created = await createInvite.mutateAsync({ maxUses: n });
                  const link = buildDeepLink(created.code);
                  if (link) {
                    const copied = await copyText(link);
                    toast.show({
                      title: copied.ok ? 'Ссылка скопирована' : 'Ссылка создана',
                      message: copied.ok ? undefined : link,
                      variant: 'success',
                    });
                  } else {
                    toast.show({ title: 'Инвайт создан', message: `Код: ${created.code}`, variant: 'success' });
                  }
                } catch {
                  toast.show({ title: 'Ошибка', message: 'Не удалось создать инвайт', variant: 'error' });
                }
              }}
            >
              Создать ссылку
            </Button>
          </div>

          {!buildDeepLink('test') && (
            <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-sm)' }}>
              Чтобы формировались ссылки, задайте <code>VITE_TELEGRAM_BOT_USERNAME</code> при сборке фронта.
            </div>
          )}

          {invites.isLoading && (
            <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-sm)' }}>Загрузка инвайтов…</div>
          )}
          {invites.isError && (
            <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-sm)' }}>Не удалось загрузить инвайты.</div>
          )}
          {inviteRows.length === 0 && !invites.isLoading && (
            <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-sm)' }}>Инвайтов пока нет.</div>
          )}

          {inviteRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {inviteRows.map((i) => {
                const link = buildDeepLink(i.code);
                const limit = i.maxUses == null ? '∞' : String(i.maxUses);
                const used = i.usesCount ?? 0;
                const exhausted = i.maxUses != null && used >= i.maxUses;
                return (
                  <div
                    key={i.id}
                    style={{
                      padding: 'var(--sp-3)',
                      background: 'var(--card-2)',
                      borderRadius: 'var(--r-md)',
                      fontSize: 'var(--text-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--sp-2)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <strong>{i.code}</strong>
                      <span style={{ color: exhausted ? 'var(--destructive, #c44)' : 'var(--muted-fg)' }}>
                        использований: {used}/{limit}
                      </span>
                      {i.expiresAt && (
                        <span style={{ color: 'var(--muted-fg)' }}>
                          до: {new Date(i.expiresAt).toLocaleString('ru-RU')}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--muted-fg)', wordBreak: 'break-all' }}>
                      {link ?? 'Укажите bot username, чтобы сформировать ссылку.'}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!link}
                        onClick={async () => {
                          if (!link) return;
                        const copied = await copyText(link);
                        toast.show({
                          title: copied.ok ? 'Скопировано' : 'Ссылка готова',
                          message: copied.ok ? undefined : link,
                          variant: 'success',
                        });
                        }}
                      >
                        Копировать ссылку
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
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
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Зачислить по Telegram username</CardTitle>
          <CardDescription>@username (пользователь должен хотя бы раз открыть Mini App)</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Input
            placeholder="@someuser"
            value={usernameManual}
            onChange={(e) => setUsernameManual(e.target.value)}
          />
          <Button
            variant="primary"
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
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Ученики</CardTitle>
          <CardDescription>{rows.length} записей</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {rows.length === 0 && (
            <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-sm)' }}>Пока нет зачислений.</div>
          )}
          {rows.map((row) => {
            const e = row.enrollment;
            const daysStr = grantDaysByRow[e.id] ?? '30';
            const revoked = Boolean(e.revokedAt);
            return (
              <div
                key={e.id}
                style={{
                  padding: 'var(--sp-3)',
                  background: 'var(--card-2)',
                  borderRadius: 'var(--r-md)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <div>
                  TG: <strong>{row.studentTelegramUserId}</strong>
                  {row.studentUsername ? ` (@${row.studentUsername})` : ''}
                </div>
                <div>enrollment: {e.id}</div>
                <div>
                  Доступ до: {e.accessEnd ? new Date(e.accessEnd).toLocaleString('ru-RU') : 'без срока'}
                </div>
                <div style={{ color: revoked ? 'var(--destructive, #c44)' : 'var(--muted-fg)' }}>
                  {revoked ? `Отозван: ${e.revokedAt ? new Date(e.revokedAt).toLocaleString('ru-RU') : ''}` : 'Активен'}
                </div>
                {!revoked && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--sp-2)',
                      flexWrap: 'wrap',
                      marginTop: 'var(--sp-2)',
                      alignItems: 'center',
                    }}
                  >
                    <Input
                      placeholder="Дней"
                      value={daysStr}
                      onChange={(ev) => setGrantDaysByRow((s) => ({ ...s, [e.id]: ev.target.value }))}
                      style={{ width: 100 }}
                    />
                    <Button
                      variant="secondary"
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
                    </Button>
                    <Button
                      variant="secondary"
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
                      Отозвать
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
