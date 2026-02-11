import {
  IBalanceLedgerRepository,
  ICardRepository,
  IOrganizationRepository,
  ITransactionRepository
} from './repositories.abstract';

export abstract class IDataServices {
  abstract readonly cards: ICardRepository;
  abstract readonly organizations: IOrganizationRepository;
  abstract readonly transactions: ITransactionRepository;
  abstract readonly ledgers: IBalanceLedgerRepository;

  abstract runInTransaction<T>(callback: (tx: IDataServices) => Promise<T>): Promise<T>;
}
