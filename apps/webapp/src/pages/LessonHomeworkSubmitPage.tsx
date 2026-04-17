import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, useToast } from '../shared/ui/index.js';
import { useLesson } from '../shared/queries/useLesson.js';
import { useCreateLessonSubmission } from '../shared/queries/useCreateLessonSubmission.js';
import { fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';

export function LessonHomeworkSubmitPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const id = lessonId ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useLesson(id);
  const createSubmission = useCreateLessonSubmission(id);

  const [text, setText] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadedFileKey, setUploadedFileKey] = React.useState<string | null>(null);

  if (!id) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Домашнее задание</CardTitle>
            <CardDescription>Некорректный id</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="70%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="220px" radius="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Не удалось загрузить урок</CardTitle>
            <CardDescription>Попробуйте ещё раз</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => refetch()}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lesson = data.lesson;

  const upload = async () => {
    if (!selectedFile) {
      toast.show({ title: 'Файл', message: 'Выберите файл', variant: 'error' });
      return;
    }
    setUploading(true);
    try {
      const contentType = (selectedFile.type || '').trim() || 'application/octet-stream';
      const signed = await fetchJson<{ fileKey: string; url: string }>({
        path: '/uploads/submissions/signed',
        method: 'POST',
        body: {
          lessonId: id,
          filename: selectedFile.name,
          contentType,
        },
      });
      const putRes = await fetch(signed.url, {
        method: 'PUT',
        credentials: 'omit',
        headers: { 'content-type': contentType },
        body: selectedFile,
      });
      if (!putRes.ok) throw new Error(`HTTP ${putRes.status}`);
      setUploadedFileKey(signed.fileKey);
      toast.show({ title: 'Файл загружен', variant: 'success' });
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось загрузить файл', variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const t = text.trim();
    if (!t && !uploadedFileKey) {
      toast.show({ title: 'Заполните ответ', message: 'Добавьте текст и/или файл', variant: 'info' });
      return;
    }
    try {
      await createSubmission.mutateAsync({
        text: t ? t : null,
        link: null,
        fileKey: uploadedFileKey,
      } satisfies ContractsV1.CreateSubmissionRequestV1);
      toast.show({ title: 'Отправлено', message: 'Домашнее задание отправлено', variant: 'success' });
      navigate(`/lesson/${id}`, { replace: true });
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось отправить', variant: 'error' });
    }
  };

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Сдать домашнее задание</CardTitle>
          <CardDescription>Урок: {lesson.title}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Ваш ответ</CardTitle>
          <CardDescription>Текст + файл (опционально)</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Текст ответа"
            style={{
              width: '100%',
              minHeight: 160,
              padding: 'var(--sp-3)',
              borderRadius: 'var(--r-md)',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'var(--card)',
              color: 'var(--fg)',
            }}
          />

          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setSelectedFile(f);
              setUploadedFileKey(null);
            }}
            style={{ width: '100%' }}
          />

          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={upload} disabled={!selectedFile || uploading}>
              {uploading ? 'Загрузка…' : uploadedFileKey ? 'Файл загружен' : 'Загрузить файл'}
            </Button>
            <Button variant="primary" onClick={save} disabled={createSubmission.isPending}>
              Сохранить
            </Button>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Назад
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

