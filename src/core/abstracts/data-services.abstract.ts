import {
  IBalanceLedgerRepository,
  ICardRepository,
  IOrganizationRepository,
  ITransactionRepository,
  IWebhookRejectionLogRepository
} from './repositories.abstract';
import { ICacheService } from './cache.abstract';

export abstract class IDataServices {
  abstract readonly cards: ICardRepository;
  abstract readonly organizations: IOrganizationRepository;
  abstract readonly transactions: ITransactionRepository;
  abstract readonly ledgers: IBalanceLedgerRepository;
  abstract readonly rejectionLogs: IWebhookRejectionLogRepository;
  abstract readonly redisCache: ICacheService;

  abstract runInTransaction<T>(callback: (tx: IDataServices) => Promise<T>): Promise<T>;
}
