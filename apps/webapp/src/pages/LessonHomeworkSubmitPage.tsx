import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, useToast } from '../shared/ui/index.js';
import { useLesson } from '../shared/queries/useLesson.js';
import { useCreateLessonSubmission } from '../shared/queries/useCreateLessonSubmission.js';
import { useMyLessonSubmissions } from '../shared/queries/useMyLessonSubmissions.js';
import { fetchMultipart } from '../shared/api/index.js';
import { ApiClientError } from '../shared/api/errors.js';
import type { ContractsV1 } from '@tracked/shared';

function labelFromSubmissionFileKey(key: string): string {
  const tail = key.includes('/') ? key.slice(key.lastIndexOf('/') + 1) : key;
  const withoutTs = tail.replace(/^\d+-/, '');
  return (withoutTs || tail || 'файл').trim() || 'файл';
}

export function LessonHomeworkSubmitPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const id = lessonId ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useLesson(id);
  const { data: mySubsData, isFetched: mySubsFetched } = useMyLessonSubmissions(id);
  const createSubmission = useCreateLessonSubmission(id);

  const [text, setText] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadedFileKey, setUploadedFileKey] = React.useState<string | null>(null);
  const didSeedRef = React.useRef(false);

  React.useEffect(() => {
    didSeedRef.current = false;
  }, [id]);

  React.useEffect(() => {
    if (!mySubsFetched || didSeedRef.current) return;
    const latest = mySubsData?.items?.[0];
    didSeedRef.current = true;
    if (!latest || latest.status === 'accepted') return;
    setText(typeof latest.text === 'string' ? latest.text : '');
    setUploadedFileKey(latest.fileKey ?? null);
    setSelectedFile(null);
  }, [mySubsFetched, mySubsData, id]);

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

  if (!mySubsFetched) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="70%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="220px" radius="lg" />
      </div>
    );
  }

  const latestSubmission = mySubsData?.items?.[0] ?? null;
  if (latestSubmission?.status === 'accepted') {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Редактирование недоступно</CardTitle>
            <CardDescription>
              Эксперт уже принял ваш ответ. Отправленные материалы больше нельзя изменить.
            </CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => navigate(`/lesson/${id}`, { replace: true })}>
              К уроку
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lesson = data.lesson;
  const isEditing = Boolean(latestSubmission);

  const upload = async () => {
    if (!selectedFile) {
      toast.show({ title: 'Файл', message: 'Выберите файл', variant: 'error' });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('lessonId', id);
      form.append('file', selectedFile, selectedFile.name);
      const res = await fetchMultipart<{ fileKey: string }>({
        path: '/uploads/submissions',
        form,
      });
      setUploadedFileKey(res.fileKey);
      toast.show({ title: 'Файл загружен', variant: 'success' });
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? `${e.message} (HTTP ${e.status})`
          : e instanceof Error
            ? e.message
            : 'Не удалось загрузить файл';
      toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const t = text.trim();
    let fileKey = uploadedFileKey;
    if (selectedFile && !fileKey) {
      setSaving(true);
      try {
        const form = new FormData();
        form.append('lessonId', id);
        form.append('file', selectedFile, selectedFile.name);
        const res = await fetchMultipart<{ fileKey: string }>({
          path: '/uploads/submissions',
          form,
        });
        fileKey = res.fileKey;
        setUploadedFileKey(res.fileKey);
      } catch (e) {
        const msg =
          e instanceof ApiClientError
            ? `${e.message} (HTTP ${e.status})`
            : e instanceof Error
              ? e.message
              : 'Не удалось загрузить файл';
        toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
        return;
      } finally {
        setSaving(false);
      }
    }

    if (!t && !fileKey) {
      toast.show({ title: 'Заполните ответ', message: 'Добавьте текст и/или файл', variant: 'info' });
      return;
    }
    try {
      await createSubmission.mutateAsync({
        text: t ? t : null,
        link: null,
        fileKey,
      } satisfies ContractsV1.CreateSubmissionRequestV1);
      toast.show({
        title: isEditing ? 'Сохранено' : 'Отправлено',
        message: isEditing ? 'Ответ обновлён' : 'Домашнее задание отправлено',
        variant: 'success',
      });
      navigate(`/lesson/${id}`, { replace: true });
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось отправить', variant: 'error' });
    }
  };

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>{isEditing ? 'Изменить ответ' : 'Сдать домашнее задание'}</CardTitle>
          <CardDescription>Урок: {lesson.title}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Ваш ответ</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Измените текст и при необходимости замените или удалите файл.'
              : 'Текст + файл (опционально)'}
          </CardDescription>
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

          {uploadedFileKey ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                padding: 'var(--sp-3)',
                borderRadius: 'var(--r-md)',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', flex: '1 1 auto', minWidth: 0 }}>
                Прикреплённый файл:{' '}
                <span style={{ color: 'var(--fg)', wordBreak: 'break-word' }}>{labelFromSubmissionFileKey(uploadedFileKey)}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUploadedFileKey(null);
                  setSelectedFile(null);
                }}
              >
                Удалить файл
              </Button>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={upload} disabled={!selectedFile || uploading}>
              {uploading ? 'Загрузка…' : uploadedFileKey ? 'Заменить файл' : 'Загрузить файл'}
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={createSubmission.isPending || saving}>
              {createSubmission.isPending || saving ? 'Отправка…' : isEditing ? 'Сохранить изменения' : 'Сохранить'}
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
