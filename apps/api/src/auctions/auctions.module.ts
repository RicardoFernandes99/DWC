import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import { User, UserSchema } from '../users/user.schema.js';
import { Auction, AuctionSchema } from './auction.schema.js';
import { AuctionsService } from './auctions.service.js';
import { ProducerAuctionsController } from './producer-auctions.controller.js';
import { PublicAuctionsController } from './public-auctions.controller.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Auction.name, schema: AuctionSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ProducerAuctionsController, PublicAuctionsController],
  providers: [AuctionsService],
})
export class AuctionsModule {}
