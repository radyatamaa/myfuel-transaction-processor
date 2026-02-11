import { Module } from '@nestjs/common';
import { DataServicesModule } from '../../services/data-services/data-services.module';
import { TransactionFactoryService } from './transaction-factory.service';
import { TransactionUseCases } from './transaction.use-case';

@Module({
  imports: [DataServicesModule],
  providers: [TransactionFactoryService, TransactionUseCases],
  exports: [TransactionFactoryService, TransactionUseCases]
})
export class TransactionUseCasesModule {}
