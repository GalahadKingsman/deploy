import { getApiBaseUrl, getTelegramBotUsername } from './env.js';
import { getAvatarImageSrc } from './avatarImageUrl.js';
import { clearAccessToken, getAccessToken, setAccessToken } from './authSession.js';

declare global {
  interface Window {
    closeMobileNav?: () => void;
    edifyOpenAuthModal?: (mode: 'login' | 'register' | 'forgot') => void;
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
  streakDays?: number;
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

function avatarInitialsForChip(u: MeUserV1): string {
  const d = displayName(u);
  const parts = d.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? '?').toUpperCase();
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? '').toUpperCase();
  return (a + b).slice(0, 2) || '?';
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

type AuthMode = 'login' | 'register' | 'forgot';

async function readApiErrorMessage(res: Response): Promise<string> {
  if (res.status === 504 || res.status === 502) {
    return 'Шлюз не дождался ответа API (502/504). Обычно API долго подключается к SMTP: проверьте SMTP_HOST, порт 465/587, исходящий фаервол и proxy_read_timeout в nginx перед API.';
  }
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text) as { message?: unknown };
    const m = j?.message;
    if (typeof m === 'string' && m.trim()) return m.trim();
    if (Array.isArray(m) && m.length && typeof m[0] === 'string') return m.filter((x) => typeof x === 'string').join(' ').slice(0, 400);
  } catch {
    /* not JSON */
  }
  return text.trim() ? text.slice(0, 220) : `Ошибка (HTTP ${res.status})`;
}

function parseApiSuccessMessage(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as { message?: string };
    if (j?.message && typeof j.message === 'string') return j.message.trim();
  } catch {
    /* ignore */
  }
  return fallback;
}

function isValidEmailShape(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

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
  title.textContent =
    mode === 'register' ? 'Регистрация' : mode === 'forgot' ? 'Восстановление пароля' : 'Вход';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'edify-auth__close';
  close.innerHTML = '&times;';
  close.addEventListener('click', () => backdrop.remove());
  head.append(title, close);

  const tabsBar = document.createElement('div');
  tabsBar.className = 'edify-auth__tabs-bar';

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
  tabs.append(tLogin, tReg);

  const forgotToLogin = document.createElement('button');
  forgotToLogin.type = 'button';
  forgotToLogin.className = 'edify-auth__forgot-link';
  forgotToLogin.textContent = 'Забыли пароль?';

  tabsBar.append(tabs, forgotToLogin);

  const setModeUi = (m: AuthMode) => {
    mode = m;
    if (mode === 'forgot') {
      title.textContent = 'Восстановление пароля';
      tabsBar.style.display = '';
      tabs.style.display = 'none';
      tLogin.classList.remove('is-active');
      tReg.classList.remove('is-active');
      regFields.style.display = 'none';
      password.style.display = 'none';
      submit.textContent = 'Отправить письмо для восстановления';
      forgotToLogin.textContent = 'Назад ко входу';
    } else {
      tabsBar.style.display = '';
      tabs.style.display = '';
      title.textContent = mode === 'register' ? 'Регистрация' : 'Вход';
      tLogin.classList.toggle('is-active', mode === 'login');
      tReg.classList.toggle('is-active', mode === 'register');
      regFields.style.display = mode === 'register' ? '' : 'none';
      password.style.display = '';
      submit.textContent = mode === 'register' ? 'Создать аккаунт' : 'Войти';
      forgotToLogin.textContent = 'Забыли пароль?';
    }
    setMsg('', 'neutral');
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  };
  tLogin.addEventListener('click', () => setModeUi('login'));
  tReg.addEventListener('click', () => setModeUi('register'));
  forgotToLogin.addEventListener('click', () => {
    if (mode === 'forgot') setModeUi('login');
    else setModeUi('forgot');
  });

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
  msg.setAttribute('role', 'status');
  msg.setAttribute('aria-live', 'polite');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'edify-auth__submit';
  submit.textContent = mode === 'register' ? 'Создать аккаунт' : 'Войти';

  form.append(regFields, email, password, msg, submit);
  form.noValidate = true;

  const setMsg = (text: string, kind: 'neutral' | 'error' | 'ok' = 'neutral') => {
    msg.textContent = text;
    msg.classList.remove('edify-auth__msg--error', 'edify-auth__msg--ok');
    if (kind === 'error') msg.classList.add('edify-auth__msg--error');
    if (kind === 'ok') msg.classList.add('edify-auth__msg--ok');
  };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setMsg('Отправка…', 'neutral');
    const api = getApiBaseUrl();
    if (!api) {
      setMsg('Не задан API base url.', 'error');
      return;
    }
    submit.disabled = true;
    try {
      if (mode === 'forgot') {
        const em = email.value.trim();
        if (!em) {
          setMsg('Введите email.', 'error');
          return;
        }
        if (!isValidEmailShape(em)) {
          setMsg('Укажите корректный email (например name@mail.ru).', 'error');
          return;
        }
        const res = await fetch(`${api}/auth/password/reset/request`, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ email: em }),
        });
        if (!res.ok) {
          setMsg(await readApiErrorMessage(res), 'error');
          return;
        }
        const okText = await res.text();
        setMsg(parseApiSuccessMessage(okText, 'Письмо отправлено. Проверьте папку «Спам», если письма нет во входящих.'), 'ok');
        return;
      }

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
        setMsg(await readApiErrorMessage(res), 'error');
        return;
      }
      const data = (await res.json()) as { accessToken?: string };
      if (!data.accessToken) {
        setMsg('Не удалось получить токен.', 'error');
        return;
      }
      setAccessToken(data.accessToken);
      backdrop.remove();
      await refreshNavAuth();
    } catch {
      setMsg(
        'Запрос не удался (часто из‑за 504 от nginx: HTML без CORS, или обрыв сети). В «Сеть» посмотрите статус POST; если 504 — увеличьте proxy_read_timeout у прокси на API и проверьте доступность SMTP с сервера (порт 465).',
        'error',
      );
    } finally {
      submit.disabled = false;
    }
  });

  card.append(head, tabsBar, form);
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

  const ph = document.createElement('div');
  ph.className = 'edify-user-chip__avatar edify-user-chip__avatar--ph';
  ph.textContent = avatarInitialsForChip(user);
  root.appendChild(ph);
  if (user.avatarUrl) {
    const src = getAvatarImageSrc(user.avatarUrl);
    if (src) {
      const avatar = document.createElement('img');
      avatar.className = 'edify-user-chip__avatar';
      avatar.alt = '';
      avatar.referrerPolicy = 'no-referrer';
      avatar.src = src;
      avatar.addEventListener('load', () => {
        if (ph.parentNode === root) root.replaceChild(avatar, ph);
      });
      avatar.addEventListener('error', () => {
        /* keep initials placeholder */
      });
    }
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
      if (user.platformRole === 'admin' || user.platformRole === 'owner') {
        const admin = document.createElement('button');
        admin.type = 'button';
        admin.className = 'edify-nav-admin';
        admin.textContent = 'Админ‑панель';
        admin.addEventListener('click', () => {
          window.location.href = '/platform/?screen=admin';
        });
        wrap.appendChild(admin);
      }
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
