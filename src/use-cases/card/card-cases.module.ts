import { Module } from '@nestjs/common';
import { DataServicesModule } from '../../services/data-services/data-services.module';
import { CardFactoryService } from './card-factory.service';
import { CardUseCases } from './card.use-case';

@Module({
  imports: [DataServicesModule],
  providers: [CardFactoryService, CardUseCases],
  exports: [CardFactoryService, CardUseCases]
})
export class CardUseCasesModule {}
