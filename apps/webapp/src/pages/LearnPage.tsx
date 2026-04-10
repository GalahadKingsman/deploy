import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Button, Card, Skeleton, EmptyState, ErrorState } from '../shared/ui/index.js';
import { useMe } from '../shared/queries/useMe.js';
import { useLearnSummary } from '../shared/queries/useLearnSummary.js';
import { useMyCourses } from '../shared/queries/useMyCourses.js';
import { getTelegramDisplayUser } from '../shared/auth/telegram.js';

// Progress Circle Component
function ProgressCircle({ completed, total }: { completed: number; total: number }) {
  const percentage = (completed / total) * 100;
  const angle = (percentage / 100) * 360;

  return (
    <div
      style={{
        position: 'relative',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: `conic-gradient(
          var(--accent) 0deg ${angle}deg,
          rgba(255, 255, 255, 0.1) ${angle}deg 360deg
        )`,
        padding: '4px',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: 'var(--card)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--fg)',
            lineHeight: 1.2,
          }}
        >
          {completed}/{total}
        </div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--muted-fg)',
            marginTop: '2px',
          }}
        >
          уроков
        </div>
      </div>
    </div>
  );
}

// Section Header Component
function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--sp-4)',
      }}
    >
      <h2
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      {right && <div>{right}</div>}
    </div>
  );
}

// Progress Bar Component
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '2px',
        overflow: 'hidden',
        marginTop: 'var(--sp-2)',
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: 'var(--accent)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

// Current Course Card
function CurrentCourseCard({ title, courseId, completed, total }: { title: string; courseId: string; completed: number; total: number }) {
  return (
    <Card
      style={{
        marginBottom: 'var(--sp-5)',
        padding: 'var(--sp-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-4)',
          alignItems: 'flex-start',
        }}
      >
        {/* Left: Progress circle + text */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--sp-4)',
            alignItems: 'flex-start',
            flex: 1,
          }}
        >
          <ProgressCircle completed={completed} total={total} />
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-1)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--muted-fg)',
              }}
            >
              Текущий курс:
            </div>
            <div
              style={{
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--fg)',
              }}
            >
              {mockCurrentCourse.title}
            </div>
          </div>
        </div>
        {/* Right: Action area with button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Button
            asChild
            variant="primary"
            size="sm"
            style={{
              borderRadius: '999px',
              padding: 'var(--sp-2) var(--sp-4)',
              minHeight: '36px',
            }}
          >
            <Link to={`/course/${courseId}`}>Продолжить</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Next Lesson Card
function NextLessonCard({ title }: { title: string }) {
  return (
    <Card
      style={{
        marginBottom: 'var(--sp-5)',
        padding: 'var(--sp-4)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--r-md)',
          backgroundColor: 'var(--accent)',
          opacity: 0.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--muted-fg)',
            marginBottom: 'var(--sp-1)',
          }}
        >
          Следующий урок:
        </div>
        <div
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--fg)',
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--r-md)',
          backgroundColor: 'var(--accent)',
          opacity: 0.1,
          flexShrink: 0,
        }}
      />
    </Card>
  );
}

// My Courses Section
function MyCoursesSection({ items }: { items: Array<{ id: string; title: string; progressPercent: number }> }) {
  return (
    <div style={{ marginBottom: 'var(--sp-6)' }}>
      <SectionHeader
        title="Мои курсы"
        right={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
            }}
          >
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>›</div>
          </div>
        }
      />
      <div>
        {items.map((course) => (
          <Link
            key={course.id}
            to={`/course/${course.id}`}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <Card
              style={{
                marginBottom: 'var(--sp-2)',
                padding: 'var(--sp-3) var(--sp-4)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--sp-2)',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--text-md)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--fg)',
                    flex: 1,
                  }}
                >
                    {course.title}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--muted-fg)',
                    marginLeft: 'var(--sp-3)',
                  }}
                >
                    {course.progressPercent}%
                </div>
              </div>
                <ProgressBar progress={course.progressPercent} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Skeleton width="60%" height="32px" style={{ marginBottom: 'var(--sp-5)' }} />
      <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-5)' }} />
      <Skeleton width="100%" height="80px" radius="lg" style={{ marginBottom: 'var(--sp-5)' }} />
      <Skeleton width="50%" height="24px" style={{ marginBottom: 'var(--sp-4)' }} />
      <Skeleton width="100%" height="60px" radius="md" style={{ marginBottom: 'var(--sp-2)' }} />
      <Skeleton width="100%" height="60px" radius="md" style={{ marginBottom: 'var(--sp-5)' }} />
      <Skeleton width="50%" height="24px" style={{ marginBottom: 'var(--sp-4)' }} />
      <div style={{ display: 'flex', gap: 'var(--sp-3)', overflowX: 'auto' }}>
        <Skeleton width="140px" height="160px" radius="lg" />
        <Skeleton width="140px" height="160px" radius="lg" />
        <Skeleton width="140px" height="160px" radius="lg" />
      </div>
    </div>
  );
}

function displayName(
  user: { firstName?: string; lastName?: string; username?: string } | null,
): string {
  if (!user) return 'Пользователь';
  const first = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (first) return first;
  if (user.username) return user.username;
  return 'Пользователь';
}

// Main LearnPage Component
export function LearnPage() {
  const [searchParams] = useSearchParams();
  const state = searchParams.get('state') || 'default';
  const { data: meData } = useMe();
  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useLearnSummary();
  const { data: myCourses, isLoading: myCoursesLoading } = useMyCourses();
  const apiUser = meData?.user ?? null;
  const displayUser = apiUser ?? getTelegramDisplayUser();
  const userName = displayName(displayUser);

  if (state === 'loading' || summaryLoading || myCoursesLoading) {
    return <LoadingState />;
  }

  const activeCourse = summary?.activeCourse ?? null;
  const nextLesson = summary?.nextLesson ?? null;

  if (state === 'empty' || (!activeCourse && !summaryError)) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <EmptyState
          title="Нет активного обучения"
          description="Начните обучение, выбрав курс из библиотеки"
          actionLabel="Открыть библиотеку"
          onAction={() => {
            window.location.href = '/library';
          }}
        />
      </div>
    );
  }

  if (state === 'error' || summaryError) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <ErrorState
          title="Не удалось загрузить данные"
          description="Проверьте подключение к интернету и попробуйте снова"
          actionLabel="Повторить"
          onAction={() => {
            refetchSummary();
          }}
        />
      </div>
    );
  }

  // Default state
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      {/* Header */}
      <h1
        style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--fg)',
          margin: '0 0 var(--sp-5) 0',
        }}
      >
        Привет, {userName}
      </h1>

      {activeCourse && (
        <CurrentCourseCard
          title={activeCourse.title}
          courseId={activeCourse.id}
          completed={0}
          total={Math.max(1, activeCourse.lessonsCount ?? 1)}
        />
      )}

      {nextLesson && <NextLessonCard title={nextLesson.title} />}

      <MyCoursesSection
        items={(myCourses?.items ?? []).map((x) => ({
          id: x.course.id,
          title: x.course.title,
          progressPercent: x.progressPercent,
        }))}
      />
    </div>
  );
}
