import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { APP } from './configuration';
import { HttpExceptionFilter } from './configuration/filters/http-exception.filter';

function validateRequiredSecurityConfig(): void {
  const isProduction = APP.nodeEnv === 'production';
  const webhookApiKey = process.env.WEBHOOK_API_KEY?.trim();

  if (isProduction && !webhookApiKey) {
    throw new Error('WEBHOOK_API_KEY is required in production');
  }
}

async function bootstrap(): Promise<void> {
  validateRequiredSecurityConfig();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('MyFuel Transaction Processor')
    .setDescription('Fuel transaction webhook processing service')
    .setVersion('1.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header'
      },
      'api-key'
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  await app.listen(APP.port);
}

void bootstrap();
