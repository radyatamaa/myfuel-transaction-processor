import { Injectable } from '@nestjs/common';
import {
  IBalanceLedgerRepository,
  ICardRepository,
  IDataServices,
  IOrganizationRepository,
  ITransactionRepository,
  IWebhookRejectionLogRepository
} from 'src/core/abstracts';
import {
  DbClient,
  PrismaBalanceLedgerRepository,
  PrismaCardRepository,
  PrismaOrganizationRepository,
  PrismaTransactionRepository,
  PrismaWebhookRejectionLogRepository
} from './repositories';
import { PrismaService } from './prisma.service';

function createDataServices(db: DbClient): IDataServices {
  return {
    cards: new PrismaCardRepository(db),
    organizations: new PrismaOrganizationRepository(db),
    transactions: new PrismaTransactionRepository(db),
    ledgers: new PrismaBalanceLedgerRepository(db),
    rejectionLogs: new PrismaWebhookRejectionLogRepository(db),
    runInTransaction: async <T>(callback: (tx: IDataServices) => Promise<T>): Promise<T> => {
      void callback;
      throw new Error('Nested transaction is not supported');
    }
  };
}

@Injectable()
export class PrismaDataServicesService implements IDataServices {
  readonly cards: ICardRepository;
  readonly organizations: IOrganizationRepository;
  readonly transactions: ITransactionRepository;
  readonly ledgers: IBalanceLedgerRepository;
  readonly rejectionLogs: IWebhookRejectionLogRepository;

  constructor(private readonly prisma: PrismaService) {
    this.cards = new PrismaCardRepository(prisma);
    this.organizations = new PrismaOrganizationRepository(prisma);
    this.transactions = new PrismaTransactionRepository(prisma);
    this.ledgers = new PrismaBalanceLedgerRepository(prisma);
    this.rejectionLogs = new PrismaWebhookRejectionLogRepository(prisma);
  }

  async runInTransaction<T>(callback: (tx: IDataServices) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const txServices = createDataServices(tx);
      return callback(txServices);
    });
  }
}
