import * as React from 'react';

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

const defaultLinkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
};

/**
 * Renders plain text with http(s) and www. URLs turned into external links (safe protocol only).
 */
export function renderTextWithLinks(
  text: string,
  linkStyle?: React.CSSProperties,
): React.ReactNode {
  if (!text) return null;
  const re = new RegExp(URL_REGEX.source, 'gi');
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (m.index > last) out.push(text.slice(last, m.index));
    const parsed = parseHttpUrl(raw);
    if (parsed) {
      out.push(
        <a
          key={`lnk-${k++}`}
          href={parsed.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...defaultLinkStyle, ...linkStyle }}
        >
          {parsed.label}
        </a>,
      );
    } else {
      out.push(raw);
    }
    last = m.index + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 0 ? text : <>{out}</>;
}
