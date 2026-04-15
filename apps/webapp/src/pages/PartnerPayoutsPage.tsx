import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  useToast,
} from '../shared/ui/index.js';
import { useCreatePayoutRequest, useMyPayoutRequests } from '../shared/queries/usePartnerPayouts.js';

export function PartnerPayoutsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useMyPayoutRequests();
  const createReq = useCreatePayoutRequest();
  const [amountRub, setAmountRub] = React.useState('');

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="60%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Выплаты партнёрам</CardTitle>
            <CardDescription>Не удалось загрузить</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => refetch()}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = data.items ?? [];
  const rubToCents = (s: string): number | null => {
    const n = parseFloat(s.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
  };

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Выплаты партнёрам</CardTitle>
          <CardDescription>
            Эта страница в разработке: реальные выплаты и банковские API пока не подключены. Ниже — учёт заявок
            (заглушка).
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>
            Создайте заявку на сумму в рублях — статус останется «stub», без перевода денег.
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={amountRub}
              onChange={(e) => setAmountRub(e.target.value)}
              placeholder="Сумма, ₽"
              inputMode="decimal"
              style={{
                flex: '1 1 140px',
                maxWidth: 200,
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--fg)',
              }}
            />
            <Button
              variant="primary"
              disabled={createReq.isPending}
              onClick={async () => {
                const cents = rubToCents(amountRub.trim());
                if (cents == null) {
                  toast.show({ title: 'Сумма', message: 'Укажите положительное число (рубли)', variant: 'info' });
                  return;
                }
                try {
                  await createReq.mutateAsync({ amountCents: cents });
                  setAmountRub('');
                  toast.show({ title: 'Заявка создана', message: 'Статус: заглушка (нет вывода в банк)', variant: 'success' });
                } catch {
                  toast.show({ title: 'Ошибка', message: 'Не удалось создать заявку', variant: 'error' });
                }
              }}
            >
              Отправить заявку
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Мои заявки</CardTitle>
          <CardDescription>Последние записи</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {items.length === 0 && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Пока нет заявок.</div>
          )}
          {items.map((p) => (
            <div
              key={p.id}
              style={{
                padding: 'var(--sp-2)',
                background: 'var(--card-2)',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--text-sm)',
                color: 'var(--fg)',
              }}
            >
              {Math.round(p.amountCents / 100).toLocaleString('ru-RU')} ₽ · {p.status} ·{' '}
              {new Date(p.createdAt).toLocaleString('ru-RU')}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
