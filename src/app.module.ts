import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { WebhookApiKeyGuard } from './configuration/guards/webhook-api-key.guard';
import { LoggingInterceptor } from './configuration/interceptors/logging.interceptor';
import { RequestIdMiddleware } from './configuration/middlewares/request-id.middleware';
import { AppController, WebhookController } from './controllers';
import { DataServicesModule } from './services/data-services/data-services.module';
import { TransactionUseCasesModule } from './use-cases/transaction/transaction-cases.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration]
    }),
    DataServicesModule,
    TransactionUseCasesModule
  ],
  controllers: [AppController, WebhookController],
  providers: [
    WebhookApiKeyGuard,
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
