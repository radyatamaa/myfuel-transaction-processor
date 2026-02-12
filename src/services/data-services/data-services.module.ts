import { Module } from '@nestjs/common';
import { IDataServices } from 'src/core/abstracts';
import { RedisDataServicesModule } from '../../frameworks/data-services/redis/redis-data-services.module';
import { PrismaDataServicesModule } from '../../frameworks/data-services/prisma/prisma-data-services.module';
import { DataServicesService } from './data-services.service';

@Module({
  imports: [PrismaDataServicesModule, RedisDataServicesModule],
  providers: [
    DataServicesService,
    {
      provide: IDataServices,
      useExisting: DataServicesService
    }
  ],
  exports: [IDataServices, DataServicesService]
})
export class DataServicesModule {}
