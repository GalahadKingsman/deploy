import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator: extract expertId from request.
 * Source: req.params.expertId (always); fallback req.headers['x-expert-id'] only when NODE_ENV !== 'production'.
 * Guard must run first and return 400 EXPERT_CONTEXT_REQUIRED when missing.
 */
export const ExpertId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const fromParams = request.params?.expertId;
  if (typeof fromParams === 'string' && fromParams.trim() !== '') {
    return fromParams.trim();
  }
  if (process.env.NODE_ENV !== 'production') {
    const fromHeader = request.headers?.['x-expert-id'];
    const headerValue =
      typeof fromHeader === 'string'
        ? fromHeader
        : Array.isArray(fromHeader)
          ? fromHeader[0]
          : undefined;
    if (typeof headerValue === 'string' && headerValue.trim() !== '') {
      return headerValue.trim();
    }
  }
  return '';
});
