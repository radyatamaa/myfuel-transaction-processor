import { Injectable } from '@nestjs/common';
import {
  CardUsageSnapshot,
  ICardRepository,
  IDataServices,
  IOrganizationRepository,
  ITransactionRepository
} from 'src/core/abstracts';
import {
  Card,
  Organization,
  RejectionReason,
  Transaction,
  TransactionStatus
} from 'src/core/entities';
import { PrismaService } from './prisma.service';

class MysqlCardRepository implements ICardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCardNumber(cardNumber: string): Promise<Card | null> {
    const row = await this.prisma.card.findUnique({
      where: { cardNumber }
    });

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
    const usageDate = new Date(Date.UTC(trxAt.getUTCFullYear(), trxAt.getUTCMonth(), trxAt.getUTCDate()));
    const usageMonth = `${trxAt.getUTCFullYear()}-${String(trxAt.getUTCMonth() + 1).padStart(2, '0')}`;

    const [dailyUsage, monthlyUsage] = await Promise.all([
      this.prisma.cardDailyUsage.findUnique({
        where: {
          cardId_usageDate: {
            cardId,
            usageDate
          }
        },
        select: { usedAmount: true }
      }),
      this.prisma.cardMonthlyUsage.findUnique({
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
}

class MysqlOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Organization | null> {
    const row = await this.prisma.organization.findUnique({
      where: { id }
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      currentBalance: row.currentBalance.toString(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}

class MysqlTransactionRepository implements ITransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByRequestId(requestId: string): Promise<Transaction | null> {
    const row = await this.prisma.transaction.findUnique({
      where: { requestId }
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      requestId: row.requestId,
      organizationId: row.organizationId,
      cardId: row.cardId,
      stationId: row.stationId,
      amount: row.amount.toString(),
      trxAt: row.trxAt,
      status: row.status as TransactionStatus,
      rejectionReason: (row.rejectionReason as RejectionReason) ?? null,
      createdAt: row.createdAt
    };
  }
}

@Injectable()
export class MysqlDataServicesService implements IDataServices {
  readonly cards: ICardRepository;
  readonly organizations: IOrganizationRepository;
  readonly transactions: ITransactionRepository;

  constructor(private readonly prisma: PrismaService) {
    this.cards = new MysqlCardRepository(prisma);
    this.organizations = new MysqlOrganizationRepository(prisma);
    this.transactions = new MysqlTransactionRepository(prisma);
  }

  async runInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async () => callback());
  }
}
