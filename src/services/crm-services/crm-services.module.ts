import { Module } from '@nestjs/common';
import { InternalCrmServicesModule } from '../../frameworks/crm-services/internal/internal-crm-services.module';

@Module({
  imports: [InternalCrmServicesModule],
  exports: [InternalCrmServicesModule]
})
export class CrmServicesModule {}
