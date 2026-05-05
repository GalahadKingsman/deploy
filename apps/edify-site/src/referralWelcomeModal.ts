import { getAvatarImageSrc } from './avatarImageUrl.js';

export interface ReferralWelcomeModalParams {
  displayName: string;
  avatarUrl: string | null;
  onClose?: () => void;
}

const MODAL_ID = 'edify-referral-welcome';

function avatarInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase() || 'EI';
}

/**
 * Модалка-приветствие в стилистике существующей `.edify-auth` (см. edify.css).
 * Используется только на главном лендинге: поэтому здесь дополнительный отступ
 * сверху (чтобы не перекрывать sticky-навигацию) и spinner на аватарке.
 */
export function showReferralWelcomeModal(params: ReferralWelcomeModalParams): void {
  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = MODAL_ID;
  backdrop.className = 'edify-auth edify-referral-welcome';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'edify-auth__card edify-referral-welcome__card';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'edify-auth__close edify-referral-welcome__close';
  close.setAttribute('aria-label', 'Закрыть');
  close.innerHTML = '&times;';

  const head = document.createElement('div');
  head.className = 'edify-referral-welcome__head';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'edify-referral-welcome__avatar';
  const initialsBadge = document.createElement('div');
  initialsBadge.className = 'edify-referral-welcome__avatar-fallback';
  initialsBadge.textContent = avatarInitialsFromName(params.displayName);
  avatarWrap.appendChild(initialsBadge);
  if (params.avatarUrl) {
    const src = getAvatarImageSrc(params.avatarUrl);
    if (src) {
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.src = src;
      img.addEventListener('load', () => {
        if (initialsBadge.parentNode === avatarWrap) avatarWrap.replaceChild(img, initialsBadge);
      });
    }
  }

  const title = document.createElement('div');
  title.className = 'edify-referral-welcome__title';
  title.textContent = 'Добро пожаловать в EDIFY';

  const subtitle = document.createElement('div');
  subtitle.className = 'edify-referral-welcome__subtitle';
  const inviterText = document.createElement('span');
  inviterText.textContent = 'Вас пригласил ';
  const inviterStrong = document.createElement('strong');
  inviterStrong.textContent = params.displayName;
  subtitle.append(inviterText, inviterStrong);

  head.append(avatarWrap, title, subtitle);

  const body = document.createElement('div');
  body.className = 'edify-referral-welcome__body';
  body.innerHTML =
    '<p>EDIFY — образовательная платформа для экспертов и студентов: курсы, домашние задания, аттестации и встроенная реферальная программа.</p>' +
    '<p>Зарегистрируйтесь или войдите, чтобы открыть кабинет — мы автоматически свяжем ваш аккаунт с пригласившим экспертом.</p>';

  const actions = document.createElement('div');
  actions.className = 'edify-referral-welcome__actions';

  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'edify-auth__submit edify-referral-welcome__primary';
  primary.textContent = 'Продолжить';

  actions.append(primary);

  card.append(close, head, body, actions);
  backdrop.appendChild(card);

  const finish = () => {
    backdrop.remove();
    if (params.onClose) params.onClose();
  };
  close.addEventListener('click', finish);
  primary.addEventListener('click', finish);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) finish();
  });
  document.addEventListener('keydown', function onKey(ev) {
    if (ev.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      finish();
    }
  });

  document.body.appendChild(backdrop);
}
