import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input } from '../shared/ui/index.js';
import { fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';

export function ExpertCourseModulesPage() {
  const navigate = useNavigate();
  const { expertId, courseId } = useParams<{ expertId: string; courseId: string }>();
  const [items, setItems] = React.useState<ContractsV1.ExpertCourseModuleV1[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');

  const load = React.useCallback(async () => {
    if (!expertId || !courseId) return;
    setLoading(true);
    try {
      const res = await fetchJson<ContractsV1.ListExpertCourseModulesResponseV1>({
        path: `/experts/${expertId}/courses/${courseId}/modules`,
      });
      setItems(res.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [expertId, courseId]);

  React.useEffect(() => {
    load();
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

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Модули</CardTitle>
          <CardDescription>Структура курса.</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Input placeholder="Новый модуль" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button variant="primary" onClick={create} disabled={!title.trim()}>
              Добавить
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => load()} disabled={loading}>
              Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && <div>Загрузка…</div>}
      {!loading && items.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Пока нет модулей</CardTitle>
            <CardDescription>Добавьте первый модуль.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {items.map((m) => (
          <Link
            key={m.id}
            to={`/expert/${expertId}/modules/${m.id}/lessons?courseId=${courseId}`}
            style={{ textDecoration: 'none' }}
          >
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: 'var(--text-md)' }}>{m.title}</CardTitle>
                <CardDescription>position: {m.position}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

