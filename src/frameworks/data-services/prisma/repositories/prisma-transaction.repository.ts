import {
  CreateTransactionInput,
  ITransactionRepository
} from 'src/core/abstracts';
import {
  RejectionReason,
  Transaction,
  TransactionStatus
} from 'src/core/entities';
import {
  RejectionReason as PrismaRejectionReason,
  TransactionStatus as PrismaTransactionStatus
} from '@prisma/client';
import { DbClient } from './db-client.type';

function mapTransactionStatus(status: PrismaTransactionStatus): TransactionStatus {
  return status as TransactionStatus;
}

function mapRejectionReason(reason: PrismaRejectionReason | null): RejectionReason | null {
  if (!reason) {
    return null;
  }

  return reason as RejectionReason;
}

export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private readonly db: DbClient) {}

  async findByRequestId(requestId: string): Promise<Transaction | null> {
    const row = await this.db.transaction.findUnique({ where: { requestId } });
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
