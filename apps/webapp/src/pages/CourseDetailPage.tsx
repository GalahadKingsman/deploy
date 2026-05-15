import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Skeleton } from '../shared/ui/index.js';
import { useCourse } from '../shared/queries/useCourse.js';
import { useCourseModules } from '../shared/queries/useCourseModules.js';
import { useMyCourses } from '../shared/queries/useMyCourses.js';
import { config as flagsConfig } from '../shared/config/flags.js';
import { ContractsV1 } from '@tracked/shared';
import { PageScreen } from '../ui/edify/PageScreen.js';

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
  const resumeLesson = data.nextLesson ?? data.lessons[0] ?? null;

  const goToCurrentLesson = () => {
    if (resumeLesson) {
      navigate(`/lesson/${resumeLesson.id}`);
      return;
    }
    if (modules[0]) {
      navigate(`/course/${courseId}/modules/${modules[0].id}`);
      return;
    }
    navigate('/learn');
  };

  return (
    <PageScreen>
      <div className="edify-course-hero">
        {cover ? (
          <img
            src={cover}
            alt=""
            style={{
              width: '100%',
              borderRadius: 'var(--r-lg)',
              aspectRatio: '16 / 9',
              objectFit: 'cover',
              border: '1px solid var(--hairline)',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: 'var(--r-lg)',
              background: 'var(--surface-1)',
              border: '1px solid var(--hairline)',
            }}
          />
        )}
        <h1 className="edify-course-hero__title">{course.title}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {course.description ?? 'Описание отсутствует'}
        </p>
        <div className="edify-course-hero__meta">
          <span>Модулей: {course.modulesCount ?? 0}</span>
          <span>·</span>
          <span>Уроков: {course.lessonsCount ?? 0}</span>
        </div>
        {(course.authorName ?? '').trim() ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
            Автор — {(course.authorName ?? '').trim()}
          </div>
        ) : null}
        {hasAccess ? (
          <div className="edify-access-badge">
            <span className="edify-access-badge__dot" />
            Доступ активен
          </div>
        ) : null}
        {!hasAccess && enrollOk ? (
          <a href={enrollUrl} target="_blank" rel="noopener noreferrer" className="edify-btn-solid" style={{ marginTop: 16, textDecoration: 'none' }}>
            Записаться
          </a>
        ) : null}
        {!hasAccess ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.45 }}>
            Доступ к урокам выдаёт автор курса. Оплата и договорённости — напрямую с экспертом; платформа не принимает
            оплату за курс.
          </p>
        ) : null}
        {hasAccess ? (
          <button type="button" className="edify-btn-solid" style={{ marginTop: 16, width: '100%' }} onClick={goToCurrentLesson}>
            Перейти к обучению
          </button>
        ) : null}
      </div>

      <div className="edify-section-header">
        <h2 className="edify-section-title">Модули</h2>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 var(--sp-4)' }}>
        {hasAccess ? 'Выберите модуль, чтобы открыть уроки.' : 'Доступ к урокам появится после зачисления на курс.'}
      </p>
      {modules.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Пока нет модулей.</div>
      ) : (
        modules.map((m, index) => (
          <button
            key={m.id}
            type="button"
            className="edify-module-row"
            onClick={() => navigate(`/course/${courseId}/modules/${m.id}`)}
          >
            <span className="edify-module-num">{String(index + 1).padStart(2, '0')}</span>
            <div className="edify-module-content">
              <div className="edify-module-title">{m.title}</div>
              <div className="edify-module-sub">
                {hasAccess ? 'Открыть уроки модуля' : 'Доступ появится после зачисления'}
              </div>
            </div>
          </button>
        ))
      )}
    </PageScreen>
  );

}
