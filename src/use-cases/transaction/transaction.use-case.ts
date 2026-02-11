import { Injectable } from '@nestjs/common';
import { ProcessTransactionDto, WebhookResponseDto } from 'src/core/dtos';
import { WebhookResponseStatus } from 'src/core/entities';

@Injectable()
export class TransactionUseCases {
  status() {
    return {
      module: 'transaction',
      ready: true,
      note: 'Step 3 module wiring only'
    };
  }

  accept(payload: ProcessTransactionDto): WebhookResponseDto {
    return {
      success: true,
      status: WebhookResponseStatus.ACCEPTED,
      message: 'Step 4 contract scaffold. No business logic yet.',
      reason: null,
      requestId: payload.requestId
    };
  }
}
