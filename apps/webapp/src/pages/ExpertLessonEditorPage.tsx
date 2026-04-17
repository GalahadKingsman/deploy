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
  const [assignmentPrompt, setAssignmentPrompt] = React.useState('');
  const [assignmentFiles, setAssignmentFiles] = React.useState<ContractsV1.AssignmentFileV1[]>([]);
  const [homeworkSaving, setHomeworkSaving] = React.useState(false);
  const [homeworkUploading, setHomeworkUploading] = React.useState(false);
  const [lesson, setLesson] = React.useState<ContractsV1.ExpertLessonV1 | null>(null);
  const homeworkFileInputRef = React.useRef<HTMLInputElement>(null);

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

        // Homework (assignment + files)
        if (found?.id && expertId) {
          try {
            const a = await fetchJson<ContractsV1.GetLessonAssignmentResponseV1>({
              path: `/experts/${expertId}/lessons/${found.id}/assignment`,
            });
            if (cancelled) return;
            setAssignmentPrompt(a.assignment?.promptMarkdown ?? '');
            setAssignmentFiles(a.files ?? []);
          } catch {
            // ignore: homework can be configured later
          }
        }
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

  const saveHomework = async () => {
    if (!expertId || !lessonId) return;
    setHomeworkSaving(true);
    try {
      await fetchJson<ContractsV1.AssignmentV1>({
        path: `/experts/${expertId}/lessons/${lessonId}/assignment`,
        method: 'PATCH',
        body: { promptMarkdown: assignmentPrompt.trim() ? assignmentPrompt : null } satisfies ContractsV1.UpsertAssignmentRequestV1,
      });
      toast.show({ title: 'Домашнее задание сохранено', variant: 'success' });
      // Refresh assignment (also pulls files list)
      const a = await fetchJson<ContractsV1.GetLessonAssignmentResponseV1>({
        path: `/experts/${expertId}/lessons/${lessonId}/assignment`,
      });
      setAssignmentPrompt(a.assignment?.promptMarkdown ?? '');
      setAssignmentFiles(a.files ?? []);
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? `${e.message} (HTTP ${e.status})`
          : e instanceof Error
            ? e.message
            : 'Не удалось сохранить';
      toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
    } finally {
      setHomeworkSaving(false);
    }
  };

  const uploadHomeworkFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!expertId || !lessonId) return;
    setHomeworkUploading(true);
    try {
      for (const f of Array.from(files)) {
        const signed = await fetchJson<{ fileKey: string; url: string }>({
          path: `/experts/${expertId}/lessons/${lessonId}/assignment/files/signed`,
          method: 'POST',
          body: { filename: f.name, contentType: f.type || null },
        });
        const putRes = await fetch(signed.url, {
          method: 'PUT',
          headers: f.type ? { 'content-type': f.type } : undefined,
          body: f,
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed (HTTP ${putRes.status})`);
        }
        await fetchJson<ContractsV1.AssignmentFileV1>({
          path: `/experts/${expertId}/lessons/${lessonId}/assignment/files`,
          method: 'POST',
          body: { fileKey: signed.fileKey, filename: f.name, contentType: f.type || null },
        });
      }
      const a = await fetchJson<ContractsV1.GetLessonAssignmentResponseV1>({
        path: `/experts/${expertId}/lessons/${lessonId}/assignment`,
      });
      setAssignmentFiles(a.files ?? []);
      toast.show({ title: 'Файлы добавлены', variant: 'success' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось загрузить файлы';
      toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
    } finally {
      setHomeworkUploading(false);
    }
  };

  const deleteHomeworkFile = async (fileId: string) => {
    if (!expertId || !lessonId) return;
    try {
      await fetchJson<{ ok: true }>({
        path: `/experts/${expertId}/lessons/${lessonId}/assignment/files/${fileId}/delete`,
        method: 'POST',
        body: {},
      });
      setAssignmentFiles((xs) => xs.filter((x) => x.id !== fileId));
      toast.show({ title: 'Удалено', variant: 'success' });
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось удалить файл', variant: 'error' });
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
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Описание</div>
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

          <Card style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardHeader>
              <CardTitle style={{ fontSize: 'var(--text-md)' }}>Домашнее задание</CardTitle>
              <CardDescription>Текст задания + файлы (презентации, материалы и т.д.)</CardDescription>
            </CardHeader>
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <textarea
                value={assignmentPrompt}
                onChange={(e) => setAssignmentPrompt(e.target.value)}
                placeholder="Текст домашнего задания"
                style={{
                  width: '100%',
                  minHeight: 140,
                  padding: 'var(--sp-3)',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'var(--card)',
                  color: 'var(--fg)',
                }}
              />
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                <Button variant="secondary" onClick={saveHomework} disabled={homeworkSaving}>
                  Сохранить задание
                </Button>
                <input
                  ref={homeworkFileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    void uploadHomeworkFiles(e.target.files);
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                  disabled={homeworkUploading}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={homeworkUploading}
                  onClick={() => homeworkFileInputRef.current?.click()}
                >
                  {homeworkUploading ? 'Загрузка…' : 'Добавить файлы'}
                </Button>
              </div>

              {assignmentFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {assignmentFiles.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 'var(--sp-2)',
                        alignItems: 'center',
                        padding: 'var(--sp-2)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 'var(--r-md)',
                      }}
                    >
                      <div style={{ fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {f.filename}
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => deleteHomeworkFile(f.id)}>
                        Удалить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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

