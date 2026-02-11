import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
}

interface ResponseLike {
  setHeader: (name: string, value: string) => void;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestLike, res: ResponseLike, next: () => void): void {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.trim().length > 0 ? incoming : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
