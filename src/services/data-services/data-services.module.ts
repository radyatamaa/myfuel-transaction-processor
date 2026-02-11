import { Module } from '@nestjs/common';
import { MysqlDataServicesModule } from '../../frameworks/data-services/mysql/mysql-data-services.module';

@Module({
  imports: [MysqlDataServicesModule],
  exports: [MysqlDataServicesModule]
})
export class DataServicesModule {}
