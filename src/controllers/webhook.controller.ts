import { Body, Controller, HttpCode, HttpStatus, Logger, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiTags
} from '@nestjs/swagger';
import { WebhookApiKeyGuard } from 'src/configuration/guards/webhook-api-key.guard';
import { ProcessTransactionDto, WebhookResponseDto } from 'src/core/dtos';
import { WebhookResponseStatus } from 'src/core/entities';
import { TransactionUseCases } from 'src/use-cases/transaction/transaction.use-case';

@ApiTags('Webhook')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly transactionUseCases: TransactionUseCases) {}

  @Post('transactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Validate and process fuel transaction webhook' })
  @ApiBody({ type: ProcessTransactionDto })
  @ApiOkResponse({
    description: 'Transaction processed (approved or rejected)',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            code: { type: 'string' },
            message: { type: 'string' },
            data: { type: 'object' },
            errors: {
              oneOf: [
                { type: 'null' },
                {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      message: { type: 'string' }
                    }
                  }
                }
              ]
            },
            timestamp: { type: 'string', format: 'date-time' },
            requestId: { type: 'string' }
          }
        },
        examples: {
          approved: {
            summary: 'Approved transaction',
            value: {
              success: true,
              code: 'SUCCESS',
              message: 'Transaction approved and persisted.',
              data: {
                requestId: 'station-abc-20260211-0001',
                transactionId: '3f46b4f2-9f28-4fe0-95fd-0f92dc53d72a',
                reason: null
              },
              errors: null,
              timestamp: '2026-02-12T10:00:00.000Z',
              requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
            }
          },
          rejectedCardNotFound: {
            summary: 'Rejected - CARD_NOT_FOUND',
            value: {
              success: false,
              code: 'REJECTED',
              message: 'Card not found or inactive',
              data: {
                requestId: 'station-abc-20260211-0002',
                transactionId: null,
                reason: 'CARD_NOT_FOUND'
              },
              errors: null,
              timestamp: '2026-02-12T10:01:00.000Z',
              requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
            }
          },
          rejectedOrganizationNotFound: {
            summary: 'Rejected - ORGANIZATION_NOT_FOUND',
            value: {
              success: false,
              code: 'REJECTED',
              message: 'Organization not found',
              data: {
                requestId: 'station-abc-20260211-0003',
                transactionId: null,
                reason: 'ORGANIZATION_NOT_FOUND'
              },
              errors: null,
              timestamp: '2026-02-12T10:01:30.000Z',
              requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
            }
          },
          rejectedInsufficientBalance: {
            summary: 'Rejected - INSUFFICIENT_BALANCE',
            value: {
              success: false,
              code: 'REJECTED',
              message: 'Insufficient organization balance',
              data: {
                requestId: 'station-abc-20260211-0004',
                transactionId: 'f7b37d7f-1519-4d82-9cd5-5adb73be36ad',
                reason: 'INSUFFICIENT_BALANCE'
              },
              errors: null,
              timestamp: '2026-02-12T10:01:00.000Z',
              requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
            }
          },
          rejectedDailyLimitExceeded: {
            summary: 'Rejected - DAILY_LIMIT_EXCEEDED',
            value: {
              success: false,
              code: 'REJECTED',
              message: 'Daily card limit exceeded',
              data: {
                requestId: 'station-abc-20260211-0005',
                transactionId: 'a60e8fce-3a0e-4b4b-8d95-c6b8f17e481f',
                reason: 'DAILY_LIMIT_EXCEEDED'
              },
              errors: null,
              timestamp: '2026-02-12T10:02:00.000Z',
              requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
            }
          },
          rejectedMonthlyLimitExceeded: {
            summary: 'Rejected - MONTHLY_LIMIT_EXCEEDED',
            value: {
              success: false,
              code: 'REJECTED',
              message: 'Monthly card limit exceeded',
              data: {
                requestId: 'station-abc-20260211-0006',
                transactionId: '9fb26399-82dd-4b23-b4b4-e4d69d12894e',
                reason: 'MONTHLY_LIMIT_EXCEEDED'
              },
              errors: null,
              timestamp: '2026-02-12T10:03:00.000Z',
              requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
            }
          },
          rejectedDuplicateRequest: {
            summary: 'Rejected - DUPLICATE_REQUEST',
            value: {
              success: false,
              code: 'REJECTED',
              message: 'Idempotency conflict: requestId already used with different payload',
              data: {
                requestId: 'station-abc-20260211-0001',
                transactionId: null,
                reason: 'DUPLICATE_REQUEST'
              },
              errors: null,
              timestamp: '2026-02-12T10:04:00.000Z',
              requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
            }
          }
        }
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    schema: {
      example: {
        success: false,
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        data: {},
        errors: [
          {
            field: 'amount',
            message: 'amount must be a positive number'
          }
        ],
        timestamp: '2026-02-12T10:00:00.000Z',
        requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
      }
    }
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid API key',
    schema: {
      example: {
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        data: {},
        errors: [
          {
            field: 'x-api-key',
            message: 'Invalid or missing API key'
          }
        ],
        timestamp: '2026-02-12T10:00:00.000Z',
        requestId: 'a2f0c1d8-0d85-4f88-b505-6f3c8e182e8d'
      }
    }
  })
  async processTransaction(
    @Body() body: ProcessTransactionDto,
    @Req() request: { requestId?: string }
  ): Promise<{
    success: boolean;
    code: string;
    message: string;
    data: Record<string, unknown>;
    errors: Array<{ field: string; message: string }> | null;
    timestamp: string;
    requestId?: string;
  }> {
    const startedAt = Date.now();
    this.logger.log(
      JSON.stringify({
        event: 'webhook_request',
        requestId: request.requestId,
        payloadRequestId: body.requestId
      })
    );

    const result: WebhookResponseDto = await this.transactionUseCases.process(body);
    const isRejected = result.status === WebhookResponseStatus.REJECTED;
    this.logger.log(
      JSON.stringify({
        event: 'webhook_response',
        requestId: request.requestId,
        payloadRequestId: body.requestId,
        code: isRejected ? 'REJECTED' : 'SUCCESS',
        durationMs: Date.now() - startedAt
      })
    );

    return {
      success: result.success,
      code: isRejected ? 'REJECTED' : 'SUCCESS',
      message: result.message,
      data: {
        requestId: result.requestId,
        transactionId: result.transactionId ?? null,
        reason: result.reason ?? null
      },
      errors: null,
      timestamp: new Date().toISOString(),
      requestId: request.requestId
    };
  }
}
