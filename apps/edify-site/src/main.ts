import './edify.css';
import { ACCESS_TOKEN_KEY, getAccessToken } from './authSession.js';
import { claimSiteLoginFromUrl } from './siteLoginClaim.js';
import { refreshNavAuth } from './navAuthUi.js';
import { getTelegramSupportUrl, isLandingPaymentsUiEnabled } from './env.js';
import { createExpertSubscriptionCheckout } from './expertSubscriptionCheckout.js';
import type { ExpertSubscriptionCheckoutProduct } from './expertSubscriptionCheckout.js';
import { legalDocumentPdfUrl } from './legalDocumentUrls.js';
import { hydrateLandingExpertCourses } from './platform/marketingExpertCoursesPreview.js';
import { hydrateLandingExpertDashboard } from './platform/marketingExpertDashboardPreview.js';
import { hydrateLandingStudentScreens } from './platform/marketingStudentScreensPreview.js';
import { mountPlatformShell } from './platform/mountPlatformShell.js';
import { maybeOpenResetPasswordUi } from './resetPasswordUi.js';
import {
  captureReferralFromUrl,
  fetchReferralPreview,
  getStoredReferralCode,
  hasGreetedReferralThisSession,
  markGreetedReferralThisSession,
} from './referralAttribution.js';
import { showReferralWelcomeModal } from './referralWelcomeModal.js';

function toggleMobileNav(): void {
  const nav = document.getElementById('mobile-nav');
  const burger = document.getElementById('nav-burger');
  if (!nav || !burger) return;
  nav.classList.toggle('open');
  burger.classList.toggle('open');
  document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
}

function closeMobileNav(): void {
  const nav = document.getElementById('mobile-nav');
  const burger = document.getElementById('nav-burger');
  if (!nav || !burger) return;
  nav.classList.remove('open');
  burger.classList.remove('open');
  document.body.style.overflow = '';
}

function faq(btn: HTMLElement): void {
  const item = btn.closest('.faq-item');
  if (!item) return;
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach((i) => i.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}

let pricingYearly = false;

function toggleP(): void {
  pricingYearly = !pricingYearly;
  document.getElementById('tog')?.classList.toggle('on', pricingYearly);
  document.getElementById('lbl-m')?.classList.toggle('active', !pricingYearly);
  document.getElementById('lbl-y')?.classList.toggle('active', pricingYearly);
  document.querySelectorAll('.pv').forEach((el) => {
    const m = el.getAttribute('data-m');
    const y = el.getAttribute('data-y');
    const raw = pricingYearly ? y : m;
    const n = raw != null ? Number(raw) : NaN;
    if (!Number.isFinite(n)) return;
    el.textContent = Math.round(n).toLocaleString('ru-RU');
  });
}

declare global {
  interface Window {
    toggleMobileNav: () => void;
    closeMobileNav: () => void;
    faq: (btn: HTMLElement) => void;
    toggleP: () => void;
    /** Для checkout: текущее состояние тумблера «Ежегодно» на лендинге. */
    __edifyPricingYearly: () => boolean;
  }
}

window.toggleMobileNav = toggleMobileNav;
window.closeMobileNav = closeMobileNav;
window.faq = faq;
window.toggleP = toggleP;
window.__edifyPricingYearly = () => pricingYearly;

async function runAuthFlow(): Promise<void> {
  await claimSiteLoginFromUrl();
  await refreshNavAuth();
}

void runAuthFlow();

/**
 * Сохраняем реферальный код из ?ref= и (только при свежем переходе по ссылке) показываем
 * приветственную модалку с именем пригласившего. F5 не повторяет показ — sessionStorage debounce.
 */
async function runReferralWelcomeFlow(): Promise<void> {
  const captured = captureReferralFromUrl();
  const code = captured ?? null;
  if (!code) return;
  if (hasGreetedReferralThisSession()) return;
  const preview = await fetchReferralPreview(code);
  if (!preview.displayName) return;
  markGreetedReferralThisSession();
  showReferralWelcomeModal({
    displayName: preview.displayName,
    avatarUrl: preview.avatarUrl ?? null,
  });
}

void runReferralWelcomeFlow();

// Dedicated public page: /reset-password?token=...
void maybeOpenResetPasswordUi();

/** Возврат из внешнего браузера (openLink) с ?login= — bfcache и переключение вкладок. */
window.addEventListener('pageshow', (ev) => {
  if (ev.persisted) void runAuthFlow();
});

window.addEventListener('focus', () => {
  try {
    if (new URL(window.location.href).searchParams.has('login')) void runAuthFlow();
  } catch {
    /* ignore */
  }
  void refreshNavAuth();
});

/**
 * Telegram Mini App после входа открывает сайт через openLink в **новой вкладке**:
 * там сохраняется токен. Старая вкладка не получает localStorage «сама по себе» —
 * событие `storage` и возврат на вкладку (`visibilitychange`) подтягивают профиль.
 */
window.addEventListener('storage', (ev) => {
  if (ev.key === ACCESS_TOKEN_KEY || ev.key === null) void refreshNavAuth();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refreshNavAuth();
});

// Landing CTA: open auth modal (register/login) in-place
document.addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement | null;
  const el = t?.closest('[data-edify-auth-open]') as HTMLElement | null;
  if (!el) return;
  const mode = (el.getAttribute('data-edify-auth-open') || '').trim();
  if (mode !== 'login' && mode !== 'register' && mode !== 'forgot') return;
  ev.preventDefault();
  window.closeMobileNav?.();
  window.edifyOpenAuthModal?.(mode);
});

function wireLegalDocumentAnchors(): void {
  document.querySelectorAll<HTMLAnchorElement>('a[data-edify-legal]').forEach((a) => {
    const k = a.getAttribute('data-edify-legal');
    if (k !== 'offer' && k !== 'privacy' && k !== 'personal_data') return;
    a.href = legalDocumentPdfUrl(k);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

function openLandingPayConfirmModal(opts: {
  checkoutButton: HTMLButtonElement;
  product: ExpertSubscriptionCheckoutProduct;
}): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'edify-pay-confirm';
  const card = document.createElement('div');
  card.className = 'edify-pay-confirm__card';

  const title = document.createElement('div');
  title.className = 'edify-pay-confirm__title';
  title.textContent = 'Подтверждение оплаты';

  const text = document.createElement('p');
  text.className = 'edify-pay-confirm__text';
  text.append(
    document.createTextNode('Продолжая оплату, вы соглашаетесь с '),
    (() => {
      const a = document.createElement('a');
      a.className = 'edify-pay-confirm__link';
      a.href = legalDocumentPdfUrl('offer');
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Договором-офертой';
      return a;
    })(),
    document.createTextNode('.'),
  );

  const actions = document.createElement('div');
  actions.className = 'edify-pay-confirm__actions';

  const btnPay = document.createElement('button');
  btnPay.type = 'button';
  btnPay.className = 'edify-pay-confirm__btn edify-pay-confirm__btn--primary';
  btnPay.textContent = 'Оплатить';

  const btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'edify-pay-confirm__btn edify-pay-confirm__btn--ghost';
  btnCancel.textContent = 'Отмена';

  const close = () => backdrop.remove();
  btnCancel.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  btnPay.addEventListener('click', () => {
    btnPay.disabled = true;
    btnCancel.disabled = true;
    const el = opts.checkoutButton;
    const hadBusy = el.getAttribute('aria-busy') === 'true';
    if (!hadBusy) {
      el.setAttribute('aria-busy', 'true');
      el.disabled = true;
    }
    void (async () => {
      try {
        const r = await createExpertSubscriptionCheckout(opts.product);
        if (!r.ok) {
          if (r.needAuth) {
            window.alert(r.error);
            window.edifyOpenAuthModal?.('login');
            return;
          }
          window.alert(r.error);
          return;
        }
        close();
        window.location.assign(r.payUrl);
      } finally {
        if (!hadBusy) {
          el.removeAttribute('aria-busy');
          el.disabled = false;
        }
        btnPay.disabled = false;
        btnCancel.disabled = false;
      }
    })();
  });

  actions.append(btnPay, btnCancel);
  card.append(title, text, actions);
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
}

/**
 * Checkout по тарифам: вешаем обработчик на саму кнопку и читаем продукт с `currentTarget`,
 * а не через `target.closest(...)`, чтобы сумма всегда соответствовала нажатой CTA.
 */
function wireLandingCheckoutProductButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('button[data-edify-checkout-product]').forEach((btn) => {
    if (btn.dataset.edifyCheckoutWired === '1') return;
    btn.dataset.edifyCheckoutWired = '1';
    btn.addEventListener('click', function onCheckoutClick(ev: MouseEvent) {
      ev.preventDefault();
      const el = ev.currentTarget as HTMLButtonElement;
      if (!isLandingPaymentsUiEnabled()) {
        window.alert('Оплата на лендинге отключена в сборке (VITE_PAYMENTS_ENABLED).');
        return;
      }
      const raw = (el.getAttribute('data-edify-checkout-product') || '').trim();
      const product = (raw === 'expert_pro' ? 'expert_pro' : 'platform_entry') as ExpertSubscriptionCheckoutProduct;
      openLandingPayConfirmModal({ checkoutButton: el, product });
    });
  });
}

wireLegalDocumentAnchors();

wireLandingCheckoutProductButtons();

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    });
  },
  { threshold: 0.1 },
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/**
 * Перенаправляем «Поддержку» на Telegram-бот (?start=support), если бот настроен.
 * HTML по умолчанию указывает mailto:edify.support@gmail.com — fallback для пустой переменной/окружения без JS.
 */
function upgradeSupportLinksToTelegram(): void {
  const url = getTelegramSupportUrl();
  if (!url) return;
  document.querySelectorAll<HTMLAnchorElement>('a[data-edify-support-tg]').forEach((a) => {
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}
upgradeSupportLinksToTelegram();

// Ограничиваем доступ на /platform/ только авторизованным
document.addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement | null;
  const a = t?.closest('a[href^="/platform"]') as HTMLAnchorElement | null;
  if (!a) return;

  const token = getAccessToken();
  if (!token) {
    ev.preventDefault();
    closeMobileNav();
    window.alert('Авторизуйтесь для перехода на платформу');
  }
});

const platformMount = document.getElementById('edify-platform-mount');
if (platformMount) {
  const shell = mountPlatformShell(platformMount, {
    marketingPreview: true,
    onAction(action) {
      if (import.meta.env.DEV) console.debug('[edify-platform]', action);
      if (action.type === 'navigate' && action.screenId === 'e-dashboard') {
        hydrateLandingExpertDashboard(action.shadowRoot);
      }
      if (action.type === 'navigate' && action.screenId === 'e-courses') {
        hydrateLandingExpertCourses(action.shadowRoot);
      }
      if (action.type === 'navigate' && (action.screenId === 's-catalog' || action.screenId === 's-mycourses')) {
        hydrateLandingStudentScreens(action.shadowRoot);
      }
    },
  });
  // Initial template state (dashboard).
  hydrateLandingExpertDashboard(shell.shadowRoot);
  hydrateLandingStudentScreens(shell.shadowRoot);
}
