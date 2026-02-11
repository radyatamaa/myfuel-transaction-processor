import { Module } from '@nestjs/common';
import { IDataServices } from 'src/core/abstracts';
import { PrismaDataServicesService } from './prisma-data-services.service';
import { PrismaService } from './prisma.service';

@Module({
  providers: [
    PrismaService,
    PrismaDataServicesService,
    {
      provide: IDataServices,
      useExisting: PrismaDataServicesService
    }
  ],
  exports: [PrismaDataServicesService, IDataServices, PrismaService]
})
export class PrismaDataServicesModule {}
