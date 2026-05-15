import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Skeleton } from '../shared/ui/index.js';
import { useExpertCourses, useCreateExpertCourse } from '../shared/queries/useExpertCourses.js';
import type { ContractsV1 } from '@tracked/shared';
import { ApiClientError } from '../shared/api/errors.js';
import { useToast } from '../shared/ui/feedback/Toast.js';
import { PageScreen } from '../ui/edify/PageScreen.js';

type TabFilter = 'all' | 'draft' | 'published';

function tabToStatus(tab: TabFilter): ContractsV1.CourseStatusV1 | undefined {
  if (tab === 'draft') return 'draft';
  if (tab === 'published') return 'published';
  return undefined;
}

export function ExpertCoursesPage() {
  const { expertId } = useParams<{ expertId: string }>();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRaw = (searchParams.get('status') ?? 'all').toLowerCase();
  const tab: TabFilter =
    tabRaw === 'draft' || tabRaw === 'published' || tabRaw === 'all' ? (tabRaw as TabFilter) : 'all';
  const qFromUrl = searchParams.get('q') ?? '';
  const [qInput, setQInput] = React.useState(qFromUrl);

  React.useEffect(() => {
    setQInput(qFromUrl);
  }, [qFromUrl]);

  const status = tabToStatus(tab);
  const { data: allForCounts } = useExpertCourses(expertId ?? '', {});
  const { data, isLoading, error, refetch } = useExpertCourses(expertId ?? '', {
    status,
    q: qFromUrl.trim() ? qFromUrl.trim() : undefined,
  });
  const create = useCreateExpertCourse(expertId ?? '');

  const setTab = (next: TabFilter) => {
    const p = new URLSearchParams(searchParams);
    if (next === 'all') p.delete('status');
    else p.set('status', next);
    setSearchParams(p, { replace: true });
  };

  const applySearch = () => {
    const p = new URLSearchParams(searchParams);
    const t = qInput.trim();
    if (t) p.set('q', t);
    else p.delete('q');
    setSearchParams(p, { replace: true });
  };

  const items = data?.items ?? [];
  const allItems = allForCounts?.items ?? [];
  const allTotal = allItems.length;
  const draftCount = allItems.filter((c) => c.status === 'draft').length;
  const publishedCount = allItems.filter((c) => c.status === 'published').length;

  const tabs: { value: TabFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Все', count: allTotal },
    { value: 'draft', label: 'Черновики', count: draftCount },
    { value: 'published', label: 'Опубликованные', count: publishedCount },
  ];

  return (
    <PageScreen>
      <div className="edify-brand" aria-hidden="true" />

      <div className="edify-content-header">
        <div className="edify-eyebrow">EXPERT · COURSES</div>
        <h1 className="edify-h edify-h--lg">Курсы</h1>
        <p className="edify-subtitle" style={{ marginTop: 8 }}>
          Черновики, опубликованные и поиск. Фильтры сохраняются в URL.
        </p>
      </div>

      <div className="edify-panel">
        <div className="edify-filter-tabs">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              className={tab === t.value ? 'is-active' : undefined}
              onClick={() => setTab(t.value)}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="edify-toolbar">
          <div className="edify-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Поиск"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            />
          </div>
          <button type="button" className="edify-btn-secondary" onClick={applySearch}>
            Найти
          </button>
          <button
            type="button"
            className="edify-btn-solid edify-btn-solid--inline"
            disabled={!expertId || create.isPending}
            onClick={() => {
              create.mutate(
                { title: 'Новый курс', visibility: 'private' },
                {
                  onSuccess: () => {
                    toast.show({ title: 'Курс создан', variant: 'success' });
                  },
                  onError: (e) => {
                    const msg =
                      e instanceof ApiClientError
                        ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
                        : e instanceof Error
                          ? e.message
                          : 'Не удалось создать курс';
                    toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
                  },
                },
              );
            }}
          >
            Создать
          </button>
        </div>
      </div>

      {isLoading ? (
        <>
          <Skeleton width="100%" height={72} radius="lg" style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={72} radius="lg" />
        </>
      ) : null}

      {error ? (
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Не удалось загрузить</div>
          <p className="edify-empty-panel__text">
            {error instanceof ApiClientError
              ? `${error.message} (HTTP ${error.status})`
              : 'Проверьте соединение и попробуйте снова.'}
          </p>
          <button type="button" className="edify-btn-primary-outline" style={{ marginTop: 16, width: 'auto' }} onClick={() => refetch()}>
            Повторить
          </button>
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Курсов нет</div>
          <p className="edify-empty-panel__text">Создайте первый курс или смените фильтр поиска.</p>
        </div>
      ) : null}

      {!isLoading && !error
        ? items.map((c) => (
            <Link key={c.id} to={`/expert/${expertId}/courses/${c.id}`} className="edify-course-row">
              <div className="edify-course-row__title">{c.title}</div>
              <div className="edify-course-row__meta">
                {c.status} {c.visibility === 'public' ? '• public' : '• private'}
              </div>
            </Link>
          ))
        : null}
    </PageScreen>
  );
}
