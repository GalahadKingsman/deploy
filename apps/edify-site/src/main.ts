import './edify.css';
import { claimSiteLoginFromUrl } from './siteLoginClaim.js';
import { refreshNavAuth } from './navAuthUi.js';

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

function showScreen(btn: HTMLElement, id: string): void {
  document.querySelectorAll('.ptab').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('[id^="screen-"]').forEach((s) => {
    (s as HTMLElement).style.display = 'none';
  });
  document.getElementById(`screen-${id}`)?.style.setProperty('display', 'block');
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
    showScreen: (btn: HTMLElement, id: string) => void;
    faq: (btn: HTMLElement) => void;
    toggleP: () => void;
  }
}

window.toggleMobileNav = toggleMobileNav;
window.closeMobileNav = closeMobileNav;
window.showScreen = showScreen;
window.faq = faq;
window.toggleP = toggleP;

void (async () => {
  await claimSiteLoginFromUrl();
  await refreshNavAuth();
})();

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

document.querySelectorAll('.grade-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const row = btn.closest('.hw-grade-row');
    row?.querySelectorAll('.grade-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
