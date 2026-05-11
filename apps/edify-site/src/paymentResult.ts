import './edify.css';
import { getTelegramSupportUrl } from './env.js';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function mount(): void {
  const root = document.getElementById('payment-outcome-root');
  if (!root) return;

  const outcome = document.body.getAttribute('data-outcome') === 'fail' ? 'fail' : 'success';
  const supportUrl = getTelegramSupportUrl();

  const top = el('header', 'payment-outcome-top');
  const logo = el('a', 'payment-outcome-logo', 'EDIFY');
  logo.href = '/';
  top.appendChild(logo);

  const card = el('article', `payment-outcome-card payment-outcome-card--${outcome}`);
  const icon = el('div', `payment-outcome-icon payment-outcome-icon--${outcome}`);
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = outcome === 'success' ? '✓' : '!';

  const label = el('div', 'payment-outcome-label', outcome === 'success' ? 'Оплата' : 'Платёж');
  const title = el(
    'h1',
    'payment-outcome-title',
    outcome === 'success' ? 'Оплата прошла успешно' : 'Не удалось завершить оплату',
  );
  const lead = el(
    'p',
    'payment-outcome-lead',
    outcome === 'success'
      ? 'Банк подтвердил платёж. Доступ по подписке обновится в течение нескольких минут. Автопродление и отключение — в разделе «Профиль» в кабинете.'
      : 'Карта могла быть отклонена, сессия оплаты истекла или вы закрыли окно банка. Попробуйте ещё раз с той же страницы тарифов или выберите другой способ.',
  );

  card.appendChild(icon);
  card.appendChild(label);
  card.appendChild(title);
  card.appendChild(lead);

  const actions = el('div', 'payment-outcome-actions');
  const primary = el('a', 'btn-primary', outcome === 'success' ? 'В кабинет' : 'К тарифам');
  primary.href = outcome === 'success' ? '/platform/?screen=s-profile' : '/#pricing';
  const secondary = el('a', 'btn-outline', 'На главную');
  secondary.href = '/';
  actions.appendChild(primary);
  actions.appendChild(secondary);
  card.appendChild(actions);

  if (outcome === 'fail' && supportUrl) {
    const help = el('p', 'payment-outcome-help');
    const link = el('a', 'payment-outcome-link', 'Написать в поддержку');
    link.href = supportUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    help.append('Если списание прошло, но вы видите эту страницу — ');
    help.appendChild(link);
    help.append('.');
    card.appendChild(help);
  }

  root.appendChild(top);
  root.appendChild(card);
}

mount();
