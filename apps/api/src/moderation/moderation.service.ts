import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, QueryFilter, Model } from 'mongoose';
import { Types } from 'mongoose';
import { NotificationIntegrationService } from '../notifications/notification-integration.service.js';
import {
  NotificationEventType,
  NotificationResourceType,
} from '../notifications/notification.schema.js';
import type { NotificationDocument } from '../notifications/notification.schema.js';
import { Product } from '../products/product.schema.js';
import { ReviewReport } from '../reviews/review-report.schema.js';
import type { ReviewReportCategory } from '../reviews/review-report.schema.js';
import { Review, ReviewVisibility } from '../reviews/review.schema.js';
import { StorageService } from '../storage/storage.service.js';
import { User } from '../users/user.schema.js';
import {
  ModerationStateFilter,
  type AdminProductDetailDto,
  type AdminProductItemDto,
  type AdminProductListResponseDto,
  type AdminReviewDetailDto,
  type AdminReviewReportItemDto,
  type AdminReviewReportListResponseDto,
  type HideContentDto,
  type ListAdminProductsQueryDto,
  type ListAdminReviewReportsQueryDto,
  type ModerationInfoDto,
  type RestoreContentDto,
} from './moderation.dto.js';

const MAX_REPORTS_IN_DETAIL = 100;

type ProductRow = Product & { _id: Types.ObjectId; createdAt?: Date };
type ReviewRow = Review & { _id: Types.ObjectId; createdAt: Date };
interface UserRow {
  _id: Types.ObjectId;
  name: string;
  producerApplication?: { farmName?: string } | null;
}
interface ReportStats {
  reportCount: number;
  latestReportAt: Date | null;
  categories: ReviewReportCategory[];
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const iso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

function moderationInfo(
  hiddenAt: Date | null | undefined,
  reason: string | null | undefined,
  hiddenBy: Types.ObjectId | null | undefined,
): ModerationInfoDto | null {
  if (!hiddenAt) return null;
  return {
    hiddenAt: hiddenAt.toISOString(),
    reason: reason ?? null,
    hiddenBy: hiddenBy ? hiddenBy.toString() : null,
  };
}

// Legacy reviews may lack `revision`; a missing value counts as 1.
const reviewRevisionFilter = (revision: number): QueryFilter<Review> =>
  revision === 1
    ? { $or: [{ revision: 1 }, { revision: { $exists: false } }] }
    : { revision };

@Injectable()
export class ModerationService {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    @InjectModel(ReviewReport.name)
    private readonly reports: Model<ReviewReport>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectConnection() private readonly connection: Connection,
    private readonly storage: StorageService,
    private readonly notificationIntegration: NotificationIntegrationService,
  ) {}

  // ---- Products ----

  async listProducts(
    query: ListAdminProductsQueryDto,
  ): Promise<AdminProductListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: QueryFilter<Product> = {};
    if (query.state === ModerationStateFilter.Hidden) {
      filter.moderatedAt = { $ne: null };
    } else if (query.state === ModerationStateFilter.Visible) {
      filter.moderatedAt = null;
    }
    if (query.producerId) {
      filter.producerId = new Types.ObjectId(query.producerId);
    }
    if (query.q) {
      filter.name = { $regex: escapeRegExp(query.q), $options: 'i' };
    }
    const [rows, total] = await Promise.all([
      this.products
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ProductRow[]>(),
      this.products.countDocuments(filter),
    ]);
    const names = await this.producerNames(rows.map((row) => row.producerId));
    return {
      items: rows.map((row) => this.toProductItem(row, names)),
      total,
      page,
      limit,
    };
  }

  async getProduct(id: string): Promise<AdminProductDetailDto> {
    const row = await this.products.findById(id).lean<ProductRow>();
    if (!row) throw new NotFoundException('Product not found.');
    return this.toProductDetail(row);
  }

  hideProduct(
    id: string,
    adminId: string,
    input: HideContentDto,
  ): Promise<AdminProductDetailDto> {
    return this.moderateProduct(id, input.revision, {
      filter: { moderatedAt: null },
      set: {
        moderatedAt: new Date(),
        moderationReason: input.reason,
        moderatedBy: new Types.ObjectId(adminId),
      },
      eventType: NotificationEventType.ProductHidden,
      title: 'Product hidden by moderation',
      message: (name) =>
        `Your product "${name}" was hidden from the marketplace: ${input.reason}`,
      invalidState: {
        code: 'already_hidden',
        message: 'Product is already hidden.',
      },
    });
  }

  restoreProduct(
    id: string,
    input: RestoreContentDto,
  ): Promise<AdminProductDetailDto> {
    return this.moderateProduct(id, input.revision, {
      filter: { moderatedAt: { $ne: null } },
      set: { moderatedAt: null, moderationReason: null, moderatedBy: null },
      eventType: NotificationEventType.ProductRestored,
      title: 'Product restored',
      message: (name) =>
        `Your product "${name}" is no longer hidden by moderation.`,
      invalidState: {
        code: 'not_hidden',
        message: 'Product is not hidden.',
      },
    });
  }

  private async moderateProduct(
    id: string,
    revision: number,
    change: {
      filter: QueryFilter<Product>;
      set: Partial<Product>;
      eventType: NotificationEventType;
      title: string;
      message: (productName: string) => string;
      invalidState: { code: string; message: string };
    },
  ): Promise<AdminProductDetailDto> {
    const _id = new Types.ObjectId(id);
    const session = await this.connection.startSession();
    let updated: ProductRow | null = null;
    let notification: NotificationDocument | null = null;
    try {
      await session.withTransaction(async () => {
        updated = null;
        notification = null;
        updated = await this.products
          .findOneAndUpdate(
            { _id, revision, ...change.filter },
            { $set: change.set, $inc: { revision: 1 } },
            { new: true, runValidators: true, session },
          )
          .lean<ProductRow>();
        if (updated) {
          notification = await this.notificationIntegration.persist(
            {
              recipientId: updated.producerId.toString(),
              eventType: change.eventType,
              title: change.title,
              // Notification messages are capped at 500 characters.
              message: change.message(updated.name).slice(0, 500),
              resource: { type: NotificationResourceType.Product, id },
              sourceEventKey: `product:${id}:moderation:${revision + 1}`,
            },
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    if (!updated) {
      if (!(await this.products.exists({ _id }))) {
        throw new NotFoundException('Product not found.');
      }
      if (!(await this.products.exists({ _id, ...change.filter }))) {
        throw new ConflictException({
          statusCode: 409,
          ...change.invalidState,
        });
      }
      throw new ConflictException({
        statusCode: 409,
        code: 'stale_revision',
        message: 'Product was updated concurrently. Refresh and try again.',
      });
    }
    if (notification)
      this.notificationIntegration.publishCommitted(notification);
    return this.toProductDetail(updated);
  }

  private async producerNames(
    ids: Types.ObjectId[],
  ): Promise<Map<string, string>> {
    const rows = await this.users
      .find({ _id: { $in: ids } })
      .select({ name: 1, 'producerApplication.farmName': 1 })
      .lean<UserRow[]>();
    return new Map(
      rows.map((row) => [
        row._id.toString(),
        row.producerApplication?.farmName || row.name,
      ]),
    );
  }

  private toProductItem(
    row: ProductRow,
    names: Map<string, string>,
  ): AdminProductItemDto {
    return {
      id: row._id.toString(),
      name: row.name,
      category: row.category,
      priceCents: row.priceCents,
      unit: row.unit,
      producerId: row.producerId.toString(),
      producerName: names.get(row.producerId.toString()) ?? 'Unknown producer',
      published: row.published,
      archivedAt: iso(row.archivedAt),
      moderation: moderationInfo(
        row.moderatedAt,
        row.moderationReason,
        row.moderatedBy,
      ),
      revision: row.revision,
      createdAt: (row.createdAt ?? new Date(0)).toISOString(),
    };
  }

  private async toProductDetail(
    row: ProductRow,
  ): Promise<AdminProductDetailDto> {
    const names = await this.producerNames([row.producerId]);
    return {
      ...this.toProductItem(row, names),
      description: row.description,
      availableStock: row.availableStock,
      reservedStock: row.reservedStock,
      imageUrl: row.image?.objectKey
        ? this.storage.createSignedGetUrl(row.image.objectKey).url
        : null,
    };
  }

  // ---- Reviews ----

  async listReviewReports(
    query: ListAdminReviewReportsQueryDto,
  ): Promise<AdminReviewReportListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const stateMatch =
      query.state === ModerationStateFilter.Hidden
        ? { 'review.visibility': ReviewVisibility.Hidden }
        : query.state === ModerationStateFilter.Visible
          ? { 'review.visibility': ReviewVisibility.Visible }
          : {};
    const [result] = await this.reports.aggregate<{
      rows: Array<{ _id: Types.ObjectId; latestReportAt: Date }>;
      count: Array<{ total: number }>;
    }>([
      {
        $group: {
          _id: '$reviewId',
          latestReportAt: { $max: '$createdAt' },
        },
      },
      {
        $lookup: {
          from: this.reviews.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'review',
        },
      },
      { $unwind: '$review' },
      { $match: stateMatch },
      {
        $facet: {
          rows: [
            { $sort: { latestReportAt: -1, _id: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { _id: 1, latestReportAt: 1 } },
          ],
          count: [{ $count: 'total' }],
        },
      },
    ]);
    const rows = result?.rows ?? [];
    const total = result?.count[0]?.total ?? 0;
    const reviewRows = await this.reviews
      .find({ _id: { $in: rows.map((row) => row._id) } })
      .lean<ReviewRow[]>();
    const byId = new Map(reviewRows.map((row) => [row._id.toString(), row]));
    const ordered = rows.flatMap((row) => {
      const review = byId.get(row._id.toString());
      return review ? [review] : [];
    });
    const items = await this.toReviewItems(ordered);
    return { items, total, page, limit };
  }

  async getReview(id: string): Promise<AdminReviewDetailDto> {
    const review = await this.reviews.findById(id).lean<ReviewRow>();
    if (!review) throw new NotFoundException('Review not found.');
    return this.toReviewDetail(review);
  }

  hideReview(
    id: string,
    adminId: string,
    input: HideContentDto,
  ): Promise<AdminReviewDetailDto> {
    return this.moderateReview(id, input.revision, {
      filter: { visibility: ReviewVisibility.Visible },
      set: {
        visibility: ReviewVisibility.Hidden,
        moderatedAt: new Date(),
        moderationReason: input.reason,
        moderatedBy: new Types.ObjectId(adminId),
      },
      invalidState: {
        code: 'already_hidden',
        message: 'Review is already hidden.',
      },
    });
  }

  restoreReview(
    id: string,
    input: RestoreContentDto,
  ): Promise<AdminReviewDetailDto> {
    return this.moderateReview(id, input.revision, {
      filter: { visibility: ReviewVisibility.Hidden },
      set: {
        visibility: ReviewVisibility.Visible,
        moderatedAt: null,
        moderationReason: null,
        moderatedBy: null,
      },
      invalidState: { code: 'not_hidden', message: 'Review is not hidden.' },
    });
  }

  private async moderateReview(
    id: string,
    revision: number,
    change: {
      filter: QueryFilter<Review>;
      set: Partial<Review>;
      invalidState: { code: string; message: string };
    },
  ): Promise<AdminReviewDetailDto> {
    const _id = new Types.ObjectId(id);
    const updated = await this.reviews
      .findOneAndUpdate(
        { _id, ...change.filter, ...reviewRevisionFilter(revision) },
        // The filter pins the current revision; $inc would yield 1 on legacy
        // reviews that have no stored revision.
        { $set: { ...change.set, revision: revision + 1 } },
        { new: true, runValidators: true },
      )
      .lean<ReviewRow>();
    if (updated) return this.toReviewDetail(updated);

    if (!(await this.reviews.exists({ _id }))) {
      throw new NotFoundException('Review not found.');
    }
    if (!(await this.reviews.exists({ _id, ...change.filter }))) {
      throw new ConflictException({ statusCode: 409, ...change.invalidState });
    }
    throw new ConflictException({
      statusCode: 409,
      code: 'stale_revision',
      message: 'Review was updated concurrently. Refresh and try again.',
    });
  }

  private async reportStats(
    reviewIds: Types.ObjectId[],
  ): Promise<Map<string, ReportStats>> {
    const rows = await this.reports.aggregate<
      ReportStats & { _id: Types.ObjectId }
    >([
      { $match: { reviewId: { $in: reviewIds } } },
      {
        $group: {
          _id: '$reviewId',
          reportCount: { $sum: 1 },
          latestReportAt: { $max: '$createdAt' },
          categories: { $push: '$category' },
        },
      },
    ]);
    return new Map(rows.map((row) => [row._id.toString(), row]));
  }

  private async toReviewItems(
    reviews: ReviewRow[],
  ): Promise<AdminReviewReportItemDto[]> {
    if (reviews.length === 0) return [];
    const [stats, users] = await Promise.all([
      this.reportStats(reviews.map((review) => review._id)),
      this.users
        .find({
          _id: { $in: reviews.flatMap((r) => [r.authorId, r.producerId]) },
        })
        .select({ name: 1, 'producerApplication.farmName': 1 })
        .lean<UserRow[]>(),
    ]);
    const userById = new Map(users.map((u) => [u._id.toString(), u]));
    return reviews.map((review) => {
      const stat = stats.get(review._id.toString());
      const author = userById.get(review.authorId.toString());
      const producer = userById.get(review.producerId.toString());
      const categoryCounts: Partial<Record<ReviewReportCategory, number>> = {};
      for (const category of stat?.categories ?? []) {
        categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
      }
      return {
        reviewId: review._id.toString(),
        rating: review.rating,
        comment: review.comment ?? null,
        visibility: review.visibility,
        moderation: moderationInfo(
          review.moderatedAt,
          review.moderationReason,
          review.moderatedBy,
        ),
        revision: review.revision ?? 1,
        reviewCreatedAt: review.createdAt.toISOString(),
        author: {
          id: review.authorId.toString(),
          name: author?.name ?? 'Unknown user',
        },
        producer: {
          id: review.producerId.toString(),
          farmName:
            producer?.producerApplication?.farmName ||
            producer?.name ||
            'Unknown producer',
        },
        orderId: review.orderId.toString(),
        reportCount: stat?.reportCount ?? 0,
        latestReportAt: iso(stat?.latestReportAt),
        categoryCounts,
      };
    });
  }

  private async toReviewDetail(
    review: ReviewRow,
  ): Promise<AdminReviewDetailDto> {
    const [items, reports] = await Promise.all([
      this.toReviewItems([review]),
      this.reports
        .find({ reviewId: review._id })
        .sort({ createdAt: -1, _id: -1 })
        .limit(MAX_REPORTS_IN_DETAIL)
        .lean<Array<ReviewReport & { _id: Types.ObjectId; createdAt: Date }>>(),
    ]);
    const reporters = await this.users
      .find({ _id: { $in: reports.map((report) => report.reporterId) } })
      .select({ name: 1 })
      .lean<UserRow[]>();
    const nameById = new Map(reporters.map((u) => [u._id.toString(), u.name]));
    return {
      ...items[0]!,
      reports: reports.map((report) => ({
        id: report._id.toString(),
        category: report.category,
        note: report.note ?? null,
        createdAt: report.createdAt.toISOString(),
        reporter: {
          id: report.reporterId.toString(),
          name: nameById.get(report.reporterId.toString()) ?? 'Unknown user',
        },
      })),
    };
  }
}
