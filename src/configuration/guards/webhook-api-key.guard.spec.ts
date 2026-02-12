import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { WebhookApiKeyGuard } from './webhook-api-key.guard';

describe('WebhookApiKeyGuard', () => {
  function createContext(
    headers: Record<string, string | string[] | undefined>,
    body?: unknown
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers, body })
      })
    } as ExecutionContext;
  }

  it('allows request when WEBHOOK_API_KEY is not configured', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'security.webhookApiKey') {
          return '';
        }
        if (key === 'security.webhookSignatureSecret') {
          return '';
        }
        return undefined;
      })
    } as unknown as ConfigService;

    const guard = new WebhookApiKeyGuard(configService);
    const result = guard.canActivate(createContext({}));

    expect(result).toBe(true);
  });

  it('allows request with valid x-api-key', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'security.webhookApiKey') {
          return 'secret-key';
        }
        if (key === 'security.webhookSignatureSecret') {
          return '';
        }
        return undefined;
      })
    } as unknown as ConfigService;

    const guard = new WebhookApiKeyGuard(configService);
    const result = guard.canActivate(createContext({ 'x-api-key': 'secret-key' }));

    expect(result).toBe(true);
  });

  it('throws UnauthorizedException for invalid x-api-key', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'security.webhookApiKey') {
          return 'secret-key';
        }
        if (key === 'security.webhookSignatureSecret') {
          return '';
        }
        return undefined;
      })
    } as unknown as ConfigService;

    const guard = new WebhookApiKeyGuard(configService);

    expect(() => guard.canActivate(createContext({ 'x-api-key': 'wrong-key' }))).toThrow(
      UnauthorizedException
    );
  });

  it('allows valid signature when signature secret is configured', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const body = { requestId: 'req-1', amount: 100 };
    const signedPayload = `${nowSec}.${JSON.stringify(body)}`;
    const signature = createHmac('sha256', 'sign-secret')
      .update(signedPayload)
      .digest('hex');

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'security.webhookApiKey') {
          return 'secret-key';
        }
        if (key === 'security.webhookSignatureSecret') {
          return 'sign-secret';
        }
        if (key === 'security.webhookTimestampToleranceSeconds') {
          return 300;
        }
        return undefined;
      })
    } as unknown as ConfigService;

    const guard = new WebhookApiKeyGuard(configService);
    const result = guard.canActivate(
      createContext(
        {
          'x-api-key': 'secret-key',
          'x-timestamp': String(nowSec),
          'x-signature': signature
        },
        body
      )
    );

    expect(result).toBe(true);
  });

  it('throws UnauthorizedException for invalid signature', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const body = { requestId: 'req-1', amount: 100 };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'security.webhookApiKey') {
          return 'secret-key';
        }
        if (key === 'security.webhookSignatureSecret') {
          return 'sign-secret';
        }
        if (key === 'security.webhookTimestampToleranceSeconds') {
          return 300;
        }
        return undefined;
      })
    } as unknown as ConfigService;

    const guard = new WebhookApiKeyGuard(configService);

    expect(() =>
      guard.canActivate(
        createContext(
          {
            'x-api-key': 'secret-key',
            'x-timestamp': String(nowSec),
            'x-signature': 'invalid-signature'
          },
          body
        )
      )
    ).toThrow(UnauthorizedException);
  });
});
