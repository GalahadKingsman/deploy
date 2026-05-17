import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Skeleton, EmptyState, ErrorState } from '../shared/ui/index.js';
import { useMe } from '../shared/queries/useMe.js';
import { useLearnSummary } from '../shared/queries/useLearnSummary.js';
import { useMyCourses } from '../shared/queries/useMyCourses.js';
import { ApiClientError } from '../shared/api/errors.js';
import { getTelegramDisplayUser } from '../shared/auth/telegram.js';
import { PageScreen } from '../ui/edify/PageScreen.js';

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const angle = (pct / 100) * 360;
  return (
    <div
      className="edify-progress-ring"
      style={{
        background: `conic-gradient(var(--accent) 0deg ${angle}deg, var(--hairline) ${angle}deg 360deg)`,
      }}
    >
      <div className="edify-progress-ring__inner">
        <div className="edify-progress-ring__num">
          {completed}/{total}
        </div>
        <div className="edify-progress-ring__lbl">уроков</div>
      </div>
    </div>
  );
}

function displayName(user: { firstName?: string; lastName?: string; username?: string } | null): string {
  if (!user) return 'Пользователь';
  const first = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (first) return first;
  if (user.username) return user.username.replace(/^@/, '');
  return 'Пользователь';
}

function CourseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function LoadingState() {
  return (
    <PageScreen>
      <Skeleton width="50%" height="28px" style={{ marginBottom: 'var(--sp-5)' }} />
      <Skeleton width="100%" height="140px" radius="lg" style={{ marginBottom: 'var(--sp-5)' }} />
      <Skeleton width="100%" height="72px" radius="lg" style={{ marginBottom: 'var(--sp-5)' }} />
      <Skeleton width="40%" height="20px" style={{ marginBottom: 'var(--sp-4)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        <Skeleton width="100%" height="120px" radius="lg" />
        <Skeleton width="100%" height="120px" radius="lg" />
      </div>
    </PageScreen>
  );
}

export function LearnPage() {
  const [searchParams] = useSearchParams();
  const state = searchParams.get('state') || 'default';
  const { data: meData } = useMe();
  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } =
    useLearnSummary();
  const { data: myCourses, isLoading: myCoursesLoading } = useMyCourses();
  const apiUser = meData?.user ?? null;
  const displayUser = apiUser ?? getTelegramDisplayUser();
  const userName = displayName(displayUser);

  if (state === 'loading' || summaryLoading || myCoursesLoading) {
    return <LoadingState />;
  }

  const activeCourse = summary?.activeCourse ?? null;
  const nextLesson = summary?.nextLesson ?? null;
  const courseItems = myCourses?.items ?? [];
  const activeProgress = activeCourse ? courseItems.find((x) => x.course.id === activeCourse.id) : null;
  const done = activeProgress?.doneLessons ?? 0;
  const total = Math.max(1, activeProgress?.totalLessons ?? activeCourse?.lessonsCount ?? 1);

  if (state === 'empty' || (!activeCourse && !summaryError)) {
    return (
      <PageScreen>
        <EmptyState
          title="Нет активного обучения"
          description="Начните обучение, выбрав курс из библиотеки"
          actionLabel="Открыть библиотеку"
          onAction={() => {
            window.location.href = '/library';
          }}
        />
      </PageScreen>
    );
  }

  if (state === 'error' || summaryError) {
    let description = 'Проверьте подключение к интернету и попробуйте снова';
    if (summaryError instanceof ApiClientError) {
      if (summaryError.status === 401) {
        description = 'Нет авторизации. Закройте мини-приложение и откройте снова из Telegram.';
      } else if (summaryError.status === 503) {
        description =
          'Авторизация недоступна (часто нет TELEGRAM_BOT_TOKEN на сервере API). Проверьте конфиг и перезапустите API.';
      } else if (summaryError.code === 'INVALID_RESPONSE' || summaryError.code === 'NETWORK_ERROR') {
        description = summaryError.message;
      }
    }
    return (
      <PageScreen>
        <ErrorState
          title="Не удалось загрузить данные"
          description={description}
          actionLabel="Повторить"
          onAction={() => refetchSummary()}
        />
      </PageScreen>
    );
  }

  return (
    <PageScreen>
      <div className="edify-greeting">
        <div className="edify-eyebrow">STUDENT</div>
        <h1 className="edify-h edify-h--lg" style={{ marginBottom: 6 }}>
          Привет, {userName}
        </h1>
        <p className="edify-subtitle">Продолжайте там, где остановились.</p>
      </div>

      {activeCourse && (
        <div className="edify-current-course">
          <div className="edify-current-course__top">
            <ProgressRing completed={done} total={total} />
            <div className="edify-current-course__meta">
              <div className="edify-current-course__label">Текущий курс:</div>
              <div className="edify-current-course__title" title={activeCourse.title}>
                {activeCourse.title}
              </div>
            </div>
          </div>
          <Link to={`/course/${activeCourse.id}`} className="edify-btn-solid">
            Продолжить
          </Link>
        </div>
      )}

      {nextLesson && (
        <Link to={`/lesson/${nextLesson.id}`} className="edify-next-lesson">
          <div className="edify-next-lesson__dot" />
          <div className="edify-next-lesson__text">
            <span>Следующий урок ·</span>
            <strong>{nextLesson.title}</strong>
          </div>
        </Link>
      )}

      {courseItems.length > 0 && (
        <>
          <div className="edify-section-header" style={{ marginTop: 0 }}>
            <h2 className="edify-section-title">Мои курсы</h2>
          </div>
          <div className="edify-course-grid">
            {courseItems.map((x) => (
              <Link key={x.course.id} to={`/course/${x.course.id}`} className="edify-course-tile">
                <div className="edify-course-tile__icon">
                  <CourseIcon />
                </div>
                <div className="edify-course-tile__title">{x.course.title}</div>
                <div className="edify-course-tile__pct">{x.progressPercent}%</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </PageScreen>
  );
}
