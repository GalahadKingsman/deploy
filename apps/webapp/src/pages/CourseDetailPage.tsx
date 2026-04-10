import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Skeleton } from '../shared/ui/index.js';
import { useCourse } from '../shared/queries/useCourse.js';
import { useCreateCourseCheckout } from '../shared/queries/useCheckout.js';
import { useToast } from '../shared/ui/index.js';
import { useMyCourses } from '../shared/queries/useMyCourses.js';
import { useMyOrders } from '../shared/queries/useMyOrders.js';
import { config } from '../shared/config/flags.js';
import { useMyContact, useUpdateMyContact } from '../shared/queries/useMyContact.js';
import { openExternalHttpsUrl } from '../shared/auth/telegram.js';

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const courseId = id ?? '';
  const { data, isLoading, error, refetch } = useCourse(courseId);
  const checkout = useCreateCourseCheckout(courseId);
  const { data: contactData } = useMyContact();
  const updateContact = useUpdateMyContact();
  const { data: myCourses } = useMyCourses();
  const { data: myOrders } = useMyOrders();

  if (!courseId) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Курс</CardTitle>
            <CardDescription>Некорректный id</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="60%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="60px" radius="md" style={{ marginBottom: 'var(--sp-2)' }} />
        <Skeleton width="100%" height="60px" radius="md" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Не удалось загрузить курс</CardTitle>
            <CardDescription>Попробуйте ещё раз</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => refetch()}>
              Повторить
            </Button>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const course = data.course;
  const lessons = data.lessons ?? [];
  const hasAccess = (myCourses?.items ?? []).some((x) => x.course.id === courseId);
  const myOrderForCourse =
    (myOrders?.items ?? [])
      .filter((o) => o.courseId === courseId)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))[0] ?? null;
  const hasPendingOrder = !hasAccess && myOrderForCourse?.status === 'created';
  const paymentsEnabled = config.PAYMENTS_ENABLED;
  const email = contactData?.contact?.email ?? null;
  const phone = contactData?.contact?.phone ?? null;
  const hasReceiptContact = Boolean((email && email.trim()) || (phone && phone.trim()));
  const priceLabel =
    typeof course.priceCents === 'number'
      ? `${Math.round(course.priceCents / 100).toLocaleString('ru-RU')} ${course.currency ?? 'RUB'}`
      : null;

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>{course.title}</CardTitle>
          <CardDescription>
            {course.description ?? 'Описание отсутствует'}
            {priceLabel ? (
              <>
                <br />
                Цена: {priceLabel}
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {hasAccess && (
            <Button variant="secondary" onClick={() => navigate('/learn')}>
              Доступ активен
            </Button>
          )}
          {!hasAccess && myOrderForCourse && (
            <Button variant="secondary" onClick={() => navigate(`/account/orders?highlight=${myOrderForCourse.id}`)}>
              Статус заказа: {myOrderForCourse.status}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={async () => {
              try {
                if (!paymentsEnabled) {
                  toast.show({
                    title: 'Оплата недоступна',
                    message: 'Payments выключены',
                    variant: 'info',
                  });
                  return;
                }
                if (hasPendingOrder && myOrderForCourse) {
                  navigate(`/account/orders?highlight=${myOrderForCourse.id}`);
                  return;
                }
                let usedEmail = email;
                let usedPhone = phone;
                if (!hasReceiptContact) {
                  // Minimal UX for now: ask for at least one contact
                  const askEmail = window.prompt('Введите email для чека (можно пропустить):', '') ?? '';
                  const askPhone = window.prompt('Введите телефон для чека (можно пропустить):', '') ?? '';
                  usedEmail = askEmail.trim() ? askEmail.trim() : null;
                  usedPhone = askPhone.trim() ? askPhone.trim() : null;
                  if (!usedEmail && !usedPhone) {
                    toast.show({
                      title: 'Нужны контакты для чека',
                      message: 'Укажите email или телефон, чтобы оформить покупку.',
                      variant: 'info',
                    });
                    return;
                  }
                  await updateContact.mutateAsync({ email: usedEmail, phone: usedPhone });
                }

                const res = await checkout.mutateAsync({ email: usedEmail, phone: usedPhone });
                if (res.payUrl) {
                  toast.show({
                    title: 'Переход к оплате',
                    message: 'Откроется страница банка. После оплаты доступ появится автоматически.',
                    variant: 'success',
                  });
                  openExternalHttpsUrl(res.payUrl);
                  navigate(`/account/orders?highlight=${res.order.id}&waitingPay=1`);
                } else {
                  toast.show({
                    title: 'Заказ создан',
                    message: `orderId: ${res.order.id}`,
                    variant: 'success',
                  });
                  navigate(`/account/orders?highlight=${res.order.id}`);
                }
              } catch {
                toast.show({
                  title: 'Оплата недоступна',
                  message: 'Похоже, payments выключены или API не настроен',
                  variant: 'error',
                });
              }
            }}
            disabled={checkout.isPending || hasAccess || (!paymentsEnabled && !hasPendingOrder)}
          >
            {hasPendingOrder ? 'Проверить статус' : paymentsEnabled ? 'Купить (beta)' : 'Оплата выключена'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Уроки</CardTitle>
          <CardDescription>Выберите урок, чтобы открыть.</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {lessons.length === 0 && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Пока нет уроков.</div>
          )}
          {lessons.map((l) => (
            <Button key={l.id} variant="secondary" asChild style={{ width: '100%', justifyContent: 'flex-start' }}>
              <Link to={`/lesson/${l.id}`}>{l.title}</Link>
            </Button>
          ))}
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginTop: 'var(--sp-2)' }}>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Назад
            </Button>
            <Button variant="ghost" onClick={() => navigate('/learn')}>
              К обучению
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
