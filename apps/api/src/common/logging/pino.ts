import pino from 'pino';

export function createPinoLogger(nodeEnv: string) {
  const isProduction = nodeEnv === 'production';

  return isProduction
    ? pino({ level: 'info' })
    : pino({
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      });
}
