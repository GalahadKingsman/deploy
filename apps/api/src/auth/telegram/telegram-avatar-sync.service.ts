import { Injectable } from '@nestjs/common';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import { S3StorageService } from '../../storage/s3-storage.service.js';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { URL } from 'node:url';

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

  private pickProxyUrl(): string | null {
    const raw = (process.env.TELEGRAM_HTTP_PROXY ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? '').trim();
    return raw ? raw : null;
  }

  private httpsGetDirect(url: string): Promise<{ status: number; text: string; headers: http.IncomingHttpHeaders }> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 0, text, headers: res.headers });
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  private async connectThroughHttpProxy(targetUrl: string, proxyUrl: string): Promise<net.Socket> {
    const target = new URL(targetUrl);
    const host = target.hostname;
    const port = target.port ? Number(target.port) : target.protocol === 'https:' ? 443 : 80;

    const proxy = new URL(proxyUrl);
    const proxyHost = proxy.hostname;
    const proxyPort = proxy.port ? Number(proxy.port) : proxy.protocol === 'https:' ? 443 : 80;

    // HTTP CONNECT tunnels to host:443 (covers api.telegram.org and api.telegram.org file downloads)
    return await new Promise((resolve, reject) => {
      const req = http.request({
        host: proxyHost,
        port: proxyPort,
        method: 'CONNECT',
        path: `${host}:${port}`,
      });
      req.on('connect', (res, socket) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          socket.destroy();
          reject(new Error(`CONNECT failed: HTTP ${res.statusCode ?? 'unknown'}`));
          return;
        }
        resolve(socket);
      });
      req.on('error', reject);
      req.end();
    });
  }

  private async httpsGetTextViaProxy(url: string, proxyUrl: string): Promise<{ status: number; text: string; headers: http.IncomingHttpHeaders }> {
    const socket = await this.connectThroughHttpProxy(url, proxyUrl);
    const u = new URL(url);

    return await new Promise((resolve, reject) => {
      const req = https.request(
        {
          host: u.hostname,
          path: `${u.pathname}${u.search}`,
          method: 'GET',
          headers: { host: u.host },
          servername: u.hostname,
          agent: false,
          createConnection: () => socket,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({ status: res.statusCode ?? 0, text, headers: res.headers });
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  private httpsGetBufferDirect(url: string): Promise<{ status: number; buf: Buffer; headers: http.IncomingHttpHeaders }> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, buf: Buffer.concat(chunks), headers: res.headers }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  private async httpsGetBufferViaProxy(url: string, proxyUrl: string): Promise<{ status: number; buf: Buffer; headers: http.IncomingHttpHeaders }> {
    const socket = await this.connectThroughHttpProxy(url, proxyUrl);
    const u = new URL(url);
    return await new Promise((resolve, reject) => {
      const req = https.request(
        {
          host: u.hostname,
          path: `${u.pathname}${u.search}`,
          method: 'GET',
          headers: { host: u.host },
          servername: u.hostname,
          agent: false,
          createConnection: () => socket,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, buf: Buffer.concat(chunks), headers: res.headers }));
        },
      );
      req.on('error', reject);
      req.end();
    });
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
    const proxy = this.pickProxyUrl();

    const photosUrl = `${apiBase}/getUserProfilePhotos?user_id=${encodeURIComponent(tgUserId)}&limit=1`;
    const photosRes = proxy ? await this.httpsGetTextViaProxy(photosUrl, proxy) : await this.httpsGetDirect(photosUrl);
    if (photosRes.status < 200 || photosRes.status >= 300) return null;

    let photosJson: TgGetUserProfilePhotosResponse;
    try {
      photosJson = JSON.parse(photosRes.text) as TgGetUserProfilePhotosResponse;
    } catch {
      return null;
    }
    if (!photosJson?.ok) return null;

    const sets = photosJson.result?.photos ?? [];
    const variants = sets[0] ?? [];
    if (!variants.length) return null;

    // Pick the largest image variant
    const best = variants.slice().sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0] ?? variants[variants.length - 1]!;

    const fileUrl = `${apiBase}/getFile?file_id=${encodeURIComponent(best.file_id)}`;
    const fileRes = proxy ? await this.httpsGetTextViaProxy(fileUrl, proxy) : await this.httpsGetDirect(fileUrl);
    if (fileRes.status < 200 || fileRes.status >= 300) return null;

    let fileJson: TgGetFileResponse;
    try {
      fileJson = JSON.parse(fileRes.text) as TgGetFileResponse;
    } catch {
      return null;
    }

    const path = (fileJson?.ok ? fileJson.result?.file_path : null) ?? null;
    if (!path) return null;

    const dlUrl = `https://api.telegram.org/file/bot${token}/${path}`;
    const dl = proxy ? await this.httpsGetBufferViaProxy(dlUrl, proxy) : await this.httpsGetBufferDirect(dlUrl);
    if (dl.status < 200 || dl.status >= 300) return null;

    const buf = dl.buf;
    if (!buf.length) return null;

    const hdrCt = dl.headers['content-type'];
    const ct0 = Array.isArray(hdrCt) ? hdrCt[0] : hdrCt;
    const contentType = typeof ct0 === 'string' && ct0 ? ct0 : null;

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
