import { Card, Organization, Transaction } from 'src/core/entities';

export interface CardUsageSnapshot {
  dailyUsedAmount: string;
  monthlyUsedAmount: string;
}

export abstract class ICardRepository {
  abstract findByCardNumber(cardNumber: string): Promise<Card | null>;
  abstract getUsageSnapshot(cardId: string, trxAt: Date): Promise<CardUsageSnapshot>;
}

export abstract class IOrganizationRepository {
  abstract findById(id: string): Promise<Organization | null>;
}

export abstract class ITransactionRepository {
  abstract findByRequestId(requestId: string): Promise<Transaction | null>;
}
