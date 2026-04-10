import crypto from 'node:crypto';

export async function requestIdPlugin(fastify: any) {
  fastify.decorateRequest('traceId', '');
  fastify.decorateRequest('_startAt', 0);

  fastify.addHook('onRequest', (req: any, reply: any, done: any) => {
    const h = req.headers['x-request-id'];
    const incoming = Array.isArray(h) ? h[0] : h;
    const traceId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.trim()
        : crypto.randomUUID();

    req.traceId = traceId;
    req._startAt = Date.now();
    done();
  });

  // ГАРАНТИЯ: header ставится прямо перед отправкой
  fastify.addHook('onSend', (req: any, reply: any, payload: any, done: any) => {
    if (req.traceId) {
      reply.header('x-request-id', req.traceId);
    }
    done(null, payload);
  });

  fastify.addHook('onResponse', (req: any, reply: any, done: any) => {
    const durationMs = Date.now() - (req._startAt || Date.now());

    // Используем fastify.log => это тот же pino, что в adapter
    const log = fastify.log || (fastify as any).logger;
    if (log && req.traceId) {
      log.info(
        {
          traceId: req.traceId,
          method: req.method,
          url: req.url,
          statusCode: reply.statusCode,
          durationMs,
        },
        'http',
      );
    }
    done();
  });
}
