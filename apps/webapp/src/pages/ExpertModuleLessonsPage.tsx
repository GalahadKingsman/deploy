import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input } from '../shared/ui/index.js';
import { fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';

export function ExpertModuleLessonsPage() {
  const navigate = useNavigate();
  const { expertId, moduleId } = useParams<{ expertId: string; moduleId: string }>();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId');

  const [items, setItems] = React.useState<ContractsV1.ExpertLessonV1[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');

  const load = React.useCallback(async () => {
    if (!expertId || !moduleId) return;
    setLoading(true);
    try {
      const res = await fetchJson<ContractsV1.ListExpertLessonsResponseV1>({
        path: `/experts/${expertId}/modules/${moduleId}/lessons`,
      });
      setItems(res.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [expertId, moduleId]);

  React.useEffect(() => {
    load();
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

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Уроки</CardTitle>
          <CardDescription>Редактор уроков (markdown).</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Input placeholder="Новый урок" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button variant="primary" onClick={create} disabled={!title.trim()}>
              Добавить
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => load()} disabled={loading}>
              Обновить
            </Button>
            {expertId && courseId && (
              <Button variant="ghost" asChild>
                <Link to={`/expert/${expertId}/courses/${courseId}/modules`}>К модулям</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && <div>Загрузка…</div>}
      {!loading && items.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Пока нет уроков</CardTitle>
            <CardDescription>Добавьте первый урок.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {items.map((l) => (
          <Link
            key={l.id}
            to={`/expert/${expertId}/modules/${moduleId}/lessons/${l.id}`}
            style={{ textDecoration: 'none' }}
          >
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: 'var(--text-md)' }}>{l.title}</CardTitle>
                <CardDescription>position: {l.position}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

