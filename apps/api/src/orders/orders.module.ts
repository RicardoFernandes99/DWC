import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Payment, PaymentSchema } from '../checkout/payment.schema.js';
import { User, UserSchema } from '../users/user.schema.js';
import { Order, OrderSchema } from './order.schema.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
