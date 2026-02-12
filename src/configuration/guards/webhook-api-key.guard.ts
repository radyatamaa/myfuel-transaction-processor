import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

@Injectable()
export class WebhookApiKeyGuard implements CanActivate {
  private static readonly HEADER_NAME = 'x-api-key';
  private static readonly SIGNATURE_HEADER = 'x-signature';
  private static readonly TIMESTAMP_HEADER = 'x-timestamp';

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

    const signatureSecret = this.configService.get<string>('security.webhookSignatureSecret');
    if (!signatureSecret) {
      return true;
    }

    const toleranceSeconds =
      this.configService.get<number>('security.webhookTimestampToleranceSeconds') ?? 300;
    const timestampHeader = request.headers[WebhookApiKeyGuard.TIMESTAMP_HEADER];
    const signatureHeader = request.headers[WebhookApiKeyGuard.SIGNATURE_HEADER];

    if (typeof timestampHeader !== 'string' || typeof signatureHeader !== 'string') {
      throw new UnauthorizedException('Missing webhook signature headers');
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp)) {
      throw new UnauthorizedException('Invalid webhook timestamp');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestamp) > toleranceSeconds) {
      throw new UnauthorizedException('Webhook timestamp expired');
    }

    const bodyString = JSON.stringify(request.body ?? {});
    const signedPayload = `${timestampHeader}.${bodyString}`;
    const expectedSignature = createHmac('sha256', signatureSecret)
      .update(signedPayload)
      .digest('hex');

    const provided = Buffer.from(signatureHeader);
    const expected = Buffer.from(expectedSignature);
    const isValidLength = provided.length === expected.length;
    const isValid =
      isValidLength && timingSafeEqual(provided, expected);

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
