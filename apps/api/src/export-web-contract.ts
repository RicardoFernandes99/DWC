import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ThrottlerModule } from '@nestjs/throttler';
import { readFile, writeFile } from 'node:fs/promises';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';
import { PaymentMethodsController } from './payment-methods/payment-methods.controller.js';
import { PaymentMethodsService } from './payment-methods/payment-methods.service.js';
import { ProducerApplicationController } from './producer-application/producer-application.controller.js';
import { ProducerApplicationService } from './producer-application/producer-application.service.js';

// Contract-only module: controllers and DTO metadata are real; no service is called.
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
  controllers: [
    AuthController,
    UsersController,
    PaymentMethodsController,
    ProducerApplicationController,
  ],
  providers: [
    { provide: AuthService, useValue: {} },
    { provide: UsersService, useValue: {} },
    { provide: PaymentMethodsService, useValue: {} },
    { provide: ProducerApplicationService, useValue: {} },
    {
      provide: ConfigService,
      useValue: { getOrThrow: () => 'http://localhost' },
    },
  ],
})
class ContractModule {}
const app = await NestFactory.create(ContractModule, { logger: false });
app.setGlobalPrefix('api');
const config = new DocumentBuilder()
  .setTitle('From Farm to Table API')
  .setVersion('0.1.0')
  .addBearerAuth()
  .addCookieAuth('dwc_refresh', { type: 'apiKey', in: 'cookie' }, 'refresh')
  .build();
const document = SwaggerModule.createDocument(app, config);
const output = new URL('../../web/openapi.json', import.meta.url);
const contents = `${JSON.stringify(document, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== contents) {
    throw new Error(
      'Web OpenAPI contract is stale. Run pnpm contract:generate.',
    );
  }
} else {
  await writeFile(output, contents);
}
await app.close();
