import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface ErrorResponseBody {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const request = ctx.getRequest<{ url: string }>();

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
        statusCode: status,
        error: HttpStatus[status] ?? 'HttpException',
        message,
        path: request.url,
        timestamp: new Date().toISOString()
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
        statusCode: HttpStatus.CONFLICT,
        error: HttpStatus[HttpStatus.CONFLICT],
        message: 'Conflict: duplicate unique value',
        path: request.url,
        timestamp: new Date().toISOString()
      };

      response.status(HttpStatus.CONFLICT).json(body);
      return;
    }

    const body: ErrorResponseBody = {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR],
      message: fallbackMessage,
      path: request.url,
      timestamp: new Date().toISOString()
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
