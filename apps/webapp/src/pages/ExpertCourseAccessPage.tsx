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
  useEnrollByTelegram,
  useEnrollByUsername,
} from '../shared/queries/useExpertCourseAccess.js';

export function ExpertCourseAccessPage() {
  const toast = useToast();
  const { expertId = '', courseId = '' } = useParams<{ expertId: string; courseId: string }>();
  const { data, isLoading, error, refetch } = useExpertCourseEnrollments(expertId, courseId);
  const extend = useExtendEnrollment(expertId, courseId);
  const revoke = useRevokeEnrollment(expertId, courseId);
  const enrollTg = useEnrollByTelegram(expertId, courseId);
  const enrollUsername = useEnrollByUsername(expertId, courseId);
  const [tgManual, setTgManual] = React.useState('');
  const [usernameManual, setUsernameManual] = React.useState('');
  const [grantDaysByRow, setGrantDaysByRow] = React.useState<Record<string, string>>({});

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
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Зачислить по Telegram ID</CardTitle>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Input placeholder="Telegram user id" value={tgManual} onChange={(e) => setTgManual(e.target.value)} />
          <Button
            variant="primary"
            disabled={enrollTg.isPending}
            onClick={async () => {
              const t = tgManual.trim();
              if (!t) return;
              try {
                await enrollTg.mutateAsync({ telegramUserId: t });
                setTgManual('');
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
