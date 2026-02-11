import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProcessTransactionDto, WebhookResponseDto } from 'src/core/dtos';
import { TransactionUseCases } from 'src/use-cases/transaction/transaction.use-case';

@ApiTags('Webhook')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly transactionUseCases: TransactionUseCases) {}

  @Get('status')
  status() {
    return {
      success: true,
      step: 4,
      message: 'Webhook module wired. Contracts ready. No business logic yet.'
    };
  }

  @Post('transactions')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive fuel transaction webhook (contract only)' })
  @ApiBody({ type: ProcessTransactionDto })
  @ApiResponse({ status: 202, type: WebhookResponseDto })
  processTransaction(@Body() body: ProcessTransactionDto): WebhookResponseDto {
    return this.transactionUseCases.accept(body);
  }
}
