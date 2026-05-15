import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Skeleton, useToast } from '../shared/ui/index.js';
import { useModuleLessons } from '../shared/queries/useModuleLessons.js';
import { useCourseModules } from '../shared/queries/useCourseModules.js';
import { useCourse } from '../shared/queries/useCourse.js';
import { PageScreen } from '../ui/edify/PageScreen.js';
import { truncateMiddle } from '../ui/edify/contentMeta.js';

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export function CourseModulePage() {
  const { courseId = '', moduleId = '' } = useParams<{ courseId: string; moduleId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: courseData } = useCourse(courseId);
  const { data: modulesData, isLoading: modulesLoading } = useCourseModules(courseId);
  const { data, isLoading, error, refetch } = useModuleLessons(courseId, moduleId);

  const moduleTitle = (modulesData?.items ?? []).find((m) => m.id === moduleId)?.title ?? 'Модуль';
  const courseTitle = courseData?.course?.title ?? '';

  if (!courseId || !moduleId) {
    return (
      <PageScreen>
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Некорректные параметры</div>
        </div>
      </PageScreen>
    );
  }

  if (isLoading || modulesLoading) {
    return (
      <PageScreen>
        <Skeleton width="50%" height={28} style={{ marginBottom: 'var(--sp-5)' }} />
        <Skeleton width="100%" height={72} radius="lg" style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={72} radius="lg" />
      </PageScreen>
    );
  }

  if (error || !data) {
    return (
      <PageScreen>
        <div className="edify-content-header">
          <h1 className="edify-h edify-h--md">{moduleTitle}</h1>
        </div>
        <p className="edify-subtitle" style={{ marginBottom: 16 }}>Не удалось загрузить уроки</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Повторить
        </Button>
      </PageScreen>
    );
  }

  const items = data.items ?? [];
  const unlocked = new Set(data.unlockedLessonIds ?? []);
  const completed = new Set(data.completedLessonIds ?? []);

  return (
    <PageScreen>
      <div className="edify-content-header">
        <div className="edify-eyebrow">LEARN</div>
        <nav className="edify-breadcrumb" aria-label="Навигация">
          <button type="button" className="edify-breadcrumb__link" onClick={() => navigate(`/course/${courseId}`)}>
            {truncateMiddle(courseTitle || 'Курс', 24)}
          </button>
        </nav>
        <h1 className="edify-h edify-h--lg">{moduleTitle}</h1>
        <p className="edify-subtitle" style={{ marginTop: 8 }}>
          Выберите урок, чтобы продолжить обучение.
        </p>
      </div>

      {items.length > 0 ? (
        <div className="edify-section-header">
          <h2 className="edify-section-title">Уроки</h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            {String(items.length).padStart(2, '0')}
          </span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div className="edify-empty-panel__title">Нет уроков</div>
          <p className="edify-empty-panel__text">
            Если вы не зачислены на курс, уроки будут скрыты. Обратитесь к автору курса.
          </p>
        </div>
      ) : (
        items.map((l, index) => {
          const isUnlocked = unlocked.has(l.id);
          const isDone = completed.has(l.id);
          const meta = isDone ? 'Завершён' : isUnlocked ? 'Открыт' : 'Закрыт';

          if (isUnlocked) {
            return (
              <Link key={l.id} to={`/lesson/${l.id}`} className="edify-item-row">
                <span className="edify-item-num">{String(index + 1).padStart(2, '0')}</span>
                <div className="edify-item-content">
                  <div className="edify-item-title">{l.title}</div>
                  <div className="edify-item-meta">
                    <span className={isDone ? 'edify-item-meta-tag' : undefined}>{meta}</span>
                  </div>
                </div>
                <Chevron />
              </Link>
            );
          }

          return (
            <button
              key={l.id}
              type="button"
              className="edify-item-row"
              onClick={() => {
                toast.show({
                  title: 'Урок закрыт',
                  message: 'Доступ появится после проверки домашнего задания экспертом.',
                  variant: 'info',
                });
              }}
            >
              <span className="edify-item-num">{String(index + 1).padStart(2, '0')}</span>
              <div className="edify-item-content">
                <div className="edify-item-title">{l.title}</div>
                <div className="edify-item-meta">
                  <span>{meta}</span>
                </div>
              </div>
              <span style={{ fontSize: 16, opacity: 0.5 }} aria-hidden>
                🔒
              </span>
            </button>
          );
        })
      )}
    </PageScreen>
  );
}
