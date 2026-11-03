import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { Order, OrderSchema } from '../orders/order.schema.js';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import { User, UserSchema } from '../users/user.schema.js';
import { CheckoutController } from './checkout.controller.js';
import { Checkout, CheckoutSchema } from './checkout.schema.js';
import { CheckoutService } from './checkout.service.js';
import { Payment, PaymentSchema } from './payment.schema.js';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    PaymentMethodsModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
      { name: Checkout.name, schema: CheckoutSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
