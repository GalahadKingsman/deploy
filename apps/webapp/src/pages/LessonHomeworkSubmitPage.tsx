import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Skeleton, useToast } from '../shared/ui/index.js';
import { useLesson } from '../shared/queries/useLesson.js';
import { useCreateLessonSubmission } from '../shared/queries/useCreateLessonSubmission.js';
import { useMyLessonSubmissions } from '../shared/queries/useMyLessonSubmissions.js';
import { fetchMultipart } from '../shared/api/index.js';
import { ApiClientError } from '../shared/api/errors.js';
import type { ContractsV1 } from '@tracked/shared';
import { PageScreen } from '../ui/edify/PageScreen.js';
import { truncateMiddle } from '../ui/edify/contentMeta.js';

function labelFromSubmissionFileKey(key: string): string {
  const tail = key.includes('/') ? key.slice(key.lastIndexOf('/') + 1) : key;
  const withoutTs = tail.replace(/^\d+-/, '');
  return (withoutTs || tail || 'файл').trim() || 'файл';
}

function HomeworkScreenShell({
  title,
  subtitle,
  lessonTitle,
  lessonId,
  children,
}: {
  title: string;
  subtitle?: string;
  lessonTitle?: string;
  lessonId?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <PageScreen>
      <div className="edify-content-header">
        <div className="edify-eyebrow">HOMEWORK</div>
        {lessonId ? (
          <nav className="edify-breadcrumb" aria-label="Навигация">
            <button type="button" className="edify-breadcrumb__link" onClick={() => navigate(`/lesson/${lessonId}`)}>
              {truncateMiddle(lessonTitle || 'Урок', 28)}
            </button>
          </nav>
        ) : null}
        <h1 className="edify-h edify-h--lg">{title}</h1>
        {subtitle ? <p className="edify-subtitle" style={{ marginTop: 8 }}>{subtitle}</p> : null}
      </div>
      {children}
    </PageScreen>
  );
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
      <HomeworkScreenShell title="Домашнее задание" subtitle="Некорректный id урока">
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Не удалось открыть форму</div>
        </div>
      </HomeworkScreenShell>
    );
  }

  if (isLoading || !mySubsFetched) {
    return (
      <PageScreen>
        <Skeleton width="70%" height={32} style={{ marginBottom: 'var(--sp-5)' }} />
        <Skeleton width="100%" height={200} radius="lg" />
      </PageScreen>
    );
  }

  if (error || !data) {
    return (
      <HomeworkScreenShell title="Не удалось загрузить урок" subtitle="Попробуйте ещё раз">
        <button type="button" className="edify-btn-solid" onClick={() => void refetch()}>
          Повторить
        </button>
      </HomeworkScreenShell>
    );
  }

  const latestSubmission = mySubsData?.items?.[0] ?? null;
  const lesson = data.lesson;

  if (latestSubmission?.status === 'accepted') {
    return (
      <HomeworkScreenShell
        title="Редактирование недоступно"
        subtitle="Эксперт уже принял ваш ответ. Отправленные материалы больше нельзя изменить."
        lessonTitle={lesson.title}
        lessonId={id}
      >
        <button type="button" className="edify-btn-solid" onClick={() => navigate(`/lesson/${id}`, { replace: true })}>
          К уроку
        </button>
      </HomeworkScreenShell>
    );
  }

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
        setSaving(false);
        return;
      }
      setSaving(false);
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

  const attachedName = uploadedFileKey
    ? labelFromSubmissionFileKey(uploadedFileKey)
    : selectedFile?.name ?? null;

  return (
    <HomeworkScreenShell
      title={isEditing ? 'Изменить ответ' : 'Сдать домашнее задание'}
      subtitle={
        isEditing
          ? 'Измените текст и при необходимости замените или удалите файл.'
          : 'Добавьте текст ответа и при необходимости прикрепите файл.'
      }
      lessonTitle={lesson.title}
      lessonId={id}
    >
      <section className="edify-lesson-panel" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
        <h2 className="edify-lesson-panel__title">Ваш ответ</h2>

        <div className="edify-hw-form">
          <textarea
            className="edify-hw-form__textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Текст ответа"
          />

          <div className="edify-hw-form__file-wrap">
            <input
              type="file"
              className="edify-hw-form__file-input"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setSelectedFile(f);
                setUploadedFileKey(null);
              }}
            />
          </div>

          {attachedName ? (
            <div className="edify-hw-form__attached">
              <span className="edify-hw-form__attached-name" title={attachedName}>
                {attachedName}
              </span>
              <button
                type="button"
                className="edify-item-link"
                style={{ padding: '4px 0' }}
                onClick={() => {
                  setUploadedFileKey(null);
                  setSelectedFile(null);
                }}
              >
                Удалить
              </button>
            </div>
          ) : null}

          <div className="edify-hw-form__actions">
            <button
              type="button"
              className="edify-btn-primary-outline"
              onClick={() => void upload()}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Загрузка…' : uploadedFileKey ? 'Заменить файл' : 'Загрузить файл'}
            </button>
            <button
              type="button"
              className="edify-btn-solid"
              onClick={() => void save()}
              disabled={createSubmission.isPending || saving}
            >
              {createSubmission.isPending || saving ? 'Отправка…' : isEditing ? 'Сохранить изменения' : 'Отправить'}
            </button>
            <button type="button" className="edify-btn-primary-outline" onClick={() => navigate(`/lesson/${id}`)}>
              Отмена
            </button>
          </div>
        </div>
      </section>
    </HomeworkScreenShell>
  );
}
