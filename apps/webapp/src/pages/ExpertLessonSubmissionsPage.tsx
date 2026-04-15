import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, useToast } from '../shared/ui/index.js';
import { useExpertLessonSubmissions, useDecideSubmission } from '../shared/queries/useExpertLessonSubmissions.js';
import { config } from '../shared/config/flags.js';
import { buildUrl } from '../shared/api/url.js';
import { getAuthHeaders } from '../shared/api/headers.js';

function baseUrl(): string {
  return config.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
}

export function ExpertLessonSubmissionsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { expertId, lessonId } = useParams<{ expertId: string; lessonId: string }>();
  const eId = expertId ?? '';
  const lId = lessonId ?? '';

  const { data, isLoading, error, refetch } = useExpertLessonSubmissions(eId, lId);
  const decide = useDecideSubmission(eId, lId);

  const download = async (submissionId: string) => {
    try {
      const headers = await getAuthHeaders();
      const url = buildUrl(
        baseUrl(),
        `/experts/${eId}/lessons/${lId}/submissions/${submissionId}/file/signed`,
      );
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось скачать файл', variant: 'error' });
    }
  };

  if (!eId || !lId) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Сабмиты</CardTitle>
            <CardDescription>Некорректные параметры</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={() => navigate('/learn')}>
              К обучению
            </Button>
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

  if (error || !data) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Не удалось загрузить сабмиты</CardTitle>
            <CardDescription>Попробуйте ещё раз</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => refetch()}>
              Повторить
            </Button>
            <Button variant="secondary" onClick={() => navigate('/learn')}>
              К обучению
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
          <CardTitle>Сабмиты</CardTitle>
          <CardDescription>Урок: {lId}</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => refetch()}>
            Обновить
          </Button>
        </CardContent>
      </Card>

      {items.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Пока нет сабмитов</CardTitle>
            <CardDescription>Когда студенты отправят ответы, они появятся тут.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {items.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle style={{ fontSize: 'var(--text-md)' }}>submission {s.id}</CardTitle>
              <CardDescription>
                status: {s.status} • student: {s.studentId}
              </CardDescription>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {s.text && (
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 'var(--text-sm)' }}>{s.text}</pre>
              )}
              {s.link && (
                <a href={s.link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                  {s.link}
                </a>
              )}
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await decide.mutateAsync({ submissionId: s.id, status: 'accepted' });
                      toast.show({ title: 'Готово', message: 'Принято', variant: 'success' });
                    } catch {
                      toast.show({ title: 'Ошибка', message: 'Не удалось обновить статус', variant: 'error' });
                    }
                  }}
                  disabled={decide.isPending}
                >
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await decide.mutateAsync({ submissionId: s.id, status: 'rework' });
                      toast.show({ title: 'Готово', message: 'Отправлено на доработку', variant: 'success' });
                    } catch {
                      toast.show({ title: 'Ошибка', message: 'Не удалось обновить статус', variant: 'error' });
                    }
                  }}
                  disabled={decide.isPending}
                >
                  Rework
                </Button>
                {s.fileKey && (
                  <Button variant="ghost" size="sm" onClick={() => download(s.id)}>
                    Скачать файл
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

