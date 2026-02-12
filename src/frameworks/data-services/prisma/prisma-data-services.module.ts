import { Module } from '@nestjs/common';
import { PrismaDataServicesService } from './prisma-data-services.service';
import { PrismaService } from './prisma.service';

@Module({
  providers: [
    PrismaService,
    PrismaDataServicesService
  ],
  exports: [PrismaDataServicesService, PrismaService]
})
export class PrismaDataServicesModule {}
