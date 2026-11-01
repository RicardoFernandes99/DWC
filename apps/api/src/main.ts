import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.getOrThrow<string>('WEB_ORIGIN') });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  const swagger = new DocumentBuilder()
    .setTitle('From Farm to Table API')
    .setDescription(
      'Local marketplace API. Account registration is available; other business endpoints are added incrementally.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api-docs',
    app,
    SwaggerModule.createDocument(app, swagger),
  );
  await app.listen(config.getOrThrow<number>('API_PORT'), '127.0.0.1');
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
