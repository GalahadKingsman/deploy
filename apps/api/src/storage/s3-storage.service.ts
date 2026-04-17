import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ApiEnv } from '@tracked/shared';
import { validateOrThrow, ApiEnvSchema } from '@tracked/shared';

export class S3StorageService {
  /** Server-side I/O (reachable from the API container, e.g. http://minio:9000). */
  private readonly client: S3Client;
  /** Presigned URLs must use a host the user's browser can reach. */
  private readonly presignClient: S3Client;
  private readonly bucket: string;

  constructor() {
    const env: ApiEnv = validateOrThrow(ApiEnvSchema, process.env);
    if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_BUCKET || !env.S3_REGION) {
      throw new Error('S3 storage is not configured (S3_* env vars are required).');
    }
    const forcePathStyle =
      typeof env.S3_FORCE_PATH_STYLE === 'string'
        ? env.S3_FORCE_PATH_STYLE.toLowerCase().trim() === 'true' || env.S3_FORCE_PATH_STYLE.trim() === '1'
        : false;
    this.bucket = env.S3_BUCKET;
    const credentials = {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    };
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle,
      credentials,
    });
    const publicEndpoint = env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT;
    try {
      const internal = new URL(env.S3_ENDPOINT);
      if (env.NODE_ENV === 'production' && internal.hostname === 'minio' && !env.S3_PUBLIC_ENDPOINT) {
        // eslint-disable-next-line no-console
        console.warn(
          '[S3StorageService] Presigned URLs use S3_ENDPOINT (minio). Browsers cannot reach Docker hostnames; set S3_PUBLIC_ENDPOINT to a public MinIO base URL.',
        );
      }
    } catch {
      // ignore invalid S3_ENDPOINT
    }
    this.presignClient =
      publicEndpoint === env.S3_ENDPOINT
        ? this.client
        : new S3Client({
            endpoint: publicEndpoint,
            region: env.S3_REGION,
            forcePathStyle,
            credentials,
          });
  }

  async putObject(params: { key: string; body: Uint8Array; contentType?: string | null }): Promise<{ key: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType ?? undefined,
      }),
    );
    return { key: params.key };
  }

  async getObject(params: { key: string }): Promise<{
    contentType: string | null;
    contentLength: number | null;
    body: unknown;
  }> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
      }),
    );
    return {
      contentType: res.ContentType ?? null,
      contentLength: typeof res.ContentLength === 'number' ? res.ContentLength : null,
      body: res.Body as unknown,
    };
  }

  async getSignedGetUrl(params: { key: string; expiresSeconds?: number }): Promise<{ url: string }> {
    const expiresIn = params.expiresSeconds ?? 120;
    const url = await getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: params.key }),
      { expiresIn },
    );
    return { url };
  }

  async getSignedPutUrl(params: {
    key: string;
    contentType: string | null;
    expiresSeconds?: number;
  }): Promise<{ url: string }> {
    const expiresIn = params.expiresSeconds ?? 120;
    const url = await getSignedUrl(
      this.presignClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        ContentType: params.contentType ?? undefined,
      }),
      { expiresIn },
    );
    return { url };
  }
}

