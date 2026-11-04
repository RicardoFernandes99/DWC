import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import {
  ReviewReport,
  ReviewReportSchema,
} from '../reviews/review-report.schema.js';
import { Review, ReviewSchema } from '../reviews/review.schema.js';
import { StorageModule } from '../storage/storage.module.js';
import { User, UserSchema } from '../users/user.schema.js';
import {
  AdminProductsController,
  AdminReviewsController,
} from './admin-moderation.controller.js';
import { ModerationService } from './moderation.service.js';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    StorageModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: ReviewReport.name, schema: ReviewReportSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminProductsController, AdminReviewsController],
  providers: [ModerationService],
})
export class ModerationModule {}
