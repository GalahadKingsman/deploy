import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, useToast } from '../shared/ui/index.js';
import { useModuleLessons } from '../shared/queries/useModuleLessons.js';
import { useCourseModules } from '../shared/queries/useCourseModules.js';

export function CourseModulePage() {
  const { courseId = '', moduleId = '' } = useParams<{ courseId: string; moduleId: string }>();
  const toast = useToast();
  const { data: modulesData, isLoading: modulesLoading } = useCourseModules(courseId);
  const { data, isLoading, error, refetch } = useModuleLessons(courseId, moduleId);

  const moduleTitle =
    (modulesData?.items ?? []).find((m) => m.id === moduleId)?.title ?? 'Модуль';

  if (!courseId || !moduleId) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Модуль</CardTitle>
            <CardDescription>Некорректные параметры</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading || modulesLoading) {
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
            <CardTitle>{moduleTitle}</CardTitle>
            <CardDescription>Не удалось загрузить уроки</CardDescription>
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

  const items = data.items ?? [];
  const unlocked = new Set(data.unlockedLessonIds ?? []);
  const completed = new Set(data.completedLessonIds ?? []);

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>{moduleTitle}</CardTitle>
          <CardDescription>Уроки модуля</CardDescription>
        </CardHeader>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle style={{ fontSize: 'var(--text-md)' }}>Нет уроков</CardTitle>
            <CardDescription>
              Если вы не зачислены на курс, уроки будут скрыты.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {items.map((l) => {
            const isUnlocked = unlocked.has(l.id);
            const isDone = completed.has(l.id);
            if (isUnlocked) {
              return (
                <Button
                  key={l.id}
                  variant="secondary"
                  asChild
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                >
                  <Link to={`/lesson/${l.id}`}>{isDone ? `✓ ${l.title}` : l.title}</Link>
                </Button>
              );
            }
            return (
              <Button
                key={l.id}
                variant="secondary"
                disabled
                style={{ width: '100%', justifyContent: 'flex-start', opacity: 0.7 }}
                onClick={() => {
                  toast.show({
                    title: 'Урок закрыт',
                    message: 'Доступ появится после проверки домашнего задания экспертом.',
                    variant: 'info',
                  });
                }}
              >
                🔒 {l.title}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

