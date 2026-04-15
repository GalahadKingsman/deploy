import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Skeleton, useToast } from '../shared/ui/index.js';
import { useActivateInvite } from '../shared/queries/useActivateInvite.js';

export function InviteActivatePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const c = (code ?? '').trim();
  const activate = useActivateInvite();

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!c) return;
      try {
        const res = await activate.mutateAsync(c);
        if (cancelled) return;
        toast.show({ title: 'Готово', message: 'Доступ активирован', variant: 'success' });
        navigate(`/course/${res.courseId}`, { replace: true });
      } catch {
        if (cancelled) return;
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [c]);

  if (!c) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Invite</CardTitle>
            <CardDescription>Некорректный код</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (activate.isPending) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="60%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" />
      </div>
    );
  }

  if (activate.isError) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Не удалось активировать</CardTitle>
            <CardDescription>Проверьте код и попробуйте ещё раз</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => activate.mutate(c)}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Активация…</CardTitle>
          <CardDescription>Сейчас перенаправим</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

