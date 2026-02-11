import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { APP } from './configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  await app.listen(APP.port);
}

void bootstrap();
