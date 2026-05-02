import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isStrictSecurityMode } from '../config/security.config';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const rawMessage = typeof rawResponse === 'object' && rawResponse && 'message' in rawResponse
      ? (rawResponse as { message?: unknown }).message
      : exception instanceof Error
        ? exception.message
        : undefined;
    const safeMessage = status >= 500 && isStrictSecurityMode()
      ? 'Interner Serverfehler'
      : this.normalizeMessage(rawMessage, status);

    if (status >= 500) {
      const message = exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${request.method} ${request.url} failed: ${message}`, stack);
    }

    response.status(status).json({
      statusCode: status,
      message: safeMessage,
      error: this.getErrorLabel(status),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeMessage(message: unknown, status: number) {
    if (Array.isArray(message)) return message.map((entry) => String(entry));
    if (typeof message === 'string' && message.trim()) return message;
    return this.getErrorLabel(status);
  }

  private getErrorLabel(status: number) {
    if (status === HttpStatus.BAD_REQUEST) return 'Bad Request';
    if (status === HttpStatus.UNAUTHORIZED) return 'Unauthorized';
    if (status === HttpStatus.FORBIDDEN) return 'Forbidden';
    if (status === HttpStatus.NOT_FOUND) return 'Not Found';
    if (status === HttpStatus.CONFLICT) return 'Conflict';
    if (status === HttpStatus.TOO_MANY_REQUESTS) return 'Too Many Requests';
    if (status === HttpStatus.SERVICE_UNAVAILABLE) return 'Service Unavailable';
    return 'Internal Server Error';
  }
}