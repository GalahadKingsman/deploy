import { Bot, InlineKeyboard } from 'grammy';
import { BotEnvSchema, validateOrThrow } from '@tracked/shared';

const env = validateOrThrow(BotEnvSchema, process.env);

// Startup validation: TELEGRAM_WEBAPP_URL (required, https, no trailing slash)
const raw = process.env.TELEGRAM_WEBAPP_URL;
if (raw === undefined || raw.trim() === '') {
  throw new Error(
    'TELEGRAM_WEBAPP_URL is required (free ngrok URL; set it before starting the bot)',
  );
}
const trimmed = raw.trim();
const parsed = new URL(trimmed);
if (parsed.protocol !== 'https:') {
  throw new Error(`TELEGRAM_WEBAPP_URL must be https (got: ${trimmed})`);
}
const WEBAPP_URL = trimmed.replace(/\/+$/, '');

const bot = new Bot(env.BOT_TOKEN);

// Ensure long polling works even if a webhook was previously configured for this bot token.
// If webhook is set, Telegram will NOT deliver updates via getUpdates (polling), and the bot will appear "silent".
try {
  await bot.api.deleteWebhook({ drop_pending_updates: true });
} catch (e) {
  // Non-fatal: we can still try to start; but if webhook is set, polling won't work.
  console.warn('Failed to delete webhook (polling may not receive updates):', e);
}

const openWebAppKb = new InlineKeyboard().webApp('Open WebApp', WEBAPP_URL);

const pendingSubmissions = new Map<string, { lessonId: string }>();
const pendingContacts = new Map<string, { step: 'await_contact' | 'await_email' }>();

function isInviteCode(s: string): boolean {
  // Our invite codes are hex strings produced by randomBytes(12).toString('hex') => 24 chars.
  return /^[a-f0-9]{8,64}$/i.test(s);
}

/** Mini App получает `start_param` из query `startapp` на URL кнопки WebApp. */
function webAppUrlWithStartApp(startParam: string): string {
  const u = new URL(WEBAPP_URL);
  u.searchParams.set('startapp', startParam);
  return u.toString();
}

bot.command('inv', async (ctx) => {
  const text = ctx.message?.text ?? '';
  const code = text.replace(/^\/inv(@\w+)?\s*/i, '').trim();
  if (!code || !isInviteCode(code)) {
    await ctx.reply('Usage: /inv <inviteCode>');
    return;
  }
  const url = `${WEBAPP_URL}/invite/${encodeURIComponent(code)}`;
  const kb = new InlineKeyboard().webApp('Open WebApp', url);
  await ctx.reply('Open the app to activate invite:', { reply_markup: kb });
});

// Команда /start — inline-кнопка Open WebApp; поддерживаем deep link payload (inv_<code>)
bot.command('start', async (ctx) => {
  const text = ctx.message?.text ?? '';
  const payloadRaw = text.replace(/^\/start(@\w+)?\s*/i, '').trim();
  if (payloadRaw.startsWith('inv_')) {
    const code = payloadRaw.slice('inv_'.length).trim();
    if (isInviteCode(code)) {
      const url = `${WEBAPP_URL}/invite/${encodeURIComponent(code)}`;
      const kb = new InlineKeyboard().webApp('Open WebApp', url);
      await ctx.reply('Open the app to activate invite:', { reply_markup: kb });
      return;
    }
  }
  // Привязка аккаунта с сайта: t.me/bot?start=link_<code> → Mini App с start_param=link_<code>
  if (payloadRaw.startsWith('link_')) {
    const code = payloadRaw.slice('link_'.length).trim();
    if (code && isInviteCode(code)) {
      // Telegram clients may not reliably propagate start_param for WebApp buttons.
      // Keep startapp for those that do, but also include plain query param as a fallback.
      const url = (() => {
        const u = new URL(webAppUrlWithStartApp(`link_${code}`));
        u.searchParams.set('link', code);
        return u.toString();
      })();
      const kb = new InlineKeyboard().webApp('Open WebApp', url);
      await ctx.reply('Нажмите кнопку, чтобы завершить привязку Telegram к аккаунту на сайте:', {
        reply_markup: kb,
      });
      return;
    }
  }
  // Вход с маркетингового сайта: t.me/bot?start=site → Mini App с start_param=site
  if (payloadRaw.toLowerCase() === 'site') {
    const url = webAppUrlWithStartApp('site');
    const kb = new InlineKeyboard().webApp('Open WebApp', url);
    await ctx.reply('Нажмите кнопку, чтобы завершить вход на сайте:', { reply_markup: kb });
    return;
  }
  await ctx.reply(
    'Open the app:',
    {
      reply_markup: openWebAppKb,
    },
  );
});

bot.command('submit', async (ctx) => {
  const text = ctx.message?.text ?? '';
  const parts = text.split(' ').map((p) => p.trim()).filter(Boolean);
  const lessonId = parts[1];
  if (!lessonId) {
    await ctx.reply('Usage: /submit <lessonId>');
    return;
  }
  const tgId = String(ctx.from?.id ?? '');
  pendingSubmissions.set(tgId, { lessonId });
  await ctx.reply(
    `Send your submission for lesson ${lessonId}.\n\nYou can send:\n- text message\n- file (document)\n\nOr /cancel`,
  );
});

bot.command('cancel', async (ctx) => {
  const tgId = String(ctx.from?.id ?? '');
  pendingSubmissions.delete(tgId);
  pendingContacts.delete(tgId);
  await ctx.reply('Cancelled.');
});

async function upsertContact(params: { telegramUserId: string; phone?: string | null; email?: string | null }) {
  const shared = (env.TELEGRAM_BOT_TOKEN ?? env.BOT_TOKEN).trim();
  const internal = (env.BOT_INTERNAL_TOKEN ?? '').trim();
  const res = await fetch(`${env.BOT_API_BASE_URL.replace(/\/+$/, '')}/bot/contact`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-token': shared,
      ...(internal ? { 'x-bot-internal-token': internal } : {}),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const payload = await res.text();
    throw new Error(`API error: ${res.status} ${payload}`);
  }
  return (await res.json()) as any;
}

bot.command('contact', async (ctx) => {
  const tgId = String(ctx.from?.id ?? '');
  pendingContacts.set(tgId, { step: 'await_contact' });
  await ctx.reply('Отправьте контакт (телефон) через Telegram, затем я попрошу email (необязательно).');
});

bot.on('message:contact', async (ctx) => {
  const tgId = String(ctx.from?.id ?? '');
  const pending = pendingContacts.get(tgId);
  if (!pending || pending.step !== 'await_contact') return;

  const phone = ctx.message.contact.phone_number ? String(ctx.message.contact.phone_number).trim() : '';
  try {
    await upsertContact({ telegramUserId: tgId, phone: phone || null });
    pendingContacts.set(tgId, { step: 'await_email' });
    await ctx.reply('Телефон сохранён. Теперь отправьте email текстом (или /cancel).');
  } catch (e) {
    await ctx.reply('Не удалось сохранить контакт. Попробуйте позже.');
    throw e;
  }
});

async function createSubmission(params: {
  telegramUserId: string;
  lessonId: string;
  text?: string | null;
  telegramFileId?: string | null;
}) {
  const shared = (env.TELEGRAM_BOT_TOKEN ?? env.BOT_TOKEN).trim();
  const internal = (env.BOT_INTERNAL_TOKEN ?? '').trim();
  const res = await fetch(`${env.BOT_API_BASE_URL.replace(/\/+$/, '')}/bot/submissions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-token': shared,
      ...(internal ? { 'x-bot-internal-token': internal } : {}),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const payload = await res.text();
    throw new Error(`API error: ${res.status} ${payload}`);
  }
  return (await res.json()) as any;
}

bot.on('message:text', async (ctx) => {
  const tgId = String(ctx.from?.id ?? '');
  const pendingContact = pendingContacts.get(tgId);
  if (pendingContact?.step === 'await_email') {
    const email = (ctx.message.text ?? '').trim();
    if (!email) return;
    pendingContacts.delete(tgId);
    try {
      await upsertContact({ telegramUserId: tgId, email });
      await ctx.reply('Email сохранён.');
    } catch (e) {
      await ctx.reply('Не удалось сохранить email. Попробуйте позже.');
      throw e;
    }
    return;
  }

  const pending = pendingSubmissions.get(tgId);
  if (!pending) return;
  pendingSubmissions.delete(tgId);
  try {
    await createSubmission({
      telegramUserId: tgId,
      lessonId: pending.lessonId,
      text: ctx.message.text,
    });
    await ctx.reply('Submitted.');
  } catch (e) {
    await ctx.reply('Failed to submit. Try again later.');
    throw e;
  }
});

bot.on('message:document', async (ctx) => {
  const tgId = String(ctx.from?.id ?? '');
  const pending = pendingSubmissions.get(tgId);
  if (!pending) return;
  pendingSubmissions.delete(tgId);
  const fileId = ctx.message.document.file_id;
  try {
    await createSubmission({
      telegramUserId: tgId,
      lessonId: pending.lessonId,
      telegramFileId: fileId,
    });
    await ctx.reply('File submitted.');
  } catch (e) {
    await ctx.reply('Failed to submit file. Try again later.');
    throw e;
  }
});

// Обработка ошибок
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;

  // Логируем ошибку без утечки токена
  if (e instanceof Error) {
    console.error('Error name:', e.name);
    console.error('Error message:', e.message);
    if (e.stack) {
      // Убираем токен из stack trace, если он там есть
      const safeStack = e.stack.replace(new RegExp(env.BOT_TOKEN, 'g'), '***');
      console.error('Stack trace:', safeStack);
    }
  } else {
    console.error('Unknown error:', e);
  }
});

// Старт бота
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started`);
  },
});
