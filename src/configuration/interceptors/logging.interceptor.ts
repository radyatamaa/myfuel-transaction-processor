import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor
} from '@nestjs/common';
import { catchError, Observable, tap, throwError } from 'rxjs';

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  requestId?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  statusCode?: number;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<ResponseLike>();

    const requestId =
      request.requestId ??
      (typeof request.headers?.['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : 'n/a');

    const method = request.method ?? 'UNKNOWN';
    const path = request.originalUrl ?? request.url ?? 'unknown-path';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const status = response.statusCode ?? 200;
        this.logger.log(`[${requestId}] ${method} ${path} -> ${status} (${duration}ms)`);
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - start;
        const status = response.statusCode ?? 500;
        this.logger.error(`[${requestId}] ${method} ${path} -> ${status} (${duration}ms)`);
        return throwError(() => error);
      })
    );
  }
}
