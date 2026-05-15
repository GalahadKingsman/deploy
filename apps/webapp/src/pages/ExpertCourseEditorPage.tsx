import React from 'react';
import { useParams } from 'react-router-dom';
import { Skeleton, useToast } from '../shared/ui/index.js';
import { fetchJson, fetchMultipart } from '../shared/api/index.js';
import { ContractsV1 } from '@tracked/shared';
import { useTopics, useCourseTopics, useSetCourseTopics } from '../shared/queries/useTopics.js';
import { ApiClientError } from '../shared/api/errors.js';
import { PageScreen } from '../ui/edify/PageScreen.js';
import { FormField, FormInput, FormSelect, FormTextarea } from '../ui/edify/FormField.js';
import { ExpertListRow } from '../ui/edify/ExpertListRow.js';

const ModulesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const AccessIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

function parseEstimatedCompletionHoursInput(
  raw: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const s = raw.trim();
  if (!s) return { ok: true, value: null };
  if (!/^\d+$/.test(s)) {
    return { ok: false, message: 'Только целые цифры, без пробелов и букв.' };
  }
  if (s.length > 1 && s.startsWith('0')) {
    return { ok: false, message: 'Число не должно начинаться с 0.' };
  }
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1 || n > 8760) {
    return { ok: false, message: 'Укажите от 1 до 8760 часов.' };
  }
  return { ok: true, value: n };
}

export function ExpertCourseEditorPage() {
  const toast = useToast();
  const { expertId, courseId } = useParams<{ expertId: string; courseId: string }>();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [visibility, setVisibility] = React.useState<'private' | 'public'>('private');
  const [lessonAccessMode, setLessonAccessMode] = React.useState<'sequential' | 'open'>('sequential');
  const [coverUrl, setCoverUrl] = React.useState<string>('');
  const [authorDisplayName, setAuthorDisplayName] = React.useState('');
  const [enrollmentContactUrl, setEnrollmentContactUrl] = React.useState('');
  const [estimatedCompletionHours, setEstimatedCompletionHours] = React.useState('');
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
  const [customTopicTitle, setCustomTopicTitle] = React.useState('');
  const [customTopicSaving, setCustomTopicSaving] = React.useState(false);
  const [extraTopics, setExtraTopics] = React.useState<ContractsV1.TopicV1[]>([]);

  React.useEffect(() => {
    const ids = new Set((courseTopicsData?.items ?? []).map((t) => t.id));
    setSelectedTopicIds(ids);
  }, [courseTopicsData]);

  React.useEffect(() => {
    setExtraTopics([]);
  }, [expertId, courseId]);

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
        setVisibility((c.visibility ?? 'private') === 'public' ? 'public' : 'private');
        setLessonAccessMode(c.lessonAccessMode === 'open' ? 'open' : 'sequential');
        setCoverUrl((c.coverUrl ?? '') || '');
        setAuthorDisplayName((c.authorDisplayName ?? '').trim());
        setEnrollmentContactUrl((c.enrollmentContactUrl ?? '').trim());
        const h = c.estimatedCompletionHours;
        setEstimatedCompletionHours(
          typeof h === 'number' && Number.isFinite(h) && h >= 1 ? String(Math.trunc(h)) : '',
        );
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
    const encUrl = enrollmentContactUrl.trim();
    if (encUrl && !ContractsV1.isEnrollmentContactUrlAllowed(encUrl)) {
      toast.show({
        title: 'Проверьте ссылку',
        message: 'Нужен полный адрес: http(s), tg: или mailto:, не длиннее 2048 символов.',
        variant: 'error',
      });
      return;
    }
    const hoursParsed = parseEstimatedCompletionHoursInput(estimatedCompletionHours);
    if (!hoursParsed.ok) {
      toast.show({
        title: 'Время прохождения',
        message: hoursParsed.message,
        variant: 'error',
      });
      return;
    }
    setSaving(true);
    try {
      const updated = await fetchJson<ContractsV1.ExpertCourseV1>({
        path: `/experts/${expertId}/courses/${courseId}`,
        method: 'PATCH',
        body: {
          title,
          description: description.trim() ? description.trim() : null,
          visibility,
          coverUrl: coverUrl.trim() ? coverUrl.trim() : null,
          lessonAccessMode,
          authorDisplayName: authorDisplayName.trim() ? authorDisplayName.trim() : null,
          enrollmentContactUrl: encUrl ? encUrl : null,
          estimatedCompletionHours: hoursParsed.value,
        },
      });
      setCourse(updated);
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

  const publish = async () => {
    if (!expertId || !courseId) return;
    const updated = await fetchJson<ContractsV1.ExpertCourseV1>({
      path: `/experts/${expertId}/courses/${courseId}/publish`,
      method: 'POST',
    });
    setCourse(updated);
    toast.show({ title: 'Опубликовано', variant: 'success' });
  };

  const unpublish = async () => {
    if (!expertId || !courseId) return;
    const updated = await fetchJson<ContractsV1.ExpertCourseV1>({
      path: `/experts/${expertId}/courses/${courseId}/unpublish`,
      method: 'POST',
    });
    setCourse(updated);
    toast.show({ title: 'Снято с публикации', variant: 'success' });
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
    return (
      <PageScreen>
        <div className="edify-brand" aria-hidden="true" />
        <Skeleton width="60%" height={32} radius="lg" style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={280} radius="lg" />
      </PageScreen>
    );
  }

  if (!course || !expertId || !courseId) {
    return (
      <PageScreen>
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Курс не найден</div>
        </div>
      </PageScreen>
    );
  }

  const allTopics = [...(allTopicsData?.items ?? []), ...extraTopics];

  return (
    <PageScreen>
      <div className="edify-brand" aria-hidden="true" />

      <div className="edify-content-header">
        <div className="edify-eyebrow">EXPERT · EDIT</div>
        <h1 className="edify-h edify-h--lg">Редактор курса</h1>
        <p className="edify-subtitle" style={{ marginTop: 8 }}>
          Статус: {course.status} • {course.visibility}
        </p>
      </div>

      <div className="edify-panel">
        <div className="edify-panel__body">
          <FormField label="Название">
            <FormInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>

          <FormField label="Описание">
            <FormTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Коротко опишите, что будет в курсе"
              rows={4}
            />
          </FormField>

          <FormField
            label="Укажите фамилию и имя автора курса"
            hint="Показывается ученикам на странице курса строкой «Автор курса — …»."
          >
            <FormInput
              value={authorDisplayName}
              onChange={(e) => setAuthorDisplayName(e.target.value)}
              placeholder="Например: Иванов Иван"
            />
          </FormField>

          <FormField
            label="Куда студенту написать для зачисления? (ссылка)"
            hint="Откроется по кнопке «Записаться» в карточке курса. Разрешены http(s), tg: и mailto:."
          >
            <FormInput
              value={enrollmentContactUrl}
              onChange={(e) => setEnrollmentContactUrl(e.target.value)}
              placeholder="https://t.me/… или tg:resolve?domain=…"
            />
          </FormField>

          <FormField
            label="Укажите время прохождения курса в часах"
            hint="Только целое число от 1 до 8760, без ведущего нуля. В превью отобразится как «12 ч»."
          >
            <FormInput
              className="edify-field__input--narrow"
              value={estimatedCompletionHours}
              onChange={(e) => setEstimatedCompletionHours(e.target.value)}
              placeholder="Например: 12"
              inputMode="numeric"
            />
          </FormField>

          <FormField label="Обложка (URL, auto)" hint="Поле заполняется автоматически после загрузки файла.">
            <FormInput
              placeholder="/public/course-cover?key=..."
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-3)' }}>
            <FormField label="Видимость">
              <FormSelect
                value={visibility}
                onChange={(e) => setVisibility(e.target.value === 'public' ? 'public' : 'private')}
              >
                <option value="private">private (только по ссылке)</option>
                <option value="public">public (в библиотеке)</option>
              </FormSelect>
            </FormField>
            <FormField label="Доступ к урокам">
              <FormSelect
                value={lessonAccessMode}
                onChange={(e) => setLessonAccessMode(e.target.value === 'open' ? 'open' : 'sequential')}
              >
                <option value="sequential">поочерёдно</option>
                <option value="open">все сразу (кроме скрытых)</option>
              </FormSelect>
            </FormField>
          </div>

          <FormField label="Файл обложки">
            <div className="edify-composer">
              <div
                className="edify-composer__input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: coverFile ? 'var(--fg)' : 'var(--text-muted)',
                  cursor: 'default',
                }}
              >
                {coverFile?.name ?? 'Файл не выбран'}
              </div>
              <label className="edify-composer__submit" style={{ cursor: 'pointer' }}>
                Выбрать
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <button
              type="button"
              className="edify-btn-primary-outline"
              style={{ marginTop: 10 }}
              onClick={() => void uploadCover()}
              disabled={!coverFile || coverUploading}
            >
              {coverUploading ? 'Загрузка…' : 'Загрузить обложку'}
            </button>
          </FormField>
        </div>
      </div>

      <div className="edify-action-stack">
        <button type="button" className="edify-btn-solid" onClick={() => void save()} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        {course.status !== 'published' ? (
          <button type="button" className="edify-btn-primary-outline" onClick={() => void publish()}>
            Опубликовать
          </button>
        ) : (
          <button type="button" className="edify-btn-primary-outline" onClick={() => void unpublish()}>
            Снять с публикации
          </button>
        )}
      </div>

      <nav className="edify-nav-panel" aria-label="Разделы курса">
        <ExpertListRow
          to={`/expert/${expertId}/courses/${courseId}/modules`}
          title="Модули"
          subtitle="Структура курса и уроки"
          icon={<ModulesIcon />}
        />
        <ExpertListRow
          to={`/expert/${expertId}/courses/${courseId}/access`}
          title="Доступ"
          subtitle="Инвайты и зачисления"
          icon={<AccessIcon />}
        />
      </nav>

      <div className="edify-panel">
        <h2 className="edify-panel__title">Темы курса</h2>
        <p className="edify-panel__desc">Мультиселект из справочника тем платформы.</p>
        <div className="edify-panel__body edify-panel__body--tight">
          <div className="edify-composer">
            <input
              type="text"
              className="edify-composer__input"
              placeholder="Например: Маркетинг, Психология…"
              value={customTopicTitle}
              onChange={(e) => setCustomTopicTitle(e.target.value)}
            />
            <button
              type="button"
              className="edify-composer__submit"
              disabled={customTopicSaving || !customTopicTitle.trim()}
              onClick={async () => {
                const topicTitle = customTopicTitle.trim();
                if (!topicTitle) return;
                setCustomTopicSaving(true);
                try {
                  const topic = await fetchJson<ContractsV1.TopicV1>({
                    path: `/experts/${encodeURIComponent(expertId)}/courses/${encodeURIComponent(courseId)}/topics/custom`,
                    method: 'POST',
                    body: { title: topicTitle },
                  });
                  setCustomTopicTitle('');
                  setExtraTopics((prev) => (prev.some((t) => t.id === topic.id) ? prev : [...prev, topic]));
                  setSelectedTopicIds((prev) => new Set([...prev, topic.id]));
                  toast.show({ title: 'Тема добавлена', variant: 'success' });
                } catch (e) {
                  const msg =
                    e instanceof ApiClientError
                      ? `${e.message} (HTTP ${e.status})`
                      : e instanceof Error
                        ? e.message
                        : 'Не удалось добавить тему';
                  toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
                } finally {
                  setCustomTopicSaving(false);
                }
              }}
            >
              Добавить
            </button>
          </div>

          {allTopics.length === 0 ? (
            <p className="edify-field__hint" style={{ margin: 0 }}>
              Темы не загружены.
            </p>
          ) : null}

          {allTopics.map((t) => (
            <label key={t.id} className="edify-topic-check">
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

          <button
            type="button"
            className="edify-btn-primary-outline"
            disabled={setTopics.isPending}
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
          </button>
        </div>
      </div>
    </PageScreen>
  );
}
