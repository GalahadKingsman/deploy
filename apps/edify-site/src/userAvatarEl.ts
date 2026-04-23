import { getAvatarImageSrc } from './avatarImageUrl.js';

/**
 * Круг с фото из `users.avatar_url` (как правый верх в шелле и `data-ep-profile-avatar`):
 * только `getAvatarImageSrc(raw)` — без `normalizeAssetUrl` (логика не для обложек курсов).
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
    el.textContent = initialsText;
    return;
  }
  const src = getAvatarImageSrc(raw);
  if (!src) {
    el.textContent = initialsText;
    return;
  }
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
      el.replaceChildren();
      el.textContent = initialsText;
    },
    { once: true },
  );
  img.src = src;
  el.appendChild(img);
}
