import { Module } from '@nestjs/common';
import { IDataServices } from 'src/core/abstracts';
import { MysqlDataServicesService } from './mysql-data-services.service';

@Module({
  providers: [
    MysqlDataServicesService,
    {
      provide: IDataServices,
      useExisting: MysqlDataServicesService
    }
  ],
  exports: [MysqlDataServicesService, IDataServices]
})
export class MysqlDataServicesModule {}
