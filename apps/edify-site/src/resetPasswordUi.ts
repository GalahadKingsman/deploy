import { getApiBaseUrl } from './env.js';

function getTokenFromUrl(): string {
  try {
    return (new URL(window.location.href).searchParams.get('token') ?? '').trim();
  } catch {
    return '';
  }
}

function setMsg(el: HTMLElement, text: string, kind: 'ok' | 'err' | 'info' = 'info'): void {
  el.textContent = text;
  el.style.color = kind === 'err' ? 'var(--err)' : kind === 'ok' ? 'var(--ok)' : 'var(--t3)';
}

export async function maybeOpenResetPasswordUi(): Promise<boolean> {
  const path = (window.location.pathname ?? '').replace(/\/+$/, '') || '/';
  if (path !== '/reset-password') return false;

  const token = getTokenFromUrl();
  const api = getApiBaseUrl();
  const backdrop = document.createElement('div');
  backdrop.className = 'edify-auth';
  backdrop.id = 'edify-reset-password';

  const card = document.createElement('div');
  card.className = 'edify-auth__card';

  const head = document.createElement('div');
  head.className = 'edify-auth__head';
  const title = document.createElement('div');
  title.className = 'edify-auth__title';
  title.textContent = 'Сброс пароля';
  const close = document.createElement('a');
  close.className = 'edify-auth__close';
  close.href = '/';
  close.setAttribute('aria-label', 'На главную');
  close.innerHTML = '&times;';
  head.append(title, close);

  const form = document.createElement('form');
  form.className = 'edify-auth__form';

  const email = document.createElement('input');
  email.className = 'edify-auth__input';
  email.type = 'email';
  email.placeholder = 'Email';
  email.readOnly = true;

  const p1 = document.createElement('input');
  p1.className = 'edify-auth__input';
  p1.type = 'password';
  p1.placeholder = 'Новый пароль (минимум 8 символов)';
  p1.autocomplete = 'new-password';

  const p2 = document.createElement('input');
  p2.className = 'edify-auth__input';
  p2.type = 'password';
  p2.placeholder = 'Повторите пароль';
  p2.autocomplete = 'new-password';

  const msg = document.createElement('div');
  msg.className = 'edify-auth__msg';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'edify-auth__submit';
  submit.textContent = 'Сохранить';

  form.append(email, p1, p2, msg, submit);
  card.append(head, form);
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  if (!api) {
    setMsg(msg, 'Не задан API base url.', 'err');
    submit.disabled = true;
    return true;
  }
  if (!token) {
    setMsg(msg, 'Ссылка некорректна: отсутствует token.', 'err');
    submit.disabled = true;
    return true;
  }

  setMsg(msg, 'Загрузка…', 'info');
  try {
    const r = await fetch(`${api}/auth/password/reset/preview?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (!r.ok) {
      setMsg(msg, 'Ссылка истекла или уже использована.', 'err');
      submit.disabled = true;
      return true;
    }
    const data = await r.json();
    const em = typeof data?.email === 'string' ? data.email.trim() : '';
    email.value = em || '—';
    setMsg(msg, 'Введите новый пароль и подтвердите.', 'info');
  } catch {
    setMsg(msg, 'Не удалось выполнить запрос. Проверьте сеть.', 'err');
    submit.disabled = true;
    return true;
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const a = p1.value;
    const b = p2.value;
    if (a.length < 8) return setMsg(msg, 'Пароль должен быть минимум 8 символов.', 'err');
    if (a !== b) return setMsg(msg, 'Пароли не совпадают.', 'err');
    submit.disabled = true;
    setMsg(msg, 'Сохраняем…', 'info');
    try {
      const res = await fetch(`${api}/auth/password/reset/confirm`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ token, newPassword: a }),
      });
      if (!res.ok) {
        setMsg(msg, 'Не удалось сбросить пароль. Ссылка могла истечь или быть использована.', 'err');
        submit.disabled = false;
        return;
      }
      setMsg(msg, 'Пароль обновлён. Теперь можно войти с новым паролем.', 'ok');
      p1.value = '';
      p2.value = '';
    } catch {
      setMsg(msg, 'Не удалось выполнить запрос. Проверьте сеть.', 'err');
      submit.disabled = false;
    }
  });

  return true;
}

