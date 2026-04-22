import { getApiBaseUrl, getTelegramBotUsername } from './env.js';
import { clearAccessToken, getAccessToken, setAccessToken } from './authSession.js';

declare global {
  interface Window {
    closeMobileNav?: () => void;
    edifyOpenAuthModal?: (mode: 'login' | 'register') => void;
  }
}

export type MeUserV1 = {
  id: string;
  telegramUserId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  email?: string | null;
  platformRole: string;
};

function displayName(u: MeUserV1): string {
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  if (n) return n;
  if (u.username) return u.username;
  return 'Пользователь';
}

function resolvePublicUrl(url: string): string {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (!raw.startsWith('/')) return raw;
  const api = getApiBaseUrl();
  return api ? `${api}${raw}` : raw;
}

function extractFileKey(raw: string): string {
  const v = (raw || '').trim();
  if (!v) return '';
  if (v.startsWith('submissions/') || v.startsWith('avatars/')) return v;
  if (v.startsWith('/public/avatar?')) {
    try {
      const u = new URL(v, 'https://x.local');
      return (u.searchParams.get('key') || '').trim();
    } catch {
      return '';
    }
  }
  if (v.startsWith('/files?')) {
    try {
      const u = new URL(v, 'https://x.local');
      return (u.searchParams.get('key') || '').trim();
    } catch {
      return '';
    }
  }
  return '';
}

async function resolveAvatarImgSrc(avatarUrl: string, token: string): Promise<string> {
  const key = extractFileKey(avatarUrl);
  if (!key) return resolvePublicUrl(avatarUrl);
  // If it's already public avatar endpoint, no need for signed flow.
  if (avatarUrl.trim().startsWith('/public/avatar?')) return resolvePublicUrl(avatarUrl);
  const api = getApiBaseUrl();
  if (!api) return resolvePublicUrl(avatarUrl);
  const res = await fetch(`${api}/files/signed?key=${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  if (!res.ok) return resolvePublicUrl(avatarUrl);
  const data = (await res.json()) as { url?: string };
  return typeof data.url === 'string' && data.url ? resolvePublicUrl(data.url) : resolvePublicUrl(avatarUrl);
}
function roleLabel(u: MeUserV1): string {
  // On landing we only need a short label like inside platform UI.
  if (u.platformRole === 'owner' || u.platformRole === 'admin') return 'Эксперт';
  return 'Ученик';
}

function setRegisterCtasVisible(visible: boolean): void {
  document.querySelectorAll<HTMLElement>('[data-edify-auth-open="register"]').forEach((el) => {
    el.style.display = visible ? '' : 'none';
  });
}

function guestLoginAlert(): void {
  window.alert(
    'Вход через Telegram не настроен: при сборке маркетингового сайта задайте переменную VITE_TELEGRAM_BOT_USERNAME (имя бота без @). Пример:\n' +
      'VITE_TELEGRAM_BOT_USERNAME=your_bot pnpm --filter @tracked/edify-site build',
  );
}

function wireGuestLink(a: HTMLAnchorElement): void {
  // Email+password auth: open modal instead of Telegram deep-link.
  a.href = '#';
  a.removeAttribute('target');
  a.removeAttribute('rel');
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal('login');
  });
}

type AuthMode = 'login' | 'register';

function openAuthModal(mode: AuthMode): void {
  const existing = document.getElementById('edify-auth-modal');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'edify-auth-modal';
  backdrop.className = 'edify-auth';

  const card = document.createElement('div');
  card.className = 'edify-auth__card';

  const head = document.createElement('div');
  head.className = 'edify-auth__head';
  const title = document.createElement('div');
  title.className = 'edify-auth__title';
  title.textContent = mode === 'register' ? 'Регистрация' : 'Вход';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'edify-auth__close';
  close.innerHTML = '&times;';
  close.addEventListener('click', () => backdrop.remove());
  head.append(title, close);

  const tabs = document.createElement('div');
  tabs.className = 'edify-auth__tabs';
  const tLogin = document.createElement('button');
  tLogin.type = 'button';
  tLogin.className = 'edify-auth__tab';
  tLogin.textContent = 'Вход';
  const tReg = document.createElement('button');
  tReg.type = 'button';
  tReg.className = 'edify-auth__tab';
  tReg.textContent = 'Регистрация';
  const setModeUi = (m: AuthMode) => {
    mode = m;
    title.textContent = mode === 'register' ? 'Регистрация' : 'Вход';
    tLogin.classList.toggle('is-active', mode === 'login');
    tReg.classList.toggle('is-active', mode === 'register');
    regFields.style.display = mode === 'register' ? '' : 'none';
    submit.textContent = mode === 'register' ? 'Создать аккаунт' : 'Войти';
    msg.textContent = '';
  };
  tLogin.addEventListener('click', () => setModeUi('login'));
  tReg.addEventListener('click', () => setModeUi('register'));
  tabs.append(tLogin, tReg);

  const form = document.createElement('form');
  form.className = 'edify-auth__form';

  const regFields = document.createElement('div');
  regFields.className = 'edify-auth__row2';
  regFields.style.display = 'none';

  const firstName = document.createElement('input');
  firstName.className = 'edify-auth__input';
  firstName.placeholder = 'Имя';
  const lastName = document.createElement('input');
  lastName.className = 'edify-auth__input';
  lastName.placeholder = 'Фамилия';
  regFields.append(firstName, lastName);

  const email = document.createElement('input');
  email.className = 'edify-auth__input';
  email.placeholder = 'Email';
  email.type = 'email';
  email.autocomplete = 'email';

  const password = document.createElement('input');
  password.className = 'edify-auth__input';
  password.placeholder = 'Пароль (минимум 8 символов)';
  password.type = 'password';
  password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';

  const msg = document.createElement('div');
  msg.className = 'edify-auth__msg';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'edify-auth__submit';
  submit.textContent = mode === 'register' ? 'Создать аккаунт' : 'Войти';

  form.append(regFields, email, password, msg, submit);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    msg.textContent = '…';
    const api = getApiBaseUrl();
    if (!api) {
      msg.textContent = 'Не задан API base url.';
      return;
    }
    try {
      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const body =
        mode === 'register'
          ? {
              firstName: firstName.value.trim(),
              lastName: lastName.value.trim(),
              email: email.value.trim(),
              password: password.value,
            }
          : { email: email.value.trim(), password: password.value };
      const res = await fetch(`${api}${path}`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        msg.textContent = text ? `Ошибка: ${text.slice(0, 160)}` : `Ошибка входа (HTTP ${res.status})`;
        return;
      }
      const data = (await res.json()) as { accessToken?: string };
      if (!data.accessToken) {
        msg.textContent = 'Не удалось получить токен.';
        return;
      }
      setAccessToken(data.accessToken);
      backdrop.remove();
      await refreshNavAuth();
    } catch {
      msg.textContent = 'Не удалось выполнить запрос. Проверьте сеть.';
    }
  });

  card.append(head, tabs, form);
  backdrop.appendChild(card);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);
  setModeUi(mode);
}

// Expose for non-auth-slot buttons on the landing page (CTA -> registration, etc.)
window.edifyOpenAuthModal = (mode: AuthMode) => openAuthModal(mode);

export function renderGuestSlots(): void {
  setRegisterCtasVisible(true);
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

function buildUserChip(user: MeUserV1, variant: string, token?: string | null): HTMLElement {
  const root = document.createElement('div');
  root.className = `edify-user-chip edify-user-chip--${variant}`;

  if (user.avatarUrl) {
    const key = extractFileKey(user.avatarUrl);
    if (key && token) {
      // Start with placeholder initials (avoid broken image icon), then swap to real avatar.
      const ph = document.createElement('div');
      ph.className = 'edify-user-chip__avatar edify-user-chip__avatar--ph';
      ph.textContent = (displayName(user).charAt(0) || '?').toUpperCase();
      root.appendChild(ph);
      void (async () => {
        try {
          const avatar = document.createElement('img');
          avatar.className = 'edify-user-chip__avatar';
          avatar.alt = '';
          avatar.referrerPolicy = 'no-referrer';
          avatar.src = await resolveAvatarImgSrc(user.avatarUrl!, token);
          avatar.addEventListener('load', () => {
            root.replaceChild(avatar, ph);
          });
        } catch {
          // ignore (keep placeholder)
        }
      })();
    } else {
      const avatar = document.createElement('img');
      avatar.className = 'edify-user-chip__avatar';
      avatar.alt = '';
      avatar.src = resolvePublicUrl(user.avatarUrl);
      avatar.referrerPolicy = 'no-referrer';
      root.appendChild(avatar);
    }
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

  const sub = document.createElement('span');
  sub.className = 'edify-user-chip__sub';
  // Header should look like platform: show role; other variants can still show @username.
  sub.textContent = variant === 'header' ? roleLabel(user) : user.username ? `@${user.username}` : roleLabel(user);
  body.appendChild(sub);
  root.appendChild(body);

  // Click → profile inside platform
  root.style.cursor = 'pointer';
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement | null;
    if (t?.closest('.edify-user-chip__logout')) return;
    window.location.href = '/platform/?screen=s-profile';
  });

  // Optional logout for mobile/footer variants (not shown in header anyway)
  if (variant !== 'header') {
    const out = document.createElement('button');
    out.type = 'button';
    out.className = 'edify-user-chip__logout';
    out.textContent = 'Выйти';
    out.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearAccessToken();
      renderGuestSlots();
      window.closeMobileNav?.();
    });
    body.appendChild(out);
  }

  return root;
}

export function renderUserSlots(user: MeUserV1): void {
  setRegisterCtasVisible(false);
  const token = getAccessToken();
  document.querySelectorAll<HTMLElement>('[data-edify-nav-auth]').forEach((slot) => {
    const variant = slot.dataset.variant ?? 'header';
    slot.replaceChildren();
    if (variant === 'header') {
      const wrap = document.createElement('div');
      wrap.className = 'edify-nav-user';
      wrap.appendChild(buildUserChip(user, variant, token));
      const out = document.createElement('button');
      out.type = 'button';
      out.className = 'edify-nav-logout';
      out.textContent = 'Выйти';
      out.addEventListener('click', () => {
        clearAccessToken();
        renderGuestSlots();
      });
      wrap.appendChild(out);
      slot.appendChild(wrap);
      return;
    }
    slot.appendChild(buildUserChip(user, variant, token));
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
