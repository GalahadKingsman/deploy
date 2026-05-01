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

const SUPPORT_GROUP_ID_RAW = (env.TELEGRAM_SUPPORT_GROUP_ID ?? '').trim();
const SUPPORT_GROUP_ID = SUPPORT_GROUP_ID_RAW ? Number(SUPPORT_GROUP_ID_RAW) : Number.NaN;
const supportEnabled = Number.isFinite(SUPPORT_GROUP_ID) && SUPPORT_GROUP_ID !== 0;
if (!supportEnabled && SUPPORT_GROUP_ID_RAW) {
  console.warn(`TELEGRAM_SUPPORT_GROUP_ID is not a valid number: "${SUPPORT_GROUP_ID_RAW}"`);
}
if (!supportEnabled) {
  console.warn('TELEGRAM_SUPPORT_GROUP_ID is not set — "Чат с поддержкой" disabled');
}

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
/** Telegram user IDs (private chats with the bot) that are currently in the support chat mode. */
const supportActive = new Set<string>();

/** Команды в меню «/» в личке с ботом: start, поддержка (ru по умолчанию + en). */
async function syncSlashCommandMenu(): Promise<void> {
  const scopePrivate = { type: 'all_private_chats' as const };
  const ru = [
    { command: 'start', description: 'Главное меню и приложение' },
    { command: 'support', description: 'Написать в поддержку' },
    { command: 'support_end', description: 'Завершить чат с поддержкой' },
  ];
  const en = [
    { command: 'start', description: 'Home and Mini App' },
    { command: 'support', description: 'Contact support' },
    { command: 'support_end', description: 'End support chat' },
  ];
  try {
    await bot.api.setMyCommands(ru, { scope: scopePrivate });
    await bot.api.setMyCommands(en, { scope: scopePrivate, language_code: 'en' });
  } catch (e) {
    console.warn('setMyCommands failed (меню «/» может быть устаревшим):', e);
  }
}

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
  // Поддержка с сайта: t.me/bot?start=support → inline кнопка «Чат с поддержкой»
  if (payloadRaw.toLowerCase() === 'support') {
    await replyWithSupportEntry(ctx);
    return;
  }
  await ctx.reply(
    'Open the app:',
    {
      reply_markup: openWebAppKb,
    },
  );
});

type ReplyCtx = { reply: (text: string, other?: { reply_markup?: InlineKeyboard }) => Promise<unknown> };

async function replyWithSupportEntry(ctx: ReplyCtx) {
  if (!supportEnabled) {
    await ctx.reply(
      'Поддержка временно недоступна. Напишите на hello@edify.su — мы ответим как можно скорее.',
    );
    return;
  }
  const kb = new InlineKeyboard().text('Чат с поддержкой', 'support_open');
  await ctx.reply(
    'Привет! Это служба поддержки EDIFY.\n\nНажмите кнопку, чтобы начать диалог — мы получим ваше сообщение и ответим в этом же чате.',
    { reply_markup: kb },
  );
}

bot.command('support', async (ctx) => {
  await replyWithSupportEntry(ctx);
});

bot.command('support_end', async (ctx) => {
  const tgId = String(ctx.from?.id ?? '');
  if (tgId) supportActive.delete(tgId);
  await ctx.reply('Диалог с поддержкой завершён. Чтобы открыть его снова — /support.');
});

bot.callbackQuery('support_open', async (ctx) => {
  const tgId = String(ctx.from?.id ?? '');
  if (!tgId) {
    await ctx.answerCallbackQuery();
    return;
  }
  if (!supportEnabled) {
    await ctx.answerCallbackQuery();
    await ctx.reply('Поддержка временно недоступна.');
    return;
  }
  supportActive.add(tgId);
  await ctx.answerCallbackQuery({ text: 'Чат открыт' });
  const endKb = new InlineKeyboard().text('Завершить диалог', 'support_end');
  await ctx.reply(
    'Напишите ваш вопрос текстом — я передам его команде поддержки и пришлю ответ сюда же.',
    { reply_markup: endKb },
  );
});

bot.callbackQuery('support_end', async (ctx) => {
  const tgId = String(ctx.from?.id ?? '');
  if (tgId) supportActive.delete(tgId);
  await ctx.answerCallbackQuery({ text: 'Диалог завершён' });
  await ctx.reply('Диалог с поддержкой завершён. Чтобы открыть его снова — /support.');
});

async function persistSupportRouting(params: {
  outboundMessageId: number;
  customerTelegramId: number;
}) {
  const shared = (env.TELEGRAM_BOT_TOKEN ?? env.BOT_TOKEN).trim();
  const res = await fetch(
    `${env.BOT_API_BASE_URL.replace(/\/+$/, '')}/bot/support/routing`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-token': shared },
      body: JSON.stringify(params),
    },
  );
  if (!res.ok) {
    const payload = await res.text();
    throw new Error(`API error: ${res.status} ${payload}`);
  }
}

async function fetchSupportRouting(outboundMessageId: number): Promise<string | null> {
  const shared = (env.TELEGRAM_BOT_TOKEN ?? env.BOT_TOKEN).trim();
  const res = await fetch(
    `${env.BOT_API_BASE_URL.replace(/\/+$/, '')}/bot/support/routing/${encodeURIComponent(String(outboundMessageId))}`,
    { method: 'GET', headers: { 'x-telegram-bot-token': shared } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const payload = await res.text();
    throw new Error(`API error: ${res.status} ${payload}`);
  }
  const json = (await res.json()) as { customerTelegramId?: string };
  return json.customerTelegramId ? String(json.customerTelegramId) : null;
}

function formatSupportHeader(ctx: {
  from?: { first_name?: string; last_name?: string; username?: string; id?: number } | undefined;
}): string {
  const u = ctx.from;
  const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() || '—';
  const handle = u?.username ? ` (@${u.username})` : '';
  const id = String(u?.id ?? '');
  return `Сообщение в поддержку\nОт: ${name}${handle}\nTelegram ID: ${id}`;
}

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
  const text = ctx.message.text ?? '';

  // Поддержка: ответ админа в супергруппе → пересылка пользователю
  if (supportEnabled && ctx.chat?.id === SUPPORT_GROUP_ID) {
    const reply = ctx.message.reply_to_message;
    if (!reply || !reply.from?.is_bot) return;
    try {
      const customerId = await fetchSupportRouting(reply.message_id);
      if (!customerId) {
        await ctx.api.sendMessage(
          ctx.chat.id,
          'Не удалось найти получателя для этого ответа (старое сообщение или сбой маршрутизации).',
          { reply_parameters: { message_id: ctx.message.message_id } },
        );
        return;
      }
      await ctx.api.sendMessage(Number(customerId), `Поддержка: ${text}`);
    } catch (e) {
      console.warn('support relay (group→user) failed:', e);
    }
    return;
  }

  const pendingContact = pendingContacts.get(tgId);
  if (pendingContact?.step === 'await_email') {
    const email = text.trim();
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
  if (pending) {
    pendingSubmissions.delete(tgId);
    try {
      await createSubmission({
        telegramUserId: tgId,
        lessonId: pending.lessonId,
        text,
      });
      await ctx.reply('Submitted.');
    } catch (e) {
      await ctx.reply('Failed to submit. Try again later.');
      throw e;
    }
    return;
  }

  // Поддержка: сообщение пользователя в личке → пост в группу + сохранить маршрут
  if (supportEnabled && supportActive.has(tgId) && ctx.chat?.type === 'private') {
    try {
      const header = formatSupportHeader({ from: ctx.from ?? undefined });
      const sent = await ctx.api.sendMessage(SUPPORT_GROUP_ID, `${header}\n\n${text}`);
      try {
        await persistSupportRouting({
          outboundMessageId: sent.message_id,
          customerTelegramId: Number(tgId),
        });
      } catch (e) {
        console.warn('persistSupportRouting failed:', e);
        await ctx.reply('Сообщение отправлено, но ответы могут не дойти автоматически. Мы проверим.');
        return;
      }
      await ctx.reply('Принято — ответ придёт в этот чат.');
    } catch (e) {
      console.warn('support relay (user→group) failed:', e);
      await ctx.reply('Не удалось отправить сообщение в поддержку. Попробуйте ещё раз позже.');
    }
    return;
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
  onStart: async (botInfo) => {
    console.log(`Bot @${botInfo.username} started`);
    await syncSlashCommandMenu();
  },
});
