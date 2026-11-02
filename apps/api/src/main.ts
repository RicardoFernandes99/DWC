import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Connection } from 'mongoose';
import { AppModule } from './app.module.js';
import { SocketIoAdapter } from './realtime/socket-io.adapter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.useWebSocketAdapter(new SocketIoAdapter(app, config));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.getOrThrow<string>('WEB_ORIGIN'),
    credentials: true,
  });
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
    .addCookieAuth('dwc_refresh', { type: 'apiKey', in: 'cookie' }, 'refresh')
    .build();
  SwaggerModule.setup(
    'api-docs',
    app,
    SwaggerModule.createDocument(app, swagger),
  );
  await app.init();
  const database = app.get<Connection>(getConnectionToken());
  await Promise.all(
    Object.values(database.models).map((model) => model.init()),
  );
  await app.listen(config.getOrThrow<number>('API_PORT'), '127.0.0.1');
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
