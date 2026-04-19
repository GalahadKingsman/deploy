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

function displayName(u: MeUserV1): string {
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  if (n) return n;
  if (u.username) return u.username;
  return 'Пользователь';
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

/** `null` — 401 (сессия недействительна). `undefined` — сеть/CORS/5xx (токен не трогаем). */
async function fetchMe(api: string, token: string): Promise<MeUserV1 | null | undefined> {
  try {
    const res = await fetch(`${api}/me`, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    if (res.status === 401) return null;
    if (!res.ok) return undefined;
    const data = (await res.json()) as { user?: MeUserV1 };
    return data?.user && typeof data.user.id === 'string' ? data.user : undefined;
  } catch {
    return undefined;
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

  const name = document.createElement('span');
  name.className = 'edify-user-chip__name';
  name.textContent = displayName(user);
  body.appendChild(name);

  if (user.username) {
    const handle = document.createElement('span');
    handle.className = 'edify-user-chip__handle';
    handle.textContent = `@${user.username}`;
    body.appendChild(handle);
  }

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
  if (user === null) {
    clearAccessToken();
    renderGuestSlots();
    return;
  }
  if (user === undefined) {
    console.warn('[edify] GET /me: сеть или CORS; токен сохранён, профиль не загружен.');
    renderGuestSlots();
    return;
  }
  renderUserSlots(user);
}
