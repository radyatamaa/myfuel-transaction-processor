import { Injectable } from '@nestjs/common';
import { Prisma, RejectionReason as PrismaRejectionReason, TransactionStatus as PrismaTransactionStatus } from '@prisma/client';
import {
  IBalanceLedgerRepository,
  CardUsageSnapshot,
  CreateBalanceLedgerInput,
  CreateWebhookRejectionLogInput,
  CreateTransactionInput,
  ICardRepository,
  IDataServices,
  IOrganizationRepository,
  ITransactionRepository,
  IWebhookRejectionLogRepository
} from 'src/core/abstracts';
import {
  BalanceLedger,
  Card,
  BalanceLedgerType,
  Organization,
  RejectionReason,
  Transaction,
  TransactionStatus
} from 'src/core/entities';
import { PrismaService } from './prisma.service';

type DbClient = PrismaService | Prisma.TransactionClient;

function toUsageDate(trxAt: Date): Date {
  return new Date(Date.UTC(trxAt.getUTCFullYear(), trxAt.getUTCMonth(), trxAt.getUTCDate()));
}

function toUsageMonth(trxAt: Date): string {
  return `${trxAt.getUTCFullYear()}-${String(trxAt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function mapTransactionStatus(status: PrismaTransactionStatus): TransactionStatus {
  return status as TransactionStatus;
}

function mapRejectionReason(reason: PrismaRejectionReason | null): RejectionReason | null {
  if (!reason) {
    return null;
  }

  return reason as RejectionReason;
}

class MysqlCardRepository implements ICardRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Card | null> {
    const row = await this.db.card.findUnique({
      where: { id }
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

  async findByCardNumber(cardNumber: string): Promise<Card | null> {
    const row = await this.db.card.findUnique({
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

class MysqlOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Organization | null> {
    const row = await this.db.organization.findUnique({
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

  async updateBalance(id: string, newBalance: string): Promise<void> {
    await this.db.organization.update({
      where: { id },
      data: { currentBalance: newBalance }
    });
  }

  async lockById(id: string): Promise<void> {
    await this.db.$queryRaw`SELECT id FROM "Organization" WHERE id = ${id} FOR UPDATE`;
  }
}

class MysqlTransactionRepository implements ITransactionRepository {
  constructor(private readonly db: DbClient) {}

  async findByRequestId(requestId: string): Promise<Transaction | null> {
    const row = await this.db.transaction.findUnique({
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
      status: mapTransactionStatus(row.status),
      rejectionReason: mapRejectionReason(row.rejectionReason),
      createdAt: row.createdAt
    };
  }

  async createApproved(input: CreateTransactionInput): Promise<Transaction> {
    const row = await this.db.transaction.create({
      data: {
        requestId: input.requestId,
        organizationId: input.organizationId,
        cardId: input.cardId,
        stationId: input.stationId,
        amount: input.amount,
        trxAt: input.trxAt,
        status: PrismaTransactionStatus.APPROVED
      }
    });

    return {
      id: row.id,
      requestId: row.requestId,
      organizationId: row.organizationId,
      cardId: row.cardId,
      stationId: row.stationId,
      amount: row.amount.toString(),
      trxAt: row.trxAt,
      status: mapTransactionStatus(row.status),
      rejectionReason: mapRejectionReason(row.rejectionReason),
      createdAt: row.createdAt
    };
  }

  async createRejected(
    input: CreateTransactionInput & { rejectionReason: RejectionReason }
  ): Promise<Transaction> {
    const row = await this.db.transaction.create({
      data: {
        requestId: input.requestId,
        organizationId: input.organizationId,
        cardId: input.cardId,
        stationId: input.stationId,
        amount: input.amount,
        trxAt: input.trxAt,
        status: PrismaTransactionStatus.REJECTED,
        rejectionReason: input.rejectionReason as PrismaRejectionReason
      }
    });

    return {
      id: row.id,
      requestId: row.requestId,
      organizationId: row.organizationId,
      cardId: row.cardId,
      stationId: row.stationId,
      amount: row.amount.toString(),
      trxAt: row.trxAt,
      status: mapTransactionStatus(row.status),
      rejectionReason: mapRejectionReason(row.rejectionReason),
      createdAt: row.createdAt
    };
  }
}

class MysqlBalanceLedgerRepository implements IBalanceLedgerRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateBalanceLedgerInput): Promise<BalanceLedger> {
    const row = await this.db.balanceLedger.create({
      data: {
        organizationId: input.organizationId,
        type: input.type,
        amount: input.amount,
        beforeBalance: input.beforeBalance,
        afterBalance: input.afterBalance,
        referenceType: input.referenceType,
        referenceId: input.referenceId
      }
    });

    return {
      id: row.id,
      organizationId: row.organizationId,
      type: row.type as BalanceLedgerType,
      amount: row.amount.toString(),
      beforeBalance: row.beforeBalance.toString(),
      afterBalance: row.afterBalance.toString(),
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      createdAt: row.createdAt
    };
  }
}

class MysqlWebhookRejectionLogRepository implements IWebhookRejectionLogRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateWebhookRejectionLogInput): Promise<void> {
    await this.db.webhookRejectionLog.create({
      data: {
        requestId: input.requestId,
        cardNumber: input.cardNumber,
        amount: input.amount,
        stationId: input.stationId,
        transactionAt: input.transactionAt,
        reason: input.reason as PrismaRejectionReason,
        message: input.message,
        rawPayload: input.rawPayload
      }
    });
  }
}

function createDataServices(db: DbClient): IDataServices {
  return {
    cards: new MysqlCardRepository(db),
    organizations: new MysqlOrganizationRepository(db),
    transactions: new MysqlTransactionRepository(db),
    ledgers: new MysqlBalanceLedgerRepository(db),
    rejectionLogs: new MysqlWebhookRejectionLogRepository(db),
    runInTransaction: async <T>(_callback: (tx: IDataServices) => Promise<T>): Promise<T> => {
      throw new Error('Nested transaction is not supported');
    }
  };
}

@Injectable()
export class MysqlDataServicesService implements IDataServices {
  readonly cards: ICardRepository;
  readonly organizations: IOrganizationRepository;
  readonly transactions: ITransactionRepository;
  readonly ledgers: IBalanceLedgerRepository;
  readonly rejectionLogs: IWebhookRejectionLogRepository;

  constructor(private readonly prisma: PrismaService) {
    this.cards = new MysqlCardRepository(prisma);
    this.organizations = new MysqlOrganizationRepository(prisma);
    this.transactions = new MysqlTransactionRepository(prisma);
    this.ledgers = new MysqlBalanceLedgerRepository(prisma);
    this.rejectionLogs = new MysqlWebhookRejectionLogRepository(prisma);
  }

  async runInTransaction<T>(callback: (tx: IDataServices) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const txServices = createDataServices(tx);
      return callback(txServices);
    });
  }
}
