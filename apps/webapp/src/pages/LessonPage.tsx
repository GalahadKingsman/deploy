import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Skeleton, useToast } from '../shared/ui/index.js';
import { useLesson } from '../shared/queries/useLesson.js';
import { useLessonAssignment } from '../shared/queries/useLessonAssignment.js';
import { useCreateLessonSubmission } from '../shared/queries/useCreateLessonSubmission.js';
import { useMyLessonSubmissions } from '../shared/queries/useMyLessonSubmissions.js';
import { fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';
import { getAuthHeaders } from '../shared/api/headers.js';
import { buildUrl } from '../shared/api/url.js';
import { config } from '../shared/config/flags.js';
import { normalizeRutubeEmbedUrl } from '@tracked/shared';

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const id = lessonId ?? '';
  const { data, isLoading, error, refetch } = useLesson(id);
  const { data: assignmentData } = useLessonAssignment(id);
  const createSubmission = useCreateLessonSubmission(id);
  const { data: mySubmissionsData, refetch: refetchMySubmissions } = useMyLessonSubmissions(id);
  const [completing, setCompleting] = React.useState(false);
  const [submissionText, setSubmissionText] = React.useState('');
  const [submissionLink, setSubmissionLink] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadedFileKey, setUploadedFileKey] = React.useState<string | null>(null);

  const complete = async () => {
    if (!id) return;
    setCompleting(true);
    try {
      await fetchJson<ContractsV1.CompleteLessonResponseV1>({
        path: `/lessons/${id}/complete`,
        method: 'POST',
        body: {},
      });
      toast.show({ title: 'Готово', message: 'Урок отмечен как выполненный', variant: 'success' });
    } catch (e) {
      toast.show({ title: 'Ошибка', message: 'Не удалось отметить урок', variant: 'error' });
    } finally {
      setCompleting(false);
    }
  };

  if (!id) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Урок</CardTitle>
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
        <Skeleton width="100%" height="280px" radius="lg" />
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
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lesson = data.lesson;
  const rutubeRaw =
    lesson.video && lesson.video.kind === 'rutube' ? (lesson.video.url as string) : null;
  const rutube = rutubeRaw ? normalizeRutubeEmbedUrl(rutubeRaw) ?? rutubeRaw : null;
  const assignment = assignmentData?.assignment ?? null;
  const myLatest = (mySubmissionsData?.items ?? [])[0] ?? null;

  const downloadMyFile = async (fileKey: string) => {
    try {
      const headers = await getAuthHeaders();
      const baseUrl =
        config.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
      const signedUrl = buildUrl(baseUrl, `/files/signed`, { key: fileKey });
      const res = await fetch(signedUrl, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось скачать файл', variant: 'error' });
    }
  };

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>{lesson.title}</CardTitle>
          <CardDescription>Курс: {lesson.courseId}</CardDescription>
        </CardHeader>
      </Card>

      {rutube && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 'var(--text-md)' }}>Видео</CardTitle>
            <CardDescription>Rutube embed</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
              <iframe
                src={rutube}
                title="Rutube video"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                  borderRadius: 'var(--r-md)',
                }}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          </CardContent>
        </Card>
      )}

      {assignment && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 'var(--text-md)' }}>Задание</CardTitle>
            <CardDescription>Отправьте ответ текстом или ссылкой</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 'var(--text-sm)',
                color: 'var(--fg)',
                margin: 0,
              }}
            >
              {assignment.promptMarkdown ?? ''}
            </pre>
            <textarea
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Ваш ответ (текст)"
              style={{
                width: '100%',
                minHeight: 120,
                padding: 'var(--sp-3)',
                borderRadius: 'var(--r-md)',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--card)',
                color: 'var(--fg)',
              }}
            />
            <input
              value={submissionLink}
              onChange={(e) => setSubmissionLink(e.target.value)}
              placeholder="Ссылка (опционально)"
              style={{
                width: '100%',
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
            <Button
              variant="secondary"
              onClick={async () => {
                if (!selectedFile) {
                  toast.show({ title: 'Файл', message: 'Выберите файл', variant: 'error' });
                  return;
                }
                setUploading(true);
                try {
                  const signed = await fetchJson<{ fileKey: string; url: string }>({
                    path: '/uploads/submissions/signed',
                    method: 'POST',
                    body: {
                      lessonId: id,
                      filename: selectedFile.name,
                      contentType: selectedFile.type || null,
                    },
                  });
                  const putRes = await fetch(signed.url, {
                    method: 'PUT',
                    headers: selectedFile.type ? { 'content-type': selectedFile.type } : undefined,
                    body: selectedFile,
                  });
                  if (!putRes.ok) throw new Error(`PUT failed: ${putRes.status}`);
                  setUploadedFileKey(signed.fileKey);
                  toast.show({ title: 'Загружено', message: 'Файл загружен', variant: 'success' });
                } catch {
                  toast.show({ title: 'Ошибка', message: 'Не удалось загрузить файл', variant: 'error' });
                } finally {
                  setUploading(false);
                }
              }}
              disabled={uploading}
            >
              Загрузить файл
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await createSubmission.mutateAsync({
                    text: submissionText.trim() ? submissionText.trim() : null,
                    link: submissionLink.trim() ? submissionLink.trim() : null,
                    fileKey: uploadedFileKey,
                  });
                  setSubmissionText('');
                  setSubmissionLink('');
                  setSelectedFile(null);
                  setUploadedFileKey(null);
                  await refetchMySubmissions();
                  toast.show({ title: 'Отправлено', message: 'Ответ отправлен', variant: 'success' });
                } catch (e) {
                  toast.show({ title: 'Ошибка', message: 'Не удалось отправить ответ', variant: 'error' });
                }
              }}
              disabled={createSubmission.isPending}
            >
              Отправить ответ
            </Button>

            {myLatest && (
              <Card style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardHeader>
                  <CardTitle style={{ fontSize: 'var(--text-sm)' }}>Ваш последний сабмит</CardTitle>
                  <CardDescription>status: {myLatest.status}</CardDescription>
                </CardHeader>
                <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                  {myLatest.fileKey && (
                    <Button variant="ghost" size="sm" onClick={() => downloadMyFile(myLatest.fileKey as string)}>
                      Скачать файл
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => refetchMySubmissions()}>
                    Обновить статус
                  </Button>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Материал</CardTitle>
          <CardDescription>Markdown (рендер будет улучшен позже).</CardDescription>
        </CardHeader>
        <CardContent>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 'var(--text-sm)',
              color: 'var(--fg)',
              margin: 0,
            }}
          >
            {lesson.contentMarkdown ?? ''}
          </pre>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginTop: 'var(--sp-4)' }}>
            <Button variant="primary" onClick={complete} disabled={completing}>
              Завершить урок
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/course/${lesson.courseId}`)}>
              К курсу
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Назад
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
