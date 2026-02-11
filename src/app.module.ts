import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { LoggingInterceptor } from './configuration/interceptors/logging.interceptor';
import { RequestIdMiddleware } from './configuration/middlewares/request-id.middleware';
import { AppController, WebhookController } from './controllers';
import { CrmServicesModule } from './services/crm-services/crm-services.module';
import { DataServicesModule } from './services/data-services/data-services.module';
import { CardUseCasesModule } from './use-cases/card/card-cases.module';
import { OrganizationUseCasesModule } from './use-cases/organization/organization-cases.module';
import { TransactionUseCasesModule } from './use-cases/transaction/transaction-cases.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration]
    }),
    DataServicesModule,
    CrmServicesModule,
    TransactionUseCasesModule,
    OrganizationUseCasesModule,
    CardUseCasesModule
  ],
  controllers: [AppController, WebhookController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
