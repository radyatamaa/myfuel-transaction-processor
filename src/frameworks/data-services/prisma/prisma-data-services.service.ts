import { Injectable } from '@nestjs/common';
import { IDataServicesPrisma } from 'src/core/abstracts';
import {
  DbClient,
  PrismaBalanceLedgerRepository,
  PrismaCardRepository,
  PrismaOrganizationRepository,
  PrismaTransactionRepository,
  PrismaWebhookRejectionLogRepository
} from './repositories';
import { PrismaService } from './prisma.service';

function createPrismaRepositories(db: DbClient): IDataServicesPrisma {
  return {
    cards: new PrismaCardRepository(db),
    organizations: new PrismaOrganizationRepository(db),
    transactions: new PrismaTransactionRepository(db),
    ledgers: new PrismaBalanceLedgerRepository(db),
    rejectionLogs: new PrismaWebhookRejectionLogRepository(db)
  };
}

@Injectable()
export class PrismaDataServicesService {
  readonly prisma: IDataServicesPrisma;

  constructor(private readonly prismaClient: PrismaService) {
    this.prisma = createPrismaRepositories(prismaClient);
  }

  async runInTransaction<T>(callback: (tx: IDataServicesPrisma) => Promise<T>): Promise<T> {
    return this.prismaClient.$transaction(async (tx) => callback(createPrismaRepositories(tx)));
  }
}
