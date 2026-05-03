import { getAccessToken } from './authSession.js';
import { getApiBaseUrl } from './env.js';

export type ExpertSubscriptionCheckoutResult =
  | { ok: true; payUrl: string }
  | { ok: false; error: string; needAuth?: boolean };

/**
 * POST /checkout/expert-subscription — только для владельца пространства эксперта (JWT).
 * Сумма на стороне API: price_cents в БД или EXPERT_SUBSCRIPTION_CHECKOUT_PRICE_CENTS.
 */
export async function createExpertSubscriptionCheckout(): Promise<ExpertSubscriptionCheckoutResult> {
  const api = getApiBaseUrl();
  if (!api.trim()) {
    return { ok: false, error: 'Не настроен адрес API (VITE_API_BASE_URL или meta edify-api-base).' };
  }
  const token = getAccessToken();
  if (!token) {
    return { ok: false, error: 'Войдите в аккаунт, чтобы перейти к оплате.', needAuth: true };
  }

  const url = `${api}/checkout/expert-subscription`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Сеть: ${msg}` };
  }

  const text = await res.text();
  let data: { payUrl?: string | null; order?: { payUrl?: string | null } } = {};
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    return { ok: false, error: text ? `${res.status}: ${text.slice(0, 400)}` : `HTTP ${res.status}` };
  }

  if (!res.ok) {
    let msg = text.slice(0, 500);
    try {
      const j = JSON.parse(text) as { message?: string };
      if (typeof j.message === 'string' && j.message.trim()) msg = j.message.trim();
    } catch {
      /* use raw */
    }
    if (res.status === 401) {
      return { ok: false, error: 'Сессия истекла — войдите снова.', needAuth: true };
    }
    return { ok: false, error: msg || `HTTP ${res.status}` };
  }

  const payUrl = (typeof data.payUrl === 'string' && data.payUrl.trim()) || data.order?.payUrl?.trim() || '';
  if (!payUrl) {
    return {
      ok: false,
      error:
        'Ссылка на оплату не получена. Включите PAYMENTS_ENABLED, задайте сумму (EXPERT_SUBSCRIPTION_CHECKOUT_PRICE_CENTS или price_cents в БД) и ключи Tinkoff.',
    };
  }
  return { ok: true, payUrl };
}
