import { Module } from '@nestjs/common';
import { DataServicesModule } from '../../services/data-services/data-services.module';
import { OrganizationFactoryService } from './organization-factory.service';
import { OrganizationUseCases } from './organization.use-case';

@Module({
  imports: [DataServicesModule],
  providers: [OrganizationFactoryService, OrganizationUseCases],
  exports: [OrganizationFactoryService, OrganizationUseCases]
})
export class OrganizationUseCasesModule {}
