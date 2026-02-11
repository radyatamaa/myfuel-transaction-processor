export enum WebhookResponseStatus {
  ACCEPTED = 'ACCEPTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum TransactionStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum RejectionReason {
  CARD_NOT_FOUND = 'CARD_NOT_FOUND',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  DAILY_LIMIT_EXCEEDED = 'DAILY_LIMIT_EXCEEDED',
  MONTHLY_LIMIT_EXCEEDED = 'MONTHLY_LIMIT_EXCEEDED',
  DUPLICATE_REQUEST = 'DUPLICATE_REQUEST'
}

export interface Transaction {
  id: string;
  requestId: string;
  organizationId: string;
  cardId: string;
  stationId: string;
  amount: string;
  trxAt: Date;
  status: TransactionStatus;
  rejectionReason: RejectionReason | null;
  createdAt: Date;
}
