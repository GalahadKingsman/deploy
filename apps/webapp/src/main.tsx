import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './shared/ui/theme/tokens.css';
import './shared/ui/theme/global.css';
import { startMocking } from './shared/mocks/startMocking.js';
import { bootstrapAuth } from './shared/auth/bootstrapAuth.js';
import { getAccessToken, clearAccessToken } from './shared/auth/tokenStorage.js';
import { waitForTelegramWebApp, waitForTelegramInitData } from './shared/auth/telegram.js';
import { setReferral } from './shared/referrals/referralStorage.js';
import {
  AuthDiagnosticProvider,
  type AuthDiagnostic,
} from './shared/auth/AuthDiagnosticContext.js';
// Import probe for dev-only API testing
import './shared/api/probe.js';

/**
 * Shown immediately while bootstrap runs — same background as app, no black flash
 */
function BootstrapLoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, var(--app-bg-1) 0%, var(--app-bg-2) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sp-4)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '3px solid var(--chrome-border)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/**
 * Show setup error when opened from Telegram but API is not configured
 */
function BootstrapErrorScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 'var(--sp-5)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-base)',
        color: 'var(--fg)',
        maxWidth: '400px',
        margin: '0 auto',
      }}
    >
      <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--sp-4)' }}>
        Не удалось подключиться
      </h2>
      <p style={{ marginBottom: 'var(--sp-4)' }}>{message}</p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}>
        Запусти webapp с переменной: <code>VITE_API_BASE_URL=http://localhost:3001</code> (если
        открываешь с компьютера). Если с телефона — подними API в ngrok и укажи его URL.
      </p>
    </div>
  );
}

async function bootstrap() {
  // Capture referral code from URL (public entrypoint)
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (ref) setReferral(ref);
  } catch {
    // ignore
  }

  // Start mocking (never throws, always returns valid mode)
  await startMocking();

  // Wait for Telegram WebApp and initData (Telegram may inject async, especially on mobile)
  const telegramReady = await waitForTelegramWebApp(5000);
  const initDataSnapshot = await waitForTelegramInitData();

  // Bootstrap authentication (never throws, never blocks)
  let authResult: Awaited<ReturnType<typeof bootstrapAuth>> | null = null;
  try {
    authResult = await bootstrapAuth(initDataSnapshot);
  } catch (error) {
    console.warn('Bootstrap auth failed (non-blocking):', error);
  }

  const diagnostic: AuthDiagnostic = {
    telegramReady,
    hasInitData: !!initDataSnapshot,
    initDataLength: initDataSnapshot?.length ?? 0,
    authResult,
  };

  // Dev-only: expose for console and render banner
  if (import.meta.env.DEV) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__trackedAuth = {
      getAccessToken,
      clearAccessToken,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__trackedAuthDiagnostic = diagnostic;
  }

  const showSetupError =
    authResult?.mode === 'error' &&
    (authResult.error?.message?.includes('API_BASE_URL') ||
      authResult.error?.message?.includes('not configured'));
  const errorMessage = authResult?.mode === 'error' ? authResult.error?.message : undefined;

  renderApp(
    showSetupError ? <BootstrapErrorScreen message={errorMessage ?? 'API не настроен'} /> : <App />,
    diagnostic,
  );
}

function renderApp(children: React.ReactNode, diagnostic: AuthDiagnostic | null) {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  reactRoot.render(
    <React.StrictMode>
      <AuthDiagnosticProvider value={import.meta.env.DEV ? diagnostic : null}>
        {children}
      </AuthDiagnosticProvider>
    </React.StrictMode>,
  );
}

// Mount root once and show loading immediately (no black screen)
const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found');
}
const reactRoot = ReactDOM.createRoot(rootEl);
reactRoot.render(
  <React.StrictMode>
    <BootstrapLoadingScreen />
  </React.StrictMode>,
);

// Run bootstrap in background, then show app
bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
  renderApp(<App />, null);
});
