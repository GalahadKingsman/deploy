import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';
import { waitForTelegramWebApp, waitForTelegramInitData } from './telegram.js';
import { setAccessToken, clearAccessToken } from './tokenStorage.js';
import { setUser, clearUser } from './userStorage.js';
import { config } from '../config/flags.js';

/**
 * Bootstrap authentication result
 */
export type BootstrapAuthResult =
  | { mode: 'no-initdata' }
  | { mode: 'authenticated' }
  | { mode: 'rejected' }
  | { mode: 'error'; error?: Error };

/**
 * Bootstrap authentication flow
 *
 * Main logic:
 * 1. Get initData from Telegram (or use provided initData)
 * 2. If no initData: leave token as-is (if exists), return { mode: 'no-initdata' }
 * 3. If initData exists: POST /auth/telegram, save token, return { mode: 'authenticated' }
 *
 * Error handling:
 * - 401/400: clear token, return { mode: 'rejected' }
 * - Network/5xx: don't clear token, return { mode: 'error' }
 *
 * Never blocks render forever.
 * Independent of REAL_API/USE_MSW flags (they only control where requests go).
 *
 * @param initDataOrNull - Optional initData from Telegram; if not provided, waits for it via waitForTelegramInitData()
 */
export async function bootstrapAuth(initDataOrNull?: string | null): Promise<BootstrapAuthResult> {
  let initData: string | null = initDataOrNull ?? null;

  if (initData == null) {
    await waitForTelegramWebApp(5000);
    initData = await waitForTelegramInitData();
  }

  // If no initData, leave token as-is and continue
  if (!initData) {
    return { mode: 'no-initdata' };
  }

  // Check if API is available (explicit URL or same-origin in browser via proxy)
  const hasApi =
    config.API_BASE_URL ||
    (typeof window !== 'undefined' && typeof window.location?.origin === 'string');
  if (!hasApi) {
    return { mode: 'error', error: new Error('API_BASE_URL is not configured') };
  }

  try {
    // POST /auth/telegram with initData
    const response = await fetchJson<ContractsV1.AuthTelegramResponseV1>({
      path: '/auth/telegram',
      method: 'POST',
      body: {
        initData,
      },
    });

    // Save access token and user (so UI shows name/avatar immediately before GET /me)
    setAccessToken(response.accessToken);
    setUser(response.user);

    return { mode: 'authenticated' };
  } catch (error) {
    // Handle API errors
    if (error instanceof ApiClientError) {
      const status = error.status;

      // 401 or 400: authentication failed, clear token and user
      if (status === 401 || status === 400) {
        clearAccessToken();
        clearUser();
        return { mode: 'rejected' };
      }

      // 5xx or other errors: don't clear token (might be temporary)
      return { mode: 'error', error };
    }

    // Network error or other: don't clear token
    return { mode: 'error', error: error instanceof Error ? error : new Error(String(error)) };
  }
}
