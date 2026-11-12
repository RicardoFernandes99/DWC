import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { User, UserSchema } from './user.schema.js';
import { AdminBuyersController } from './admin-buyers.controller.js';
import { BuyerStandingService } from './buyer-standing.service.js';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AdminBuyersController],
  providers: [BuyerStandingService],
})
export class BuyerStandingModule {}
