import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
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
  @ApiResponse({ status: 200 })
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
    request_id?: string;
  }> {
    const result: WebhookResponseDto = await this.transactionUseCases.process(body);
    const isRejected = result.status === WebhookResponseStatus.REJECTED;

    return {
      success: result.success,
      code: isRejected ? 'REJECTED' : 'SUCCESS',
      message: result.message,
      data: {
        request_id: result.requestId,
        transaction_id: result.transactionId ?? null,
        reason: result.reason ?? null
      },
      errors: isRejected
        ? [{ field: 'reason', message: result.reason ?? 'REJECTED' }]
        : null,
      timestamp: new Date().toISOString(),
      request_id: request.requestId
    };
  }
}
