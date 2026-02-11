import {
  BalanceLedger,
  BalanceLedgerType,
  Card,
  Organization,
  RejectionReason,
  Transaction
} from 'src/core/entities';

export interface CardUsageSnapshot {
  dailyUsedAmount: string;
  monthlyUsedAmount: string;
}

export abstract class ICardRepository {
  abstract findByCardNumber(cardNumber: string): Promise<Card | null>;
  abstract getUsageSnapshot(cardId: string, trxAt: Date): Promise<CardUsageSnapshot>;
  abstract addUsage(cardId: string, trxAt: Date, amount: string): Promise<void>;
  abstract lockById(cardId: string): Promise<void>;
}

export abstract class IOrganizationRepository {
  abstract findById(id: string): Promise<Organization | null>;
  abstract updateBalance(id: string, newBalance: string): Promise<void>;
  abstract lockById(id: string): Promise<void>;
}

export interface CreateTransactionInput {
  requestId: string;
  organizationId: string;
  cardId: string;
  stationId: string;
  amount: string;
  trxAt: Date;
}

export interface CreateBalanceLedgerInput {
  organizationId: string;
  type: BalanceLedgerType;
  amount: string;
  beforeBalance: string;
  afterBalance: string;
  referenceType: string;
  referenceId: string;
}

export interface CreateWebhookRejectionLogInput {
  requestId: string;
  cardNumber?: string;
  amount?: string;
  stationId?: string;
  transactionAt?: Date;
  reason: RejectionReason;
  message: string;
  rawPayload?: string;
}

export abstract class ITransactionRepository {
  abstract findByRequestId(requestId: string): Promise<Transaction | null>;
  abstract createApproved(input: CreateTransactionInput): Promise<Transaction>;
  abstract createRejected(
    input: CreateTransactionInput & { rejectionReason: RejectionReason }
  ): Promise<Transaction>;
}

export abstract class IBalanceLedgerRepository {
  abstract create(input: CreateBalanceLedgerInput): Promise<BalanceLedger>;
}

export abstract class IWebhookRejectionLogRepository {
  abstract create(input: CreateWebhookRejectionLogInput): Promise<void>;
}
