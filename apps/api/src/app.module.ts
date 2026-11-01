import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { fileURLToPath } from 'node:url';
import { validateEnvironment } from './config.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { RedisModule } from './redis/redis.module.js';
import { StorageService } from './storage/storage.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    RedisModule,
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
  providers: [HealthService, StorageService],
})
export class AppModule {}
