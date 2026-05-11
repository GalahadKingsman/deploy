import { getAccessToken } from './authSession.js';
import { getApiBaseUrl } from './env.js';
import { getStoredReferralCode } from './referralAttribution.js';

export type ExpertSubscriptionCheckoutProduct = 'platform_entry' | 'expert_pro';

export type ExpertSubscriptionCheckoutResult =
  | { ok: true; payUrl: string }
  | { ok: false; error: string; needAuth?: boolean };

function readLandingPricingYearly(): boolean {
  try {
    const fn = (window as unknown as { __edifyPricingYearly?: () => boolean }).__edifyPricingYearly;
    return typeof fn === 'function' ? Boolean(fn()) : false;
  } catch {
    return false;
  }
}

/**
 * POST /checkout/expert-subscription — JWT, сумма и период считаются на API.
 */
export async function createExpertSubscriptionCheckout(
  product: ExpertSubscriptionCheckoutProduct,
): Promise<ExpertSubscriptionCheckoutResult> {
  const api = getApiBaseUrl();
  if (!api.trim()) {
    return { ok: false, error: 'Не настроен адрес API (VITE_API_BASE_URL или meta edify-api-base).' };
  }
  const token = getAccessToken();
  if (!token) {
    return { ok: false, error: 'Войдите в аккаунт, чтобы перейти к оплате.', needAuth: true };
  }

  if (product === 'expert_pro') {
    try {
      const subRes = await fetch(`${api.replace(/\/+$/, '')}/me/expert-subscription`, {
        method: 'GET',
        headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      });
      if (subRes.ok) {
        const sub = (await subRes.json()) as {
          status?: string;
          currentPeriodEnd?: string | null;
        } | null;
        if (sub && sub.status === 'active') {
          const endMs = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null;
          if (endMs == null || endMs > Date.now()) {
            return {
              ok: false,
              error:
                'У вас уже есть активная подписка эксперта. Продление и автопродление — в разделе «Профиль».',
            };
          }
        }
      }
    } catch {
      /* если /me/expert-subscription недоступен — не блокируем оплату */
    }
  }

  const billingPeriod = readLandingPricingYearly() ? 'yearly' : 'monthly';
  const url = `${api.replace(/\/+$/, '')}/checkout/expert-subscription`;
  const referralCode = getStoredReferralCode();
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ product, billingPeriod, referralCode }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Сеть: ${msg}` };
  }

  const text = await res.text();
  let data: { payUrl?: string | null; tinkoffInitError?: string | null; order?: { payUrl?: string | null } } = {};
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
    const bank =
      typeof data.tinkoffInitError === 'string' && data.tinkoffInitError.trim() ? data.tinkoffInitError.trim() : '';
    const base =
      'Ссылка на оплату не получена. Поле provider у заказа по умолчанию tinkoff в БД — это не признак успешного Init.';
    return {
      ok: false,
      error: bank ? `${base} Детали: ${bank}` : `${base} Проверьте TINKOFF_* в окружении API и логи сервера.`,
    };
  }
  return { ok: true, payUrl };
}
