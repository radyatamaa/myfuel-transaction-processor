import { Injectable, Logger } from '@nestjs/common';
import { TransactionApprovedEvent, TransactionRejectedEvent } from 'src/core/abstracts';

@Injectable()
export class TransactionEventHandler {
  private readonly logger = new Logger(TransactionEventHandler.name);

  async handleApproved(event: TransactionApprovedEvent): Promise<void> {
    this.logger.log(
      `transaction.approved requestId=${event.requestId} transactionId=${event.transactionId} organizationId=${event.organizationId} cardId=${event.cardId} amount=${event.amount}`
    );
  }

  async handleRejected(event: TransactionRejectedEvent): Promise<void> {
    this.logger.warn(
      `transaction.rejected requestId=${event.requestId} reason=${event.reason} message=${event.message}`
    );
  }
}
