import React from 'react';
import { useParams } from 'react-router-dom';
import { Skeleton } from '../shared/ui/index.js';
import { fetchJson } from '../shared/api/index.js';
import { ContractsV1 } from '@tracked/shared';
import { PageScreen } from '../ui/edify/PageScreen.js';
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

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export function ExpertCourseHubPage() {
  const { expertId, courseId } = useParams<{ expertId: string; courseId: string }>();
  const [course, setCourse] = React.useState<ContractsV1.ExpertCourseV1 | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!expertId || !courseId) return;
      setLoading(true);
      try {
        const c = await fetchJson<ContractsV1.ExpertCourseV1>({
          path: `/experts/${expertId}/courses/${courseId}`,
        });
        if (!cancelled) setCourse(c);
      } catch {
        if (!cancelled) setCourse(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [expertId, courseId]);

  if (loading) {
    return (
      <PageScreen>
        <div className="edify-brand" aria-hidden="true" />
        <Skeleton width="60%" height={32} radius="lg" style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={200} radius="lg" />
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

  return (
    <PageScreen>
      <div className="edify-brand" aria-hidden="true" />

      <div className="edify-content-header">
        <div className="edify-eyebrow">EXPERT · COURSE</div>
        <h1 className="edify-h edify-h--lg">{course.title}</h1>
        <p className="edify-subtitle" style={{ marginTop: 8 }}>
          Статус: {course.status} • {course.visibility}
        </p>
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
        <ExpertListRow
          to={`/expert/${expertId}/courses/${courseId}/settings`}
          title="Настройки курса"
          subtitle="Название, обложка, темы, публикация"
          icon={<SettingsIcon />}
        />
      </nav>
    </PageScreen>
  );
}
