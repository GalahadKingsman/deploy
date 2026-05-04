import { buildInviteTelegramStartUrl, buildInviteWebActivateUrl } from '../inviteLinks.js';

export type ExpertCourseInviteRow = {
  code: string;
  maxUses?: number | null;
  usesCount?: number;
};

/** Рендер списка инвайтов в drawer «Доступ к курсу» (конструктор). */
export function renderExpertCourseInvitesPanel(root: ShadowRoot, items: ExpertCourseInviteRow[]): void {
  const host = root.querySelector('[data-ep-access-invites]') as HTMLElement | null;
  const empty = root.querySelector('[data-ep-access-invites-empty]') as HTMLElement | null;
  if (!host || !empty) return;
  host.replaceChildren();
  const rows = items ?? [];
  empty.style.display = rows.length ? 'none' : '';
  for (const i of rows) {
    const card = document.createElement('div');
    card.style.padding = '10px 12px';
    card.style.border = '1px solid var(--line)';
    card.style.borderRadius = '12px';
    card.style.background = 'var(--surface2)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '10px';

    const tgUrl = buildInviteTelegramStartUrl(i.code);
    const webUrl = buildInviteWebActivateUrl(i.code);
    const linkBlock = document.createElement('div');
    linkBlock.style.display = 'flex';
    linkBlock.style.flexDirection = 'column';
    linkBlock.style.gap = '6px';

    const webLab = document.createElement('div');
    webLab.style.fontSize = '11px';
    webLab.style.fontWeight = '650';
    webLab.style.color = 'var(--t1)';
    webLab.textContent = 'Ссылка для зачисления';
    const webHint = document.createElement('div');
    webHint.style.fontSize = '10px';
    webHint.style.color = 'var(--t3)';
    webHint.style.lineHeight = '1.45';
    webHint.textContent =
      'Ссылка для браузера (не окно Mini App в Telegram). Ученик должен войти в аккаунт на этом сайте; после перехода доступ к курсу активируется.';
    const webA = document.createElement('a');
    webA.href = webUrl;
    webA.target = '_blank';
    webA.rel = 'noopener noreferrer';
    webA.style.fontSize = '12px';
    webA.style.color = 'var(--a)';
    webA.style.wordBreak = 'break-all';
    webA.textContent = webUrl;
    linkBlock.append(webLab, webHint, webA);

    if (tgUrl) {
      const tgLab = document.createElement('div');
      tgLab.style.fontSize = '10px';
      tgLab.style.color = 'var(--t3)';
      tgLab.style.fontFamily = 'var(--fm)';
      tgLab.style.textTransform = 'uppercase';
      tgLab.style.letterSpacing = '0.06em';
      tgLab.style.marginTop = '6px';
      tgLab.textContent = 'Дополнительно через Telegram';
      const tgA = document.createElement('a');
      tgA.href = tgUrl;
      tgA.target = '_blank';
      tgA.rel = 'noopener noreferrer';
      tgA.style.fontSize = '12px';
      tgA.style.color = 'var(--a)';
      tgA.style.wordBreak = 'break-all';
      tgA.textContent = tgUrl;
      linkBlock.append(tgLab, tgA);
    }

    const limit = i.maxUses == null ? '∞' : String(i.maxUses);
    const used = i.usesCount ?? 0;
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.flexWrap = 'wrap';
    footer.style.alignItems = 'baseline';
    footer.style.gap = '6px 12px';
    footer.style.fontSize = '10px';
    footer.style.color = 'var(--t3)';
    footer.style.fontFamily = 'var(--fm)';
    const usage = document.createElement('span');
    usage.textContent = `Активаций: ${used}/${limit}`;
    const token = document.createElement('span');
    token.style.opacity = '0.85';
    token.title = 'Технический идентификатор (не для отправки ученику отдельно)';
    token.textContent = `код ${i.code}`;
    footer.append(usage, token);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.flexWrap = 'wrap';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-outline btn-sm';
    copyBtn.textContent = 'Скопировать ссылку';
    copyBtn.dataset.epAccessInviteCopy = i.code;
    copyBtn.disabled = false;

    const revokeBtn = document.createElement('button');
    revokeBtn.type = 'button';
    revokeBtn.className = 'btn btn-ghost btn-sm';
    revokeBtn.textContent = 'Отозвать';
    revokeBtn.dataset.epAccessInviteRevoke = i.code;

    actions.append(copyBtn, revokeBtn);
    card.append(linkBlock, footer, actions);
    host.appendChild(card);
  }
}
