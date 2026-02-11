import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookApiKeyGuard } from './webhook-api-key.guard';

describe('WebhookApiKeyGuard', () => {
  function createContext(headers: Record<string, string | string[] | undefined>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers })
      })
    } as ExecutionContext;
  }

  it('allows request when WEBHOOK_API_KEY is not configured', () => {
    const configService = {
      get: jest.fn().mockReturnValue('')
    } as unknown as ConfigService;

    const guard = new WebhookApiKeyGuard(configService);
    const result = guard.canActivate(createContext({}));

    expect(result).toBe(true);
  });

  it('allows request with valid x-api-key', () => {
    const configService = {
      get: jest.fn().mockReturnValue('secret-key')
    } as unknown as ConfigService;

    const guard = new WebhookApiKeyGuard(configService);
    const result = guard.canActivate(createContext({ 'x-api-key': 'secret-key' }));

    expect(result).toBe(true);
  });

  it('throws UnauthorizedException for invalid x-api-key', () => {
    const configService = {
      get: jest.fn().mockReturnValue('secret-key')
    } as unknown as ConfigService;

    const guard = new WebhookApiKeyGuard(configService);

    expect(() => guard.canActivate(createContext({ 'x-api-key': 'wrong-key' }))).toThrow(
      UnauthorizedException
    );
  });
});
