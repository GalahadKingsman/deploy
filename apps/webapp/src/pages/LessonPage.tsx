import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Skeleton, useToast } from '../shared/ui/index.js';
import { useLesson } from '../shared/queries/useLesson.js';
import { useLessonAssignment } from '../shared/queries/useLessonAssignment.js';
import { useMyLessonSubmissions } from '../shared/queries/useMyLessonSubmissions.js';
import { useCourse } from '../shared/queries/useCourse.js';
import { downloadAuthenticatedFile, downloadFileFromUrl, fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';
import { buildUrl } from '../shared/api/url.js';
import { config } from '../shared/config/flags.js';
import { normalizeRutubeEmbedUrl } from '@tracked/shared';
import { BottomSheet } from '../ui/kit/BottomSheet.js';
import { renderTextWithLinks } from '../shared/lib/renderTextWithLinks.js';
import { ApiClientError } from '../shared/api/errors.js';
import { PageScreen } from '../ui/edify/PageScreen.js';
import { truncateMiddle } from '../ui/edify/contentMeta.js';

const STAR_GOLD = '#d4c090';
const STAR_GOLD_DIM = 'rgba(212, 192, 144, 0.28)';

function lessonVideoEmbed(lesson: ContractsV1.LessonV1): string | null {
  const v = lesson.video;
  if (!v || v.kind === 'none') return null;
  if (v.kind === 'rutube') {
    const raw = (v.url as string) ?? '';
    return normalizeRutubeEmbedUrl(raw) ?? raw;
  }
  if (v.kind === 'youtube' && v.youtubeId) {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtubeId)}`;
  }
  return null;
}

function HomeworkScoreStars({ score }: { score: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <div className="edify-hw-stars" role="img" aria-label={`Оценка ${filled} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= filled ? STAR_GOLD : STAR_GOLD_DIM }}>
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
    <div className="edify-hw-card">
      <div className="edify-hw-card__head">
        <div className="edify-hw-card__label">Ваш ответ</div>
        {showStars ? <HomeworkScoreStars score={numericScore} /> : null}
      </div>
      {submission.text ? (
        <div className="edify-hw-block edify-hw-block--answer">
          <div className="edify-hw-block__label">Текст ответа</div>
          <div className="edify-hw-block__body">{renderTextWithLinks(submission.text, { wordBreak: 'break-all' })}</div>
        </div>
      ) : null}
      {comment ? (
        <div className="edify-hw-block edify-hw-block--review">
          <div className="edify-hw-block__label">Комментарий эксперта</div>
          <div className="edify-hw-block__body">{renderTextWithLinks(comment, { wordBreak: 'break-all' })}</div>
        </div>
      ) : null}
      {allowEditHomework ? (
        <button type="button" className="edify-btn-primary-outline" onClick={onEditHomework}>
          Изменить ответ
        </button>
      ) : null}
    </div>
  );
}

const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

function FileDownloadRow({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button type="button" className="edify-file-row" onClick={onClick}>
      <span className="edify-file-row__icon">
        <FileIcon />
      </span>
      <span className="edify-file-row__name">{name}</span>
    </button>
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
  const [lessonMaterials, setLessonMaterials] = React.useState<ContractsV1.LessonMaterialFileV1[]>([]);
  const [lessonMaterialsLoading, setLessonMaterialsLoading] = React.useState(false);

  const courseId = data?.lesson?.courseId ?? '';
  const { data: courseData } = useCourse(courseId);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!id) return;
      setLessonMaterialsLoading(true);
      try {
        const m = await fetchJson<ContractsV1.ListLessonMaterialsResponseV1>({
          path: `/lessons/${id}/materials`,
        });
        if (cancelled) return;
        setLessonMaterials(m.items ?? []);
      } catch {
        if (!cancelled) setLessonMaterials([]);
      } finally {
        if (!cancelled) setLessonMaterialsLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const downloadLessonMaterial = async (key: string, filename: string) => {
    try {
      const signed = await fetchJson<{ url: string }>({
        path: `/files/signed`,
        query: { key },
      });
      const apiBase =
        config.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
      const raw = (signed.url ?? '').trim();
      if (!raw) throw new Error('empty signed url');
      const base = raw.startsWith('http://') || raw.startsWith('https://') ? raw : buildUrl(apiBase, raw);
      const url = base + (base.includes('?') ? '&' : '?') + 'dl=1';
      await downloadFileFromUrl({ url, fallbackFilename: filename || 'file' });
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось скачать файл', variant: 'error' });
    }
  };

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
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось отметить урок', variant: 'error' });
    } finally {
      setCompleting(false);
    }
  };

  if (!id) {
    return (
      <PageScreen>
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Некорректный id урока</div>
        </div>
      </PageScreen>
    );
  }

  if (isLoading) {
    return (
      <PageScreen>
        <Skeleton width="70%" height={32} style={{ marginBottom: 'var(--sp-5)' }} />
        <Skeleton width="100%" height={200} radius="lg" style={{ marginBottom: 'var(--sp-4)' }} />
        <Skeleton width="100%" height={120} radius="lg" />
      </PageScreen>
    );
  }

  if (error || !data) {
    const locked = error instanceof ApiClientError && error.status === 403;
    return (
      <PageScreen>
        <div className="edify-content-header">
          <h1 className="edify-h edify-h--md">{locked ? 'Урок пока закрыт' : 'Не удалось загрузить урок'}</h1>
          <p className="edify-subtitle" style={{ marginTop: 8 }}>
            {locked
              ? 'Доступ появится после проверки домашнего задания или завершения предыдущего урока.'
              : 'Попробуйте ещё раз'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" className="edify-btn-solid" onClick={() => void refetch()}>
            Повторить
          </button>
          {locked ? (
            <button type="button" className="edify-btn-primary-outline" onClick={() => navigate('/learn')}>
              В обучение
            </button>
          ) : null}
        </div>
      </PageScreen>
    );
  }

  const lesson = data.lesson;
  const videoEmbed = lessonVideoEmbed(lesson);
  const assignment = assignmentData?.assignment ?? null;
  const assignmentFiles = assignmentData?.files ?? [];
  const myLatest = (mySubmissionsData?.items ?? [])[0] ?? null;
  const homeworkLockedAfterAccept = myLatest?.status === 'accepted';
  const courseTitle = courseData?.course?.title ?? '';

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
      const url = buildUrl(baseUrl, `/lessons/${id}/assignment/files/${encodeURIComponent(fileId)}/download`);
      await downloadAuthenticatedFile({ url, fallbackFilename });
    } catch {
      toast.show({ title: 'Ошибка', message: 'Не удалось скачать файл', variant: 'error' });
    }
  };

  const contentText = (lesson.contentMarkdown ?? '').trim();

  return (
    <PageScreen>
      <div className="edify-content-header">
        <div className="edify-eyebrow">LEARN</div>
        <nav className="edify-breadcrumb" aria-label="Навигация">
          <button type="button" className="edify-breadcrumb__link" onClick={() => navigate(`/course/${lesson.courseId}`)}>
            {truncateMiddle(courseTitle || 'Курс', 28)}
          </button>
        </nav>
        <h1 className="edify-h edify-h--lg">{lesson.title}</h1>
      </div>

      {videoEmbed ? (
        <section className="edify-lesson-video" aria-label="Видео урока">
          <div className="edify-lesson-video__inner">
            <iframe src={videoEmbed} title="Видео урока" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          </div>
        </section>
      ) : null}

      {!lessonMaterialsLoading && lessonMaterials.length > 0 ? (
        <section className="edify-lesson-panel">
          <h2 className="edify-lesson-panel__title">Материалы к уроку</h2>
          <p className="edify-lesson-panel__sub">Файлы от эксперта — скачайте на устройство.</p>
          {lessonMaterials.map((f) => (
            <FileDownloadRow
              key={`${f.id}:${f.fileKey}`}
              name={f.filename}
              onClick={() => void downloadLessonMaterial(f.fileKey, f.filename)}
            />
          ))}
        </section>
      ) : null}

      <section className="edify-lesson-panel">
        <h2 className="edify-lesson-panel__title">Материал</h2>
        {contentText ? (
          <div className="edify-lesson-prose">{renderTextWithLinks(contentText, { wordBreak: 'break-all' })}</div>
        ) : (
          <p className="edify-lesson-panel__sub">Текст урока пока не добавлен.</p>
        )}
        <div className="edify-lesson-actions">
          <button type="button" className="edify-btn-solid" onClick={() => void complete()} disabled={completing}>
            {completing ? 'Сохранение…' : 'Завершить урок'}
          </button>
          <button type="button" className="edify-btn-primary-outline" onClick={() => navigate(`/course/${lesson.courseId}`)}>
            К курсу
          </button>
        </div>
      </section>

      {showHomeworkSection ? (
        <section className="edify-lesson-panel">
          <h2 className="edify-lesson-panel__title">Домашнее задание</h2>
          <p className="edify-lesson-panel__sub">Прочитайте задание, скачайте материалы и сдайте ответ.</p>

          {assignmentQuery.isPending ? <Skeleton width="100%" height={72} radius="lg" /> : null}

          {assignmentQuery.isError ? (
            <>
              <p className="edify-lesson-panel__sub">Не удалось загрузить задание. Проверьте сеть.</p>
              <button type="button" className="edify-btn-primary-outline" onClick={() => void assignmentQuery.refetch()}>
                Повторить
              </button>
            </>
          ) : null}

          {publishedHomework ? (
            <>
              {hasHomeworkText ? (
                <div className="edify-lesson-prose" style={{ marginBottom: 'var(--sp-4)' }}>
                  {renderTextWithLinks(homeworkText, { wordBreak: 'break-all' })}
                </div>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--sp-3)' }}>
                {hasHomeworkFiles ? (
                  <button
                    type="button"
                    className="edify-btn-primary-outline"
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
                  </button>
                ) : null}
                {!myLatest ? (
                  <button type="button" className="edify-btn-solid" onClick={() => navigate(`/lesson/${id}/homework`)}>
                    Сдать домашнее задание
                  </button>
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
        </section>
      ) : null}

      <BottomSheet open={materialsOpen} onClose={() => setMaterialsOpen(false)} title="Материалы к заданию">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {assignmentFiles.map((f) => (
            <FileDownloadRow
              key={`${f.id}:${f.fileKey}`}
              name={f.filename}
              onClick={async () => {
                await downloadAssignmentMaterial(f.id, f.filename);
                setMaterialsOpen(false);
              }}
            />
          ))}
        </div>
      </BottomSheet>
    </PageScreen>
  );
}
