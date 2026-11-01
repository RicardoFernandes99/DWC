import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentMethodsController } from './payment-methods.controller.js';
import { PaymentMethod, PaymentMethodSchema } from './payment-method.schema.js';
import { PaymentMethodsService } from './payment-methods.service.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
    ]),
  ],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
