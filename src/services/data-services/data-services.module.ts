import { Module } from '@nestjs/common';
import { RedisDataServicesModule } from '../../frameworks/data-services/redis/redis-data-services.module';
import { PrismaDataServicesModule } from '../../frameworks/data-services/prisma/prisma-data-services.module';

@Module({
  imports: [PrismaDataServicesModule, RedisDataServicesModule],
  exports: [PrismaDataServicesModule, RedisDataServicesModule]
})
export class DataServicesModule {}
