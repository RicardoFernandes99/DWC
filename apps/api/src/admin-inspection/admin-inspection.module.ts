import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Auction,
  AuctionBid,
  AuctionBidSchema,
  AuctionSchema,
} from '../auctions/auction.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { Payment, PaymentSchema } from '../checkout/payment.schema.js';
import { Order, OrderSchema } from '../orders/order.schema.js';
import {
  RefundAllocation,
  RefundAllocationSchema,
} from '../orders/refund-allocation.schema.js';
import { RedisModule } from '../redis/redis.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { User, UserSchema } from '../users/user.schema.js';
import { AdminInspectionController } from './admin-inspection.controller.js';
import { AdminInspectionService } from './admin-inspection.service.js';

@Module({
  imports: [
    AuthModule,
    RedisModule,
    StorageModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: RefundAllocation.name, schema: RefundAllocationSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Auction.name, schema: AuctionSchema },
      { name: AuctionBid.name, schema: AuctionBidSchema },
    ]),
  ],
  controllers: [AdminInspectionController],
  providers: [AdminInspectionService],
})
export class AdminInspectionModule {}
