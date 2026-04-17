import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Skeleton, useToast } from '../shared/ui/index.js';
import { useLesson } from '../shared/queries/useLesson.js';
import { useLessonAssignment } from '../shared/queries/useLessonAssignment.js';
import { useMyLessonSubmissions } from '../shared/queries/useMyLessonSubmissions.js';
import { fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';
import { buildUrl } from '../shared/api/url.js';
import { config } from '../shared/config/flags.js';
import { normalizeRutubeEmbedUrl } from '@tracked/shared';
import { downloadAuthenticatedFile } from '../shared/api/index.js';
import { BottomSheet } from '../ui/kit/BottomSheet.js';

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const id = lessonId ?? '';
  const { data, isLoading, error, refetch } = useLesson(id);
  const assignmentQuery = useLessonAssignment(id);
  const assignmentData = assignmentQuery.data;
  const { data: mySubmissionsData, refetch: refetchMySubmissions } = useMyLessonSubmissions(id);
  const [completing, setCompleting] = React.useState(false);
  const [materialsOpen, setMaterialsOpen] = React.useState(false);

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
  const assignmentFiles = assignmentData?.files ?? [];
  const myLatest = (mySubmissionsData?.items ?? [])[0] ?? null;

  const homeworkText = (assignment?.promptMarkdown ?? '').trim();
  const hasHomeworkText = homeworkText.length > 0;
  const hasHomeworkFiles = assignmentFiles.length > 0;
  const publishedHomework =
    assignmentQuery.isSuccess && !!assignment && (hasHomeworkText || hasHomeworkFiles);
  const showHomeworkSection =
    assignmentQuery.isPending ||
    assignmentQuery.isError ||
    publishedHomework ||
    (assignmentQuery.isSuccess && !!myLatest);

  const downloadMyFile = async (fileKey: string, fallbackFilename: string) => {
    try {
      const baseUrl =
        config.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
      const url = buildUrl(baseUrl, `/files`, { key: fileKey });
      await downloadAuthenticatedFile({ url, fallbackFilename });
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось скачать файл', variant: 'error' });
    }
  };

  const downloadAssignmentMaterial = async (fileId: string, fallbackFilename: string) => {
    try {
      const baseUrl =
        config.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
      const url = buildUrl(
        baseUrl,
        `/lessons/${id}/assignment/files/${encodeURIComponent(fileId)}/download`,
      );
      await downloadAuthenticatedFile({ url, fallbackFilename });
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

      {showHomeworkSection && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 'var(--text-md)' }}>Домашнее задание</CardTitle>
            <CardDescription>Прочитайте задание, скачайте материалы и сдайте ответ.</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {assignmentQuery.isPending ? (
              <Skeleton width="100%" height="72px" radius="md" />
            ) : assignmentQuery.isError ? (
              <>
                <CardDescription style={{ margin: 0 }}>
                  Не удалось загрузить домашнее задание. Проверьте сеть и попробуйте снова.
                </CardDescription>
                <Button variant="secondary" onClick={() => void assignmentQuery.refetch()}>
                  Повторить
                </Button>
              </>
            ) : publishedHomework ? (
              <>
                {hasHomeworkText && (
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
                    {homeworkText}
                  </pre>
                )}

                <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                  {hasHomeworkFiles && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (assignmentFiles.length === 1) {
                          const f0 = assignmentFiles[0];
                          void downloadAssignmentMaterial(f0.id, f0.filename);
                          return;
                        }
                        setMaterialsOpen(true);
                      }}
                    >
                      {assignmentFiles.length === 1 ? 'Скачать презентацию' : `Материалы (${assignmentFiles.length})`}
                    </Button>
                  )}
                  <Button variant="primary" onClick={() => navigate(`/lesson/${id}/homework`)}>
                    Сдать домашнее задание
                  </Button>
                </div>

                {myLatest && (
                  <Card style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <CardHeader>
                      <CardTitle style={{ fontSize: 'var(--text-sm)' }}>Ваш ответ</CardTitle>
                      <CardDescription>
                        статус: {myLatest.status}
                        {typeof myLatest.score === 'number' ? ` • оценка: ${myLatest.score}/5` : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      {myLatest.text && (
                        <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 'var(--text-sm)' }}>{myLatest.text}</pre>
                      )}
                      {myLatest.reviewerComment && (
                        <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-sm)' }}>
                          Комментарий: {myLatest.reviewerComment}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                        {myLatest.fileKey && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void downloadMyFile(myLatest.fileKey as string, myLatest.fileKey?.split('/').pop() ?? 'file')
                            }
                          >
                            Скачать файл
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => refetchMySubmissions()}>
                          Обновить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : myLatest ? (
              <Card style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardHeader>
                  <CardTitle style={{ fontSize: 'var(--text-sm)' }}>Ваш ответ</CardTitle>
                  <CardDescription>
                    статус: {myLatest.status}
                    {typeof myLatest.score === 'number' ? ` • оценка: ${myLatest.score}/5` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {myLatest.text && (
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 'var(--text-sm)' }}>{myLatest.text}</pre>
                  )}
                  {myLatest.reviewerComment && (
                    <div style={{ color: 'var(--muted-fg)', fontSize: 'var(--text-sm)' }}>
                      Комментарий: {myLatest.reviewerComment}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                    {myLatest.fileKey && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void downloadMyFile(
                            myLatest.fileKey as string,
                            myLatest.fileKey?.split('/').pop() ?? 'file',
                          )
                        }
                      >
                        Скачать файл
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => refetchMySubmissions()}>
                      Обновить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>
      )}

      <BottomSheet open={materialsOpen} onClose={() => setMaterialsOpen(false)} title="Материалы">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {assignmentFiles.map((f) => (
            <Button
              key={`${f.id}:${f.fileKey}`}
              variant="secondary"
              onClick={async () => {
                await downloadAssignmentMaterial(f.id, f.filename);
                setMaterialsOpen(false);
              }}
            >
              Скачать: {f.filename}
            </Button>
          ))}
        </div>
      </BottomSheet>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Материал</CardTitle>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
