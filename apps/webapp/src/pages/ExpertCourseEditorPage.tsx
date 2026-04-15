import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, useToast } from '../shared/ui/index.js';
import { fetchJson, fetchMultipart } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';
import { useTopics, useCourseTopics, useSetCourseTopics } from '../shared/queries/useTopics.js';
import { ApiClientError } from '../shared/api/errors.js';

export function ExpertCourseEditorPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { expertId, courseId } = useParams<{ expertId: string; courseId: string }>();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priceRubles, setPriceRubles] = React.useState('0');
  const [currency, setCurrency] = React.useState('RUB');
  const [visibility, setVisibility] = React.useState<'private' | 'public'>('private');
  const [coverUrl, setCoverUrl] = React.useState<string>('');
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverUploading, setCoverUploading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [course, setCourse] = React.useState<ContractsV1.ExpertCourseV1 | null>(null);
  const { data: allTopicsData } = useTopics();
  const { data: courseTopicsData, refetch: refetchCourseTopics } = useCourseTopics(
    expertId ?? '',
    courseId ?? '',
  );
  const setTopics = useSetCourseTopics(expertId ?? '', courseId ?? '');
  const [selectedTopicIds, setSelectedTopicIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const ids = new Set((courseTopicsData?.items ?? []).map((t) => t.id));
    setSelectedTopicIds(ids);
  }, [courseTopicsData]);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!expertId || !courseId) return;
      setLoading(true);
      try {
        const c = await fetchJson<ContractsV1.ExpertCourseV1>({
          path: `/experts/${expertId}/courses/${courseId}`,
        });
        if (cancelled) return;
        setCourse(c);
        setTitle(c.title);
        setDescription(c.description ?? '');
        const rub = (c.priceCents ?? 0) / 100;
        setPriceRubles(Number.isInteger(rub) ? String(rub) : (Math.round(rub * 100) / 100).toString());
        setCurrency(c.currency ?? 'RUB');
        setVisibility((c.visibility ?? 'private') === 'public' ? 'public' : 'private');
        setCoverUrl((c.coverUrl ?? '') || '');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [expertId, courseId]);

  const save = async () => {
    if (!expertId || !courseId) return;
    const rub = parseFloat(String(priceRubles).replace(',', '.'));
    if (!Number.isFinite(rub) || rub < 0) {
      toast.show({ title: 'Некорректная цена', message: 'Укажите неотрицательное число рублей.', variant: 'error' });
      return;
    }
    const priceCents = Math.round(rub * 100);
    setSaving(true);
    try {
      const updated = await fetchJson<ContractsV1.ExpertCourseV1>({
        path: `/experts/${expertId}/courses/${courseId}`,
        method: 'PATCH',
        body: {
          title,
          description: description.trim() ? description.trim() : null,
          priceCents,
          currency: currency.trim() || 'RUB',
          visibility,
          coverUrl: coverUrl.trim() ? coverUrl.trim() : null,
        },
      });
      setCourse(updated);
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!expertId || !courseId) return;
    const updated = await fetchJson<ContractsV1.ExpertCourseV1>({
      path: `/experts/${expertId}/courses/${courseId}/publish`,
      method: 'POST',
    });
    setCourse(updated);
  };

  const unpublish = async () => {
    if (!expertId || !courseId) return;
    const updated = await fetchJson<ContractsV1.ExpertCourseV1>({
      path: `/experts/${expertId}/courses/${courseId}/unpublish`,
      method: 'POST',
    });
    setCourse(updated);
  };

  const uploadCover = async () => {
    if (!expertId || !courseId || !coverFile) return;
    setCoverUploading(true);
    try {
      const form = new FormData();
      form.append('file', coverFile, coverFile.name);

      const updated = await fetchMultipart<ContractsV1.ExpertCourseV1>({
        path: `/experts/${expertId}/courses/${courseId}/cover`,
        form,
      });
      setCourse(updated);
      setCoverUrl((updated.coverUrl ?? '') || '');
      setCoverFile(null);
      toast.show({ title: 'Обложка загружена', variant: 'success' });
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? `${e.message} (HTTP ${e.status})`
          : e instanceof Error
            ? e.message
            : 'Не удалось загрузить обложку';
      toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
    } finally {
      setCoverUploading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 'var(--sp-4)' }}>Загрузка…</div>;
  }

  if (!course || !expertId || !courseId) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Курс</CardTitle>
            <CardDescription>Не найден.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Редактор курса</CardTitle>
          <CardDescription>
            Статус: {course.status} • {course.visibility}
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }}>Описание</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Коротко опишите, что будет в курсе"
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--fg)',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px' }}>
              <Input
                label="Обложка (URL, auto)"
                placeholder="/public/course-cover?key=..."
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                hint="Это поле заполняется автоматически после загрузки файла."
              />
            </div>
            <div style={{ flex: '0 1 160px' }}>
              <div style={{ marginBottom: 'var(--sp-2)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                Видимость
              </div>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value === 'public' ? 'public' : 'private')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--fg)',
                }}
              >
                <option value="private">private (только по ссылке)</option>
                <option value="public">public (в библиотеке)</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setCoverFile(f);
              }}
            />
            <Button variant="secondary" onClick={uploadCover} disabled={!coverFile || coverUploading}>
              {coverUploading ? 'Загрузка…' : 'Загрузить обложку'}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px' }}>
              <Input
                label="Цена (руб.)"
                inputMode="decimal"
                value={priceRubles}
                onChange={(e) => setPriceRubles(e.target.value)}
              />
            </div>
            <div style={{ flex: '0 1 100px' }}>
              <Input
                label="Валюта"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={save} disabled={saving}>
              Сохранить
            </Button>
            {course.status !== 'published' ? (
              <Button variant="secondary" onClick={publish}>
                Опубликовать
              </Button>
            ) : (
              <Button variant="secondary" onClick={unpublish}>
                Снять с публикации
              </Button>
            )}
            <Button variant="secondary" asChild>
              <Link to={`/expert/${expertId}/courses/${courseId}/modules`}>Модули</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to={`/expert/${expertId}/courses/${courseId}/access`}>Доступ</Link>
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Назад
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Темы курса</CardTitle>
          <CardDescription>Мультиселект из справочника тем платформы.</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {(allTopicsData?.items ?? []).length === 0 && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Темы не загружены.</div>
          )}
          {(allTopicsData?.items ?? []).map((t) => (
            <label
              key={t.id}
              style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}
            >
              <input
                type="checkbox"
                checked={selectedTopicIds.has(t.id)}
                onChange={(ev) => {
                  setSelectedTopicIds((prev) => {
                    const n = new Set(prev);
                    if (ev.target.checked) n.add(t.id);
                    else n.delete(t.id);
                    return n;
                  });
                }}
              />
              {t.title}
            </label>
          ))}
          <Button
            variant="secondary"
            disabled={setTopics.isPending || !expertId || !courseId}
            onClick={async () => {
              try {
                await setTopics.mutateAsync({ topicIds: [...selectedTopicIds] });
                await refetchCourseTopics();
                toast.show({ title: 'Темы сохранены', variant: 'success' });
              } catch {
                toast.show({ title: 'Не удалось сохранить темы', variant: 'error' });
              }
            }}
          >
            Сохранить темы
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

