import {
  CreateTransactionInput,
  ITransactionRepository
} from 'src/core/abstracts';
import {
  RejectionReason,
  Transaction,
  TransactionStatus
} from 'src/core/entities';
import { DbClient } from './db-client.type';

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
      status: row.status as TransactionStatus,
      rejectionReason: row.rejectionReason as RejectionReason | null,
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
        status: TransactionStatus.APPROVED
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
      status: row.status as TransactionStatus,
      rejectionReason: row.rejectionReason as RejectionReason | null,
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
        status: TransactionStatus.REJECTED,
        rejectionReason: input.rejectionReason
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
      status: row.status as TransactionStatus,
      rejectionReason: row.rejectionReason as RejectionReason | null,
      createdAt: row.createdAt
    };
  }
}
