import { getApiBaseUrl, getTelegramBotUsername } from './env.js';
import { clearAccessToken, getAccessToken } from './authSession.js';

declare global {
  interface Window {
    closeMobileNav?: () => void;
  }
}

export type MeUserV1 = {
  id: string;
  telegramUserId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  platformRole: string;
};

const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

function displayName(u: MeUserV1): string {
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  if (n) return n;
  if (u.username) return u.username;
  return 'Пользователь';
}

function badgeLabel(u: MeUserV1): string {
  if (u.platformRole === 'owner') return 'Owner';
  if (u.platformRole === 'admin') return 'Admin';
  if (u.platformRole === 'moderator') return 'Mod';
  return 'Pro';
}

function guestLoginAlert(): void {
  window.alert(
    'Вход через Telegram не настроен: при сборке маркетингового сайта задайте переменную VITE_TELEGRAM_BOT_USERNAME (имя бота без @). Пример:\n' +
      'VITE_TELEGRAM_BOT_USERNAME=your_bot pnpm --filter @tracked/edify-site build',
  );
}

function wireGuestLink(a: HTMLAnchorElement): void {
  const bot = getTelegramBotUsername();
  if (bot) {
    a.href = `https://t.me/${bot}?start=site`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return;
  }
  a.href = '#';
  a.removeAttribute('target');
  a.removeAttribute('rel');
  a.addEventListener('click', (e) => {
    e.preventDefault();
    guestLoginAlert();
  });
}

export function renderGuestSlots(): void {
  document.querySelectorAll<HTMLElement>('[data-edify-nav-auth]').forEach((slot) => {
    slot.replaceChildren();
    const variant = slot.dataset.variant ?? 'header';
    const a = document.createElement('a');
    a.className = 'edify-guest-login';
    if (variant === 'header') a.classList.add('btn-ghost-sm');
    else if (variant === 'mobile') a.classList.add('mobile-nav-login');
    else a.classList.add('edify-footer-login');
    a.textContent = 'Войти';
    wireGuestLink(a);
    if (variant === 'mobile') {
      a.addEventListener('click', () => {
        window.closeMobileNav?.();
      });
    }
    slot.appendChild(a);
  });
}

async function fetchMe(api: string, token: string): Promise<MeUserV1 | null> {
  try {
    const res = await fetch(`${api}/me`, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: MeUserV1 };
    return data?.user && typeof data.user.id === 'string' ? data.user : null;
  } catch {
    return null;
  }
}

function buildUserChip(user: MeUserV1, variant: string): HTMLElement {
  const root = document.createElement('div');
  root.className = `edify-user-chip edify-user-chip--${variant}`;

  if (user.avatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'edify-user-chip__avatar';
    avatar.alt = '';
    avatar.src = user.avatarUrl;
    avatar.referrerPolicy = 'no-referrer';
    root.appendChild(avatar);
  } else {
    const ph = document.createElement('div');
    ph.className = 'edify-user-chip__avatar edify-user-chip__avatar--ph';
    ph.textContent = (displayName(user).charAt(0) || '?').toUpperCase();
    root.appendChild(ph);
  }

  const body = document.createElement('div');
  body.className = 'edify-user-chip__body';

  const row1 = document.createElement('div');
  row1.className = 'edify-user-chip__row';
  const name = document.createElement('span');
  name.className = 'edify-user-chip__name';
  name.textContent = displayName(user);
  const badge = document.createElement('span');
  badge.className = 'edify-user-chip__badge';
  badge.textContent = badgeLabel(user);
  row1.append(name, badge);
  body.appendChild(row1);

  if (user.username) {
    const handle = document.createElement('div');
    handle.className = 'edify-user-chip__handle';
    handle.textContent = `@${user.username}`;
    body.appendChild(handle);
  }

  const idRow = document.createElement('div');
  idRow.className = 'edify-user-chip__idrow';
  const tid = document.createElement('span');
  tid.className = 'edify-user-chip__tid';
  tid.textContent = user.telegramUserId ?? '—';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'edify-user-chip__copy';
  copyBtn.setAttribute('aria-label', 'Копировать Telegram ID');
  copyBtn.innerHTML = COPY_SVG;
  copyBtn.addEventListener('click', () => {
    const id = user.telegramUserId ?? '';
    if (!id) return;
    void navigator.clipboard.writeText(id).then(
      () => {
        copyBtn.classList.add('edify-user-chip__copy--ok');
        window.setTimeout(() => copyBtn.classList.remove('edify-user-chip__copy--ok'), 1200);
      },
      () => {
        window.alert('Не удалось скопировать');
      },
    );
  });
  idRow.append(tid, copyBtn);
  body.appendChild(idRow);

  const out = document.createElement('button');
  out.type = 'button';
  out.className = 'edify-user-chip__logout';
  out.textContent = 'Выйти';
  out.addEventListener('click', () => {
    clearAccessToken();
    renderGuestSlots();
    window.closeMobileNav?.();
  });
  body.appendChild(out);

  root.appendChild(body);
  return root;
}

export function renderUserSlots(user: MeUserV1): void {
  document.querySelectorAll<HTMLElement>('[data-edify-nav-auth]').forEach((slot) => {
    const variant = slot.dataset.variant ?? 'header';
    slot.replaceChildren();
    slot.appendChild(buildUserChip(user, variant));
  });
}

export async function refreshNavAuth(): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    renderGuestSlots();
    return;
  }
  const api = getApiBaseUrl();
  if (!api) {
    renderGuestSlots();
    return;
  }
  const user = await fetchMe(api, token);
  if (!user) {
    clearAccessToken();
    renderGuestSlots();
    return;
  }
  renderUserSlots(user);
}
