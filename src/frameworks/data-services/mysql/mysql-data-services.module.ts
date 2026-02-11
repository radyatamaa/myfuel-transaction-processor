import { Module } from '@nestjs/common';
import { MysqlDataServicesService } from './mysql-data-services.service';

@Module({
  providers: [MysqlDataServicesService],
  exports: [MysqlDataServicesService]
})
export class MysqlDataServicesModule {}
