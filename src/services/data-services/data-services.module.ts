import { Module } from '@nestjs/common';
import { PrismaDataServicesModule } from '../../frameworks/data-services/prisma/prisma-data-services.module';

@Module({
  imports: [PrismaDataServicesModule],
  exports: [PrismaDataServicesModule]
})
export class DataServicesModule {}
