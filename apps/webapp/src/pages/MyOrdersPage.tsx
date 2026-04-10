import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Skeleton } from '../shared/ui/index.js';
import { useMyOrders } from '../shared/queries/useMyOrders.js';
import { meCourses } from '../shared/queries/useMyCourses.js';

function statusLabel(s: string): string {
  if (s === 'paid') return 'Оплачен';
  if (s === 'created') return 'Ожидает оплаты';
  if (s === 'cancelled') return 'Отменён';
  if (s === 'failed') return 'Ошибка';
  if (s === 'refunded') return 'Возврат';
  return s;
}

export function MyOrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useMyOrders();
  const highlight = (searchParams.get('highlight') ?? '').trim();
  const waitingPay = searchParams.get('waitingPay') === '1';

  React.useEffect(() => {
    if (!waitingPay) return;
    void refetch();
    void queryClient.invalidateQueries({ queryKey: meCourses() });
  }, [waitingPay, refetch, queryClient]);

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="60%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Мои заказы</CardTitle>
            <CardDescription>Не удалось загрузить</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => refetch()}>
              Повторить
            </Button>
            <Button variant="secondary" onClick={() => navigate('/account')}>
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = data.items ?? [];

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Мои заказы</CardTitle>
          <CardDescription>История покупок</CardDescription>
        </CardHeader>
        {waitingPay && (
          <CardContent style={{ paddingTop: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>
              После оплаты в банке нажмите «Обновить» — статус заказа и доступ к курсу подтянутся автоматически.
            </div>
          </CardContent>
        )}
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => refetch()}>
            Обновить
          </Button>
          <Button variant="ghost" onClick={() => navigate('/account')}>
            Назад
          </Button>
        </CardContent>
      </Card>

      {items.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Заказов пока нет</CardTitle>
            <CardDescription>Оформите покупку на странице курса.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {items.map((o) => (
          <Card
            key={o.id}
            style={{
              outline: highlight && o.id === highlight ? '2px solid var(--accent)' : undefined,
            }}
          >
            <CardHeader>
              <CardTitle style={{ fontSize: 'var(--text-md)' }}>{statusLabel(o.status)}</CardTitle>
              <CardDescription>
                orderId: {o.id}
                <br />
                courseId: {o.courseId}
              </CardDescription>
            </CardHeader>
            <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              {o.status === 'created' && o.payUrl && (
                <Button
                  variant="primary"
                  onClick={() => {
                    const u = o.payUrl;
                    if (u) window.open(u, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Перейти к оплате
                </Button>
              )}
              <Button variant="secondary" onClick={() => refetch()}>
                Проверить статус
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/course/${o.courseId}`)}>
                Открыть курс
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

