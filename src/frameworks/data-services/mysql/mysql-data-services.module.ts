import { Module } from '@nestjs/common';
import { IDataServices } from 'src/core/abstracts';
import { MysqlDataServicesService } from './mysql-data-services.service';
import { PrismaService } from './prisma.service';

@Module({
  providers: [
    PrismaService,
    MysqlDataServicesService,
    {
      provide: IDataServices,
      useExisting: MysqlDataServicesService
    }
  ],
  exports: [MysqlDataServicesService, IDataServices, PrismaService]
})
export class MysqlDataServicesModule {}
