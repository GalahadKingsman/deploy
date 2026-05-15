import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal, Skeleton, useToast } from '../shared/ui/index.js';
import { fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';
import { PageScreen } from '../ui/edify/PageScreen.js';
import { formatLessonMeta, truncateMiddle } from '../ui/edify/contentMeta.js';

const ArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

export function ExpertModuleLessonsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { expertId, moduleId } = useParams<{ expertId: string; moduleId: string }>();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId');

  const [items, setItems] = React.useState<ContractsV1.ExpertLessonV1[]>([]);
  const [courseTitle, setCourseTitle] = React.useState('');
  const [moduleTitle, setModuleTitle] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState<ContractsV1.ExpertLessonV1 | null>(null);

  const load = React.useCallback(async () => {
    if (!expertId || !moduleId) return;
    setLoading(true);
    try {
      const lessonsRes = await fetchJson<ContractsV1.ListExpertLessonsResponseV1>({
        path: `/experts/${expertId}/modules/${moduleId}/lessons`,
      });
      setItems(lessonsRes.items ?? []);

      if (courseId) {
        const [courseRes, modsRes] = await Promise.all([
          fetchJson<{ course: ContractsV1.ExpertCourseV1 }>({
            path: `/experts/${expertId}/courses/${courseId}`,
          }).catch(() => null),
          fetchJson<ContractsV1.ListExpertCourseModulesResponseV1>({
            path: `/experts/${expertId}/courses/${courseId}/modules`,
          }).catch(() => null),
        ]);
        setCourseTitle(courseRes?.course?.title ?? '');
        const mod = (modsRes?.items ?? []).find((m) => m.id === moduleId);
        setModuleTitle(mod?.title ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [expertId, moduleId, courseId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!expertId || !moduleId || !title.trim()) return;
    await fetchJson<ContractsV1.ExpertLessonV1>({
      path: `/experts/${expertId}/modules/${moduleId}/lessons`,
      method: 'POST',
      body: { title: title.trim(), contentMarkdown: '' },
    });
    setTitle('');
    await load();
  };

  const deleteLesson = async () => {
    if (!expertId || !moduleId || !confirmDelete) return;
    try {
      await fetchJson<{ ok: true }>({
        path: `/experts/${expertId}/modules/${moduleId}/lessons/${confirmDelete.id}`,
        method: 'DELETE',
      });
      toast.show({ title: 'Урок удалён', variant: 'success' });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.show({ title: 'Не удалось удалить урок', message: e instanceof Error ? e.message : 'Ошибка', variant: 'error' });
    }
  };

  if (!expertId || !moduleId) {
    return (
      <PageScreen>
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Некорректные параметры</div>
        </div>
      </PageScreen>
    );
  }

  const courseCrumb = truncateMiddle(courseTitle || 'Курс', 22);
  const moduleCrumb = truncateMiddle(moduleTitle || 'Модуль', 18);

  return (
    <PageScreen>
      <div className="edify-content-header">
        <div className="edify-eyebrow">EDIT · LESSONS</div>
        <nav className="edify-breadcrumb" aria-label="Навигация">
          {courseId ? (
            <>
              <button type="button" className="edify-breadcrumb__link" onClick={() => navigate(`/expert/${expertId}/courses/${courseId}/modules`)}>
                {courseCrumb}
              </button>
              <span className="edify-breadcrumb__sep">›</span>
              <span>{moduleCrumb}</span>
            </>
          ) : (
            <button type="button" className="edify-breadcrumb__link" onClick={() => navigate(-1)}>
              Назад
            </button>
          )}
        </nav>
        <h1 className="edify-h edify-h--lg">Уроки</h1>
        <p className="edify-subtitle" style={{ marginTop: 8 }}>
          Markdown-редактор и материалы к уроку.
        </p>
      </div>

      <div className="edify-composer">
        <input
          type="text"
          className="edify-composer__input"
          placeholder="Название нового урока"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim()) void create();
          }}
        />
        <button type="button" className="edify-composer__submit" onClick={() => void create()} disabled={!title.trim()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Добавить
        </button>
      </div>

      {!loading && items.length > 0 ? (
        <div className="edify-section-header">
          <h2 className="edify-section-title">Всего уроков</h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            {String(items.length).padStart(2, '0')}
          </span>
        </div>
      ) : null}

      {loading ? (
        <>
          <Skeleton width="100%" height={72} radius="lg" style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={72} radius="lg" />
        </>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div className="edify-empty-panel__title">Уроков пока нет</div>
          <p className="edify-empty-panel__text">Добавьте первый урок — текст, видео или презентацию.</p>
        </div>
      ) : null}

      {!loading
        ? items.map((l, index) => {
            const metaParts = formatLessonMeta(l);
            return (
              <div key={l.id} className="edify-item-row edify-item-row--static">
                <span className="edify-item-num">{String(index + 1).padStart(2, '0')}</span>
                <div className="edify-item-content">
                  <div className="edify-item-title">{l.title}</div>
                  <div className="edify-item-meta">
                    {metaParts.length > 0 ? <span className="edify-item-meta-tag">{metaParts[0]}</span> : null}
                    {metaParts.slice(1).map((part) => (
                      <React.Fragment key={part}>
                        <span className="edify-item-meta-dot" />
                        <span>{part}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <Link to={`/expert/${expertId}/modules/${moduleId}/lessons/${l.id}`} className="edify-item-link">
                  Открыть
                  <ArrowIcon />
                </Link>
                <button type="button" className="edify-item-trash" aria-label="Удалить урок" onClick={() => setConfirmDelete(l)}>
                  <TrashIcon />
                </button>
              </div>
            );
          })
        : null}

      <Modal isOpen={confirmDelete != null} onClose={() => setConfirmDelete(null)} title="Удалить урок?">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Урок <strong style={{ color: 'var(--fg)' }}>{confirmDelete?.title ?? ''}</strong> будет скрыт у студентов.
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="edify-composer__submit" style={{ background: 'var(--surface-1)', color: 'var(--fg)', borderColor: 'var(--hairline)' }} onClick={() => setConfirmDelete(null)}>
              Отмена
            </button>
            <button type="button" className="edify-composer__submit" style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--danger)', borderColor: 'rgba(255,92,92,0.3)' }} onClick={() => void deleteLesson()}>
              Удалить
            </button>
          </div>
        </div>
      </Modal>
    </PageScreen>
  );
}
