import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, useToast, Modal } from '../shared/ui/index.js';
import { fetchJson } from '../shared/api/index.js';
import type { ContractsV1 } from '@tracked/shared';

export function ExpertCourseModulesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { expertId, courseId } = useParams<{ expertId: string; courseId: string }>();
  const [items, setItems] = React.useState<ContractsV1.ExpertCourseModuleV1[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');
  const [editing, setEditing] = React.useState<ContractsV1.ExpertCourseModuleV1 | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState<ContractsV1.ExpertCourseModuleV1 | null>(null);

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
          <Card key={m.id} style={{ padding: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--fg)' }}>
                  {m.title}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', marginTop: 2 }}>
                  position: {m.position}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexShrink: 0 }}>
                <Button variant="secondary" size="sm" onClick={() => openRename(m)} style={{ borderRadius: 12, minHeight: 40 }}>
                  ✎
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(m)} style={{ borderRadius: 12, minHeight: 40 }}>
                  🗑
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  asChild
                  style={{ borderRadius: 12, minHeight: 40, padding: '0 14px' }}
                >
                  <Link to={`/expert/${expertId}/modules/${m.id}/lessons?courseId=${courseId}`}>Уроки →</Link>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={editing != null}
        onClose={() => setEditing(null)}
        title="Переименовать модуль"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <Input label="Название" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setEditing(null)}>Отмена</Button>
            <Button variant="primary" onClick={saveRename} disabled={!editTitle.trim()}>Сохранить</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        title="Удалить модуль?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', lineHeight: 1.5 }}>
            Модуль <span style={{ color: 'var(--fg)', fontWeight: 'var(--font-weight-semibold)' }}>
              {confirmDelete?.title ?? ''}
            </span> будет скрыт. Уроки внутри тоже станут недоступны студентам.
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Отмена</Button>
            <Button variant="danger" onClick={deleteModule}>Удалить</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

