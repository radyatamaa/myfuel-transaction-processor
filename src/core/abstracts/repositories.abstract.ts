import { Card, Organization, RejectionReason, Transaction } from 'src/core/entities';

export interface CardUsageSnapshot {
  dailyUsedAmount: string;
  monthlyUsedAmount: string;
}

export abstract class ICardRepository {
  abstract findByCardNumber(cardNumber: string): Promise<Card | null>;
  abstract getUsageSnapshot(cardId: string, trxAt: Date): Promise<CardUsageSnapshot>;
  abstract addUsage(cardId: string, trxAt: Date, amount: string): Promise<void>;
}

export abstract class IOrganizationRepository {
  abstract findById(id: string): Promise<Organization | null>;
  abstract updateBalance(id: string, newBalance: string): Promise<void>;
}

export interface CreateTransactionInput {
  requestId: string;
  organizationId: string;
  cardId: string;
  stationId: string;
  amount: string;
  trxAt: Date;
}

export abstract class ITransactionRepository {
  abstract findByRequestId(requestId: string): Promise<Transaction | null>;
  abstract createApproved(input: CreateTransactionInput): Promise<Transaction>;
  abstract createRejected(
    input: CreateTransactionInput & { rejectionReason: RejectionReason }
  ): Promise<Transaction>;
}
