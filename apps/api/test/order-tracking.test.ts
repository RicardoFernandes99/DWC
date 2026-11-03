import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Model, Mongoose, Types } from 'mongoose';
import { OrdersService } from '../dist/orders/orders.service.js';
import {
  FulfilmentMethod,
  type OrderDocument,
  OrderOrigin,
  OrderStatus,
  OrderStatusHistoryEntry,
} from '../dist/orders/order.schema.js';
import {
  type PaymentDocument,
  PaymentStatus,
} from '../dist/checkout/payment.schema.js';
import {
  type UserDocument,
  ProducerStatus,
  UserRole,
} from '../dist/users/user.schema.js';
import { UserResponseDto } from '../dist/users/user-response.dto.js';
import {
  Product,
  ProductSchema,
  ProductUnit,
} from '../dist/products/product.schema.js';
import {
  RefundAllocation,
  RefundAllocationSchema,
} from '../dist/orders/refund-allocation.schema.js';
import {
  Notification,
  NotificationSchema,
} from '../dist/notifications/notification.schema.js';
import { NotificationsService } from '../dist/notifications/notifications.service.js';
import { NotificationIntegrationService } from '../dist/notifications/notification-integration.service.js';

interface TestOrderData {
  _id: Types.ObjectId;
  checkoutId: Types.ObjectId;
  buyerId: Types.ObjectId;
  producerId: Types.ObjectId;
  paymentId: Types.ObjectId;
  items: Array<{
    productId: Types.ObjectId;
    productName: string;
    productUnit: ProductUnit;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
  fulfilmentMethod: FulfilmentMethod;
  deliveryAddress: {
    recipientName: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
    notes?: string | null;
  } | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntry[];
  origin: OrderOrigin;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

function createMockEnvironment(initialOrders: TestOrderData[]) {
  const orders = initialOrders.map((o) => ({
    ...o,
    statusHistory: [...o.statusHistory],
  }));

  const orderModel = {
    find: (filter: Record<string, unknown>) => ({
      sort: () => ({
        skip: (skip: number) => ({
          limit: (limit: number) => ({
            exec: async () => {
              return orders
                .filter((o) => {
                  if (
                    filter.buyerId &&
                    o.buyerId.toString() !== filter.buyerId.toString()
                  )
                    return false;
                  if (
                    filter.producerId &&
                    o.producerId.toString() !== filter.producerId.toString()
                  )
                    return false;
                  if (filter.status && o.status !== filter.status) return false;
                  return true;
                })
                .slice(skip, skip + limit);
            },
          }),
        }),
      }),
    }),
    countDocuments: (filter: Record<string, unknown>) => ({
      exec: async () => {
        return orders.filter((o) => {
          if (
            filter.buyerId &&
            o.buyerId.toString() !== filter.buyerId.toString()
          )
            return false;
          if (
            filter.producerId &&
            o.producerId.toString() !== filter.producerId.toString()
          )
            return false;
          if (filter.status && o.status !== filter.status) return false;
          return true;
        }).length;
      },
    }),
    findById: (id: string | Types.ObjectId) => ({
      exec: async () => {
        const found = orders.find((o) => o._id.toString() === id.toString());
        return found ? { ...found } : null;
      },
    }),
    findOne: (filter: { _id: Types.ObjectId; producerId: Types.ObjectId }) => ({
      exec: async () => {
        const found = orders.find(
          (o) =>
            o._id.toString() === filter._id.toString() &&
            o.producerId.toString() === filter.producerId.toString(),
        );
        return found ? { ...found } : null;
      },
    }),
    findOneAndUpdate: (
      filter: Record<string, unknown>,
      update: {
        $set: { status: OrderStatus };
        $inc: { revision: number };
        $push: { statusHistory: OrderStatusHistoryEntry };
      },
    ) => ({
      exec: async () => {
        const index = orders.findIndex((o) => {
          if (o._id.toString() !== filter._id?.toString()) return false;
          if (
            filter.producerId &&
            o.producerId.toString() !== filter.producerId.toString()
          )
            return false;
          if (filter.status && o.status !== filter.status) return false;
          if (filter.revision !== undefined && o.revision !== filter.revision)
            return false;
          return true;
        });

        if (index === -1) return null;

        const target = orders[index];
        target.status = update.$set.status;
        target.revision += update.$inc.revision;
        target.statusHistory.push(update.$push.statusHistory);
        target.updatedAt = new Date();
        return { ...target };
      },
    }),
  };

  const paymentModel = {
    find: (filter: { _id?: { $in?: Types.ObjectId[] } }) => ({
      exec: async () => {
        const ids = (filter._id?.$in ?? []).map((id) => id.toString());
        return ids.map((id) => ({
          _id: new Types.ObjectId(id),
          checkoutId: new Types.ObjectId(),
          buyerId: new Types.ObjectId(),
          paymentMethodId: new Types.ObjectId(),
          paymentMethodSnapshot: {
            last4: '4242',
            expiryMonth: 12,
            expiryYear: 2028,
          },
          amountCents: 4500,
          status: PaymentStatus.Succeeded,
        }));
      },
    }),
  };

  const userModel = {
    find: (filter: { _id?: { $in?: Types.ObjectId[] } }) => ({
      exec: async () => {
        const ids = (filter._id?.$in ?? []).map((id) => id.toString());
        return ids.map((id) => ({
          _id: new Types.ObjectId(id),
          name: 'Test User',
          producerApplication: { farmName: 'Test Farm' },
        }));
      },
    }),
  };

  const testMongoose = new Mongoose();
  const productModel = testMongoose.model<Product>(Product.name, ProductSchema);
  const refundAllocationModel = testMongoose.model<RefundAllocation>(
    RefundAllocation.name,
    RefundAllocationSchema,
  );
  const connection = testMongoose.createConnection();
  Object.defineProperty(connection, 'startSession', {
    value: async () => ({
      withTransaction: async (callback: () => Promise<unknown>) => callback(),
      endSession: async () => {},
    }),
  });
  const notificationModel = testMongoose.model<Notification>(
    Notification.name,
    NotificationSchema,
  );
  Object.defineProperty(notificationModel, 'findOneAndUpdate', {
    value: (
      _filter: unknown,
      update: { $setOnInsert: Record<string, unknown> },
    ) => Promise.resolve(new notificationModel(update.$setOnInsert)),
  });
  const notificationIntegration = new NotificationIntegrationService(
    new NotificationsService(notificationModel),
    { publishNotificationCreated: () => {} },
  );

  const service = new OrdersService(
    orderModel as unknown as Model<OrderDocument>,
    paymentModel as unknown as Model<PaymentDocument>,
    userModel as unknown as Model<UserDocument>,
    productModel,
    refundAllocationModel,
    connection,
    notificationIntegration,
  );

  return { service, orders };
}

const buyerUser: UserResponseDto = {
  id: new Types.ObjectId().toString(),
  email: 'buyer@example.com',
  name: 'Buyer One',
  role: UserRole.Buyer,
  producerStatus: null,
  producerRejectionReason: null,
};

const producerUser: UserResponseDto = {
  id: new Types.ObjectId().toString(),
  email: 'producer@example.com',
  name: 'Producer One',
  role: UserRole.Producer,
  producerStatus: ProducerStatus.Approved,
  producerRejectionReason: null,
};

const otherProducerUser: UserResponseDto = {
  id: new Types.ObjectId().toString(),
  email: 'other@example.com',
  name: 'Producer Two',
  role: UserRole.Producer,
  producerStatus: ProducerStatus.Approved,
  producerRejectionReason: null,
};

const suspendedProducerUser: UserResponseDto = {
  id: producerUser.id,
  email: 'producer@example.com',
  name: 'Producer One',
  role: UserRole.Producer,
  producerStatus: ProducerStatus.Suspended,
  producerRejectionReason: null,
};

function createSampleOrder(
  method: FulfilmentMethod,
  initialStatus: OrderStatus = OrderStatus.Pending,
): TestOrderData {
  const now = new Date();
  return {
    _id: new Types.ObjectId(),
    checkoutId: new Types.ObjectId(),
    buyerId: new Types.ObjectId(buyerUser.id),
    producerId: new Types.ObjectId(producerUser.id),
    paymentId: new Types.ObjectId(),
    items: [
      {
        productId: new Types.ObjectId(),
        productName: 'Fresh Strawberries',
        productUnit: ProductUnit.Kg,
        quantity: 2,
        unitPriceCents: 400,
        lineTotalCents: 800,
      },
    ],
    fulfilmentMethod: method,
    deliveryAddress:
      method === FulfilmentMethod.Delivery
        ? {
            recipientName: 'Buyer One',
            street: 'Rua Principal 1',
            postalCode: '1000-001',
            city: 'Lisboa',
            country: 'Portugal',
          }
        : null,
    subtotalCents: 800,
    deliveryFeeCents: method === FulfilmentMethod.Delivery ? 500 : 0,
    totalCents: method === FulfilmentMethod.Delivery ? 1300 : 800,
    status: initialStatus,
    statusHistory: [
      {
        status: initialStatus,
        timestamp: now,
        actorId: new Types.ObjectId(buyerUser.id),
        actorRole: UserRole.Buyer,
        note: 'Order created',
      },
    ],
    origin: OrderOrigin.Catalogue,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

test('Delivery fulfilment: advances pending -> confirmed -> shipped -> delivered', async () => {
  const order = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Pending,
  );
  const { service } = createMockEnvironment([order]);

  // Step 1: Confirmed
  const s1 = await service.advanceOrderStatus(
    producerUser,
    order._id.toString(),
    {
      status: OrderStatus.Confirmed,
      expectedRevision: 1,
    },
  );
  assert.equal(s1.status, OrderStatus.Confirmed);
  assert.equal(s1.revision, 2);
  assert.equal(s1.statusHistory.length, 2);

  // Step 2: Shipped
  const s2 = await service.advanceOrderStatus(
    producerUser,
    order._id.toString(),
    {
      status: OrderStatus.Shipped,
      expectedRevision: 2,
    },
  );
  assert.equal(s2.status, OrderStatus.Shipped);
  assert.equal(s2.revision, 3);
  assert.equal(s2.statusHistory.length, 3);

  // Step 3: Delivered
  const s3 = await service.advanceOrderStatus(
    producerUser,
    order._id.toString(),
    {
      status: OrderStatus.Delivered,
      expectedRevision: 3,
    },
  );
  assert.equal(s3.status, OrderStatus.Delivered);
  assert.equal(s3.revision, 4);
  assert.equal(s3.statusHistory.length, 4);
});

test('Collection fulfilment: advances pending -> confirmed -> ready_for_collection -> collected', async () => {
  const order = createSampleOrder(
    FulfilmentMethod.Collection,
    OrderStatus.Pending,
  );
  const { service } = createMockEnvironment([order]);

  // Step 1: Confirmed
  const s1 = await service.advanceOrderStatus(
    producerUser,
    order._id.toString(),
    {
      status: OrderStatus.Confirmed,
    },
  );
  assert.equal(s1.status, OrderStatus.Confirmed);
  assert.equal(s1.revision, 2);

  // Step 2: Ready for collection
  const s2 = await service.advanceOrderStatus(
    producerUser,
    order._id.toString(),
    {
      status: OrderStatus.ReadyForCollection,
    },
  );
  assert.equal(s2.status, OrderStatus.ReadyForCollection);
  assert.equal(s2.revision, 3);

  // Step 3: Collected
  const s3 = await service.advanceOrderStatus(
    producerUser,
    order._id.toString(),
    {
      status: OrderStatus.Collected,
    },
  );
  assert.equal(s3.status, OrderStatus.Collected);
  assert.equal(s3.revision, 4);
});

test('Rejects step-skipping with 409 Conflict (invalid_status_transition)', async () => {
  const order = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Pending,
  );
  const { service } = createMockEnvironment([order]);

  await assert.rejects(
    async () => {
      await service.advanceOrderStatus(producerUser, order._id.toString(), {
        status: OrderStatus.Shipped,
      });
    },
    (err: ConflictException) => {
      assert.equal(err.getStatus(), 409);
      const res = err.getResponse() as Record<string, unknown>;
      assert.equal(res.code, 'invalid_status_transition');
      return true;
    },
  );
});

test('Rejects cross-fulfilment transitions with 409 Conflict', async () => {
  const deliveryOrder = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Confirmed,
  );
  const { service } = createMockEnvironment([deliveryOrder]);

  await assert.rejects(
    async () => {
      await service.advanceOrderStatus(
        producerUser,
        deliveryOrder._id.toString(),
        {
          status: OrderStatus.ReadyForCollection,
        },
      );
    },
    (err: ConflictException) => {
      assert.equal(err.getStatus(), 409);
      const res = err.getResponse() as Record<string, unknown>;
      assert.equal(res.code, 'invalid_status_transition');
      return true;
    },
  );
});

test('Rejects backwards transitions with 409 Conflict', async () => {
  const order = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Shipped,
  );
  const { service } = createMockEnvironment([order]);

  await assert.rejects(
    async () => {
      await service.advanceOrderStatus(producerUser, order._id.toString(), {
        status: OrderStatus.Confirmed,
      });
    },
    (err: ConflictException) => {
      assert.equal(err.getStatus(), 409);
      const res = err.getResponse() as Record<string, unknown>;
      assert.equal(res.code, 'invalid_status_transition');
      return true;
    },
  );
});

test('Idempotent retry: repeated submission returns order without appending history', async () => {
  const order = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Confirmed,
  );
  const { service, orders } = createMockEnvironment([order]);

  const initialHistoryLen = orders[0].statusHistory.length;
  const initialRevision = orders[0].revision;

  const result = await service.advanceOrderStatus(
    producerUser,
    order._id.toString(),
    {
      status: OrderStatus.Confirmed,
    },
  );

  assert.equal(result.status, OrderStatus.Confirmed);
  assert.equal(orders[0].statusHistory.length, initialHistoryLen);
  assert.equal(orders[0].revision, initialRevision);
});

test('Optimistic revision mismatch triggers 409 revision_conflict', async () => {
  const order = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Pending,
  );
  order.revision = 3;
  const { service } = createMockEnvironment([order]);

  await assert.rejects(
    async () => {
      await service.advanceOrderStatus(producerUser, order._id.toString(), {
        status: OrderStatus.Confirmed,
        expectedRevision: 1, // Stale revision
      });
    },
    (err: ConflictException) => {
      assert.equal(err.getStatus(), 409);
      const res = err.getResponse() as Record<string, unknown>;
      assert.equal(res.code, 'revision_conflict');
      return true;
    },
  );
});

test('Role permissions: buyer cannot advance fulfilment (403 Forbidden)', async () => {
  const order = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Pending,
  );
  const { service } = createMockEnvironment([order]);

  await assert.rejects(
    async () => {
      await service.advanceOrderStatus(buyerUser, order._id.toString(), {
        status: OrderStatus.Confirmed,
      });
    },
    (err: ForbiddenException) => {
      assert.equal(err.getStatus(), 403);
      return true;
    },
  );
});

test('Producer isolation: foreign producer cannot access or update order (404 Not Found)', async () => {
  const order = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Pending,
  );
  const { service } = createMockEnvironment([order]);

  await assert.rejects(
    async () => {
      await service.getOrderById(otherProducerUser, order._id.toString());
    },
    (err: NotFoundException) => {
      assert.equal(err.getStatus(), 404);
      return true;
    },
  );

  await assert.rejects(
    async () => {
      await service.advanceOrderStatus(
        otherProducerUser,
        order._id.toString(),
        {
          status: OrderStatus.Confirmed,
        },
      );
    },
    (err: NotFoundException) => {
      assert.equal(err.getStatus(), 404);
      return true;
    },
  );
});

test('Suspended producers can view and advance their existing orders', async () => {
  const order = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Pending,
  );
  const { service } = createMockEnvironment([order]);

  const fetched = await service.getOrderById(
    suspendedProducerUser,
    order._id.toString(),
  );
  assert.equal(fetched.id, order._id.toString());

  const advanced = await service.advanceOrderStatus(
    suspendedProducerUser,
    order._id.toString(),
    {
      status: OrderStatus.Confirmed,
    },
  );
  assert.equal(advanced.status, OrderStatus.Confirmed);
});

test('Order list is strictly scoped by user role', async () => {
  const order1 = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Pending,
  );
  const order2 = createSampleOrder(
    FulfilmentMethod.Delivery,
    OrderStatus.Pending,
  );
  order2.buyerId = new Types.ObjectId(); // different buyer
  order2.producerId = new Types.ObjectId(otherProducerUser.id); // different producer

  const { service } = createMockEnvironment([order1, order2]);

  const buyerList = await service.listOrders(buyerUser, { page: 1, limit: 20 });
  assert.equal(buyerList.items.length, 1);
  assert.equal(buyerList.items[0].id, order1._id.toString());

  const producerList = await service.listOrders(producerUser, {
    page: 1,
    limit: 20,
  });
  assert.equal(producerList.items.length, 1);
  assert.equal(producerList.items[0].id, order1._id.toString());
});
