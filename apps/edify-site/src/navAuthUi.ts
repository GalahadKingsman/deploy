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
  backdrop.style.cssText =
    'position:fixed;inset:0;z-index:1000;background:rgba(12,18,32,0.45);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:18px;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:min(520px,100%);background:var(--card,#fff);border:1px solid var(--line,rgba(0,0,0,0.08));border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,0.18);padding:18px 18px 16px;';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px;';
  const title = document.createElement('div');
  title.style.cssText = 'font-family:var(--fd,Unbounded),sans-serif;font-size:18px;font-weight:700;color:var(--t1,#0C1220);';
  title.textContent = mode === 'register' ? 'Регистрация' : 'Вход';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-ghost-sm';
  close.style.cssText = 'padding:6px 10px;border-radius:10px;';
  close.textContent = '✕';
  close.addEventListener('click', () => backdrop.remove());
  head.append(title, close);

  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
  const tLogin = document.createElement('button');
  tLogin.type = 'button';
  tLogin.className = 'btn-ghost-sm';
  tLogin.textContent = 'Вход';
  const tReg = document.createElement('button');
  tReg.type = 'button';
  tReg.className = 'btn-ghost-sm';
  tReg.textContent = 'Регистрация';
  const setModeUi = (m: AuthMode) => {
    mode = m;
    title.textContent = mode === 'register' ? 'Регистрация' : 'Вход';
    tLogin.style.borderColor = mode === 'login' ? 'var(--a-border,rgba(10,168,200,0.22))' : 'var(--line2,rgba(0,0,0,0.12))';
    tReg.style.borderColor = mode === 'register' ? 'var(--a-border,rgba(10,168,200,0.22))' : 'var(--line2,rgba(0,0,0,0.12))';
    regFields.style.display = mode === 'register' ? '' : 'none';
    submit.textContent = mode === 'register' ? 'Создать аккаунт' : 'Войти';
    msg.textContent = '';
  };
  tLogin.addEventListener('click', () => setModeUi('login'));
  tReg.addEventListener('click', () => setModeUi('register'));
  tabs.append(tLogin, tReg);

  const form = document.createElement('form');
  form.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

  const regFields = document.createElement('div');
  regFields.style.cssText = 'display:none;grid-template-columns:1fr 1fr;gap:10px;';

  const firstName = document.createElement('input');
  firstName.className = 'form-input';
  firstName.placeholder = 'Имя';
  const lastName = document.createElement('input');
  lastName.className = 'form-input';
  lastName.placeholder = 'Фамилия';
  regFields.append(firstName, lastName);

  const email = document.createElement('input');
  email.className = 'form-input';
  email.placeholder = 'Email';
  email.type = 'email';
  email.autocomplete = 'email';

  const password = document.createElement('input');
  password.className = 'form-input';
  password.placeholder = 'Пароль (минимум 8 символов)';
  password.type = 'password';
  password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';

  const msg = document.createElement('div');
  msg.style.cssText = 'font-size:12px;color:var(--t3,#8E94A8);line-height:1.5;min-height:18px;';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn-sm';
  submit.style.cssText = 'width:100%;justify-content:center;margin-top:2px;';
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
