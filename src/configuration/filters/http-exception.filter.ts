import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface ErrorResponseBody {
  success: boolean;
  code: string;
  message: string;
  data: Record<string, unknown>;
  errors: Array<{ field: string; message: string }> | null;
  timestamp: string;
  request_id?: string;
}

function mapStatusCode(status: number): string {
  if (status === HttpStatus.BAD_REQUEST) {
    return 'BAD_REQUEST';
  }
  if (status === HttpStatus.UNAUTHORIZED) {
    return 'UNAUTHORIZED';
  }
  if (status === HttpStatus.FORBIDDEN) {
    return 'FORBIDDEN';
  }
  if (status === HttpStatus.NOT_FOUND) {
    return 'NOT_FOUND';
  }
  if (status === HttpStatus.CONFLICT) {
    return 'CONFLICT';
  }

  return 'INTERNAL_SERVER_ERROR';
}

function toErrors(message: string | string[]): Array<{ field: string; message: string }> {
  const messages = Array.isArray(message) ? message : [message];

  return messages.map((entry) => {
    const trimmed = entry.trim();
    const field = trimmed.split(' ')[0] || 'general';
    return {
      field,
      message: trimmed
    };
  });
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const request = ctx.getRequest<{ requestId?: string }>();
    const requestId = request.requestId;

    const fallbackMessage = 'Internal server error';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
          ? (exceptionResponse as { message: string | string[] }).message
          : exception.message;

      const body: ErrorResponseBody = {
        success: false,
        code: mapStatusCode(status),
        message: Array.isArray(message) ? 'Validation failed' : message,
        data: {},
        errors: toErrors(message),
        timestamp: new Date().toISOString(),
        request_id: requestId
      };

      response.status(status).json(body);
      return;
    }

    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === 'P2002'
    ) {
      const body: ErrorResponseBody = {
        success: false,
        code: 'CONFLICT',
        message: 'Conflict: duplicate unique value',
        data: {},
        errors: [{ field: 'request', message: 'Conflict: duplicate unique value' }],
        timestamp: new Date().toISOString(),
        request_id: requestId
      };

      response.status(HttpStatus.CONFLICT).json(body);
      return;
    }

    const body: ErrorResponseBody = {
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: fallbackMessage,
      data: {},
      errors: [{ field: 'server', message: fallbackMessage }],
      timestamp: new Date().toISOString(),
      request_id: requestId
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
