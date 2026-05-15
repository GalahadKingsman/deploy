import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Modal, Skeleton, useToast } from '../shared/ui/index.js';
import { fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';
import { PageScreen } from '../ui/edify/PageScreen.js';
import { pluralLessons, truncateMiddle } from '../ui/edify/contentMeta.js';

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

export function ExpertCourseModulesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { expertId, courseId } = useParams<{ expertId: string; courseId: string }>();
  const [items, setItems] = React.useState<ContractsV1.ExpertCourseModuleV1[]>([]);
  const [lessonCounts, setLessonCounts] = React.useState<Record<string, number>>({});
  const [courseTitle, setCourseTitle] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');
  const [editing, setEditing] = React.useState<ContractsV1.ExpertCourseModuleV1 | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState<ContractsV1.ExpertCourseModuleV1 | null>(null);

  const load = React.useCallback(async () => {
    if (!expertId || !courseId) return;
    setLoading(true);
    try {
      const [modsRes, courseRes] = await Promise.all([
        fetchJson<ContractsV1.ListExpertCourseModulesResponseV1>({
          path: `/experts/${expertId}/courses/${courseId}/modules`,
        }),
        fetchJson<{ course: ContractsV1.ExpertCourseV1 }>({
          path: `/experts/${expertId}/courses/${courseId}`,
        }).catch(() => null),
      ]);
      const list = modsRes.items ?? [];
      setItems(list);
      setCourseTitle(courseRes?.course?.title ?? '');

      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async (m) => {
          try {
            const lessonsRes = await fetchJson<ContractsV1.ListExpertLessonsResponseV1>({
              path: `/experts/${expertId}/modules/${m.id}/lessons`,
            });
            counts[m.id] = lessonsRes.items?.length ?? 0;
          } catch {
            counts[m.id] = 0;
          }
        }),
      );
      setLessonCounts(counts);
    } finally {
      setLoading(false);
    }
  }, [expertId, courseId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!expertId || !courseId || !title.trim()) return;
    await fetchJson<ContractsV1.ExpertCourseModuleV1>({
      path: `/experts/${expertId}/courses/${courseId}/modules`,
      method: 'POST',
      body: { title: title.trim() },
    });
    setTitle('');
    await load();
  };

  const openRename = (m: ContractsV1.ExpertCourseModuleV1) => {
    setEditing(m);
    setEditTitle(m.title);
  };

  const saveRename = async () => {
    if (!expertId || !courseId || !editing) return;
    const next = editTitle.trim();
    if (!next) return;
    try {
      await fetchJson<ContractsV1.ExpertCourseModuleV1>({
        path: `/experts/${expertId}/courses/${courseId}/modules/${editing.id}`,
        method: 'PATCH',
        body: { title: next } satisfies ContractsV1.UpdateExpertCourseModuleRequestV1,
      });
      toast.show({ title: 'Модуль обновлён', variant: 'success' });
      setEditing(null);
      await load();
    } catch (e) {
      toast.show({ title: 'Не удалось переименовать', message: e instanceof Error ? e.message : 'Ошибка', variant: 'error' });
    }
  };

  const deleteModule = async () => {
    if (!expertId || !courseId || !confirmDelete) return;
    try {
      await fetchJson<{ ok: true }>({
        path: `/experts/${expertId}/courses/${courseId}/modules/${confirmDelete.id}`,
        method: 'DELETE',
      });
      toast.show({ title: 'Модуль удалён', variant: 'success' });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.show({ title: 'Не удалось удалить', message: e instanceof Error ? e.message : 'Ошибка', variant: 'error' });
    }
  };

  if (!expertId || !courseId) {
    return (
      <PageScreen>
        <div className="edify-empty-panel">
          <div className="edify-empty-panel__title">Некорректные параметры</div>
        </div>
      </PageScreen>
    );
  }

  const courseCrumb = truncateMiddle(courseTitle || 'Курс', 28);

  return (
    <PageScreen>
      <div className="edify-content-header">
        <div className="edify-eyebrow">EDIT · STRUCTURE</div>
        <nav className="edify-breadcrumb" aria-label="Навигация">
          <button type="button" className="edify-breadcrumb__link" onClick={() => navigate(`/expert/${expertId}/courses`)}>
            {courseCrumb}
          </button>
        </nav>
        <h1 className="edify-h edify-h--lg">Модули</h1>
        <p className="edify-subtitle" style={{ marginTop: 8 }}>
          Структура курса. Нажмите на название, чтобы переименовать.
        </p>
      </div>

      <div className="edify-composer">
        <input
          type="text"
          className="edify-composer__input"
          placeholder="Название нового модуля"
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
          <h2 className="edify-section-title">Всего модулей</h2>
          <span className="edify-section-count" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div className="edify-empty-panel__title">Модулей пока нет</div>
          <p className="edify-empty-panel__text">Разбейте курс на логические блоки. В каждом модуле — свои уроки и задания.</p>
        </div>
      ) : null}

      {!loading
        ? items.map((m, index) => {
            const count = lessonCounts[m.id] ?? 0;
            return (
              <div key={m.id} className="edify-item-row edify-item-row--static">
                <span className="edify-item-num">{String(index + 1).padStart(2, '0')}</span>
                <button type="button" className="edify-item-content" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }} onClick={() => openRename(m)}>
                  <div className="edify-item-title">{m.title}</div>
                  <div className="edify-item-meta">
                    <span>{pluralLessons(count)}</span>
                  </div>
                </button>
                <Link to={`/expert/${expertId}/modules/${m.id}/lessons?courseId=${courseId}`} className="edify-item-link">
                  Уроки
                  <ArrowIcon />
                </Link>
                <button type="button" className="edify-item-trash" aria-label="Удалить модуль" onClick={() => setConfirmDelete(m)}>
                  <TrashIcon />
                </button>
              </div>
            );
          })
        : null}

      <Modal isOpen={editing != null} onClose={() => setEditing(null)} title="Переименовать модуль">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <input
            type="text"
            className="edify-composer__input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="edify-composer__submit" style={{ background: 'var(--surface-1)', color: 'var(--fg)', borderColor: 'var(--hairline)' }} onClick={() => setEditing(null)}>
              Отмена
            </button>
            <button type="button" className="edify-composer__submit" onClick={() => void saveRename()} disabled={!editTitle.trim()}>
              Сохранить
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={confirmDelete != null} onClose={() => setConfirmDelete(null)} title="Удалить модуль?">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Модуль <strong style={{ color: 'var(--fg)' }}>{confirmDelete?.title ?? ''}</strong> будет скрыт. Уроки внутри тоже станут недоступны студентам.
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="edify-composer__submit" style={{ background: 'var(--surface-1)', color: 'var(--fg)', borderColor: 'var(--hairline)' }} onClick={() => setConfirmDelete(null)}>
              Отмена
            </button>
            <button type="button" className="edify-composer__submit" style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--danger)', borderColor: 'rgba(255,92,92,0.3)' }} onClick={() => void deleteModule()}>
              Удалить
            </button>
          </div>
        </div>
      </Modal>
    </PageScreen>
  );
}
