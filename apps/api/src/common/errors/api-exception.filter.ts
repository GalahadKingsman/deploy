import crypto from 'node:crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCodes, type ApiErrorResponse } from '@tracked/shared';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request: any = ctx.getRequest();

    // Гарантия requestId: проверяем req.traceId (внутреннее поле), затем заголовок x-request-id, иначе генерируем UUID
    // В ответе используем requestId (как в контракте ApiErrorV1), а не traceId
    const requestId =
      request?.traceId ??
      (typeof request?.headers?.['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : undefined) ??
      (Array.isArray(request?.headers?.['x-request-id'])
        ? request.headers['x-request-id'][0]
        : undefined) ??
      crypto.randomUUID();

    let statusCode: number;
    let message: string;
    let code: string;
    let details: unknown | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      let resp: { code?: string; message?: string; [k: string]: unknown } | null = null;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        resp = exceptionResponse as { code?: string; message?: string; [k: string]: unknown };

        // Для 400 (валидация) прокидываем details, если есть
        if (statusCode === HttpStatus.BAD_REQUEST && Array.isArray(resp.message)) {
          message = 'Validation failed';
          details = resp.message;
        } else if (statusCode === HttpStatus.BAD_REQUEST && resp.errors) {
          message = resp.message || 'Validation failed';
          details = resp.errors;
        } else if (statusCode === HttpStatus.BAD_REQUEST && resp.details) {
          message = resp.message || 'Validation failed';
          details = resp.details;
        } else {
          message = resp.message || exception.message || 'Bad Request';
        }
      } else {
        message = exception.message || 'Bad Request';
      }

      // Custom code from exception (e.g. USER_BANNED for 403) or fallback by status
      const customCode = typeof resp?.code === 'string' ? resp.code : undefined;
      switch (statusCode) {
        case HttpStatus.BAD_REQUEST:
          code = customCode ?? ErrorCodes.VALIDATION_ERROR;
          break;
        case HttpStatus.UNAUTHORIZED:
          code = customCode ?? ErrorCodes.UNAUTHORIZED;
          break;
        case HttpStatus.FORBIDDEN:
          code = customCode ?? ErrorCodes.FORBIDDEN;
          break;
        case HttpStatus.NOT_FOUND:
          code = customCode ?? ErrorCodes.NOT_FOUND;
          break;
        case HttpStatus.CONFLICT:
          code = customCode ?? ErrorCodes.CONFLICT;
          break;
        default:
          code = ErrorCodes.INTERNAL_ERROR;
      }
    } else {
      // Не HttpException - внутренняя ошибка (логируем для отладки)
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal Server Error';
      code = ErrorCodes.INTERNAL_ERROR;
      details = undefined;
      const errMsg = exception instanceof Error ? exception.message : String(exception);
      const errStack = exception instanceof Error ? exception.stack : '';
      this.logger.error(`${errMsg}${errStack ? `\n${errStack}` : ''}`);
    }

    const errorResponse: ApiErrorResponse = {
      statusCode,
      code: code as any,
      message,
      requestId,
      ...(details !== undefined && { details }),
    };

    // Ставим x-request-id header даже на ошибках
    if (response?.header) {
      response.header('x-request-id', requestId);
    }

    // Fastify reply API
    response.code(statusCode).send(errorResponse);
  }
}
