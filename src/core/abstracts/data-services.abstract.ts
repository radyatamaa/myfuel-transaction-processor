import {
  IBalanceLedgerRepository,
  ICardRepository,
  IOrganizationRepository,
  ITransactionRepository,
  IWebhookRejectionLogRepository
} from './repositories.abstract';
import { ICacheService } from './cache.abstract';

export interface IDataServicesPrisma {
  cards: ICardRepository;
  organizations: IOrganizationRepository;
  transactions: ITransactionRepository;
  ledgers: IBalanceLedgerRepository;
  rejectionLogs: IWebhookRejectionLogRepository;
}

export abstract class IDataServices {
  abstract readonly prisma: IDataServicesPrisma;
  abstract readonly redis: ICacheService;

  abstract runInTransaction<T>(callback: (tx: IDataServices) => Promise<T>): Promise<T>;
}
