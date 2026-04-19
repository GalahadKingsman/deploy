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
import { renderTextWithLinks } from '../shared/lib/renderTextWithLinks.js';
import { ApiClientError } from '../shared/api/errors.js';

const STAR_GOLD = '#d4c090';
const STAR_GOLD_DIM = 'rgba(212, 192, 144, 0.28)';

/** Emerald accents for student answer card (pairs with pale gold expert block). */
const EMERALD_LABEL = 'rgba(120, 214, 190, 0.95)';
const EMERALD_BORDER = 'rgba(100, 190, 165, 0.42)';

function HomeworkScoreStars({ score }: { score: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <div
      role="img"
      aria-label={`Оценка ${filled} из 5`}
      style={{ display: 'flex', gap: '3px', flexShrink: 0, lineHeight: 1 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            fontSize: '1.15rem',
            color: i <= filled ? STAR_GOLD : STAR_GOLD_DIM,
            textShadow: i <= filled ? '0 0 12px rgba(212, 192, 144, 0.35)' : 'none',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function StudentHomeworkAnswerCard({
  submission,
  onEditHomework,
  allowEditHomework,
}: {
  submission: ContractsV1.SubmissionV1;
  onEditHomework: () => void;
  allowEditHomework: boolean;
}) {
  const numericScore = typeof submission.score === 'number' ? submission.score : null;
  const showStars = numericScore != null && numericScore >= 1 && numericScore <= 5;
  const comment = (submission.reviewerComment ?? '').trim();

  return (
    <Card style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', minWidth: 0, maxWidth: '100%' }}>
      <CardHeader style={{ paddingBottom: 'var(--sp-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
          <CardTitle style={{ fontSize: 'var(--text-sm)', margin: 0 }}>Ваш ответ</CardTitle>
          {showStars ? <HomeworkScoreStars score={numericScore} /> : null}
        </div>
      </CardHeader>
      <CardContent
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)',
          minWidth: 0,
        }}
      >
        {submission.text ? (
          <div
            style={{
              borderRadius: 'var(--r-md)',
              border: `1px solid ${EMERALD_BORDER}`,
              background:
                'linear-gradient(145deg, rgba(72, 160, 130, 0.16) 0%, rgba(255, 255, 255, 0.035) 52%, rgba(12, 36, 32, 0.42) 100%)',
              padding: 'var(--sp-3)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: EMERALD_LABEL,
                marginBottom: 'var(--sp-2)',
              }}
            >
              Текст ответа
            </div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--fg)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.55,
                margin: 0,
                fontFamily: 'inherit',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                minWidth: 0,
              }}
            >
              {renderTextWithLinks(submission.text, { wordBreak: 'break-all' })}
            </div>
          </div>
        ) : null}
        {comment ? (
          <div
            style={{
              borderRadius: 'var(--r-md)',
              border: '1px solid rgba(212, 192, 144, 0.38)',
              background: 'linear-gradient(145deg, rgba(212, 192, 144, 0.14) 0%, rgba(255, 255, 255, 0.04) 55%, rgba(20, 24, 32, 0.35) 100%)',
              padding: 'var(--sp-3)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'rgba(212, 192, 144, 0.95)',
                marginBottom: 'var(--sp-2)',
              }}
            >
              Комментарий эксперта
            </div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--fg)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.55,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                minWidth: 0,
              }}
            >
              {renderTextWithLinks(submission.reviewerComment ?? '', { wordBreak: 'break-all' })}
            </div>
          </div>
        ) : null}
        {allowEditHomework ? (
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" onClick={onEditHomework}>
              Изменить ответ
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const id = lessonId ?? '';
  const { data, isLoading, error, refetch } = useLesson(id);
  const assignmentQuery = useLessonAssignment(id);
  const assignmentData = assignmentQuery.data;
  const { data: mySubmissionsData } = useMyLessonSubmissions(id);
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
    const locked = error instanceof ApiClientError && error.status === 403;
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>{locked ? 'Урок пока закрыт' : 'Не удалось загрузить урок'}</CardTitle>
            <CardDescription>
              {locked
                ? 'Доступ появится после проверки домашнего задания экспертом или после завершения предыдущего урока.'
                : 'Попробуйте ещё раз'}
            </CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => refetch()}>
              Повторить
            </Button>
            {locked ? (
              <Button variant="secondary" onClick={() => navigate('/learn')}>
                В обучение
              </Button>
            ) : null}
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
  const homeworkLockedAfterAccept = myLatest?.status === 'accepted';

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
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--fg)',
                      margin: 0,
                    }}
                  >
                    {renderTextWithLinks(homeworkText, { wordBreak: 'break-all' })}
                  </div>
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
                  {!myLatest ? (
                    <Button variant="primary" onClick={() => navigate(`/lesson/${id}/homework`)}>
                      Сдать домашнее задание
                    </Button>
                  ) : null}
                </div>

                {myLatest ? (
                  <StudentHomeworkAnswerCard
                    submission={myLatest}
                    onEditHomework={() => navigate(`/lesson/${id}/homework`)}
                    allowEditHomework={!homeworkLockedAfterAccept}
                  />
                ) : null}
              </>
            ) : myLatest ? (
              <StudentHomeworkAnswerCard
                submission={myLatest}
                onEditHomework={() => navigate(`/lesson/${id}/homework`)}
                allowEditHomework={!homeworkLockedAfterAccept}
              />
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
          <div
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 'var(--text-sm)',
              color: 'var(--fg)',
              margin: 0,
            }}
          >
            {renderTextWithLinks(lesson.contentMarkdown ?? '', { wordBreak: 'break-all' })}
          </div>
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
