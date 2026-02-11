import { CardUsageSnapshot, ICardRepository } from 'src/core/abstracts';
import { Card } from 'src/core/entities';
import { DbClient } from './db-client.type';

function toUsageDate(trxAt: Date): Date {
  return new Date(Date.UTC(trxAt.getUTCFullYear(), trxAt.getUTCMonth(), trxAt.getUTCDate()));
}

function toUsageMonth(trxAt: Date): string {
  return `${trxAt.getUTCFullYear()}-${String(trxAt.getUTCMonth() + 1).padStart(2, '0')}`;
}

export class PrismaCardRepository implements ICardRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Card | null> {
    const row = await this.db.card.findUnique({ where: { id } });
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      organizationId: row.organizationId,
      cardNumber: row.cardNumber,
      dailyLimit: row.dailyLimit.toString(),
      monthlyLimit: row.monthlyLimit.toString(),
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async findByCardNumber(cardNumber: string): Promise<Card | null> {
    const row = await this.db.card.findUnique({ where: { cardNumber } });
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      organizationId: row.organizationId,
      cardNumber: row.cardNumber,
      dailyLimit: row.dailyLimit.toString(),
      monthlyLimit: row.monthlyLimit.toString(),
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async getUsageSnapshot(cardId: string, trxAt: Date): Promise<CardUsageSnapshot> {
    const usageDate = toUsageDate(trxAt);
    const usageMonth = toUsageMonth(trxAt);

    const [dailyUsage, monthlyUsage] = await Promise.all([
      this.db.cardDailyUsage.findUnique({
        where: {
          cardId_usageDate: {
            cardId,
            usageDate
          }
        },
        select: { usedAmount: true }
      }),
      this.db.cardMonthlyUsage.findUnique({
        where: {
          cardId_usageMonth: {
            cardId,
            usageMonth
          }
        },
        select: { usedAmount: true }
      })
    ]);

    return {
      dailyUsedAmount: dailyUsage?.usedAmount.toString() ?? '0',
      monthlyUsedAmount: monthlyUsage?.usedAmount.toString() ?? '0'
    };
  }

  async addUsage(cardId: string, trxAt: Date, amount: string): Promise<void> {
    const usageDate = toUsageDate(trxAt);
    const usageMonth = toUsageMonth(trxAt);

    await Promise.all([
      this.db.cardDailyUsage.upsert({
        where: {
          cardId_usageDate: {
            cardId,
            usageDate
          }
        },
        update: {
          usedAmount: {
            increment: amount
          }
        },
        create: {
          cardId,
          usageDate,
          usedAmount: amount
        }
      }),
      this.db.cardMonthlyUsage.upsert({
        where: {
          cardId_usageMonth: {
            cardId,
            usageMonth
          }
        },
        update: {
          usedAmount: {
            increment: amount
          }
        },
        create: {
          cardId,
          usageMonth,
          usedAmount: amount
        }
      })
    ]);
  }

  async lockById(cardId: string): Promise<void> {
    await this.db.$queryRaw`SELECT id FROM "Card" WHERE id = ${cardId} FOR UPDATE`;
  }
}
