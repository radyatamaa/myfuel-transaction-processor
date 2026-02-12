import { Module } from '@nestjs/common';
import { ITransactionEventPublisher } from 'src/core/abstracts';
import { CacheModule } from 'src/frameworks/cache/cache.module';
import { TransactionEventHandler } from 'src/frameworks/events/transaction-event.handler';
import { TransactionEventPublisher } from 'src/frameworks/events/transaction-event.publisher';
import { DataServicesModule } from '../../services/data-services/data-services.module';
import { TransactionFactoryService } from './transaction-factory.service';
import { TransactionUseCases } from './transaction.use-case';

@Module({
  imports: [DataServicesModule, CacheModule],
  providers: [
    TransactionFactoryService,
    TransactionUseCases,
    TransactionEventHandler,
    TransactionEventPublisher,
    {
      provide: ITransactionEventPublisher,
      useExisting: TransactionEventPublisher
    }
  ],
  exports: [TransactionFactoryService, TransactionUseCases]
})
export class TransactionUseCasesModule {}
