import { Injectable } from '@nestjs/common';
import {
  ITransactionEventPublisher,
  TransactionApprovedEvent,
  TransactionRejectedEvent
} from 'src/core/abstracts';
import { TransactionEventHandler } from './transaction-event.handler';

@Injectable()
export class TransactionEventPublisher implements ITransactionEventPublisher {
  constructor(private readonly handler: TransactionEventHandler) {}

  async publishApproved(event: TransactionApprovedEvent): Promise<void> {
    await this.handler.handleApproved(event);
  }

  async publishRejected(event: TransactionRejectedEvent): Promise<void> {
    await this.handler.handleRejected(event);
  }
}
