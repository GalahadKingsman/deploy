import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Skeleton, useToast } from '../shared/ui/index.js';
import { useActivateInvite } from '../shared/queries/useActivateInvite.js';
import { ApiClientError } from '../shared/api/errors.js';
import { getAccessToken } from '../shared/auth/tokenStorage.js';

export function InviteActivatePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  // ToastProvider passes a new object each render; depend on stable `show` only (useCallback),
  // otherwise after toast.show() the effect re-runs and loops forever.
  const { show } = useToast();
  const c = (code ?? '').trim();
  const { mutateAsync, isPending, isError } = useActivateInvite();

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!c) return;
      try {
        // When opened via bot deep link, the page can mount before bootstrapAuth stores JWT.
        // Retry a bit on 401 until token appears.
        let lastErr: unknown = null;
        for (let attempt = 0; attempt < 12; attempt++) {
          try {
            const res = await mutateAsync(c);
            if (cancelled) return;
            show({ title: 'Готово', message: 'Доступ активирован', variant: 'success' });
            navigate(`/course/${res.courseId}`, { replace: true });
            return;
          } catch (e) {
            lastErr = e;
            const status = e instanceof ApiClientError ? e.status : null;
            // Only retry on unauthorized while token is not yet present.
            if (status === 401 && !getAccessToken()) {
              await new Promise((r) => setTimeout(r, 350));
              continue;
            }
            throw e;
          }
        }
        throw lastErr;
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiClientError
            ? `${e.message} (HTTP ${e.status})`
            : e instanceof Error
              ? e.message
              : 'Не удалось активировать';
        show({ title: 'Не удалось активировать', message: msg, variant: 'error' });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [c, navigate, show, mutateAsync]);

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

  if (isPending) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="60%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Не удалось активировать</CardTitle>
            <CardDescription>Проверьте код и попробуйте ещё раз</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              onClick={() => {
                void (async () => {
                  try {
                    const res = await mutateAsync(c);
                    show({ title: 'Готово', message: 'Доступ активирован', variant: 'success' });
                    navigate(`/course/${res.courseId}`, { replace: true });
                  } catch {
                    /* mutation stays failed */
                  }
                })();
              }}
            >
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

