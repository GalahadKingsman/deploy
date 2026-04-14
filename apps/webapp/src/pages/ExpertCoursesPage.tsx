import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input } from '../shared/ui/index.js';
import { useExpertCourses, useCreateExpertCourse } from '../shared/queries/useExpertCourses.js';
import type { ContractsV1 } from '@tracked/shared';
import { ApiClientError } from '../shared/api/errors.js';
import { useToast } from '../shared/ui/feedback/Toast.js';

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

  const TabButton = ({ value, label, count }: { value: TabFilter; label: string; count: number }) => (
    <Button
      variant={tab === value ? 'primary' : 'secondary'}
      onClick={() => setTab(value)}
      style={{ flex: '1 1 auto' }}
    >
      {label} ({count})
    </Button>
  );

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Курсы</CardTitle>
          <CardDescription>Черновики, опубликованные и поиск. Фильтры сохраняются в URL.</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <TabButton value="all" label="Все" count={allTotal} />
            <TabButton value="draft" label="Черновики" count={draftCount} />
            <TabButton value="published" label="Опубликованные" count={publishedCount} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Input
              placeholder="Поиск"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              style={{ flex: '1 1 200px' }}
            />
            <Button variant="secondary" onClick={applySearch}>
              Найти
            </Button>
            <Button
              variant="primary"
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
              disabled={!expertId || create.isPending}
            >
              Создать
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div>Загрузка…</div>}
      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
            <CardDescription>
              {error instanceof ApiClientError
                ? `Не удалось загрузить список курсов. ${error.message} (HTTP ${error.status})`
                : 'Не удалось загрузить список курсов.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={() => refetch()}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && items.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Пусто</CardTitle>
            <CardDescription>Создайте первый курс или смените фильтр.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {items.map((c) => (
          <Link
            key={c.id}
            to={`/expert/${expertId}/courses/${c.id}`}
            style={{ textDecoration: 'none' }}
          >
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: 'var(--text-md)' }}>{c.title}</CardTitle>
                <CardDescription>
                  {c.status} {c.visibility === 'public' ? '• public' : '• private'}
                  {typeof c.priceCents === 'number' && c.priceCents > 0
                    ? ` • ${(c.priceCents / 100).toLocaleString('ru-RU')} ${c.currency ?? 'RUB'}`
                    : ' • бесплатно'}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
