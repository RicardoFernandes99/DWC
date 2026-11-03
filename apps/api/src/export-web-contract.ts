import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ThrottlerModule } from '@nestjs/throttler';
import { readFile, writeFile } from 'node:fs/promises';
import { AdminGuard } from './auth/admin.guard.js';
import { RoleGuard } from './auth/role.guard.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';
import { PaymentMethodsController } from './payment-methods/payment-methods.controller.js';
import { PaymentMethodsService } from './payment-methods/payment-methods.service.js';
import { AdminProducerApplicationsController } from './producer-application/admin-producer-applications.controller.js';
import { ProducerApplicationController } from './producer-application/producer-application.controller.js';
import { ProducerApplicationService } from './producer-application/producer-application.service.js';
import { ProducerProfileController } from './producer-application/producer-profile.controller.js';
import { ProducerProductsController } from './products/producer-products.controller.js';
import { ProductsService } from './products/products.service.js';
import { CatalogueController } from './catalogue/catalogue.controller.js';
import { CatalogueService } from './catalogue/catalogue.service.js';
import { CheckoutController } from './checkout/checkout.controller.js';
import { CheckoutService } from './checkout/checkout.service.js';
import { OrdersController } from './orders/orders.controller.js';
import { OrdersService } from './orders/orders.service.js';
import { NotificationsController } from './notifications/notifications.controller.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { AuctionsService } from './auctions/auctions.service.js';
import { ProducerAuctionsController } from './auctions/producer-auctions.controller.js';
import { PublicAuctionsController } from './auctions/public-auctions.controller.js';

// Contract-only module: controllers and DTO metadata are real; no service is called.
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
  controllers: [
    AuthController,
    UsersController,
    PaymentMethodsController,
    ProducerApplicationController,
    ProducerProfileController,
    AdminProducerApplicationsController,
    ProducerProductsController,
    CatalogueController,
    CheckoutController,
    OrdersController,
    NotificationsController,
    ProducerAuctionsController,
    PublicAuctionsController,
  ],
  providers: [
    { provide: AuthService, useValue: {} },
    { provide: AdminGuard, useValue: { canActivate: () => true } },
    { provide: RoleGuard, useValue: { canActivate: () => true } },
    { provide: UsersService, useValue: {} },
    { provide: PaymentMethodsService, useValue: {} },
    { provide: ProducerApplicationService, useValue: {} },
    { provide: ProductsService, useValue: {} },
    { provide: CatalogueService, useValue: {} },
    { provide: CheckoutService, useValue: {} },
    { provide: OrdersService, useValue: {} },
    { provide: NotificationsService, useValue: {} },
    { provide: AuctionsService, useValue: {} },
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
