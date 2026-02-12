import { Module } from '@nestjs/common';
import { ICacheService } from 'src/core/abstracts';
import { RedisCacheService } from './redis-cache.service';

@Module({
  providers: [
    RedisCacheService,
    {
      provide: ICacheService,
      useExisting: RedisCacheService
    }
  ],
  exports: [ICacheService, RedisCacheService]
})
export class RedisDataServicesModule {}
