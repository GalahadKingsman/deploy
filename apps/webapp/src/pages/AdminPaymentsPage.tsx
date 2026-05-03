import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, useToast } from '../shared/ui/index.js';
import { useMe } from '../shared/queries/useMe.js';
import {
  useAdminCommissions,
  useAdminCreateRefundRequest,
  useAdminMarkOrderPaid,
  useAdminOrders,
} from '../shared/queries/useAdminPayments.js';

function statusLabel(s: string): string {
  if (s === 'paid') return 'Оплачен';
  if (s === 'created') return 'Создан';
  if (s === 'cancelled') return 'Отменён';
  if (s === 'failed') return 'Ошибка';
  if (s === 'refunded') return 'Возврат';
  return s;
}

export function AdminPaymentsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: me } = useMe();

  const isAdmin = me?.user?.platformRole === 'admin' || me?.user?.platformRole === 'owner';

  const [status, setStatus] = React.useState<string>('');
  const [userId, setUserId] = React.useState<string>('');
  const [courseId, setCourseId] = React.useState<string>('');
  const [referralCode, setReferralCode] = React.useState<string>('');

  const { data, isLoading, error, refetch, isFetching } = useAdminOrders({
    status: status.trim() ? status.trim() : undefined,
    userId: userId.trim() ? userId.trim() : undefined,
    courseId: courseId.trim() ? courseId.trim() : undefined,
    limit: 50,
  });

  const markPaid = useAdminMarkOrderPaid();
  const refundStub = useAdminCreateRefundRequest();
  const commissionsQuery = useAdminCommissions({
    referralCode: referralCode.trim() ? referralCode.trim() : undefined,
    limit: 50,
  });

  if (!isAdmin) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Admin payments</CardTitle>
            <CardDescription>Доступ запрещён</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            {/* back handled by Telegram BackButton */}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="60%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" />
      </div>
    );
  }

  const items = data?.items ?? [];
  const commissions = commissionsQuery.data?.items ?? [];

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Admin payments</CardTitle>
          <CardDescription>Заказы, отметка paid и заглушка заявки на возврат (без банка)</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <input
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="status (created/paid/..)"
            style={{
              flex: '1 1 160px',
              padding: '10px 12px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--fg)',
            }}
          />
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="userId"
            style={{
              flex: '2 1 260px',
              padding: '10px 12px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--fg)',
            }}
          />
          <input
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            placeholder="courseId"
            style={{
              flex: '2 1 260px',
              padding: '10px 12px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--fg)',
            }}
          />
          <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
            Обновить
          </Button>
          <Button variant="secondary" onClick={() => commissionsQuery.refetch()} disabled={commissionsQuery.isFetching}>
            Обновить комиссии
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
            <CardDescription>Не удалось загрузить список заказов</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={() => refetch()}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Пусто</CardTitle>
            <CardDescription>Нет заказов по текущим фильтрам</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {items.map((o) => (
          <Card key={o.id}>
            <CardHeader>
              <CardTitle style={{ fontSize: 'var(--text-md)' }}>{statusLabel(o.status)}</CardTitle>
              <CardDescription>
                orderId: {o.id}
                <br />
                userId: {o.userId}
                <br />
                kind: {o.orderKind}
                {o.expertId ? (
                  <>
                    <br />
                    expertId: {o.expertId}
                  </>
                ) : null}
                {o.courseId ? (
                  <>
                    <br />
                    courseId: {o.courseId}
                  </>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              {o.courseId ? (
                <Button variant="secondary" onClick={() => navigate(`/course/${o.courseId}`)}>
                  Открыть курс
                </Button>
              ) : null}
              <Button
                variant="primary"
                disabled={o.status === 'paid' || markPaid.isPending}
                onClick={async () => {
                  try {
                    await markPaid.mutateAsync({ orderId: o.id });
                    toast.show({ title: 'OK', message: 'Order marked as paid', variant: 'success' });
                    await refetch();
                  } catch {
                    toast.show({ title: 'Ошибка', message: 'Не удалось отметить paid', variant: 'error' });
                  }
                }}
              >
                Mark paid
              </Button>
              <Button
                variant="secondary"
                disabled={refundStub.isPending}
                onClick={async () => {
                  try {
                    await refundStub.mutateAsync({ orderId: o.id, note: 'stub from admin UI' });
                    toast.show({
                      title: 'Заявка на возврат',
                      message: 'Запись создана (интеграция с банком в разработке)',
                      variant: 'success',
                    });
                  } catch {
                    toast.show({ title: 'Ошибка', message: 'Не удалось создать заявку', variant: 'error' });
                  }
                }}
              >
                Заявка на возврат (stub)
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card style={{ marginTop: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Комиссии</CardTitle>
          <CardDescription>Список начислений (admin)</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="referralCode (e.g. REF-XXXX...)"
            style={{
              flex: '2 1 260px',
              padding: '10px 12px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--fg)',
            }}
          />
          <Button variant="secondary" onClick={() => commissionsQuery.refetch()} disabled={commissionsQuery.isFetching}>
            Обновить
          </Button>
        </CardContent>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {commissionsQuery.error && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Не удалось загрузить комиссии.</div>
          )}
          {commissions.length === 0 && !commissionsQuery.error && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Пока нет комиссий.</div>
          )}
          {commissions.map((c) => (
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
              +{Math.round((c.amountCents ?? 0) / 100).toLocaleString('ru-RU')} ₽ · {c.referralCode} · orderId: {c.orderId}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

