import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';
import { Auction, AuctionBid } from '../auctions/auction.schema.js';
import type {
  AuctionBidDocument,
  AuctionDocument,
} from '../auctions/auction.schema.js';
import { Payment } from '../checkout/payment.schema.js';
import type { PaymentDocument } from '../checkout/payment.schema.js';
import { Order } from '../orders/order.schema.js';
import type { OrderDocument } from '../orders/order.schema.js';
import { RefundAllocation } from '../orders/refund-allocation.schema.js';
import type { RefundAllocationDocument } from '../orders/refund-allocation.schema.js';
import { RedisService } from '../redis/redis.service.js';
import { StorageService } from '../storage/storage.service.js';
import { User } from '../users/user.schema.js';
import type { UserDocument } from '../users/user.schema.js';
import {
  AdminAuctionDetailDto,
  AdminAuctionsPageDto,
  AdminAuctionsQueryDto,
  AdminOrderDetailDto,
  AdminOrdersPageDto,
  AdminOrdersQueryDto,
  AdminServiceHealthDto,
  AdminUserDetailDto,
  AdminUsersPageDto,
  AdminUsersQueryDto,
} from './admin-inspection.dto.js';

const HEALTH_TIMEOUT_MS = 2500;

type AdminHealthCheck = () => Promise<unknown>;

async function runHealthCheck(operation: AdminHealthCheck) {
  const startedAt = Date.now();
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Dependency check timed out')),
          HEALTH_TIMEOUT_MS,
        );
      }),
    ]);
    return {
      status: 'up' as const,
      latencyMs: Math.min(HEALTH_TIMEOUT_MS, Date.now() - startedAt),
    };
  } catch {
    return {
      status: 'down' as const,
      latencyMs: Math.min(HEALTH_TIMEOUT_MS, Date.now() - startedAt),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function collectAdminServiceHealth(checks: {
  mongodb: AdminHealthCheck;
  redis: AdminHealthCheck;
  storage: AdminHealthCheck;
}) {
  const [mongodb, redis, storage] = await Promise.all([
    runHealthCheck(checks.mongodb),
    runHealthCheck(checks.redis),
    runHealthCheck(checks.storage),
  ]);
  const isHealthy =
    mongodb.status === 'up' && redis.status === 'up' && storage.status === 'up';
  return {
    status: isHealthy ? ('ok' as const) : ('degraded' as const),
    api: 'up' as const,
    mongodb: mongodb.status,
    redis: redis.status,
    storage: storage.status,
    mongodbLatencyMs: mongodb.latencyMs,
    redisLatencyMs: redis.latencyMs,
    storageLatencyMs: storage.latencyMs,
  };
}

function pageResult<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

function id(value: { toString(): string } | null | undefined): string | null {
  return value?.toString() ?? null;
}

function iso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

@Injectable()
export class AdminInspectionService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(Auction.name)
    private readonly auctions: Model<AuctionDocument>,
    @InjectModel(AuctionBid.name)
    private readonly bids: Model<AuctionBidDocument>,
    @InjectModel(Payment.name)
    private readonly payments: Model<PaymentDocument>,
    @InjectModel(RefundAllocation.name)
    private readonly refundAllocations: Model<RefundAllocationDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  async listUsers(query: AdminUsersQueryDto): Promise<AdminUsersPageDto> {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.producerStatus) filter.producerStatus = query.producerStatus;
    const skip = (query.page - 1) * query.limit;
    const [documents, total] = await Promise.all([
      this.users
        .find(filter)
        .select(
          'name email role producerStatus producerApplication.farmName producerApplication.city createdAt',
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.users.countDocuments(filter).exec(),
    ]);
    return pageResult(
      documents.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        producerStatus: user.producerStatus,
        farmName: user.producerApplication?.farmName ?? null,
        city: user.producerApplication?.city ?? null,
        createdAt: iso(user.createdAt),
      })),
      total,
      query.page,
      query.limit,
    );
  }

  async getUser(userId: string): Promise<AdminUserDetailDto> {
    const user = await this.users
      .findById(userId)
      .select(
        'name email role producerStatus producerApplication.farmName producerApplication.description producerApplication.city producerApplication.submittedAt producerRejectionReason producerSuspensionReason producerDecisionRevision producerDecisionBy producerDecisionAt createdAt updatedAt',
      )
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found.');
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      producerStatus: user.producerStatus,
      farmName: user.producerApplication?.farmName ?? null,
      city: user.producerApplication?.city ?? null,
      producerApplication: user.producerApplication
        ? {
            farmName: user.producerApplication.farmName,
            description: user.producerApplication.description,
            city: user.producerApplication.city,
            submittedAt: iso(user.producerApplication.submittedAt),
          }
        : null,
      producerRejectionReason: user.producerRejectionReason,
      producerSuspensionReason: user.producerSuspensionReason,
      producerDecisionRevision: user.producerDecisionRevision ?? 0,
      producerDecisionBy: id(user.producerDecisionBy),
      producerDecisionAt: iso(user.producerDecisionAt),
      createdAt: iso(user.createdAt),
      updatedAt: iso(user.updatedAt),
    };
  }

  async listOrders(query: AdminOrdersQueryDto): Promise<AdminOrdersPageDto> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.origin) filter.origin = query.origin;
    if (query.fulfilmentMethod)
      filter.fulfilmentMethod = query.fulfilmentMethod;
    if (query.buyerId) filter.buyerId = query.buyerId;
    if (query.producerId) filter.producerId = query.producerId;
    const skip = (query.page - 1) * query.limit;
    const [documents, total] = await Promise.all([
      this.orders
        .find(filter)
        .select(
          'checkoutId auctionId buyerId producerId paymentId status origin fulfilmentMethod totalCents createdAt',
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.orders.countDocuments(filter).exec(),
    ]);
    const allocations = await this.refundAllocations
      .find({ orderId: { $in: documents.map((order) => order._id) } })
      .select('orderId amountCents')
      .lean()
      .exec();
    const refundedByOrder = new Map(
      allocations.map((allocation) => [
        allocation.orderId.toString(),
        allocation.amountCents,
      ]),
    );
    return pageResult(
      documents.map((order) => ({
        id: order._id.toString(),
        checkoutId: id(order.checkoutId),
        auctionId: id(order.auctionId),
        buyerId: order.buyerId.toString(),
        producerId: order.producerId.toString(),
        paymentId: order.paymentId.toString(),
        status: order.status,
        origin: order.origin,
        fulfilmentMethod: order.fulfilmentMethod,
        totalCents: order.totalCents,
        refundedCents: refundedByOrder.get(order._id.toString()) ?? 0,
        createdAt: iso(order.createdAt),
      })),
      total,
      query.page,
      query.limit,
    );
  }

  async getOrder(orderId: string): Promise<AdminOrderDetailDto> {
    const order = await this.orders
      .findById(orderId)
      .select(
        'checkoutId auctionId buyerId producerId paymentId items fulfilmentMethod status statusHistory origin subtotalCents deliveryFeeCents totalCents refundRequest revision createdAt updatedAt',
      )
      .lean()
      .exec();
    if (!order) throw new NotFoundException('Order not found.');
    const [buyers, payment, allocation] = await Promise.all([
      this.users
        .find({ _id: { $in: [order.buyerId, order.producerId] } })
        .select('name email role producerApplication.farmName')
        .lean()
        .exec(),
      this.payments
        .findById(order.paymentId)
        .select('status amountCents refundedCents checkoutId auctionId')
        .lean()
        .exec(),
      this.refundAllocations
        .findOne({ orderId: order._id })
        .select('amountCents refundedAt paymentId')
        .lean()
        .exec(),
    ]);
    const buyer = buyers.find((item) => item._id.equals(order.buyerId));
    const producer = buyers.find((item) => item._id.equals(order.producerId));
    return {
      id: order._id.toString(),
      checkoutId: id(order.checkoutId),
      auctionId: id(order.auctionId),
      buyerId: order.buyerId.toString(),
      producerId: order.producerId.toString(),
      paymentId: order.paymentId.toString(),
      buyer: buyer
        ? {
            id: buyer._id.toString(),
            name: buyer.name,
            email: buyer.email,
            role: buyer.role,
          }
        : { id: order.buyerId.toString(), name: null, email: null, role: null },
      producer: producer
        ? {
            id: producer._id.toString(),
            name: producer.producerApplication?.farmName ?? producer.name,
            email: producer.email,
            role: producer.role,
          }
        : {
            id: order.producerId.toString(),
            name: null,
            email: null,
            role: null,
          },
      payment: payment
        ? {
            id: payment._id.toString(),
            status: payment.status,
            amountCents: payment.amountCents,
            checkoutId: id(payment.checkoutId),
            auctionId: id(payment.auctionId),
          }
        : null,
      items: order.items.map((item) => ({
        productId: item.productId.toString(),
        productName: item.productName,
        productUnit: item.productUnit,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.lineTotalCents,
      })),
      fulfilmentMethod: order.fulfilmentMethod,
      status: order.status,
      statusHistory: order.statusHistory.map((entry) => ({
        status: entry.status,
        timestamp: iso(entry.timestamp),
        actorId: entry.actorId.toString(),
        actorRole: entry.actorRole,
        note: entry.note,
      })),
      origin: order.origin,
      subtotalCents: order.subtotalCents,
      deliveryFeeCents: order.deliveryFeeCents,
      totalCents: order.totalCents,
      refundedCents: allocation?.amountCents ?? 0,
      refundAllocation: allocation
        ? {
            paymentId: allocation.paymentId.toString(),
            refundedAt: iso(allocation.refundedAt),
          }
        : null,
      refundRequest: order.refundRequest
        ? {
            status: order.refundRequest.status,
            requestedBy: order.refundRequest.requestedBy.toString(),
            requestedAt: iso(order.refundRequest.requestedAt),
            reason: order.refundRequest.reason,
            decidedBy: id(order.refundRequest.decidedBy),
            decidedAt: iso(order.refundRequest.decidedAt),
            refundedCents: order.refundRequest.refundedCents,
          }
        : null,
      revision: order.revision,
      createdAt: iso(order.createdAt),
      updatedAt: iso(order.updatedAt),
    };
  }

  async listAuctions(
    query: AdminAuctionsQueryDto,
  ): Promise<AdminAuctionsPageDto> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.producerId) filter.producerId = query.producerId;
    const skip = (query.page - 1) * query.limit;
    const [documents, total] = await Promise.all([
      this.auctions
        .find(filter)
        .select(
          'producerId productId productSnapshot status startsAt endsAt quantity currentBidCents createdAt',
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.auctions.countDocuments(filter).exec(),
    ]);
    return pageResult(
      documents.map((auction) => ({
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
        status: auction.status,
        startsAt: auction.startsAt.toISOString(),
        endsAt: auction.endsAt.toISOString(),
        quantity: auction.quantity,
        currentBidCents: auction.currentBidCents,
        createdAt: iso(auction.createdAt),
      })),
      total,
      query.page,
      query.limit,
    );
  }

  async getAuction(
    auctionId: string,
    page: number,
    limit: number,
  ): Promise<AdminAuctionDetailDto> {
    const auction = await this.auctions
      .findById(auctionId)
      .select(
        'producerId productId productSnapshot quantity startingPriceCents minimumIncrementCents startsAt endsAt status currentBidCents currentBidderId currentBidderName lastBidAt revision createdAt updatedAt',
      )
      .lean()
      .exec();
    if (!auction) throw new NotFoundException('Auction not found.');
    const [producer, bids, bidTotal, order, payment] = await Promise.all([
      this.users
        .findById(auction.producerId)
        .select('name email role producerStatus producerApplication.farmName')
        .lean()
        .exec(),
      this.bids
        .find({ auctionId: auction._id })
        .select('buyerId bidderName amountCents acceptedAt endsAt revision')
        .sort({ acceptedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.bids.countDocuments({ auctionId: auction._id }).exec(),
      this.orders
        .findOne({ auctionId: auction._id })
        .select('status totalCents paymentId buyerId producerId createdAt')
        .lean()
        .exec(),
      this.payments
        .findOne({ auctionId: auction._id })
        .select('status amountCents refundedCents buyerId createdAt')
        .lean()
        .exec(),
    ]);
    return {
      id: auction._id.toString(),
      producerId: auction.producerId.toString(),
      producer: producer
        ? {
            id: producer._id.toString(),
            name: producer.producerApplication?.farmName ?? producer.name,
            email: producer.email,
            role: producer.role,
            status: producer.producerStatus,
          }
        : {
            id: auction.producerId.toString(),
            name: null,
            email: null,
            role: null,
            status: null,
          },
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
      status: auction.status,
      currentBidCents: auction.currentBidCents,
      currentBidderId: id(auction.currentBidderId),
      currentBidderName: auction.currentBidderName,
      lastBidAt: iso(auction.lastBidAt),
      revision: auction.revision,
      createdAt: iso(auction.createdAt),
      updatedAt: iso(auction.updatedAt),
      bidHistory: pageResult(
        bids.map((bid) => ({
          id: bid._id.toString(),
          buyerId: bid.buyerId.toString(),
          bidderName: bid.bidderName,
          amountCents: bid.amountCents,
          acceptedAt: bid.acceptedAt.toISOString(),
          endsAt: bid.endsAt.toISOString(),
          revision: bid.revision,
        })),
        bidTotal,
        page,
        limit,
      ),
      settlement: {
        order: order
          ? {
              id: order._id.toString(),
              status: order.status,
              totalCents: order.totalCents,
              paymentId: order.paymentId.toString(),
              buyerId: order.buyerId.toString(),
              producerId: order.producerId.toString(),
              createdAt: iso(order.createdAt),
            }
          : null,
        payment: payment
          ? {
              id: payment._id.toString(),
              status: payment.status,
              amountCents: payment.amountCents,
              refundedCents: payment.refundedCents,
              buyerId: payment.buyerId.toString(),
              createdAt: iso(payment.createdAt),
            }
          : null,
      },
    };
  }

  async serviceHealth(): Promise<AdminServiceHealthDto> {
    return collectAdminServiceHealth({
      mongodb: () => {
        if (!this.connection.db) throw new Error('Database unavailable');
        return this.connection.db
          .admin()
          .ping({ timeoutMS: HEALTH_TIMEOUT_MS });
      },
      redis: () => this.redis.ping(),
      storage: () => this.storage.ping(),
    });
  }
}
