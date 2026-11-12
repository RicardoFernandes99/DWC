import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Order, OrderSchema } from '../orders/order.schema.js';
import { User, UserSchema } from '../users/user.schema.js';
import { ReviewReport, ReviewReportSchema } from './review-report.schema.js';
import { Review, ReviewSchema } from './review.schema.js';
import {
  ProducerReviewsController,
  ReviewsController,
} from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: ReviewReport.name, schema: ReviewReportSchema },
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ReviewsController, ProducerReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
