import { Injectable } from '@nestjs/common';
import { IDataServices, IDataServicesPrisma, ICacheService } from 'src/core/abstracts';
import { PrismaDataServicesService } from 'src/frameworks/data-services/prisma/prisma-data-services.service';
import { RedisCacheService } from 'src/frameworks/data-services/redis/redis-cache.service';

@Injectable()
export class DataServicesService implements IDataServices {
  readonly prisma: IDataServicesPrisma;
  readonly redis: ICacheService;

  constructor(
    private readonly prismaDataServices: PrismaDataServicesService,
    private readonly redisCacheService: RedisCacheService
  ) {
    this.prisma = prismaDataServices.prisma;
    this.redis = redisCacheService;
  }

  async runInTransaction<T>(callback: (tx: IDataServices) => Promise<T>): Promise<T> {
    return this.prismaDataServices.runInTransaction(async (prisma) => {
      const txDataServices: IDataServices = {
        prisma,
        redis: this.redis,
        runInTransaction: async <U>(nested: (tx: IDataServices) => Promise<U>): Promise<U> => {
          void nested;
          throw new Error('Nested transaction is not supported');
        }
      };

      return callback(txDataServices);
    });
  }
}
