import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { WebhookApiKeyGuard } from 'src/configuration/guards/webhook-api-key.guard';
import { ProcessTransactionDto, WebhookResponseDto } from 'src/core/dtos';
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
  @ApiResponse({ status: 200, type: WebhookResponseDto })
  async processTransaction(@Body() body: ProcessTransactionDto): Promise<WebhookResponseDto> {
    return this.transactionUseCases.process(body);
  }
}
