import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { ContractsV1 } from '@tracked/shared';
import { Input, Button, Card, Skeleton, EmptyState, ErrorState } from '../shared/ui/index.js';
import { useLibrary } from '../shared/queries/useLibrary.js';
import { ApiClientError } from '../shared/api/errors.js';
import { config } from '../shared/config/flags.js';

function resolveCoverUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  // For values like `/public/course-cover?...` that live on API host.
  if (u.startsWith('/')) {
    const base =
      config.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
    return `${base}${u}`;
  }
  return u;
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

function SquareCourseCard({ course }: { course: ContractsV1.CourseV1 }) {
  const cover =
    typeof course.coverUrl === 'string' && course.coverUrl.trim()
      ? resolveCoverUrl(course.coverUrl)
      : null;
  return (
    <Link
      to={`/course/${course.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <Card
        style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: 'var(--r-xl)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <div style={{ position: 'relative' }}>
          {/* square cover */}
          <div style={{ width: '100%', paddingTop: '100%', background: 'rgba(255,255,255,0.06)' }}>
            {cover ? (
              <img
                src={cover}
                alt=""
                loading="lazy"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : null}
          </div>

          {/* gradient for text legibility */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '55%',
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: 'var(--sp-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-1)',
            }}
          >
            <div
              style={{
                color: 'white',
                fontSize: 'var(--text-md)',
                fontWeight: 'var(--font-weight-semibold)',
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textShadow: '0 1px 10px rgba(0,0,0,0.6)',
              }}
            >
              {course.title}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 'var(--text-xs)' }}>
              {course.visibility ?? 'public'}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

// Loading State
function LoadingState() {
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Skeleton width="60%" height="32px" style={{ marginBottom: 'var(--sp-4)' }} />
      <Skeleton width="100%" height="48px" radius="md" style={{ marginBottom: 'var(--sp-5)' }} />
      <Skeleton width="50%" height="24px" style={{ marginBottom: 'var(--sp-4)' }} />
      <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-3)' }} />
      <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-3)' }} />
      <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-3)' }} />
      <Skeleton width="100%" height="120px" radius="lg" style={{ marginBottom: 'var(--sp-5)' }} />
      <Skeleton width="50%" height="24px" style={{ marginBottom: 'var(--sp-4)' }} />
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          overflowX: 'auto',
          paddingBottom: 'var(--sp-2)',
        }}
      >
        <Skeleton width="220px" height="140px" radius="lg" />
        <Skeleton width="220px" height="140px" radius="lg" />
        <Skeleton width="220px" height="140px" radius="lg" />
      </div>
    </div>
  );
}

// Main LibraryPage Component
export function LibraryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = searchParams.get('state') || 'default';
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error, refetch } = useLibrary();
  const catalogCourses = data?.courses ?? [];
  const recommendedCourses = data?.recommended ?? [];

  // Filter courses based on search query
  const filteredCatalogCourses = useMemo(() => {
    if (!searchQuery.trim()) {
      return catalogCourses;
    }
    const query = searchQuery.toLowerCase();
    return catalogCourses.filter((course) => course.title.toLowerCase().includes(query));
  }, [searchQuery]);

  const filteredRecommendedCourses = useMemo(() => {
    if (!searchQuery.trim()) {
      return recommendedCourses;
    }
    const query = searchQuery.toLowerCase();
    return recommendedCourses.filter((course) => course.title.toLowerCase().includes(query));
  }, [searchQuery]);

  const hasSearchResults =
    filteredCatalogCourses.length > 0 || filteredRecommendedCourses.length > 0;
  const isSearchActive = searchQuery.trim().length > 0;

  // Loading state
  if (state === 'loading' || isLoading) {
    return <LoadingState />;
  }

  // Empty state
  if (state === 'empty') {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <EmptyState
          title="Каталог пуст"
          description="Попробуйте изменить запрос или сбросить фильтр"
          actionLabel="Перейти в обучение"
          onAction={() => {
            navigate('/learn');
          }}
        />
      </div>
    );
  }

  // Error state
  if (state === 'error' || error) {
    let description = 'Попробуйте ещё раз';
    if (error instanceof ApiClientError) {
      if (error.code === 'INVALID_RESPONSE' || error.code === 'NETWORK_ERROR') {
        description = error.message;
      }
    }
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <ErrorState
          title="Не удалось загрузить каталог"
          description={description}
          actionLabel="Повторить"
          onAction={() => {
            if (refetch) refetch();
            else navigate('/library');
          }}
        />
      </div>
    );
  }

  // Default state
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      {/* Search Input */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-2)',
          marginBottom: 'var(--sp-5)',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <Input
            placeholder="Поиск курсов"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingRight: searchQuery ? 'var(--sp-9)' : undefined,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 'var(--sp-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--muted-fg)',
                fontSize: 'var(--text-xl)',
                cursor: 'pointer',
                padding: 'var(--sp-1)',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
              }}
              aria-label="Очистить поиск"
            >
              ×
            </button>
          )}
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            style={{
              flexShrink: 0,
            }}
          >
            Очистить
          </Button>
        )}
      </div>

      {/* Search Results Empty State */}
      {isSearchActive && !hasSearchResults && (
        <EmptyState
          title="Ничего не найдено"
          description="Попробуйте изменить запрос или сбросить фильтр"
          actionLabel="Сбросить поиск"
          onAction={() => setSearchQuery('')}
        />
      )}

      {/* Section A - Catalog Courses */}
      {!isSearchActive && (
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <SectionHeader
            title="Каталог курсов"
            right={
              <div
                style={{
                  fontSize: 'var(--text-md)',
                  color: 'var(--muted-fg)',
                }}
              >
                ›
              </div>
            }
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--sp-3)',
            }}
          >
            {catalogCourses.map((course) => (
              <SquareCourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      )}

      {/* Search Results - Catalog */}
      {isSearchActive && hasSearchResults && filteredCatalogCourses.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <SectionHeader title="Каталог курсов" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--sp-3)',
            }}
          >
            {filteredCatalogCourses.map((course) => (
              <SquareCourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      )}

      {/* Section B - Recommendations */}
      {(!isSearchActive || (isSearchActive && filteredRecommendedCourses.length > 0)) && (
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <SectionHeader
            title="Рекомендации"
            right={
              !isSearchActive ? (
                <div
                  style={{
                    fontSize: 'var(--text-md)',
                    color: 'var(--muted-fg)',
                  }}
                >
                  ›
                </div>
              ) : undefined
            }
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--sp-3)',
            }}
          >
            {filteredRecommendedCourses.map((course) => (
              <SquareCourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
