import { IBalanceLedgerRepository, CreateBalanceLedgerInput } from 'src/core/abstracts';
import { BalanceLedger, BalanceLedgerType } from 'src/core/entities';
import { DbClient } from './db-client.type';

export class PrismaBalanceLedgerRepository implements IBalanceLedgerRepository {
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
