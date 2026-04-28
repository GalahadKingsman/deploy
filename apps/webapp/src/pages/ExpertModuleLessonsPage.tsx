import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Modal, useToast } from '../shared/ui/index.js';
import { fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';

export function ExpertModuleLessonsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { expertId, moduleId } = useParams<{ expertId: string; moduleId: string }>();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId');

  const [items, setItems] = React.useState<ContractsV1.ExpertLessonV1[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState<ContractsV1.ExpertLessonV1 | null>(null);

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
          <Card key={l.id} style={{ padding: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--fg)' }}>
                  {l.title}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', marginTop: 2 }}>
                  position: {l.position}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexShrink: 0 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  asChild
                  style={{ borderRadius: 12, minHeight: 40, padding: '0 14px' }}
                >
                  <Link to={`/expert/${expertId}/modules/${moduleId}/lessons/${l.id}`}>Открыть →</Link>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDelete(l)}
                  style={{ borderRadius: 12, minHeight: 40 }}
                  aria-label="Удалить урок"
                >
                  🗑
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        title="Удалить урок?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', lineHeight: 1.5 }}>
            Урок{' '}
            <span style={{ color: 'var(--fg)', fontWeight: 'var(--font-weight-semibold)' }}>
              {confirmDelete?.title ?? ''}
            </span>{' '}
            будет скрыт у студентов.
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Отмена
            </Button>
            <Button variant="danger" onClick={deleteLesson}>
              Удалить
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

