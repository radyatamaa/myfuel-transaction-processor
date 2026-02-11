import { Injectable } from '@nestjs/common';
import {
  CardUsageSnapshot,
  ICardRepository,
  IDataServices,
  IOrganizationRepository,
  ITransactionRepository
} from 'src/core/abstracts';
import { Card, Organization, Transaction } from 'src/core/entities';

class MysqlCardRepository implements ICardRepository {
  async findByCardNumber(_cardNumber: string): Promise<Card | null> {
    throw new Error('Step 5 scaffold: not implemented');
  }

  async getUsageSnapshot(_cardId: string, _trxAt: Date): Promise<CardUsageSnapshot> {
    throw new Error('Step 5 scaffold: not implemented');
  }
}

class MysqlOrganizationRepository implements IOrganizationRepository {
  async findById(_id: string): Promise<Organization | null> {
    throw new Error('Step 5 scaffold: not implemented');
  }
}

class MysqlTransactionRepository implements ITransactionRepository {
  async findByRequestId(_requestId: string): Promise<Transaction | null> {
    throw new Error('Step 5 scaffold: not implemented');
  }
}

@Injectable()
export class MysqlDataServicesService implements IDataServices {
  readonly cards: ICardRepository = new MysqlCardRepository();
  readonly organizations: IOrganizationRepository = new MysqlOrganizationRepository();
  readonly transactions: ITransactionRepository = new MysqlTransactionRepository();

  async runInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }
}
