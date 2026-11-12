import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { Payment, PaymentSchema } from '../checkout/payment.schema.js';
import { Order, OrderSchema } from '../orders/order.schema.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import { User, UserSchema } from '../users/user.schema.js';
import { Auction, AuctionSchema } from './auction.schema.js';
import { AuctionBid, AuctionBidSchema } from './auction.schema.js';
import {
  PaymentMethod,
  PaymentMethodSchema,
} from '../payment-methods/payment-method.schema.js';
import { AuctionsService } from './auctions.service.js';
import { ProducerAuctionsController } from './producer-auctions.controller.js';
import { PublicAuctionsController } from './public-auctions.controller.js';
import { PublicAuctionsGateway } from './public-auctions.gateway.js';
import { AuctionCompletionPublisher } from './auction-completion.publisher.js';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Auction.name, schema: AuctionSchema },
      { name: AuctionBid.name, schema: AuctionBidSchema },
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ProducerAuctionsController, PublicAuctionsController],
  providers: [
    AuctionsService,
    PublicAuctionsGateway,
    AuctionCompletionPublisher,
  ],
})
export class AuctionsModule {}
