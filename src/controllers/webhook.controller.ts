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
      step: 8,
      message: 'Webhook validation and atomic write flow are ready.'
    };
  }

  @Post('transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate and process fuel transaction webhook' })
  @ApiBody({ type: ProcessTransactionDto })
  @ApiResponse({ status: 200, type: WebhookResponseDto })
  async processTransaction(@Body() body: ProcessTransactionDto): Promise<WebhookResponseDto> {
    return this.transactionUseCases.process(body);
  }
}
