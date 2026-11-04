import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Order, OrderSchema } from '../orders/order.schema.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import { ProducerMetricsController } from './producer-metrics.controller.js';
import { ProducerMetricsService } from './producer-metrics.service.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [ProducerMetricsController],
  providers: [ProducerMetricsService],
})
export class ProducerMetricsModule {}
