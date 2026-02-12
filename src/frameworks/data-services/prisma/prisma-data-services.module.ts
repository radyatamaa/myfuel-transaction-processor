import { Module } from '@nestjs/common';
import { IDataServices } from 'src/core/abstracts';
import { RedisDataServicesModule } from 'src/frameworks/data-services/redis/redis-data-services.module';
import { PrismaDataServicesService } from './prisma-data-services.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [RedisDataServicesModule],
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
