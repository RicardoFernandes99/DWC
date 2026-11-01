import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { User, UserSchema } from '../users/user.schema.js';
import { ProducerProductsController } from './producer-products.controller.js';
import { Product, ProductSchema } from './product.schema.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ProducerProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
