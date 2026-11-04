import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { fileURLToPath } from 'node:url';
import { validateEnvironment } from './config.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { RedisModule } from './redis/redis.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module.js';
import { ProducerApplicationModule } from './producer-application/producer-application.module.js';
import { ProductsModule } from './products/products.module.js';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuctionsModule } from './auctions/auctions.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';

@Module({
  imports: [
    AuthModule,
    PaymentMethodsModule,
    ProducerApplicationModule,
    ProductsModule,
    CatalogueModule,
    CheckoutModule,
    OrdersModule,
    RealtimeModule,
    NotificationsModule,
    AuctionsModule,
    ReviewsModule,
    UsersModule,
    RedisModule,
    StorageModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: fileURLToPath(new URL('../../../.env', import.meta.url)),
      validate: validateEnvironment,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        serverSelectionTimeoutMS: 5000,
        retryAttempts: 1,
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
