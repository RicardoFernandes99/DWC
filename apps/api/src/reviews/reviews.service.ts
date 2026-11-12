import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import { Order, OrderStatus } from '../orders/order.schema.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { ProducerStatus, User, UserRole } from '../users/user.schema.js';
import { ReviewReport } from './review-report.schema.js';
import {
  CreateReviewDto,
  ListProducerReviewsQueryDto,
  OrderReviewStatusDto,
  OwnReviewDto,
  ProducerReviewListDto,
  PublicReviewDto,
  ReportReviewDto,
  ReviewReportResultDto,
} from './review.dto.js';
import {
  Review,
  type ReviewDocument,
  ReviewVisibility,
} from './review.schema.js';

const DUPLICATE_KEY = 11000;
const REVIEWABLE: OrderStatus[] = [
  OrderStatus.Delivered,
  OrderStatus.Collected,
];

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}

function toOwnDto(review: ReviewDocument): OwnReviewDto {
  return {
    id: review._id.toString(),
    orderId: review.orderId.toString(),
    producerId: review.producerId.toString(),
    rating: review.rating,
    comment: review.comment ?? null,
    createdAt: review.createdAt.toISOString(),
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    @InjectModel(ReviewReport.name)
    private readonly reports: Model<ReviewReport>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async create(
    user: UserResponseDto,
    dto: CreateReviewDto,
  ): Promise<OwnReviewDto> {
    const order = await this.findOwnedOrder(user.id, dto.orderId);
    if (!REVIEWABLE.includes(order.status)) {
      throw new ConflictException({
        statusCode: 409,
        code: 'order_not_reviewable',
        message: 'Only delivered or collected orders can be reviewed.',
      });
    }
    try {
      const created = await this.reviews.create({
        authorId: order.buyerId,
        orderId: order._id,
        producerId: order.producerId,
        rating: dto.rating,
        comment: dto.comment ?? null,
        visibility: ReviewVisibility.Visible,
      });
      return toOwnDto(created as ReviewDocument);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'review_exists',
          message: 'This order has already been reviewed.',
        });
      }
      throw error;
    }
  }

  async getOrderStatus(
    user: UserResponseDto,
    orderId: string,
  ): Promise<OrderReviewStatusDto> {
    const order = await this.findOwnedOrder(user.id, orderId);
    const review = await this.reviews.findOne({ orderId: order._id });
    return {
      eligible: REVIEWABLE.includes(order.status) && !review,
      review: review ? toOwnDto(review as ReviewDocument) : null,
    };
  }

  async listForProducer(
    producerId: string,
    query: ListProducerReviewsQueryDto,
  ): Promise<ProducerReviewListDto> {
    const producer = await this.users
      .findOne({
        _id: new Types.ObjectId(producerId),
        role: UserRole.Producer,
        producerStatus: ProducerStatus.Approved,
        producerApplication: { $ne: null },
      })
      .select({ _id: 1 })
      .lean();
    if (!producer) throw new NotFoundException('Producer not found.');

    const filter = {
      producerId: producer._id,
      visibility: ReviewVisibility.Visible,
    };
    const [docs, [aggregate]] = await Promise.all([
      this.reviews
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.reviews.aggregate<{ average: number; count: number }>([
        { $match: filter },
        {
          $group: {
            _id: null,
            average: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const authors = await this.users
      .find({ _id: { $in: docs.map((doc) => doc.authorId) } })
      .select({ _id: 1, name: 1 })
      .lean();
    const firstNames = new Map(
      authors.map((author) => [
        author._id.toString(),
        author.name.trim().split(/\s+/)[0] ?? '',
      ]),
    );

    const items: PublicReviewDto[] = docs.map((doc) => ({
      id: doc._id.toString(),
      rating: doc.rating,
      comment: doc.comment ?? null,
      createdAt: (
        doc as unknown as { createdAt: Date }
      ).createdAt.toISOString(),
      reviewerFirstName: firstNames.get(doc.authorId.toString()) ?? '',
    }));
    const count = aggregate?.count ?? 0;
    return {
      items,
      page: query.page,
      limit: query.limit,
      total: count,
      summary: {
        averageRating: aggregate
          ? Math.round(aggregate.average * 10) / 10
          : null,
        ratingCount: count,
      },
    };
  }

  async report(
    user: UserResponseDto,
    reviewId: string,
    dto: ReportReviewDto,
  ): Promise<ReviewReportResultDto> {
    const review = await this.reviews
      .findOne({
        _id: new Types.ObjectId(reviewId),
        visibility: ReviewVisibility.Visible,
      })
      .select({ _id: 1, authorId: 1 })
      .lean();
    if (!review) throw new NotFoundException('Review not found.');
    if (review.authorId.toString() === user.id) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'own_review',
        message: 'You cannot report your own review.',
      });
    }
    try {
      await this.reports.create({
        reviewId: review._id,
        reporterId: new Types.ObjectId(user.id),
        category: dto.category,
        note: dto.note ?? null,
      });
    } catch (error) {
      // Retry by the same reporter: keep the first report unchanged.
      if (!isDuplicateKey(error)) throw error;
    }
    return { reported: true };
  }

  private async findOwnedOrder(buyerId: string, orderId: string) {
    const order = await this.orders
      .findOne({
        _id: new Types.ObjectId(orderId),
        buyerId: new Types.ObjectId(buyerId),
      })
      .select({ _id: 1, buyerId: 1, producerId: 1, status: 1 })
      .lean();
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }
}
