import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, type PaymentDocument } from '../checkout/payment.schema.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { User, type UserDocument, UserRole } from '../users/user.schema.js';
import {
  ListOrdersQueryDto,
  OrderListResponseDto,
  OrderPaymentSummaryDto,
  OrderResponseDto,
  UpdateOrderStatusDto,
} from './order.dto.js';
import {
  FulfilmentMethod,
  Order,
  type OrderDocument,
  OrderStatus,
  OrderStatusHistoryEntry,
} from './order.schema.js';

interface UserSnapshot {
  name: string;
  producerApplication?: {
    farmName: string;
  } | null;
}

const DELIVERY_TRANSITIONS: Readonly<Record<OrderStatus, OrderStatus | null>> =
  {
    [OrderStatus.Pending]: OrderStatus.Confirmed,
    [OrderStatus.Confirmed]: OrderStatus.Shipped,
    [OrderStatus.Shipped]: OrderStatus.Delivered,
    [OrderStatus.Delivered]: null,
    [OrderStatus.ReadyForCollection]: null,
    [OrderStatus.Collected]: null,
    [OrderStatus.Cancelled]: null,
  };

const COLLECTION_TRANSITIONS: Readonly<
  Record<OrderStatus, OrderStatus | null>
> = {
  [OrderStatus.Pending]: OrderStatus.Confirmed,
  [OrderStatus.Confirmed]: OrderStatus.ReadyForCollection,
  [OrderStatus.ReadyForCollection]: OrderStatus.Collected,
  [OrderStatus.Collected]: null,
  [OrderStatus.Shipped]: null,
  [OrderStatus.Delivered]: null,
  [OrderStatus.Cancelled]: null,
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Confirmation predicate for ticket 020 to block confirmation when a refund request is open.
   */
  async canConfirmOrder(order: OrderDocument): Promise<boolean> {
    void order;
    return true;
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
    const transitions =
      order.fulfilmentMethod === FulfilmentMethod.Delivery
        ? DELIVERY_TRANSITIONS
        : COLLECTION_TRANSITIONS;

    const expectedNextStatus = transitions[currentStatus];

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

    const userMap = new Map<string, UserSnapshot>();
    for (const user of users) {
      userMap.set(user._id.toString(), {
        name: user.name,
        producerApplication: user.producerApplication
          ? { farmName: user.producerApplication.farmName }
          : null,
      });
    }

    const paymentMap = new Map<string, PaymentDocument>();
    for (const payment of payments) {
      paymentMap.set(payment._id.toString(), payment);
    }

    return orders.map((order) => {
      const buyer = userMap.get(order.buyerId.toString());
      const producer = userMap.get(order.producerId.toString());
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
        buyerName: buyer?.name ?? null,
        producerId: order.producerId.toString(),
        producerName:
          producer?.producerApplication?.farmName ?? producer?.name ?? null,
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
      };
    });
  }
}
