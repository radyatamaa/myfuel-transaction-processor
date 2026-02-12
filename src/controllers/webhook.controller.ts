import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
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
          rejected: {
            summary: 'Rejected transaction',
            value: {
              success: false,
              code: 'REJECTED',
              message: 'Insufficient organization balance',
              data: {
                requestId: 'station-abc-20260211-0002',
                transactionId: 'f7b37d7f-1519-4d82-9cd5-5adb73be36ad',
                reason: 'INSUFFICIENT_BALANCE'
              },
              errors: [
                {
                  field: 'reason',
                  message: 'INSUFFICIENT_BALANCE'
                }
              ],
              timestamp: '2026-02-12T10:01:00.000Z',
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
    const result: WebhookResponseDto = await this.transactionUseCases.process(body);
    const isRejected = result.status === WebhookResponseStatus.REJECTED;

    return {
      success: result.success,
      code: isRejected ? 'REJECTED' : 'SUCCESS',
      message: result.message,
      data: {
        requestId: result.requestId,
        transactionId: result.transactionId ?? null,
        reason: result.reason ?? null
      },
      errors: isRejected
        ? [{ field: 'reason', message: result.reason ?? 'REJECTED' }]
        : null,
      timestamp: new Date().toISOString(),
      requestId: request.requestId
    };
  }
}
