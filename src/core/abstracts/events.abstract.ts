import { RejectionReason } from 'src/core/entities';

export interface TransactionApprovedEvent {
  requestId: string;
  transactionId: string;
  organizationId: string;
  cardId: string;
  amount: string;
  stationId: string;
  transactionAt: string;
}

export interface TransactionRejectedEvent {
  requestId: string;
  transactionId?: string;
  organizationId?: string;
  cardId?: string;
  amount?: string;
  stationId?: string;
  transactionAt?: string;
  reason: RejectionReason;
  message: string;
}

export abstract class ITransactionEventPublisher {
  abstract publishApproved(event: TransactionApprovedEvent): Promise<void>;
  abstract publishRejected(event: TransactionRejectedEvent): Promise<void>;
}
