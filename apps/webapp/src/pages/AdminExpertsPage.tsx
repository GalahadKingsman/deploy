import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, useToast } from '../shared/ui/index.js';
import { useMe } from '../shared/queries/useMe.js';
import {
  useAdminAddExpertMember,
  useAdminCreateExpert,
  useAdminExpireExpertSubscriptionNow,
  useAdminGrantExpertSubscriptionDays,
  useAdminRemoveExpertMember,
  useAdminSetExpertMemberRole,
  type ExpertMemberRole,
} from '../shared/queries/useAdminExperts.js';
import { useAdminUsers, type AdminUserPick } from '../shared/queries/useAdminUsers.js';
import { useAdminSetUserPlatformRole } from '../shared/queries/useAdminPlatformRole.js';

const roles: ExpertMemberRole[] = ['owner', 'manager', 'reviewer', 'support'];

function formatUserLabel(u: AdminUserPick): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  const username = u.username ? `@${u.username}` : '';
  const tg = u.telegramUserId ? `tg:${u.telegramUserId}` : '';
  const parts = [name, username, tg].filter(Boolean).join(' · ');
  return parts ? `${parts} · ${u.id}` : u.id;
}

function RoleSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: ExpertMemberRole;
  onChange: (v: ExpertMemberRole) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 'var(--sp-2)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }}>
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ExpertMemberRole)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: 'var(--sp-3)',
          fontSize: 'var(--text-md)',
          fontFamily: 'var(--font-sans)',
          color: 'var(--fg)',
          backgroundColor: 'var(--card)',
          border: `1px solid var(--border)`,
          borderRadius: 'var(--r-md)',
          outline: 'none',
        }}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AdminExpertsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: me } = useMe();

  const platformRole = me?.user?.platformRole ?? null;
  const isAdmin = platformRole === 'admin' || platformRole === 'owner';
  const isOwner = platformRole === 'owner';

  const createExpert = useAdminCreateExpert();
  const addMember = useAdminAddExpertMember();
  const setMemberRole = useAdminSetExpertMemberRole();
  const removeMember = useAdminRemoveExpertMember();
  const grantDays = useAdminGrantExpertSubscriptionDays();
  const expireNow = useAdminExpireExpertSubscriptionNow();
  const setPlatformRole = useAdminSetUserPlatformRole();

  const [createTitle, setCreateTitle] = React.useState('');
  const [createSlug, setCreateSlug] = React.useState('');
  const [createOwnerUserId, setCreateOwnerUserId] = React.useState('');
  const [createdExpertId, setCreatedExpertId] = React.useState<string>('');

  const [userSearch, setUserSearch] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<AdminUserPick | null>(null);
  const usersQuery = useAdminUsers({
    q: userSearch.trim() ? userSearch.trim() : undefined,
    limit: 20,
    offset: 0,
  });

  const [expertId, setExpertId] = React.useState('');
  const [memberUserId, setMemberUserId] = React.useState('');
  const [memberRole, setMemberRole] = React.useState<ExpertMemberRole>('owner');

  const [roleUserId, setRoleUserId] = React.useState('');
  const [roleRole, setRoleRole] = React.useState<ExpertMemberRole>('manager');

  const [removeUserId, setRemoveUserId] = React.useState('');

  const [subDays, setSubDays] = React.useState('3650');

  if (!isAdmin) {
    return (
      <div style={{ padding: 'var(--sp-4)' }}>
        <Card>
          <CardHeader>
            <CardTitle>Admin: experts</CardTitle>
            <CardDescription>Доступ запрещён</CardDescription>
          </CardHeader>
          <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => navigate('/account')}>
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const effectiveExpertId = (expertId.trim() || createdExpertId.trim()).trim();

  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Admin: эксперты</CardTitle>
          <CardDescription>
            Включение «режима эксперта» = создать expert → добавить участника → активировать подписку (grant-days).
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => navigate('/account')}>
            Назад
          </Button>
        </CardContent>
      </Card>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>Поиск пользователя (по базе)</CardTitle>
          <CardDescription>
            Ищи по UUID, Telegram ID, username, имени/фамилии. Клик по пользователю подставит его `userId` в формы ниже.
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <Input
            label="Поиск"
            placeholder="somefunc / 123456789 / Иван / 0000-..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          {selectedUser && (
            <div style={{ padding: 'var(--sp-3)', background: 'var(--surface)', borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>
              Выбран: {formatUserLabel(selectedUser)}
            </div>
          )}
          {selectedUser && (
            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                disabled={!isOwner || setPlatformRole.isPending}
                onClick={async () => {
                  try {
                    await setPlatformRole.mutateAsync({ userId: selectedUser.id, role: 'admin' });
                    toast.show({ title: 'OK', message: 'Роль обновлена: admin', variant: 'success' });
                    usersQuery.refetch().catch(() => {});
                  } catch (e) {
                    toast.show({
                      title: 'Ошибка',
                      message: e instanceof Error ? e.message : 'Не удалось назначить admin',
                      variant: 'danger',
                    });
                  }
                }}
              >
                Сделать admin
              </Button>
              <Button
                variant="secondary"
                disabled={!isOwner || setPlatformRole.isPending}
                onClick={async () => {
                  try {
                    await setPlatformRole.mutateAsync({ userId: selectedUser.id, role: 'user' });
                    toast.show({ title: 'OK', message: 'Роль обновлена: user', variant: 'success' });
                    usersQuery.refetch().catch(() => {});
                  } catch (e) {
                    toast.show({
                      title: 'Ошибка',
                      message: e instanceof Error ? e.message : 'Не удалось назначить user',
                      variant: 'danger',
                    });
                  }
                }}
              >
                Снять admin
              </Button>
              {!isOwner && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)', alignSelf: 'center' }}>
                  Назначать роли может только owner.
                </div>
              )}
            </div>
          )}
          {!userSearch.trim() ? (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>
              Введи запрос, чтобы показать пользователей (по умолчанию список не грузим).
            </div>
          ) : usersQuery.isLoading ? (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Загрузка…</div>
          ) : usersQuery.error ? (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--danger)' }}>
              Ошибка: {usersQuery.error.message}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {(usersQuery.data?.items ?? []).map((u) => (
                <Button
                  key={u.id}
                  variant={selectedUser?.id === u.id ? 'primary' : 'secondary'}
                  onClick={() => {
                    setSelectedUser(u);
                    setCreateOwnerUserId(u.id);
                    setMemberUserId(u.id);
                    setRoleUserId(u.id);
                    setRemoveUserId(u.id);
                    toast.show({ title: 'Выбран пользователь', message: formatUserLabel(u), variant: 'info' });
                  }}
                  style={{ justifyContent: 'flex-start' }}
                >
                  {formatUserLabel(u)}
                </Button>
              ))}
              {(usersQuery.data?.items ?? []).length === 0 && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Ничего не найдено</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>1) Создать expert</CardTitle>
          <CardDescription>Требуется platformRole=admin. Ответ вернёт `expertId`.</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <Input label="Title" placeholder="Школа Игоря" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} />
          <Input label="Slug (необязательно)" placeholder="igor-school" value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} />
          <Input
            label="Owner userId (UUID)"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={createOwnerUserId}
            onChange={(e) => setCreateOwnerUserId(e.target.value)}
            hint={selectedUser ? `Выбранный пользователь: ${formatUserLabel(selectedUser)}` : undefined}
          />
          <Button
            variant="primary"
            disabled={platformRole !== 'admin' || createExpert.isPending}
            onClick={async () => {
              try {
                const res = await createExpert.mutateAsync({
                  title: createTitle.trim(),
                  ownerUserId: createOwnerUserId.trim(),
                  slug: createSlug.trim() ? createSlug.trim() : undefined,
                });
                setCreatedExpertId(res.id);
                if (!expertId.trim()) setExpertId(res.id);
                toast.show({ title: 'OK', message: `expertId: ${res.id}`, variant: 'success' });
              } catch (e) {
                toast.show({
                  title: 'Ошибка',
                  message: e instanceof Error ? e.message : 'Не удалось создать expert',
                  variant: 'danger',
                });
              }
            }}
          >
            Создать expert
          </Button>
          {platformRole !== 'admin' && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>
              У тебя сейчас роль `{platformRole ?? 'unknown'}` — создание expert доступно только admin.
            </div>
          )}
        </CardContent>
      </Card>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>2) Управление участниками expert</CardTitle>
          <CardDescription>Добавить/изменить/удалить участника (требуется admin).</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Input
            label="ExpertId"
            placeholder="expertId"
            value={expertId}
            onChange={(e) => setExpertId(e.target.value)}
            hint={createdExpertId ? `Последний созданный expertId: ${createdExpertId}` : undefined}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Добавить участника</div>
            <Input
              label="UserId (UUID)"
              placeholder="userId"
              value={memberUserId}
              onChange={(e) => setMemberUserId(e.target.value)}
              hint={selectedUser ? `Выбранный пользователь: ${formatUserLabel(selectedUser)}` : undefined}
            />
            <RoleSelect label="Role" value={memberRole} onChange={setMemberRole} disabled={platformRole !== 'admin'} />
            <Button
              variant="primary"
              disabled={platformRole !== 'admin' || addMember.isPending || !effectiveExpertId || !memberUserId.trim()}
              onClick={async () => {
                try {
                  await addMember.mutateAsync({
                    expertId: effectiveExpertId,
                    userId: memberUserId.trim(),
                    role: memberRole,
                  });
                  toast.show({ title: 'OK', message: 'Участник добавлен', variant: 'success' });
                } catch (e) {
                  toast.show({
                    title: 'Ошибка',
                    message: e instanceof Error ? e.message : 'Не удалось добавить участника',
                    variant: 'danger',
                  });
                }
              }}
            >
              Добавить
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Изменить роль участника</div>
            <Input
              label="UserId (UUID)"
              placeholder="userId"
              value={roleUserId}
              onChange={(e) => setRoleUserId(e.target.value)}
              hint={selectedUser ? `Выбранный пользователь: ${formatUserLabel(selectedUser)}` : undefined}
            />
            <RoleSelect label="New role" value={roleRole} onChange={setRoleRole} disabled={platformRole !== 'admin'} />
            <Button
              variant="secondary"
              disabled={platformRole !== 'admin' || setMemberRole.isPending || !effectiveExpertId || !roleUserId.trim()}
              onClick={async () => {
                try {
                  await setMemberRole.mutateAsync({
                    expertId: effectiveExpertId,
                    userId: roleUserId.trim(),
                    role: roleRole,
                  });
                  toast.show({ title: 'OK', message: 'Роль обновлена', variant: 'success' });
                } catch (e) {
                  toast.show({
                    title: 'Ошибка',
                    message: e instanceof Error ? e.message : 'Не удалось обновить роль',
                    variant: 'danger',
                  });
                }
              }}
            >
              Обновить роль
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>Удалить участника</div>
            <Input
              label="UserId (UUID)"
              placeholder="userId"
              value={removeUserId}
              onChange={(e) => setRemoveUserId(e.target.value)}
              hint={selectedUser ? `Выбранный пользователь: ${formatUserLabel(selectedUser)}` : undefined}
            />
            <Button
              variant="danger"
              disabled={platformRole !== 'admin' || removeMember.isPending || !effectiveExpertId || !removeUserId.trim()}
              onClick={async () => {
                try {
                  await removeMember.mutateAsync({
                    expertId: effectiveExpertId,
                    userId: removeUserId.trim(),
                  });
                  toast.show({ title: 'OK', message: 'Участник удалён', variant: 'success' });
                } catch (e) {
                  toast.show({
                    title: 'Ошибка',
                    message: e instanceof Error ? e.message : 'Не удалось удалить участника',
                    variant: 'danger',
                  });
                }
              }}
            >
              Удалить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <CardHeader>
          <CardTitle>3) Подписка эксперта</CardTitle>
          <CardDescription>
            grant-days включает `status=active` и выставляет `current_period_end`. Требуется platformRole=owner.
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <Input
            label="ExpertId"
            placeholder="expertId"
            value={expertId}
            onChange={(e) => setExpertId(e.target.value)}
          />
          <Input
            label="Days"
            placeholder="3650"
            value={subDays}
            onChange={(e) => setSubDays(e.target.value)}
            hint="Например 3650 = ~10 лет"
          />
          <Button
            variant="primary"
            disabled={!isOwner || grantDays.isPending || !effectiveExpertId}
            onClick={async () => {
              const days = Number(subDays);
              try {
                await grantDays.mutateAsync({ expertId: effectiveExpertId, days });
                toast.show({ title: 'OK', message: 'Подписка активирована', variant: 'success' });
              } catch (e) {
                toast.show({
                  title: 'Ошибка',
                  message: e instanceof Error ? e.message : 'Не удалось активировать подписку',
                  variant: 'danger',
                });
              }
            }}
          >
            Grant days (activate)
          </Button>
          <Button
            variant="danger"
            disabled={!isOwner || expireNow.isPending || !effectiveExpertId}
            onClick={async () => {
              try {
                await expireNow.mutateAsync({ expertId: effectiveExpertId });
                toast.show({ title: 'OK', message: 'Подписка просрочена', variant: 'success' });
              } catch (e) {
                toast.show({
                  title: 'Ошибка',
                  message: e instanceof Error ? e.message : 'Не удалось просрочить подписку',
                  variant: 'danger',
                });
              }
            }}
          >
            Expire now
          </Button>
          {!isOwner && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-fg)' }}>
              У тебя сейчас роль `{platformRole ?? 'unknown'}` — grant/expire доступно только owner.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

