import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Skeleton,
  Input,
  useToast,
} from '../shared/ui/index.js';
import { useExpertTeam, expertTeamKey } from '../shared/queries/useExpertTeam.js';
import { useMyExpertMemberships } from '../shared/queries/useMyExpertMemberships.js';
import { fetchJson, ApiClientError } from '../shared/api/index.js';
import type { ContractsV1, ExpertMemberRoleV1 } from '@tracked/shared';

function roleLabel(role: string): string {
  if (role === 'owner') return 'Владелец';
  if (role === 'manager') return 'Менеджер';
  if (role === 'reviewer') return 'Ревьюер';
  if (role === 'support') return 'Поддержка';
  return role;
}

function displayName(m: {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  const parts = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
  if (parts) return parts;
  if (m.username) return `@${m.username}`;
  return '—';
}

const ROLES: ExpertMemberRoleV1[] = ['owner', 'manager', 'reviewer', 'support'];

export function ExpertTeamPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { expertId = '' } = useParams<{ expertId: string }>();
  const { data, isLoading, error, refetch } = useExpertTeam(expertId);
  const { data: memberships } = useMyExpertMemberships();
  const myRole = (memberships?.items ?? []).find((m) => m.expertId === expertId)?.role ?? null;
  const isOwner = myRole === 'owner';

  const [tgId, setTgId] = React.useState('');
  const [addRole, setAddRole] = React.useState<ExpertMemberRoleV1>('support');

  const invalidate = () => qc.invalidateQueries({ queryKey: expertTeamKey(expertId) });

  const addMember = useMutation({
    mutationFn: async () => {
      const tg = tgId.trim();
      if (!tg) throw new Error('tg');
      return await fetchJson<{ member: ContractsV1.ExpertMemberV1 }>({
        path: `/experts/${encodeURIComponent(expertId)}/team/members/by-telegram/${encodeURIComponent(tg)}`,
        method: 'POST',
        body: { role: addRole },
      });
    },
    onSuccess: async () => {
      setTgId('');
      toast.show({ title: 'Участник добавлен', variant: 'success' });
      await invalidate();
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'Не удалось добавить';
      toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
    },
  });

  const changeRole = useMutation({
    mutationFn: async (p: { userId: string; role: ExpertMemberRoleV1 }) => {
      return await fetchJson<{ member: ContractsV1.ExpertMemberV1 }>({
        path: `/experts/${encodeURIComponent(expertId)}/team/members/${encodeURIComponent(p.userId)}`,
        method: 'PATCH',
        body: { role: p.role },
      });
    },
    onSuccess: async () => {
      toast.show({ title: 'Роль обновлена', variant: 'success' });
      await invalidate();
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'Не удалось сменить роль';
      toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      return await fetchJson<{ ok: true }>({
        path: `/experts/${encodeURIComponent(expertId)}/team/members/${encodeURIComponent(userId)}`,
        method: 'DELETE',
      });
    },
    onSuccess: async () => {
      toast.show({ title: 'Участник удалён', variant: 'success' });
      await invalidate();
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : 'Не удалось удалить';
      toast.show({ title: 'Ошибка', message: msg, variant: 'error' });
    },
  });

  if (!expertId) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Команда</CardTitle>
            <CardDescription>Не указан expertId</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Skeleton width="50%" height="28px" style={{ marginBottom: 'var(--sp-3)' }} />
        <Skeleton width="100%" height="160px" radius="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Команда</CardTitle>
            <CardDescription>Не удалось загрузить список</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => refetch()}>
              Повторить
            </Button>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = data.items ?? [];

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Команда</CardTitle>
          <CardDescription>Участники кабинета. Управление — только для роли «Владелец».</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {items.length === 0 && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Список пуст.</div>
          )}
          {items.map((m) => (
            <div
              key={m.userId}
              style={{
                padding: 'var(--sp-3)',
                background: 'var(--card-2)',
                borderRadius: 'var(--r-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--sp-2)',
              }}
            >
              <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{displayName(m)}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>
                userId: {m.userId} · {roleLabel(m.role)}
              </div>
              {isOwner && (
                <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={m.role}
                    onChange={(e) =>
                      changeRole.mutate({ userId: m.userId, role: e.target.value as ExpertMemberRoleV1 })
                    }
                    disabled={changeRole.isPending}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--fg)',
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    disabled={removeMember.isPending}
                    onClick={() => {
                      if (window.confirm('Удалить участника из команды?')) {
                        removeMember.mutate(m.userId);
                      }
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {isOwner && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 'var(--text-md)' }}>Добавить по Telegram ID</CardTitle>
            <CardDescription>Числовой id пользователя в Telegram (как в Bot API).</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <Input placeholder="Например 123456789" value={tgId} onChange={(e) => setTgId(e.target.value)} />
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as ExpertMemberRoleV1)}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--fg)',
                maxWidth: 220,
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              disabled={addMember.isPending}
              onClick={() => addMember.mutate(undefined)}
            >
              Добавить
            </Button>
          </CardContent>
        </Card>
      )}

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle style={{ fontSize: 'var(--text-md)' }}>Приглашения по ссылке</CardTitle>
          <CardDescription>Эта страница в разработке (отдельный поток приглашений).</CardDescription>
        </CardHeader>
      </Card>

      <Button variant="secondary" onClick={() => navigate(-1)} style={{ width: '100%' }}>
        Назад
      </Button>
    </div>
  );
}
