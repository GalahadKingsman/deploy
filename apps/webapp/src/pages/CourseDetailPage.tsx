import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Skeleton, ListItem } from '../shared/ui/index.js';
import { useCourse } from '../shared/queries/useCourse.js';
import { useCourseModules } from '../shared/queries/useCourseModules.js';
import { useMyCourses } from '../shared/queries/useMyCourses.js';
import { config as flagsConfig } from '../shared/config/flags.js';
import { ContractsV1 } from '@tracked/shared';

function resolveCoverUrl(raw: string | null | undefined): string | null {
  const u = (raw ?? '').trim();
  if (!u) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) {
    const base =
      flagsConfig.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
    return `${base}${u}`;
  }
  return u;
}

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const courseId = id ?? '';
  const { data, isLoading, error, refetch } = useCourse(courseId);
  const { data: modulesData, isLoading: modulesLoading, error: modulesError, refetch: refetchModules } =
    useCourseModules(courseId);
  const { data: myCourses } = useMyCourses();

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

  if (isLoading || modulesLoading) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="60%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="60px" radius="md" style={{ marginBottom: 'var(--sp-2)' }} />
        <Skeleton width="100%" height="60px" radius="md" />
      </div>
    );
  }

  if (error || modulesError || !data) {
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
            <Button variant="secondary" onClick={() => refetchModules()}>
              Повторить модули
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const course = data.course;
  const hasAccess = (myCourses?.items ?? []).some((x) => x.course.id === courseId);
  const modules = modulesData?.items ?? [];
  const cover = resolveCoverUrl(course.coverUrl);
  const enrollUrl = (course.enrollmentContactUrl ?? '').trim();
  const enrollOk = Boolean(enrollUrl && ContractsV1.isEnrollmentContactUrlAllowed(enrollUrl));

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--r-lg)',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  width={64}
                  height={64}
                  style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }}
                />
              ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <CardTitle>{course.title}</CardTitle>
              <CardDescription>
                {course.description ?? 'Описание отсутствует'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {(course.authorName ?? '').trim() ? (
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--fg)',
                lineHeight: 1.45,
                paddingTop: 'var(--sp-2)',
                borderTop: '1px solid var(--border)',
              }}
            >
              Автор курса — {(course.authorName ?? '').trim()}
            </div>
          ) : null}
          {hasAccess && (
            <Button variant="secondary" onClick={() => navigate('/learn')}>
              Доступ активен
            </Button>
          )}
          {!hasAccess && enrollOk ? (
            <Button variant="primary" asChild>
              <a href={enrollUrl} target="_blank" rel="noopener noreferrer">
                Записаться
              </a>
            </Button>
          ) : null}
          {!hasAccess && (
            <CardDescription style={{ margin: 0 }}>
              Доступ к урокам выдаёт автор курса. Оплата и договорённости — напрямую с экспертом; платформа не
              принимает оплату за курс.
            </CardDescription>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Модули</CardTitle>
          <CardDescription>
            {hasAccess ? 'Выберите модуль, чтобы открыть уроки.' : 'Доступ к урокам появится после зачисления на курс.'}
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {modules.length === 0 ? (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Пока нет модулей.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {modules.map((m) => (
                <ListItem
                  key={m.id}
                  title={m.title}
                  subtitle={hasAccess ? 'Открыть уроки модуля' : 'Доступ появится после зачисления'}
                  right={<span style={{ opacity: 0.65 }}>›</span>}
                  onClick={() => navigate(`/course/${courseId}/modules/${m.id}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
