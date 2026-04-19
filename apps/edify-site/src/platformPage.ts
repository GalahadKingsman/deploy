import './edify.css';
import { ACCESS_TOKEN_KEY } from './authSession.js';
import { claimSiteLoginFromUrl } from './siteLoginClaim.js';
import { refreshNavAuth } from './navAuthUi.js';
import { mountPlatformShell } from './platform/mountPlatformShell.js';

async function runAuthFlow(): Promise<void> {
  await claimSiteLoginFromUrl();
  await refreshNavAuth();
}

void runAuthFlow();

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

window.addEventListener('storage', (ev) => {
  if (ev.key === ACCESS_TOKEN_KEY || ev.key === null) void refreshNavAuth();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refreshNavAuth();
});

const platformMount = document.getElementById('edify-platform-mount');
if (platformMount) {
  mountPlatformShell(platformMount, {
    onAction(action) {
      // Здесь будем “подвязывать” API/данные по мере разработки платформы.
      if (import.meta.env.DEV) console.debug('[edify-platform-page]', action);
    },
  });
}

// Reveal анимации — на этой странице тоже полезны.
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

