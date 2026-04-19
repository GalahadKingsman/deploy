/**
 * Same URL rules as webapp `renderTextWithLinks` — http(s) and www. → external links only.
 * @see apps/webapp/src/shared/lib/renderTextWithLinks.tsx
 */
const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

function parseHttpUrl(raw: string): { href: string; label: string } | null {
  let candidate = raw.trim();
  for (let n = 0; n < 12 && candidate.length > 0; n++) {
    let tryStr = candidate;
    if (/^www\./i.test(tryStr)) tryStr = `https://${tryStr}`;
    try {
      const u = new URL(tryStr);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return { href: u.href, label: candidate };
      }
    } catch {
      /* try shorter */
    }
    if (!/[.,;:!?)'"\u201d\u2019\]]+$/u.test(candidate)) break;
    candidate = candidate.slice(0, -1);
  }
  return null;
}

/**
 * Plain text + newlines + autolinked URLs (Telegram WebApp behavior).
 */
export function setRichTextWithLinks(el: HTMLElement | null, text: string): void {
  if (!el) return;
  el.replaceChildren();
  el.style.whiteSpace = 'pre-wrap';
  el.style.wordBreak = 'break-word';
  el.style.overflowWrap = 'anywhere';

  if (!text) return;

  const re = new RegExp(URL_REGEX.source, 'gi');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (m.index > last) {
      el.appendChild(document.createTextNode(text.slice(last, m.index)));
    }
    const parsed = parseHttpUrl(raw);
    if (parsed) {
      const a = document.createElement('a');
      a.href = parsed.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = parsed.label;
      a.style.color = 'var(--a)';
      a.style.textDecoration = 'underline';
      a.style.textUnderlineOffset = '2px';
      a.style.wordBreak = 'break-all';
      el.appendChild(a);
    } else {
      el.appendChild(document.createTextNode(raw));
    }
    last = m.index + raw.length;
  }
  if (last < text.length) {
    el.appendChild(document.createTextNode(text.slice(last)));
  }
}
