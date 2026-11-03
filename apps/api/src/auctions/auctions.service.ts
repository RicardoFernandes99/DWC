import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { ClientSession, Connection, Model } from 'mongoose';
import { Product } from '../products/product.schema.js';
import { ProducerStatus, User, UserRole } from '../users/user.schema.js';
import { Auction, AuctionStatus } from './auction.schema.js';
import type { AuctionDocument } from './auction.schema.js';
import {
  AuctionListResponseDto,
  AuctionPublicState,
  AuctionResponseDto,
  CancelAuctionDto,
  CreateAuctionDto,
  ListAuctionsQueryDto,
  ListPublicAuctionsQueryDto,
  UpdateAuctionDto,
} from './auction.dto.js';

function toAuctionResponse(
  auction: AuctionDocument,
  now = new Date(),
): AuctionResponseDto {
  const persistedState = auction.status;
  const state =
    persistedState === AuctionStatus.Scheduled
      ? AuctionPublicState.Upcoming
      : persistedState === AuctionStatus.Cancelled
        ? AuctionPublicState.Finished
        : auction.endsAt.getTime() <= now.getTime()
          ? AuctionPublicState.Finished
          : AuctionPublicState.Active;
  return {
    id: auction._id.toString(),
    producerId: auction.producerId.toString(),
    productId: auction.productId.toString(),
    product: {
      name: auction.productSnapshot.name,
      description: auction.productSnapshot.description,
      category: auction.productSnapshot.category,
      productionMethod: auction.productSnapshot.productionMethod,
      seasons: [...auction.productSnapshot.seasons],
      unit: auction.productSnapshot.unit,
    },
    quantity: auction.quantity,
    startingPriceCents: auction.startingPriceCents,
    minimumIncrementCents: auction.minimumIncrementCents,
    startsAt: auction.startsAt.toISOString(),
    endsAt: auction.endsAt.toISOString(),
    state,
    status: auction.status,
    currentBidCents: auction.currentBidCents,
    revision: auction.revision,
    createdAt: (auction.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (auction.updatedAt ?? new Date(0)).toISOString(),
  };
}

@Injectable()
export class AuctionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuctionsService.name);
  private scheduleTimer: NodeJS.Timeout | undefined;
  private processing = false;

  constructor(
    @InjectModel(Auction.name) private readonly auctions: Model<Auction>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  onModuleInit(): void {
    this.scheduleTimer = setInterval(() => {
      void this.processDueAuctions();
    }, 1000);
    this.scheduleTimer.unref();
    void this.processDueAuctions();
  }

  onModuleDestroy(): void {
    if (this.scheduleTimer) clearInterval(this.scheduleTimer);
  }

  private async withTransaction<T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  private validateTimes(
    startsAt: Date,
    endsAt: Date,
    requireFuture: boolean,
  ): void {
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException(
        'Auction end time must be after its start time.',
      );
    }
    if (requireFuture && startsAt <= new Date()) {
      throw new BadRequestException(
        'Auction start time must be in the future.',
      );
    }
  }

  private async fenceApprovedProducer(
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<User> {
    const producer = await this.users.findOneAndUpdate(
      {
        _id: userId,
        role: UserRole.Producer,
        producerStatus: ProducerStatus.Approved,
      },
      { $inc: { auctionEligibilityRevision: 1 } },
      { session, returnDocument: 'after' },
    );
    if (!producer)
      throw new ForbiddenException(
        'Only approved producers may manage auctions.',
      );
    return producer;
  }

  private async reserveStock(
    productId: Types.ObjectId,
    producerId: Types.ObjectId,
    quantity: number,
    session: ClientSession,
    startsAt?: Date,
  ): Promise<void> {
    const filter: Record<string, unknown> = {
      _id: productId,
      producerId,
      published: true,
      archivedAt: null,
      moderatedAt: null,
      availableStock: { $gte: quantity },
    };
    if (startsAt) filter.$expr = { $gt: [{ $literal: startsAt }, '$$NOW'] };
    const updated = await this.products.findOneAndUpdate(
      filter,
      {
        $inc: {
          availableStock: -quantity,
          reservedStock: quantity,
          revision: 1,
        },
      },
      { session, returnDocument: 'after', runValidators: true },
    );
    if (!updated)
      throw new ConflictException(
        'Product is unavailable or has insufficient available stock.',
      );
  }

  private async releaseStock(
    productId: Types.ObjectId,
    producerId: Types.ObjectId,
    quantity: number,
    session: ClientSession,
  ): Promise<void> {
    const updated = await this.products.findOneAndUpdate(
      { _id: productId, producerId, reservedStock: { $gte: quantity } },
      {
        $inc: {
          availableStock: quantity,
          reservedStock: -quantity,
          revision: 1,
        },
      },
      { session, returnDocument: 'after', runValidators: true },
    );
    if (!updated)
      throw new ConflictException(
        'Reserved stock could not be released safely.',
      );
  }

  async create(
    userId: string,
    input: CreateAuctionDto,
  ): Promise<AuctionResponseDto> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    this.validateTimes(startsAt, endsAt, true);
    const producerId = new Types.ObjectId(userId);
    const productId = new Types.ObjectId(input.productId);
    const auction = await this.withTransaction(async (session) => {
      await this.fenceApprovedProducer(producerId, session);
      const product = await this.products
        .findOne({
          _id: productId,
          producerId,
          published: true,
          archivedAt: null,
          moderatedAt: null,
        })
        .session(session);
      if (!product) throw new NotFoundException('Published product not found.');
      await this.reserveStock(
        productId,
        producerId,
        input.quantity,
        session,
        startsAt,
      );
      const created = new this.auctions({
        producerId,
        productId,
        productSnapshot: {
          name: product.name,
          description: product.description,
          category: product.category,
          productionMethod: product.productionMethod,
          seasons: [...product.seasons],
          unit: product.unit,
        },
        quantity: input.quantity,
        startingPriceCents: input.startingPriceCents,
        minimumIncrementCents: input.minimumIncrementCents,
        startsAt,
        endsAt,
        status: AuctionStatus.Scheduled,
        currentBidCents: null,
        currentBidderId: null,
        revision: 1,
      });
      return created.save({ session });
    });
    return toAuctionResponse(auction);
  }

  async listForProducer(
    userId: string,
    query: ListAuctionsQueryDto,
  ): Promise<AuctionListResponseDto> {
    const producerId = new Types.ObjectId(userId);
    const filter = { producerId };
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.auctions
        .find(filter)
        .sort({ startsAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.auctions.countDocuments(filter),
    ]);
    return {
      items: items.map((item) => toAuctionResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getForProducer(
    userId: string,
    id: string,
  ): Promise<AuctionResponseDto> {
    const auction = await this.auctions.findOne({
      _id: new Types.ObjectId(id),
      producerId: new Types.ObjectId(userId),
    });
    if (!auction) throw new NotFoundException('Auction not found.');
    return toAuctionResponse(auction);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateAuctionDto,
  ): Promise<AuctionResponseDto> {
    if (
      input.quantity === undefined &&
      input.startingPriceCents === undefined &&
      input.minimumIncrementCents === undefined &&
      input.startsAt === undefined &&
      input.endsAt === undefined
    ) {
      throw new BadRequestException(
        'At least one auction field must be provided.',
      );
    }
    const producerId = new Types.ObjectId(userId);
    const auctionId = new Types.ObjectId(id);
    const updated = await this.withTransaction(async (session) => {
      await this.fenceApprovedProducer(producerId, session);
      const current = await this.auctions
        .findOne({
          _id: auctionId,
          producerId,
          status: AuctionStatus.Scheduled,
          revision: input.revision,
        })
        .session(session);
      if (!current) throw await this.staleAuctionError(auctionId, producerId);
      const nextStartsAt = input.startsAt
        ? new Date(input.startsAt)
        : current.startsAt;
      const nextEndsAt = input.endsAt ? new Date(input.endsAt) : current.endsAt;
      this.validateTimes(nextStartsAt, nextEndsAt, false);
      const quantity = input.quantity ?? current.quantity;
      const delta = quantity - current.quantity;
      if (delta > 0)
        await this.reserveStock(
          current.productId,
          producerId,
          delta,
          session,
          nextStartsAt,
        );
      if (delta < 0)
        await this.releaseStock(current.productId, producerId, -delta, session);
      const update: Record<string, unknown> = {
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        quantity,
      };
      if (input.startingPriceCents !== undefined)
        update.startingPriceCents = input.startingPriceCents;
      if (input.minimumIncrementCents !== undefined)
        update.minimumIncrementCents = input.minimumIncrementCents;
      const saved = await this.auctions.findOneAndUpdate(
        {
          _id: auctionId,
          producerId,
          status: AuctionStatus.Scheduled,
          revision: input.revision,
          $expr: {
            $and: [
              { $gt: ['$startsAt', '$$NOW'] },
              { $gt: [{ $literal: nextStartsAt }, '$$NOW'] },
            ],
          },
        },
        { $set: update, $inc: { revision: 1 } },
        { session, returnDocument: 'after', runValidators: true },
      );
      if (!saved)
        throw new ConflictException(
          'Auction has started or changed. Refresh and try again.',
        );
      return saved;
    });
    return toAuctionResponse(updated);
  }

  async cancel(
    userId: string,
    id: string,
    input: CancelAuctionDto,
  ): Promise<AuctionResponseDto> {
    const producerId = new Types.ObjectId(userId);
    const auctionId = new Types.ObjectId(id);
    const cancelled = await this.withTransaction(async (session) => {
      const current = await this.auctions
        .findOne({
          _id: auctionId,
          producerId,
          status: AuctionStatus.Scheduled,
          revision: input.revision,
        })
        .session(session);
      if (!current) throw await this.staleAuctionError(auctionId, producerId);
      const updated = await this.auctions.findOneAndUpdate(
        {
          _id: auctionId,
          producerId,
          status: AuctionStatus.Scheduled,
          revision: input.revision,
          $expr: { $gt: ['$startsAt', '$$NOW'] },
        },
        { $set: { status: AuctionStatus.Cancelled }, $inc: { revision: 1 } },
        { session, returnDocument: 'after' },
      );
      if (!updated)
        throw new ConflictException('Auction has started or changed.');
      await this.releaseStock(
        current.productId,
        producerId,
        current.quantity,
        session,
      );
      return updated;
    });
    return toAuctionResponse(cancelled);
  }

  private async staleAuctionError(
    id: Types.ObjectId,
    producerId: Types.ObjectId,
  ): Promise<Error> {
    const existing = await this.auctions.findOne({ _id: id, producerId });
    if (!existing) return new NotFoundException('Auction not found.');
    if (existing.status !== AuctionStatus.Scheduled)
      return new ConflictException(
        'Only scheduled auctions can be edited or cancelled.',
      );
    return new ConflictException(
      'Auction changed or has reached its scheduled start. Refresh and try again.',
    );
  }

  async listPublic(
    query: ListPublicAuctionsQueryDto,
  ): Promise<AuctionListResponseDto> {
    const now = new Date();
    const filter: Record<string, unknown> = {
      $or: [
        { status: AuctionStatus.Scheduled, startsAt: { $gt: now } },
        { status: AuctionStatus.Active },
      ],
    };
    if (query.state === AuctionPublicState.Upcoming) {
      filter.status = AuctionStatus.Scheduled;
      filter.startsAt = { $gt: now };
      delete filter.$or;
    }
    if (query.state === AuctionPublicState.Active) {
      filter.status = AuctionStatus.Active;
      filter.endsAt = { $gt: now };
      delete filter.$or;
    }
    if (query.state === AuctionPublicState.Finished) {
      filter.status = AuctionStatus.Active;
      filter.endsAt = { $lte: now };
      delete filter.$or;
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.auctions
        .find(filter)
        .sort({ startsAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.auctions.countDocuments(filter),
    ]);
    return {
      items: items.map((item) => toAuctionResponse(item, now)),
      total,
      page,
      limit,
    };
  }

  async getPublic(id: string): Promise<AuctionResponseDto> {
    const auction = await this.auctions.findOne({
      _id: new Types.ObjectId(id),
      $or: [
        { status: AuctionStatus.Active },
        { status: AuctionStatus.Scheduled, startsAt: { $gt: new Date() } },
      ],
    });
    if (!auction) throw new NotFoundException('Auction not found.');
    return toAuctionResponse(auction);
  }

  private async processDueAuctions(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const due = await this.auctions
        .find({
          status: AuctionStatus.Scheduled,
          $expr: { $lte: ['$startsAt', '$$NOW'] },
        })
        .sort({ startsAt: 1, _id: 1 })
        .limit(100)
        .select({ _id: 1 });
      for (const item of due) {
        try {
          await this.activateOrCancelDue(item._id);
        } catch {
          this.logger.warn(
            `Auction schedule processing failed for ${item._id.toString()}.`,
          );
        }
      }
    } catch {
      this.logger.warn('Auction scheduler could not query due records.');
    } finally {
      this.processing = false;
    }
  }

  private async activateOrCancelDue(id: Types.ObjectId): Promise<void> {
    await this.withTransaction(async (session) => {
      const auction = await this.auctions
        .findOne({
          _id: id,
          status: AuctionStatus.Scheduled,
          $expr: { $lte: ['$startsAt', '$$NOW'] },
        })
        .session(session);
      if (!auction) return;
      const producer = await this.users
        .findOne({ _id: auction.producerId, role: UserRole.Producer })
        .session(session);
      const decisionAfterStart = Boolean(
        producer?.producerDecisionAt &&
        producer.producerDecisionAt > auction.startsAt,
      );
      const eligibleAtMissedStart =
        producer?.producerStatus === ProducerStatus.Approved &&
        !decisionAfterStart;
      if (!eligibleAtMissedStart) {
        if (producer) {
          const eligibilityStillCurrent = await this.users.findOneAndUpdate(
            {
              _id: producer._id,
              role: UserRole.Producer,
              producerStatus: producer.producerStatus,
              producerDecisionAt: producer.producerDecisionAt,
            },
            { $inc: { auctionEligibilityRevision: 1 } },
            { session, returnDocument: 'after' },
          );
          if (!eligibilityStillCurrent) {
            throw new ConflictException(
              'Producer eligibility changed while cancelling auction.',
            );
          }
        }
        const cancelled = await this.auctions.findOneAndUpdate(
          {
            _id: auction._id,
            status: AuctionStatus.Scheduled,
            $expr: { $lte: ['$startsAt', '$$NOW'] },
          },
          { $set: { status: AuctionStatus.Cancelled }, $inc: { revision: 1 } },
          { session, returnDocument: 'after' },
        );
        if (cancelled)
          await this.releaseStock(
            auction.productId,
            auction.producerId,
            auction.quantity,
            session,
          );
        return;
      }

      // Touch the producer document in the same transaction as activation so a
      // concurrent suspension decision conflicts on the same eligibility record.
      const fenced = await this.users.findOneAndUpdate(
        {
          _id: auction.producerId,
          role: UserRole.Producer,
          producerStatus: ProducerStatus.Approved,
          producerDecisionAt: producer.producerDecisionAt,
        },
        { $inc: { auctionEligibilityRevision: 1 } },
        { session, returnDocument: 'after' },
      );
      if (!fenced)
        throw new ConflictException(
          'Producer eligibility changed while activating auction.',
        );
      await this.auctions.findOneAndUpdate(
        {
          _id: auction._id,
          status: AuctionStatus.Scheduled,
          $expr: { $lte: ['$startsAt', '$$NOW'] },
        },
        { $set: { status: AuctionStatus.Active }, $inc: { revision: 1 } },
        { session, returnDocument: 'after' },
      );
    });
  }
}
