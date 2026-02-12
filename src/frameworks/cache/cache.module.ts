import { Module } from '@nestjs/common';
import { ICacheService } from 'src/core/abstracts';
import { CacheService } from './cache.service';

@Module({
  providers: [
    CacheService,
    {
      provide: ICacheService,
      useExisting: CacheService
    }
  ],
  exports: [ICacheService, CacheService]
})
export class CacheModule {}

