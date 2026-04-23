import { getAvatarImageSrc } from './avatarImageUrl.js';

const INITIALS_CLASS = 'avatar--initials';

/**
 * Круг: фото из `users.avatar_url` или **инициалы по центру** (как topbar / профиль),
 * без нормализации путей обложек.
 */
export function applyUserAvatarToElement(
  el: HTMLElement,
  rawUrl: string | null | undefined,
  initialsText: string,
): void {
  const raw = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  el.replaceChildren();
  el.style.background = 'var(--al)';
  el.style.color = 'var(--a)';
  el.style.overflow = 'hidden';
  if (!raw) {
    setAvatarInitials(el, initialsText);
    return;
  }
  const src = getAvatarImageSrc(raw);
  if (!src) {
    setAvatarInitials(el, initialsText);
    return;
  }
  el.classList.remove(INITIALS_CLASS);
  const img = document.createElement('img');
  img.alt = '';
  img.referrerPolicy = 'no-referrer';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.borderRadius = '50%';
  img.style.objectFit = 'cover';
  img.style.display = 'block';
  img.addEventListener(
    'error',
    () => {
      setAvatarInitials(el, initialsText);
    },
    { once: true },
  );
  img.src = src;
  el.appendChild(img);
}

function setAvatarInitials(el: HTMLElement, initials: string): void {
  el.replaceChildren();
  el.classList.add(INITIALS_CLASS);
  el.textContent = (initials || 'ED').trim() || 'ED';
}
