import { Injectable } from '@nestjs/common';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import { S3StorageService } from '../../storage/s3-storage.service.js';
import { ProxyAgent } from 'undici';

const env = validateOrThrow(ApiEnvSchema, process.env);

type TgGetUserProfilePhotosResponse = {
  ok: boolean;
  result?: {
    total_count: number;
    photos: Array<Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>>;
  };
};

type TgGetFileResponse = {
  ok: boolean;
  result?: { file_id: string; file_unique_id: string; file_size?: number; file_path?: string };
};

@Injectable()
export class TelegramAvatarSyncService {
  constructor(private readonly storage: S3StorageService) {}

  private getTelegramDispatcher(): ProxyAgent | undefined {
    // Optional: route Telegram fetches through a proxy to обход блокировок.
    // Use TELEGRAM_HTTP_PROXY or standard HTTPS_PROXY/HTTP_PROXY.
    const raw =
      (process.env.TELEGRAM_HTTP_PROXY ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? '').trim();
    if (!raw) return undefined;
    try {
      return new ProxyAgent(raw);
    } catch {
      return undefined;
    }
  }

  /**
   * Download user's current Telegram profile photo via Bot API and upload to S3.
   * Returns S3 key (avatars/...) or null if no photo / unavailable.
   */
  async syncAvatarToS3(params: { telegramUserId: string; userId: string }): Promise<{ key: string } | null> {
    const token = (env.TELEGRAM_BOT_TOKEN ?? '').trim();
    if (!token) return null;

    const tgUserId = String(params.telegramUserId ?? '').trim();
    if (!tgUserId) return null;

    const apiBase = `https://api.telegram.org/bot${token}`;
    const dispatcher = this.getTelegramDispatcher();

    const photosRes = await fetch(
      `${apiBase}/getUserProfilePhotos?user_id=${encodeURIComponent(tgUserId)}&limit=1`,
      dispatcher ? { method: 'GET', dispatcher } : { method: 'GET' },
    );
    if (!photosRes.ok) return null;
    const photosJson = (await photosRes.json()) as TgGetUserProfilePhotosResponse;
    if (!photosJson?.ok) return null;

    const sets = photosJson.result?.photos ?? [];
    const variants = sets[0] ?? [];
    if (!variants.length) return null;

    // Pick the largest image variant
    const best = variants.slice().sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0] ?? variants[variants.length - 1]!;

    const fileRes = await fetch(
      `${apiBase}/getFile?file_id=${encodeURIComponent(best.file_id)}`,
      dispatcher ? { method: 'GET', dispatcher } : { method: 'GET' },
    );
    if (!fileRes.ok) return null;
    const fileJson = (await fileRes.json()) as TgGetFileResponse;
    const path = (fileJson?.ok ? fileJson.result?.file_path : null) ?? null;
    if (!path) return null;

    const dl = await fetch(
      `https://api.telegram.org/file/bot${token}/${path}`,
      dispatcher ? { method: 'GET', dispatcher } : { method: 'GET' },
    );
    if (!dl.ok) return null;
    const ab = await dl.arrayBuffer();
    const buf = Buffer.from(ab);
    if (!buf.length) return null;

    const contentType = dl.headers.get('content-type') ?? null;
    const ext =
      contentType?.includes('png') ? 'png' : contentType?.includes('webp') ? 'webp' : contentType?.includes('svg') ? 'svg' : 'jpg';

    const key = `avatars/${params.userId}/tg-${Date.now()}.${ext}`;
    await this.storage.putObject({
      key,
      body: new Uint8Array(buf),
      contentType,
    });
    return { key };
  }
}

