import { getApiBaseUrl } from './env.js';
import { getAccessToken } from './authSession.js';
import { claimSiteLoginFromUrl } from './siteLoginClaim.js';

function setInviteRoot(html: string): void {
  const root = document.getElementById('invite-root');
  if (root) root.innerHTML = html;
}

async function main(): Promise<void> {
  await claimSiteLoginFromUrl();

  const m = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/);
  const code = (m?.[1] ?? '').trim();
  if (!code) {
    setInviteRoot('<p>Некорректная ссылка приглашения.</p>');
    return;
  }

  const token = getAccessToken();
  if (!token) {
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setInviteRoot(
      `<p>Войдите в аккаунт EDIFY в этом браузере, затем снова откройте эту ссылку.</p>
       <p style="margin-top:14px"><a href="/">Главная</a> · <a href="/platform/">Платформа</a></p>
       <p style="font-size:13px;opacity:.75;margin-top:14px">После входа вернитесь по адресу: <code style="word-break:break-all">${escapeHtml(
         window.location.origin + here,
       )}</code></p>`,
    );
    return;
  }

  const api = getApiBaseUrl();
  if (!api) {
    setInviteRoot('<p>Не задан адрес API для сайта.</p>');
    return;
  }

  try {
    const res = await fetch(`${api}/invites/activate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, referralCode: null }),
    });

    const raw = await res.text();
    let body: { courseId?: string; message?: string; error?: { message?: string } } = {};
    try {
      body = raw ? (JSON.parse(raw) as typeof body) : {};
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      const msg =
        body?.error?.message ||
        body?.message ||
        (typeof raw === 'string' && raw.length < 400 ? raw : '') ||
        res.statusText;
      setInviteRoot(`<p>Не удалось активировать приглашение.</p><p style="opacity:.85;font-size:13px">${escapeHtml(msg)}</p>`);
      return;
    }

    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    if (!courseId) {
      setInviteRoot('<p>Сервер не вернул курс.</p>');
      return;
    }

    const base = window.location.origin.replace(/\/$/, '');
    window.location.replace(`${base}/platform/?role=student&course=${encodeURIComponent(courseId)}`);
  } catch {
    setInviteRoot('<p>Ошибка сети. Проверьте соединение и попробуйте снова.</p>');
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

void main();
