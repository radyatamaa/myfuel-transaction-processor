import { Module } from '@nestjs/common';
import { InternalCrmServicesService } from './internal-crm-services.service';

@Module({
  providers: [InternalCrmServicesService],
  exports: [InternalCrmServicesService]
})
export class InternalCrmServicesModule {}
