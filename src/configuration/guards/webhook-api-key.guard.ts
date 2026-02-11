import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class WebhookApiKeyGuard implements CanActivate {
  private static readonly HEADER_NAME = 'x-api-key';

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedApiKey = this.configService.get<string>('security.webhookApiKey');

    if (!expectedApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const headerValue = request.headers[WebhookApiKeyGuard.HEADER_NAME];

    if (typeof headerValue !== 'string' || headerValue !== expectedApiKey) {
      throw new UnauthorizedException('Invalid webhook API key');
    }

    return true;
  }
}
