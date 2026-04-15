import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  useToast,
} from '../shared/ui/index.js';
import { fetchJson } from '../shared/api/index.js';
import { normalizeRutubeEmbedUrl, type ContractsV1 } from '@tracked/shared';
import { ApiClientError } from '../shared/api/errors.js';

export function ExpertLessonEditorPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { expertId, moduleId, lessonId } = useParams<{
    expertId: string;
    moduleId: string;
    lessonId: string;
  }>();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [contentMarkdown, setContentMarkdown] = React.useState('');
  const [rutubeUrl, setRutubeUrl] = React.useState('');
  const [lesson, setLesson] = React.useState<ContractsV1.ExpertLessonV1 | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!expertId || !moduleId || !lessonId) return;
      setLoading(true);
      try {
        // No GET single-lesson endpoint in EPIC 6; load list and pick.
        const res = await fetchJson<ContractsV1.ListExpertLessonsResponseV1>({
          path: `/experts/${expertId}/modules/${moduleId}/lessons`,
        });
        const found = (res.items ?? []).find((x) => x.id === lessonId) ?? null;
        if (cancelled) return;
        setLesson(found);
        setTitle(found?.title ?? '');
        setContentMarkdown(found?.contentMarkdown ?? '');
        const v = found?.video;
        setRutubeUrl(v && v.kind === 'rutube' ? v.url : '');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [expertId, moduleId, lessonId]);

  const save = async () => {
    if (!expertId || !moduleId || !lessonId) return;
    const trimmed = rutubeUrl.trim();
    let video: ContractsV1.LessonVideoV1 = { kind: 'none' };
    if (trimmed) {
      const embed = normalizeRutubeEmbedUrl(trimmed);
      if (!embed) {
        toast.show({
          title: 'Некорректная ссылка Rutube',
          message: 'Вставьте ссылку на видео с rutube.ru (страница видео или embed).',
          variant: 'error',
        });
        return;
      }
      video = { kind: 'rutube', url: embed };
    }
    setSaving(true);
    try {
      const updated = await fetchJson<ContractsV1.ExpertLessonV1>({
        path: `/experts/${expertId}/modules/${moduleId}/lessons/${lessonId}`,
        method: 'PATCH',
        body: {
          title,
          contentMarkdown,
          video,
        },
      });
      setLesson(updated);
      const v = updated.video;
      setRutubeUrl(v && v.kind === 'rutube' ? v.url : '');
      toast.show({ title: 'Сохранено', variant: 'success' });
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? `${e.message} (HTTP ${e.status})`
          : e instanceof Error
            ? e.message
            : 'Не удалось сохранить';
      toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 'var(--sp-4)' }}>Загрузка…</div>;

  if (!lesson) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Урок</CardTitle>
            <CardDescription>Не найден.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* back handled by Telegram BackButton */}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Редактор урока</CardTitle>
          <CardDescription>Markdown и видео Rutube (воспроизведение в уроке).</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="Rutube URL"
            placeholder="https://rutube.ru/video/..."
            value={rutubeUrl}
            onChange={(e) => setRutubeUrl(e.target.value)}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Контент (markdown)</div>
            <textarea
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              style={{
                width: '100%',
                minHeight: '240px',
                resize: 'vertical',
                padding: 'var(--sp-3)',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--fg)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.5,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={save} disabled={saving}>
              Сохранить
            </Button>
            {expertId && lessonId && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/expert/${expertId}/lessons/${lessonId}/submissions`)}
              >
                Сабмиты
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

