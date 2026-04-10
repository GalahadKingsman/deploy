import crypto from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const reply: any = http.getResponse(); // FastifyReply в Nest

    const h = req?.headers?.['x-request-id'];
    const incoming = Array.isArray(h) ? h[0] : h;

    const traceId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.trim()
        : crypto.randomUUID();

    req.traceId = traceId;

    // Fastify-style header setter
    if (reply?.header) reply.header('x-request-id', traceId);
    // Fallback (на всякий)
    else if (reply?.setHeader) reply.setHeader('x-request-id', traceId);

    const startAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - startAt;
        const statusCode = reply?.statusCode;

        // Если у тебя включён pino logger в fastify adapter, req.log существует
        const log = req?.log;
        if (log?.info) {
          log.info(
            {
              traceId,
              method: req?.method,
              url: req?.url,
              statusCode,
              durationMs,
            },
            'http',
          );
        } else {
          // запасной вариант — console (лучше, чем молчание)
          // не логируем секреты, только мету

          console.log('http', {
            traceId,
            method: req?.method,
            url: req?.url,
            statusCode,
            durationMs,
          });
        }
      }),
    );
  }
}
