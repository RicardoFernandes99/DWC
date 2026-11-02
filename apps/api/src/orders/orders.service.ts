import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Connection, Model } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import {
  Payment,
  PaymentStatus,
  type PaymentDocument,
} from '../checkout/payment.schema.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { User, type UserDocument, UserRole } from '../users/user.schema.js';
import {
  ListOrdersQueryDto,
  OrderListResponseDto,
  OrderPaymentSummaryDto,
  OrderResponseDto,
  UpdateOrderStatusDto,
  RefundReasonDto,
} from './order.dto.js';
import {
  FulfilmentMethod,
  Order,
  type OrderDocument,
  OrderStatus,
  OrderStatusHistoryEntry,
  OrderOrigin,
  RefundRequestStatus,
} from './order.schema.js';
import { Product } from '../products/product.schema.js';
import { RefundAllocation } from './refund-allocation.schema.js';

const NEXT_ORDER_STATUS: Record<
  FulfilmentMethod,
  Partial<Record<OrderStatus, OrderStatus>>
> = {
  [FulfilmentMethod.Delivery]: {
    [OrderStatus.Pending]: OrderStatus.Confirmed,
    [OrderStatus.Confirmed]: OrderStatus.Shipped,
    [OrderStatus.Shipped]: OrderStatus.Delivered,
  },
  [FulfilmentMethod.Collection]: {
    [OrderStatus.Pending]: OrderStatus.Confirmed,
    [OrderStatus.Confirmed]: OrderStatus.ReadyForCollection,
    [OrderStatus.ReadyForCollection]: OrderStatus.Collected,
  },
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<Product>,
    @InjectModel(RefundAllocation.name)
    private readonly refundAllocationModel: Model<RefundAllocation>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * Confirmation predicate for ticket 020 to block confirmation when a refund request is open.
   */
  async canConfirmOrder(order: OrderDocument): Promise<boolean> {
    return order.refundRequest?.status !== RefundRequestStatus.Open;
  }

  async requestRefund(
    user: UserResponseDto,
    orderId: string,
    input: RefundReasonDto,
  ): Promise<OrderResponseDto> {
    if (user.role !== UserRole.Buyer)
      throw new ForbiddenException('Only buyers may request refunds.');
    if (!input.reason.trim())
      throw new BadRequestException('Refund reason cannot be blank.');
    const order = await this.findOwnedOrder(orderId, user.id, UserRole.Buyer);
    if (
      order.status !== OrderStatus.Pending ||
      order.origin !== OrderOrigin.Catalogue
    )
      throw this.refundConflict();
    if (order.refundRequest?.status === RefundRequestStatus.Open)
      return this.orderResponse(order);
    const refundRequest = {
      status: RefundRequestStatus.Open,
      requestedBy: new Types.ObjectId(user.id),
      requestedAt: new Date(),
      reason: input.reason.trim(),
      decidedBy: null,
      decidedAt: null,
      refundedCents: null,
    };
    const updated = await this.orderModel
      .findOneAndUpdate(
        {
          _id: order._id,
          buyerId: order.buyerId,
          status: OrderStatus.Pending,
          origin: OrderOrigin.Catalogue,
          'refundRequest.status': { $ne: RefundRequestStatus.Open },
        },
        { $set: { refundRequest }, $inc: { revision: 1 } },
        { new: true },
      )
      .exec();
    if (!updated) throw this.refundConflict();
    return this.orderResponse(updated);
  }

  async decideRefund(
    user: UserResponseDto,
    orderId: string,
    accept: boolean,
    input?: RefundReasonDto,
  ): Promise<OrderResponseDto> {
    if (user.role !== UserRole.Producer)
      throw new ForbiddenException(
        'Only producers may decide refund requests.',
      );
    if (!accept && !input?.reason.trim())
      throw new BadRequestException('Decline reason cannot be blank.');
    const order = await this.findOwnedOrder(
      orderId,
      user.id,
      UserRole.Producer,
    );
    if (
      order.status === OrderStatus.Cancelled &&
      order.refundRequest?.status === RefundRequestStatus.Accepted
    )
      return this.orderResponse(order);
    if (
      order.status !== OrderStatus.Pending ||
      order.origin !== OrderOrigin.Catalogue ||
      order.refundRequest?.status !== RefundRequestStatus.Open
    )
      throw this.refundConflict();
    if (!accept) {
      const updated = await this.orderModel
        .findOneAndUpdate(
          {
            _id: order._id,
            producerId: order.producerId,
            status: OrderStatus.Pending,
            origin: OrderOrigin.Catalogue,
            'refundRequest.status': RefundRequestStatus.Open,
          },
          {
            $set: {
              'refundRequest.status': RefundRequestStatus.Declined,
              'refundRequest.decidedBy': new Types.ObjectId(user.id),
              'refundRequest.decidedAt': new Date(),
              'refundRequest.reason': input?.reason.trim(),
            },
            $inc: { revision: 1 },
          },
          { new: true },
        )
        .exec();
      if (!updated) throw this.refundConflict();
      return this.orderResponse(updated);
    }
    return this.cancelAndRefund(order, user.id);
  }

  async cancelAndRefundOrder(
    user: UserResponseDto,
    orderId: string,
  ): Promise<OrderResponseDto> {
    if (user.role !== UserRole.Producer)
      throw new ForbiddenException('Only producers may cancel orders.');
    const order = await this.findOwnedOrder(
      orderId,
      user.id,
      UserRole.Producer,
    );
    if (
      order.status === OrderStatus.Cancelled &&
      order.refundRequest?.status === RefundRequestStatus.Accepted
    )
      return this.orderResponse(order);
    if (
      order.status !== OrderStatus.Pending ||
      order.origin !== OrderOrigin.Catalogue
    )
      throw this.refundConflict();
    return this.cancelAndRefund(order, user.id);
  }

  private async cancelAndRefund(
    order: OrderDocument,
    actorId: string,
  ): Promise<OrderResponseDto> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const updated = await this.orderModel
          .findOneAndUpdate(
            {
              _id: order._id,
              status: OrderStatus.Pending,
              origin: OrderOrigin.Catalogue,
              'refundRequest.status':
                order.refundRequest?.status === RefundRequestStatus.Open
                  ? RefundRequestStatus.Open
                  : { $ne: RefundRequestStatus.Open },
            },
            {
              $set: {
                status: OrderStatus.Cancelled,
                refundRequest: {
                  status: RefundRequestStatus.Accepted,
                  requestedBy:
                    order.refundRequest?.requestedBy ??
                    new Types.ObjectId(actorId),
                  requestedAt: order.refundRequest?.requestedAt ?? now,
                  reason: order.refundRequest?.reason ?? null,
                  decidedBy: new Types.ObjectId(actorId),
                  decidedAt: now,
                  refundedCents: order.totalCents,
                },
              },
              $inc: { revision: 1 },
              $push: {
                statusHistory: {
                  status: OrderStatus.Cancelled,
                  timestamp: now,
                  actorId: new Types.ObjectId(actorId),
                  actorRole: UserRole.Producer,
                  note: 'Order cancelled and refunded',
                },
              },
            },
            { new: true, session },
          )
          .exec();
        if (!updated) throw this.refundConflict();
        for (const item of order.items) {
          const restored = await this.productModel
            .updateOne(
              { _id: item.productId, producerId: order.producerId },
              { $inc: { availableStock: item.quantity } },
              { session },
            )
            .exec();
          if (restored.matchedCount !== 1)
            throw new ConflictException(
              'A product in this order no longer exists.',
            );
        }
        const currentPayment = await this.paymentModel
          .findById(order.paymentId)
          .session(session)
          .exec();
        const currentRefundedCents = currentPayment?.refundedCents ?? 0;
        if (
          !currentPayment ||
          currentPayment.status !== PaymentStatus.Succeeded ||
          currentRefundedCents + order.totalCents > currentPayment.amountCents
        ) {
          throw new ConflictException(
            'Payment cannot allocate this order refund.',
          );
        }
        const paymentUpdate = await this.paymentModel.updateOne(
          {
            _id: order.paymentId,
            status: PaymentStatus.Succeeded,
            $or: [
              { refundedCents: currentRefundedCents },
              { refundedCents: { $exists: false } },
            ],
          },
          { $inc: { refundedCents: order.totalCents } },
          { session },
        );
        if (paymentUpdate.matchedCount !== 1)
          throw new ConflictException(
            'Payment cannot allocate this order refund.',
          );
        await new this.refundAllocationModel({
          orderId: order._id,
          paymentId: order.paymentId,
          buyerId: order.buyerId,
          amountCents: order.totalCents,
          refundedAt: now,
        }).save({ session });
      });
    } finally {
      await session.endSession();
    }
    const refreshed = await this.orderModel.findById(order._id).exec();
    if (!refreshed) throw new NotFoundException('Order not found.');
    return this.orderResponse(refreshed);
  }

  private async findOwnedOrder(
    orderId: string,
    userId: string,
    role: UserRole,
  ): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId))
      throw new NotFoundException('Order not found.');
    const filter =
      role === UserRole.Buyer
        ? { _id: orderId, buyerId: userId }
        : { _id: orderId, producerId: userId };
    const order = await this.orderModel.findOne(filter).exec();
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  private refundConflict(): ConflictException {
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      code: 'refund_unavailable',
      message: 'Refund action is unavailable for this order state.',
    });
  }

  private async orderResponse(order: OrderDocument): Promise<OrderResponseDto> {
    const [dto] = await this.mapOrdersToResponse([order]);
    return dto;
  }

  async listOrders(
    user: UserResponseDto,
    query: ListOrdersQueryDto,
  ): Promise<OrderListResponseDto> {
    const filter: Record<string, unknown> = {};

    if (user.role === UserRole.Buyer) {
      filter.buyerId = new Types.ObjectId(user.id);
    } else if (user.role === UserRole.Producer) {
      filter.producerId = new Types.ObjectId(user.id);
    } else {
      throw new ForbiddenException(
        'Only buyers and producers can access orders.',
      );
    }

    if (query.status) {
      filter.status = query.status;
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    const items = await this.mapOrdersToResponse(orders);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getOrderById(
    user: UserResponseDto,
    orderId: string,
  ): Promise<OrderResponseDto> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found.');
    }

    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (user.role === UserRole.Buyer) {
      if (order.buyerId.toString() !== user.id) {
        throw new NotFoundException('Order not found.');
      }
    } else if (user.role === UserRole.Producer) {
      if (order.producerId.toString() !== user.id) {
        throw new NotFoundException('Order not found.');
      }
    } else {
      throw new ForbiddenException(
        'Only buyers and producers can access orders.',
      );
    }

    const [dto] = await this.mapOrdersToResponse([order]);
    return dto;
  }

  async advanceOrderStatus(
    user: UserResponseDto,
    orderId: string,
    input: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    if (user.role !== UserRole.Producer) {
      throw new ForbiddenException(
        'Only producers may advance order fulfilment.',
      );
    }

    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found.');
    }

    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.producerId.toString() !== user.id) {
      throw new NotFoundException('Order not found.');
    }

    const targetStatus = input.status;
    const currentStatus = order.status;

    // Idempotent retry: order is already in target state
    if (currentStatus === targetStatus) {
      const [existingDto] = await this.mapOrdersToResponse([order]);
      return existingDto;
    }

    // Optimistic concurrency check
    if (
      input.expectedRevision !== undefined &&
      order.revision !== input.expectedRevision
    ) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'revision_conflict',
        message: `Order revision mismatch: expected ${input.expectedRevision}, but current revision is ${order.revision}.`,
      });
    }

    // Determine expected next step in state machine
    const expectedNextStatus =
      NEXT_ORDER_STATUS[order.fulfilmentMethod]?.[currentStatus];

    if (!expectedNextStatus || targetStatus !== expectedNextStatus) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'invalid_status_transition',
        message: `Cannot transition order from '${currentStatus}' to '${targetStatus}' for '${order.fulfilmentMethod}' fulfilment. Expected '${expectedNextStatus ?? 'none'}'.`,
      });
    }

    // Check confirmation predicate (ticket 020 open refund request guard)
    if (
      currentStatus === OrderStatus.Pending &&
      targetStatus === OrderStatus.Confirmed
    ) {
      const canConfirm = await this.canConfirmOrder(order);
      if (!canConfirm) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          code: 'confirmation_blocked_by_refund',
          message:
            'Order confirmation is blocked while a refund request is open.',
        });
      }
    }

    const statusHistoryEntry: OrderStatusHistoryEntry = {
      status: targetStatus,
      timestamp: new Date(),
      actorId: new Types.ObjectId(user.id),
      actorRole: UserRole.Producer,
      note: input.note?.trim() || null,
    };

    const filter: Record<string, unknown> = {
      _id: order._id,
      producerId: new Types.ObjectId(user.id),
      status: currentStatus,
    };

    if (input.expectedRevision !== undefined) {
      filter.revision = input.expectedRevision;
    }
    if (
      currentStatus === OrderStatus.Pending &&
      targetStatus === OrderStatus.Confirmed
    ) {
      filter.$or = [
        { refundRequest: null },
        { 'refundRequest.status': { $ne: RefundRequestStatus.Open } },
      ];
    }

    const updatedOrder = await this.orderModel
      .findOneAndUpdate(
        filter,
        {
          $set: { status: targetStatus },
          $inc: { revision: 1 },
          $push: { statusHistory: statusHistoryEntry },
        },
        { new: true },
      )
      .exec();

    if (!updatedOrder) {
      // Re-read to detect concurrent race or idempotent duplicate
      const freshOrder = await this.orderModel
        .findOne({
          _id: order._id,
          producerId: new Types.ObjectId(user.id),
        })
        .exec();

      if (!freshOrder) {
        throw new NotFoundException('Order not found.');
      }

      if (freshOrder.status === targetStatus) {
        const [idempotentDto] = await this.mapOrdersToResponse([freshOrder]);
        return idempotentDto;
      }

      if (
        targetStatus === OrderStatus.Confirmed &&
        freshOrder.refundRequest?.status === RefundRequestStatus.Open
      ) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          code: 'confirmation_blocked_by_refund',
          message:
            'Order confirmation is blocked while a refund request is open.',
        });
      }

      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'invalid_status_transition',
        message: `Order was concurrently modified to status '${freshOrder.status}'.`,
      });
    }

    const [updatedDto] = await this.mapOrdersToResponse([updatedOrder]);
    return updatedDto;
  }

  private async mapOrdersToResponse(
    orders: OrderDocument[],
  ): Promise<OrderResponseDto[]> {
    if (orders.length === 0) {
      return [];
    }

    const userIds = new Set<string>();
    const paymentIds = new Set<string>();

    for (const order of orders) {
      userIds.add(order.buyerId.toString());
      userIds.add(order.producerId.toString());
      if (order.paymentId) {
        paymentIds.add(order.paymentId.toString());
      }
    }

    const [users, payments] = await Promise.all([
      this.userModel
        .find(
          {
            _id: {
              $in: Array.from(userIds).map((id) => new Types.ObjectId(id)),
            },
          },
          { name: 1, producerApplication: 1 },
        )
        .exec(),
      this.paymentModel
        .find({
          _id: {
            $in: Array.from(paymentIds).map((id) => new Types.ObjectId(id)),
          },
        })
        .exec(),
    ]);

    const nameMap = new Map<string, string>();
    for (const user of users) {
      nameMap.set(
        user._id.toString(),
        user.producerApplication?.farmName || user.name,
      );
    }

    const paymentMap = new Map<string, PaymentDocument>();
    for (const payment of payments) {
      paymentMap.set(payment._id.toString(), payment);
    }

    return orders.map((order) => {
      const paymentDoc = order.paymentId
        ? paymentMap.get(order.paymentId.toString())
        : undefined;

      const paymentSummary: OrderPaymentSummaryDto | null = paymentDoc
        ? {
            paymentId: paymentDoc._id.toString(),
            status: paymentDoc.status,
            cardLast4: paymentDoc.paymentMethodSnapshot.last4,
            cardExpiryMonth: paymentDoc.paymentMethodSnapshot.expiryMonth,
            cardExpiryYear: paymentDoc.paymentMethodSnapshot.expiryYear,
            amountCents: paymentDoc.amountCents,
          }
        : null;

      return {
        id: order._id.toString(),
        checkoutId: order.checkoutId.toString(),
        buyerId: order.buyerId.toString(),
        buyerName: nameMap.get(order.buyerId.toString()) ?? null,
        producerId: order.producerId.toString(),
        producerName: nameMap.get(order.producerId.toString()) ?? null,
        items: order.items.map((item) => ({
          productId: item.productId.toString(),
          productName: item.productName,
          productUnit: item.productUnit,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.lineTotalCents,
        })),
        fulfilmentMethod: order.fulfilmentMethod,
        deliveryAddress: order.deliveryAddress
          ? {
              recipientName: order.deliveryAddress.recipientName,
              street: order.deliveryAddress.street,
              postalCode: order.deliveryAddress.postalCode,
              city: order.deliveryAddress.city,
              country: order.deliveryAddress.country ?? 'Portugal',
              notes: order.deliveryAddress.notes ?? null,
            }
          : null,
        subtotalCents: order.subtotalCents,
        deliveryFeeCents: order.deliveryFeeCents,
        totalCents: order.totalCents,
        status: order.status,
        statusHistory: order.statusHistory.map((h) => ({
          status: h.status,
          timestamp: h.timestamp.toISOString(),
          actorId: h.actorId.toString(),
          actorRole: h.actorRole,
          note: h.note ?? null,
        })),
        origin: order.origin,
        revision: order.revision,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        payment: paymentSummary,
        refundRequest: order.refundRequest
          ? {
              status: order.refundRequest.status,
              requestedAt: order.refundRequest.requestedAt.toISOString(),
              reason: order.refundRequest.reason,
              decidedAt: order.refundRequest.decidedAt?.toISOString() ?? null,
              refundedCents: order.refundRequest.refundedCents,
            }
          : null,
      };
    });
  }
}
