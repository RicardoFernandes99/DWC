import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { ClientSession, Connection, Model } from 'mongoose';
import { Product } from '../products/product.schema.js';
import {
  BuyerStatus,
  ProducerStatus,
  User,
  UserRole,
} from '../users/user.schema.js';
import { Auction, AuctionStatus } from './auction.schema.js';
import { AuctionBid } from './auction.schema.js';
import type { AuctionBidDocument, AuctionDocument } from './auction.schema.js';
import {
  AuctionBidRequestDto,
  AuctionBidResponseDto,
  AuctionBuyerResultResponseDto,
  AuctionHistoryQueryDto,
  AuctionHistoryResponseDto,
  AuctionLiveStateDto,
  AuctionListResponseDto,
  AuctionPublicState,
  AuctionResponseDto,
  CancelAuctionDto,
  CreateAuctionDto,
  ListAuctionsQueryDto,
  ListPublicAuctionsQueryDto,
  UpdateAuctionDto,
} from './auction.dto.js';
import { PaymentMethod } from '../payment-methods/payment-method.schema.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { Payment, PaymentStatus } from '../checkout/payment.schema.js';
import {
  FulfilmentMethod,
  Order,
  OrderOrigin,
  OrderStatus,
} from '../orders/order.schema.js';
import { NotificationIntegrationService } from '../notifications/notification-integration.service.js';
import {
  NotificationEventType,
  NotificationResourceType,
} from '../notifications/notification.schema.js';
import type { NotificationDocument } from '../notifications/notification.schema.js';
import { AuctionCompletionPublisher } from './auction-completion.publisher.js';

export interface AcceptedBidResult {
  duplicate: boolean;
  bid: AuctionBidResponseDto;
  state: AuctionLiveStateDto;
}

function toBidResponse(bid: AuctionBidDocument): AuctionBidResponseDto {
  return {
    id: bid._id.toString(),
    auctionId: bid.auctionId.toString(),
    amountCents: bid.amountCents,
    bidderName: bid.bidderName,
    acceptedAt: bid.acceptedAt.toISOString(),
    endsAt: bid.endsAt.toISOString(),
    revision: bid.revision,
  };
}

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
    @InjectModel(AuctionBid.name)
    private readonly bids: Model<AuctionBid>,
    @InjectModel(PaymentMethod.name)
    private readonly paymentMethods: Model<PaymentMethod>,
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectConnection() private readonly connection: Connection,
    private readonly notificationIntegration: NotificationIntegrationService,
    private readonly completionPublisher: AuctionCompletionPublisher,
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
        { status: AuctionStatus.Finished },
      ],
    };
    if (query.producerId)
      filter.producerId = new Types.ObjectId(query.producerId);
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
      filter.$or = [
        { status: AuctionStatus.Finished },
        {
          status: AuctionStatus.Active,
          endsAt: { $lte: now },
        },
      ];
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
        { status: AuctionStatus.Finished },
        { status: AuctionStatus.Scheduled, startsAt: { $gt: new Date() } },
      ],
    });
    if (!auction) throw new NotFoundException('Auction not found.');
    return toAuctionResponse(auction);
  }

  async getLiveState(
    id: string,
    viewerCount: number,
  ): Promise<AuctionLiveStateDto> {
    const auction = await this.auctions.findOne({
      _id: new Types.ObjectId(id),
      $or: [
        { status: AuctionStatus.Active },
        { status: AuctionStatus.Finished },
        { status: AuctionStatus.Scheduled, startsAt: { $gt: new Date() } },
      ],
    });
    if (!auction) throw new NotFoundException('Auction not found.');
    return this.toLiveState(auction, new Date(), viewerCount);
  }

  async getBuyerResult(
    auctionId: string,
    buyer: UserResponseDto,
  ): Promise<AuctionBuyerResultResponseDto> {
    if (buyer.role !== UserRole.Buyer)
      throw new ForbiddenException('Buyer access is required.');
    const id = new Types.ObjectId(auctionId);
    const auction = await this.auctions.findOne({ _id: id }).select({
      status: 1,
    });
    if (!auction) throw new NotFoundException('Auction not found.');
    if (auction.status !== AuctionStatus.Finished)
      return { state: 'pending', orderId: null, paymentStatus: null };

    const order = await this.orders
      .findOne({ auctionId: id, buyerId: new Types.ObjectId(buyer.id) })
      .select({ _id: 1, paymentId: 1 });
    if (!order)
      return { state: 'not_winner', orderId: null, paymentStatus: null };
    const payment = await this.payments
      .findOne({ _id: order.paymentId, buyerId: new Types.ObjectId(buyer.id) })
      .select({ status: 1 });
    return {
      state: 'won',
      orderId: order._id.toString(),
      paymentStatus:
        payment?.status === PaymentStatus.Succeeded ? 'succeeded' : null,
    };
  }

  async listPublicHistory(
    auctionId: string,
    query: AuctionHistoryQueryDto,
  ): Promise<AuctionHistoryResponseDto> {
    const id = new Types.ObjectId(auctionId);
    const auction = await this.auctions.exists({
      _id: id,
      status: { $ne: AuctionStatus.Cancelled },
    });
    if (!auction) throw new NotFoundException('Auction not found.');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = { auctionId: id };
    const [items, total] = await Promise.all([
      this.bids
        .find(filter)
        .sort({ acceptedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.bids.countDocuments(filter),
    ]);
    return { items: items.map(toBidResponse), total, page, limit };
  }

  async placeBid(
    buyer: UserResponseDto,
    input: AuctionBidRequestDto,
  ): Promise<AcceptedBidResult> {
    if (buyer.role !== UserRole.Buyer) {
      throw new ForbiddenException('Buyer access is required to bid.');
    }
    const buyerId = new Types.ObjectId(buyer.id);
    const auctionId = new Types.ObjectId(input.auctionId);
    const paymentMethodId = new Types.ObjectId(input.paymentMethodId);
    const prior = await this.findRequest(buyerId, input.requestId);
    if (prior) return this.duplicateBid(prior, input, buyerId);

    try {
      return await this.withTransaction(async (session) => {
        const duplicate = await this.bids
          .findOne({ buyerId, requestId: input.requestId })
          .session(session);
        if (duplicate) return this.duplicateBid(duplicate, input, buyerId);

        const buyerFilter = {
          _id: buyerId,
          role: UserRole.Buyer,
          buyerStatus: { $ne: BuyerStatus.Suspended },
        };
        const eligibleBuyer = await this.users.updateOne(
          buyerFilter,
          { $inc: { buyerEligibilityRevision: 1 } },
          { session },
        );
        if (eligibleBuyer.matchedCount !== 1) {
          throw new ForbiddenException(
            'This account cannot place new bids while suspended.',
          );
        }

        const method = await this.paymentMethods
          .findOne({
            _id: paymentMethodId,
            ownerId: buyerId,
            $expr: {
              $gte: [
                { $add: [{ $multiply: ['$expiryYear', 12] }, '$expiryMonth'] },
                {
                  $add: [
                    { $multiply: [{ $year: '$$NOW' }, 12] },
                    { $month: '$$NOW' },
                  ],
                },
              ],
            },
          })
          .session(session)
          .select({ _id: 1, last4: 1, expiryMonth: 1, expiryYear: 1 });
        if (!method)
          throw new ForbiddenException(
            'Choose a saved payment method that belongs to you and has not expired.',
          );
        const current = await this.auctions
          .findOne({ _id: auctionId })
          .session(session);
        if (!current) throw new NotFoundException('Auction not found.');

        const updated = await this.auctions.findOneAndUpdate(
          {
            _id: auctionId,
            revision: current.revision,
            status: AuctionStatus.Active,
            $expr: {
              $and: [
                { $lte: ['$startsAt', '$$NOW'] },
                { $gt: ['$endsAt', '$$NOW'] },
                {
                  $or: [
                    {
                      $and: [
                        {
                          $eq: [{ $ifNull: ['$currentBidCents', null] }, null],
                        },
                        {
                          $gte: [
                            { $literal: input.amountCents },
                            '$startingPriceCents',
                          ],
                        },
                      ],
                    },
                    {
                      $and: [
                        {
                          $ne: [{ $ifNull: ['$currentBidCents', null] }, null],
                        },
                        {
                          $gte: [
                            { $literal: input.amountCents },
                            {
                              $add: [
                                '$currentBidCents',
                                '$minimumIncrementCents',
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          [
            {
              $set: {
                currentBidCents: { $literal: input.amountCents },
                currentBidderId: { $literal: buyerId },
                currentBidderName: { $literal: buyer.name.slice(0, 100) },
                lastBidAt: '$$NOW',
                endsAt: {
                  $cond: [
                    { $lt: [{ $subtract: ['$endsAt', '$$NOW'] }, 10_000] },
                    { $add: ['$$NOW', 10_000] },
                    '$endsAt',
                  ],
                },
                revision: { $add: ['$revision', 1] },
                updatedAt: '$$NOW',
              },
            },
          ],
          { session, returnDocument: 'after', updatePipeline: true },
        );
        if (!updated) {
          throw new ConflictException(
            'Bid was not accepted. Refresh the auction and meet the current minimum bid before its deadline.',
          );
        }
        if (!updated.lastBidAt) {
          throw new ConflictException('Accepted bid timestamp is unavailable.');
        }

        const bid = await this.bids.create(
          [
            {
              auctionId,
              buyerId,
              bidderName: buyer.name.slice(0, 100),
              paymentMethodId,
              paymentMethodSnapshot: {
                last4: method.last4,
                expiryMonth: method.expiryMonth,
                expiryYear: method.expiryYear,
              },
              requestId: input.requestId,
              amountCents: input.amountCents,
              startingPriceCents: updated.startingPriceCents,
              minimumIncrementCents: updated.minimumIncrementCents,
              acceptedAt: updated.lastBidAt,
              endsAt: updated.endsAt,
              revision: updated.revision,
            },
          ],
          { session },
        );
        return {
          duplicate: false,
          bid: toBidResponse(bid[0]),
          state: this.toLiveState(updated, updated.lastBidAt, 0),
        };
      });
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        const duplicate = await this.findRequest(buyerId, input.requestId);
        if (duplicate) return this.duplicateBid(duplicate, input, buyerId);
      }
      throw error;
    }
  }

  private async findRequest(buyerId: Types.ObjectId, requestId: string) {
    return this.bids.findOne({ buyerId, requestId });
  }

  private duplicateBid(
    bid: AuctionBidDocument,
    input: AuctionBidRequestDto,
    buyerId: Types.ObjectId,
  ): AcceptedBidResult {
    if (
      !bid.auctionId.equals(new Types.ObjectId(input.auctionId)) ||
      bid.amountCents !== input.amountCents ||
      !bid.paymentMethodId.equals(new Types.ObjectId(input.paymentMethodId))
    ) {
      throw new ConflictException(
        'This request ID was already used with a different bid. Use a new request ID.',
      );
    }
    if (!bid.buyerId.equals(buyerId)) throw new UnauthorizedException();
    return {
      duplicate: true,
      bid: toBidResponse(bid),
      state: {
        auctionId: bid.auctionId.toString(),
        state: AuctionPublicState.Active,
        startingPriceCents: bid.startingPriceCents,
        minimumIncrementCents: bid.minimumIncrementCents,
        currentBidCents: bid.amountCents,
        currentBidderName: bid.bidderName,
        serverTime: bid.acceptedAt.toISOString(),
        endsAt: bid.endsAt.toISOString(),
        revision: bid.revision,
        viewerCount: 0,
      },
    };
  }

  private toLiveState(
    auction: AuctionDocument,
    now: Date,
    viewerCount: number,
  ): AuctionLiveStateDto {
    const state =
      auction.status === AuctionStatus.Scheduled
        ? AuctionPublicState.Upcoming
        : auction.endsAt <= now
          ? AuctionPublicState.Finished
          : AuctionPublicState.Active;
    return {
      auctionId: auction._id.toString(),
      state,
      startingPriceCents: auction.startingPriceCents,
      minimumIncrementCents: auction.minimumIncrementCents,
      currentBidCents: auction.currentBidCents,
      currentBidderName: auction.currentBidderName,
      serverTime: now.toISOString(),
      endsAt: auction.endsAt.toISOString(),
      revision: auction.revision,
      viewerCount,
    };
  }

  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
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
      const ended = await this.auctions
        .find({
          status: AuctionStatus.Active,
          $expr: { $lte: ['$endsAt', '$$NOW'] },
        })
        .sort({ endsAt: 1, _id: 1 })
        .limit(50)
        .select({ _id: 1 });
      for (const item of ended) {
        try {
          await this.settleDueAuction(item._id);
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Auction settlement remains retryable for ${item._id.toString()}: ${detail}`,
          );
        }
      }
      await this.recoverClosureNotifications();
    } catch {
      this.logger.warn('Auction scheduler could not query due records.');
    } finally {
      this.processing = false;
    }
  }

  private async settleDueAuction(id: Types.ObjectId): Promise<void> {
    let completion: {
      auctionId: string;
      state: 'finished';
      winningAmountCents: number | null;
      winnerName: string | null;
      revision: number;
      serverTime: string;
    } | null = null;
    const notifications: NotificationDocument[] = [];
    await this.withTransaction(async (session) => {
      notifications.length = 0;
      completion = null;
      const auction = await this.auctions
        .findOne({
          _id: id,
          status: AuctionStatus.Active,
          $expr: { $lte: ['$endsAt', '$$NOW'] },
        })
        .session(session);
      if (!auction) return;

      const winnerId = auction.currentBidderId;
      const amountCents = auction.currentBidCents;
      let snapshot: {
        last4: string;
        expiryMonth: number;
        expiryYear: number;
      } | null = null;
      let winnerBid: AuctionBidDocument | null = null;
      if (winnerId && amountCents !== null) {
        winnerBid = await this.bids
          .findOne({
            auctionId: auction._id,
            buyerId: winnerId,
            amountCents,
          })
          .sort({ acceptedAt: -1, _id: -1 })
          .session(session);
        snapshot = winnerBid?.paymentMethodSnapshot ?? null;
        if (!snapshot && winnerBid) {
          const method = await this.paymentMethods
            .findOne({ _id: winnerBid.paymentMethodId, ownerId: winnerId })
            .session(session)
            .select({ last4: 1, expiryMonth: 1, expiryYear: 1 });
          if (method) {
            snapshot = {
              last4: method.last4,
              expiryMonth: method.expiryMonth,
              expiryYear: method.expiryYear,
            };
            await this.bids.updateOne(
              { _id: winnerBid._id, paymentMethodSnapshot: null },
              { $set: { paymentMethodSnapshot: snapshot } },
              { session },
            );
          }
        }
        if (!winnerBid || !snapshot) {
          throw new ConflictException(
            'Accepted winner payment snapshot is unavailable; settlement will retry.',
          );
        }
      }

      const finished = await this.auctions.findOneAndUpdate(
        {
          _id: auction._id,
          status: AuctionStatus.Active,
          revision: auction.revision,
          endsAt: auction.endsAt,
          $expr: { $lte: ['$endsAt', '$$NOW'] },
        },
        [
          {
            $set: {
              status: AuctionStatus.Finished,
              closureNotificationsPending: true,
              closureNotificationCursor: null,
              closedAt: '$$NOW',
              revision: { $add: ['$revision', 1] },
              updatedAt: '$$NOW',
            },
          },
        ],
        { session, returnDocument: 'after', updatePipeline: true },
      );
      if (!finished) return;

      if (!winnerId || amountCents === null || !winnerBid || !snapshot) {
        await this.releaseStock(
          auction.productId,
          auction.producerId,
          auction.quantity,
          session,
        );
      } else {
        const consumed = await this.products.findOneAndUpdate(
          {
            _id: auction.productId,
            producerId: auction.producerId,
            reservedStock: { $gte: auction.quantity },
          },
          { $inc: { reservedStock: -auction.quantity, revision: 1 } },
          { session, returnDocument: 'after', runValidators: true },
        );
        if (!consumed)
          throw new ConflictException(
            'Auction reserved stock could not be consumed safely.',
          );

        const payment = await this.payments.create(
          [
            {
              checkoutId: null,
              auctionId: auction._id,
              buyerId: winnerId,
              paymentMethodId: winnerBid.paymentMethodId,
              paymentMethodSnapshot: snapshot,
              amountCents,
              status: PaymentStatus.Succeeded,
              refundedCents: 0,
            },
          ],
          { session },
        );
        const lotLabel = `lot of ${auction.quantity} ${auction.quantity === 1 ? auction.productSnapshot.unit : `${auction.productSnapshot.unit}s`}`;
        const order = await this.orders.create(
          [
            {
              checkoutId: null,
              auctionId: auction._id,
              buyerId: winnerId,
              producerId: auction.producerId,
              paymentId: payment[0]._id,
              items: [
                {
                  productId: auction.productId,
                  productName: `${auction.productSnapshot.name} (${lotLabel})`,
                  productUnit: auction.productSnapshot.unit,
                  quantity: 1,
                  unitPriceCents: amountCents,
                  lineTotalCents: amountCents,
                },
              ],
              fulfilmentMethod: FulfilmentMethod.Collection,
              deliveryAddress: null,
              subtotalCents: amountCents,
              deliveryFeeCents: 0,
              totalCents: amountCents,
              status: OrderStatus.Confirmed,
              statusHistory: [
                {
                  status: OrderStatus.Confirmed,
                  timestamp: finished.closedAt ?? new Date(),
                  actorId: auction.producerId,
                  actorRole: UserRole.Producer,
                  note: 'Auction lot paid and confirmed automatically.',
                },
              ],
              origin: OrderOrigin.Auction,
              revision: 1,
              refundRequest: null,
            },
          ],
          { session },
        );
        notifications.push(
          await this.notificationIntegration.persist(
            {
              recipientId: auction.producerId.toString(),
              eventType: NotificationEventType.OrderCreated,
              title: 'Auction order confirmed',
              message: 'A paid auction lot is ready for collection.',
              resource: {
                type: NotificationResourceType.Order,
                id: order[0]._id.toString(),
              },
              sourceEventKey: `auction:${auction._id.toString()}:order-created`,
            },
            session,
          ),
        );
        notifications.push(
          await this.notificationIntegration.persist(
            {
              recipientId: winnerId.toString(),
              eventType: NotificationEventType.AuctionWon,
              title: 'Auction won',
              message:
                'Your payment succeeded and your collection order is confirmed.',
              resource: {
                type: NotificationResourceType.Auction,
                id: auction._id.toString(),
              },
              sourceEventKey: `auction:${auction._id.toString()}:result:${winnerId.toString()}`,
            },
            session,
          ),
        );

        const currentMethod = await this.paymentMethods
          .exists({ _id: winnerBid.paymentMethodId, ownerId: winnerId })
          .session(session);
        const expiredAtClosure = await this.paymentMethods
          .exists({
            _id: winnerBid.paymentMethodId,
            ownerId: winnerId,
            $expr: {
              $lt: [
                { $add: [{ $multiply: ['$expiryYear', 12] }, '$expiryMonth'] },
                {
                  $add: [
                    { $multiply: [{ $year: '$$NOW' }, 12] },
                    { $month: '$$NOW' },
                  ],
                },
              ],
            },
          })
          .session(session);
        if (!currentMethod || expiredAtClosure) {
          notifications.push(
            await this.notificationIntegration.persist(
              {
                recipientId: winnerId.toString(),
                eventType: NotificationEventType.AuctionPaymentMethodExpired,
                title: 'Add a new payment card',
                message:
                  'Your auction order is paid and confirmed. Your saved card has expired or was removed; add a new card for future purchases and bids.',
                resource: {
                  type: NotificationResourceType.Auction,
                  id: auction._id.toString(),
                },
                sourceEventKey: `auction:${auction._id.toString()}:payment-method-warning`,
              },
              session,
            ),
          );
        }
      }

      notifications.push(
        await this.notificationIntegration.persist(
          {
            recipientId: auction.producerId.toString(),
            eventType: NotificationEventType.AuctionClosed,
            title: 'Auction closed',
            message: winnerId
              ? 'The auction has closed and its collection order is confirmed.'
              : 'The auction closed without bids and its reserved stock was released.',
            resource: {
              type: NotificationResourceType.Auction,
              id: auction._id.toString(),
            },
            sourceEventKey: `auction:${auction._id.toString()}:producer-closed`,
          },
          session,
        ),
      );
      completion = {
        auctionId: auction._id.toString(),
        state: 'finished',
        winningAmountCents: amountCents,
        winnerName: auction.currentBidderName,
        revision: finished.revision,
        serverTime: (finished.closedAt ?? new Date()).toISOString(),
      };
    });
    for (const notification of notifications)
      this.notificationIntegration.publishCommitted(notification);
    if (completion) this.completionPublisher.publishCommitted(completion);
  }

  private async recoverClosureNotifications(): Promise<void> {
    let cursor: Types.ObjectId | null = null;
    for (let page = 0; page < 10; page += 1) {
      const filter: Record<string, unknown> = {
        status: AuctionStatus.Finished,
        closureNotificationsPending: true,
      };
      if (cursor) filter._id = { $gt: cursor };
      const auction = await this.auctions.findOne(filter).sort({ _id: 1 });
      if (!auction) {
        break;
      }
      cursor = auction._id;
      try {
        await this.persistParticipantNotificationPage(auction._id);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Auction participant notifications remain pending for ${auction._id.toString()}: ${detail}`,
        );
      }
    }
  }

  private async persistParticipantNotificationPage(
    auctionId: Types.ObjectId,
  ): Promise<void> {
    const notifications: NotificationDocument[] = [];
    await this.withTransaction(async (session) => {
      notifications.length = 0;
      const auction = await this.auctions
        .findOne({
          _id: auctionId,
          status: AuctionStatus.Finished,
          closureNotificationsPending: true,
        })
        .session(session);
      if (!auction) return;
      const filter: Record<string, unknown> = { auctionId };
      if (auction.closureNotificationCursor)
        filter._id = { $gt: auction.closureNotificationCursor };
      const bids = await this.bids
        .find(filter)
        .sort({ _id: 1 })
        .limit(100)
        .session(session);
      for (const bid of bids) {
        const winner = auction.currentBidderId?.equals(bid.buyerId) ?? false;
        notifications.push(
          await this.notificationIntegration.persist(
            {
              recipientId: bid.buyerId.toString(),
              eventType: winner
                ? NotificationEventType.AuctionWon
                : NotificationEventType.AuctionLost,
              title: winner ? 'Auction won' : 'Auction result',
              message: winner
                ? 'Your payment succeeded and your collection order is confirmed.'
                : 'Another buyer won this auction.',
              resource: {
                type: NotificationResourceType.Auction,
                id: auction._id.toString(),
              },
              sourceEventKey: `auction:${auction._id.toString()}:result:${bid.buyerId.toString()}`,
            },
            session,
          ),
        );
      }
      const last = bids.at(-1);
      const hasMore = bids.length === 100;
      const updated = await this.auctions.updateOne(
        {
          _id: auction._id,
          status: AuctionStatus.Finished,
          closureNotificationsPending: true,
          closureNotificationCursor: auction.closureNotificationCursor,
        },
        {
          $set: {
            closureNotificationCursor:
              last?._id ?? auction.closureNotificationCursor,
            closureNotificationsPending: hasMore,
          },
        },
        { session },
      );
      if (updated.modifiedCount !== 1)
        throw new ConflictException('Auction notification cursor changed.');
    });
    for (const notification of notifications)
      this.notificationIntegration.publishCommitted(notification);
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
