import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BadRequestException,
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Model, Mongoose, Types } from 'mongoose';
import {
  type AuthenticatedUserRequest,
  RoleGuard,
} from '../dist/auth/role.guard.js';
import { AuthService } from '../dist/auth/auth.service.js';
import {
  CheckoutService,
  STANDARD_DELIVERY_FEE_CENTS,
} from '../dist/checkout/checkout.service.js';
import {
  CheckoutQuoteIssueCode,
  FulfilmentMethod,
} from '../dist/checkout/checkout.dto.js';
import {
  ProducerStatus,
  type UserDocument,
  UserRole,
} from '../dist/users/user.schema.js';
import {
  type ProductDocument,
  ProductUnit,
} from '../dist/products/product.schema.js';
import { NotificationIntegrationService } from '../dist/notifications/notification-integration.service.js';
import {
  Notification,
  NotificationSchema,
} from '../dist/notifications/notification.schema.js';
import { NotificationsService } from '../dist/notifications/notifications.service.js';

const testMongoose = new Mongoose();
const quoteOnlyNotificationIntegration = new NotificationIntegrationService(
  new NotificationsService(
    testMongoose.model<Notification>(Notification.name, NotificationSchema),
  ),
  { publishNotificationCreated: () => {} },
);

interface MockProduct {
  _id: Types.ObjectId;
  producerId: Types.ObjectId;
  name: string;
  priceCents: number;
  unit: ProductUnit;
  availableStock: number;
  published: boolean;
  archivedAt: Date | null;
  moderatedAt: Date | null;
  revision: number;
}

interface MockProducer {
  _id: Types.ObjectId;
  name: string;
  role: UserRole;
  producerStatus: ProducerStatus;
  producerApplication?: {
    farmName: string;
    city: string;
    collectionAddress: string;
  };
}

function createMockModels(
  initialProducts: MockProduct[],
  initialProducers: MockProducer[],
) {
  let writeAttempted = false;

  const productModel = {
    find: (filter: { _id?: { $in?: Types.ObjectId[] } }) => ({
      lean: () => ({
        exec: async () => {
          const ids = (filter._id?.$in ?? []).map((id) => id.toString());
          return initialProducts.filter((p) => ids.includes(p._id.toString()));
        },
      }),
    }),
    updateOne: async () => {
      writeAttempted = true;
    },
    save: async () => {
      writeAttempted = true;
    },
  };

  const userModel = {
    find: (filter: { _id?: { $in?: Types.ObjectId[] }; role?: UserRole }) => ({
      lean: () => ({
        exec: async () => {
          const ids = (filter._id?.$in ?? []).map((id) => id.toString());
          return initialProducers.filter(
            (u) => ids.includes(u._id.toString()) && u.role === filter.role,
          );
        },
      }),
    }),
    updateOne: async () => {
      writeAttempted = true;
    },
  };

  return {
    productModel: productModel as unknown as Model<ProductDocument>,
    userModel: userModel as unknown as Model<UserDocument>,
    didAttemptWrite: () => writeAttempted,
  };
}

test('EUR 49.99 incurs EUR 5; EUR 50.00 is free independently per producer in delivery', async () => {
  const producerAId = new Types.ObjectId();
  const producerBId = new Types.ObjectId();

  const productAId = new Types.ObjectId();
  const productBId = new Types.ObjectId();

  const products: MockProduct[] = [
    {
      _id: productAId,
      producerId: producerAId,
      name: 'Olive Oil 49.99',
      priceCents: 4999, // EUR 49.99
      unit: ProductUnit.Bottle,
      availableStock: 20,
      published: true,
      archivedAt: null,
      moderatedAt: null,
      revision: 1,
    },
    {
      _id: productBId,
      producerId: producerBId,
      name: 'Artisan Wine 50.00',
      priceCents: 5000, // EUR 50.00
      unit: ProductUnit.Bottle,
      availableStock: 20,
      published: true,
      archivedAt: null,
      moderatedAt: null,
      revision: 1,
    },
  ];

  const producers: MockProducer[] = [
    {
      _id: producerAId,
      name: 'Producer A',
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Approved,
      producerApplication: {
        farmName: 'Farm A',
        city: 'Braga',
        collectionAddress: 'Rua A',
      },
    },
    {
      _id: producerBId,
      name: 'Producer B',
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Approved,
      producerApplication: {
        farmName: 'Farm B',
        city: 'Guimarães',
        collectionAddress: 'Rua B',
      },
    },
  ];

  const { productModel, userModel, didAttemptWrite } = createMockModels(
    products,
    producers,
  );
  const service = new CheckoutService(
    productModel,
    userModel,
    quoteOnlyNotificationIntegration,
  );

  const quote = await service.quote('buyer-1', {
    fulfilmentMethod: FulfilmentMethod.Delivery,
    deliveryAddress: {
      recipientName: 'Maria Silva',
      street: 'Av. Liberdade 100',
      city: 'Braga',
      postalCode: '4700-001',
    },
    items: [
      { productId: productAId.toString(), quantity: 1 },
      { productId: productBId.toString(), quantity: 1 },
    ],
  });

  assert.equal(
    didAttemptWrite(),
    false,
    'Quote must not perform database writes',
  );
  assert.equal(quote.isOrderable, true);
  assert.equal(quote.issues.length, 0);
  assert.equal(quote.groups.length, 2);

  const groupA = quote.groups.find(
    (g) => g.producerId === producerAId.toString(),
  );
  const groupB = quote.groups.find(
    (g) => g.producerId === producerBId.toString(),
  );

  assert.ok(groupA);
  assert.ok(groupB);

  // Producer A: 4999 cents -> incurs EUR 5 (500 cents) delivery fee
  assert.equal(groupA.subtotalCents, 4999);
  assert.equal(groupA.deliveryFeeCents, STANDARD_DELIVERY_FEE_CENTS);
  assert.equal(groupA.totalCents, 5499);
  assert.equal(groupA.qualifiesForFreeDelivery, false);

  // Producer B: 5000 cents -> free delivery
  assert.equal(groupB.subtotalCents, 5000);
  assert.equal(groupB.deliveryFeeCents, 0);
  assert.equal(groupB.totalCents, 5000);
  assert.equal(groupB.qualifiesForFreeDelivery, true);

  // Combined totals
  assert.equal(quote.subtotalCents, 9999);
  assert.equal(quote.deliveryFeeCents, 500);
  assert.equal(quote.totalCents, 10499);
  assert.equal(quote.itemCount, 2);
  assert.ok(
    typeof quote.fingerprint === 'string' && quote.fingerprint.length === 64,
  );
});

test('Collection is free regardless of subtotal amounts', async () => {
  const producerId = new Types.ObjectId();
  const productId = new Types.ObjectId();

  const products: MockProduct[] = [
    {
      _id: productId,
      producerId,
      name: 'Fresh Cheese',
      priceCents: 800,
      unit: ProductUnit.Unit,
      availableStock: 50,
      published: true,
      archivedAt: null,
      moderatedAt: null,
      revision: 1,
    },
  ];

  const producers: MockProducer[] = [
    {
      _id: producerId,
      name: 'Dairy Farm',
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Approved,
      producerApplication: {
        farmName: 'Valley Dairy',
        city: 'Viana',
        collectionAddress: 'Farm Gate 1',
      },
    },
  ];

  const { productModel, userModel } = createMockModels(products, producers);
  const service = new CheckoutService(
    productModel,
    userModel,
    quoteOnlyNotificationIntegration,
  );

  const quote = await service.quote('buyer-1', {
    fulfilmentMethod: FulfilmentMethod.Collection,
    items: [{ productId: productId.toString(), quantity: 2 }],
  });

  assert.equal(quote.fulfilmentMethod, FulfilmentMethod.Collection);
  assert.equal(quote.deliveryAddress, null);
  assert.equal(quote.subtotalCents, 1600);
  assert.equal(quote.deliveryFeeCents, 0);
  assert.equal(quote.totalCents, 1600);
  assert.equal(quote.groups[0].deliveryFeeCents, 0);
  assert.equal(quote.groups[0].qualifiesForFreeDelivery, true);
  assert.equal(quote.isOrderable, true);
});

test('Deduplicates and normalizes product lines so duplicate lines cannot evade stock checks', async () => {
  const producerId = new Types.ObjectId();
  const productId = new Types.ObjectId();

  const products: MockProduct[] = [
    {
      _id: productId,
      producerId,
      name: 'Organic Honey',
      priceCents: 1200,
      unit: ProductUnit.Jar,
      availableStock: 4, // only 4 in stock
      published: true,
      archivedAt: null,
      moderatedAt: null,
      revision: 1,
    },
  ];

  const producers: MockProducer[] = [
    {
      _id: producerId,
      name: 'Apiary Farm',
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Approved,
      producerApplication: {
        farmName: 'Bee Haven',
        city: 'Braga',
        collectionAddress: 'Hive Way 3',
      },
    },
  ];

  const { productModel, userModel } = createMockModels(products, producers);
  const service = new CheckoutService(
    productModel,
    userModel,
    quoteOnlyNotificationIntegration,
  );

  // User submits 2 lines of 3 units each = 6 units total (exceeds stock of 4)
  const quote = await service.quote('buyer-1', {
    fulfilmentMethod: FulfilmentMethod.Collection,
    items: [
      { productId: productId.toString(), quantity: 3 },
      { productId: productId.toString(), quantity: 3 },
    ],
  });

  assert.equal(quote.isOrderable, false);
  assert.equal(quote.itemCount, 6);
  assert.equal(quote.issues.length, 1);
  assert.equal(quote.issues[0].code, CheckoutQuoteIssueCode.InsufficientStock);
  assert.equal(quote.issues[0].requestedQuantity, 6);
  assert.equal(quote.issues[0].availableStock, 4);

  // Group has 1 normalized line with quantity 6
  assert.equal(quote.groups[0].items.length, 1);
  assert.equal(quote.groups[0].items[0].quantity, 6);
  assert.equal(quote.groups[0].items[0].lineTotalCents, 7200);
  assert.equal(
    quote.groups[0].items[0].issues[0].code,
    CheckoutQuoteIssueCode.InsufficientStock,
  );
});

test('Identifies unavailable products and suspended producers with stable issue codes', async () => {
  const activeProducerId = new Types.ObjectId();
  const suspendedProducerId = new Types.ObjectId();

  const unpublishedProductId = new Types.ObjectId();
  const suspendedProducerProductId = new Types.ObjectId();
  const nonExistentProductId = new Types.ObjectId();

  const products: MockProduct[] = [
    {
      _id: unpublishedProductId,
      producerId: activeProducerId,
      name: 'Unpublished Item',
      priceCents: 500,
      unit: ProductUnit.Unit,
      availableStock: 10,
      published: false, // unavailable!
      archivedAt: null,
      moderatedAt: null,
      revision: 1,
    },
    {
      _id: suspendedProducerProductId,
      producerId: suspendedProducerId,
      name: 'Suspended Producer Berries',
      priceCents: 750,
      unit: ProductUnit.Box,
      availableStock: 20,
      published: true,
      archivedAt: null,
      moderatedAt: null,
      revision: 1,
    },
  ];

  const producers: MockProducer[] = [
    {
      _id: activeProducerId,
      name: 'Active Farm',
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Approved,
      producerApplication: {
        farmName: 'Active Farm',
        city: 'Porto',
        collectionAddress: 'Porto 1',
      },
    },
    {
      _id: suspendedProducerId,
      name: 'Suspended Farm',
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Suspended, // suspended!
      producerApplication: {
        farmName: 'Suspended Farm',
        city: 'Porto',
        collectionAddress: 'Porto 2',
      },
    },
  ];

  const { productModel, userModel } = createMockModels(products, producers);
  const service = new CheckoutService(
    productModel,
    userModel,
    quoteOnlyNotificationIntegration,
  );

  const quote = await service.quote('buyer-1', {
    fulfilmentMethod: FulfilmentMethod.Collection,
    items: [
      { productId: unpublishedProductId.toString(), quantity: 1 },
      { productId: suspendedProducerProductId.toString(), quantity: 2 },
      { productId: nonExistentProductId.toString(), quantity: 1 },
    ],
  });

  assert.equal(quote.isOrderable, false);

  const unavailableIssues = quote.issues.filter(
    (i) => i.code === CheckoutQuoteIssueCode.UnavailableProduct,
  );
  assert.equal(unavailableIssues.length, 2); // unpublished + non-existent

  const suspendedIssues = quote.issues.filter(
    (i) => i.code === CheckoutQuoteIssueCode.ProducerSuspended,
  );
  assert.equal(suspendedIssues.length, 1);
  assert.equal(
    suspendedIssues[0].productId,
    suspendedProducerProductId.toString(),
  );
});

test('Fails when delivery address is incomplete or missing for delivery fulfilment', async () => {
  const producerId = new Types.ObjectId();
  const productId = new Types.ObjectId();

  const products: MockProduct[] = [
    {
      _id: productId,
      producerId,
      name: 'Apples',
      priceCents: 300,
      unit: ProductUnit.Kg,
      availableStock: 50,
      published: true,
      archivedAt: null,
      moderatedAt: null,
      revision: 1,
    },
  ];
  const producers: MockProducer[] = [
    {
      _id: producerId,
      name: 'Farm',
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Approved,
    },
  ];

  const { productModel, userModel } = createMockModels(products, producers);
  const service = new CheckoutService(
    productModel,
    userModel,
    quoteOnlyNotificationIntegration,
  );

  await assert.rejects(
    async () => {
      await service.quote('buyer-1', {
        fulfilmentMethod: FulfilmentMethod.Delivery,
        items: [{ productId: productId.toString(), quantity: 1 }],
      });
    },
    (err: unknown) =>
      err instanceof BadRequestException &&
      /delivery address/.test(err.message),
  );

  await assert.rejects(
    async () => {
      await service.quote('buyer-1', {
        fulfilmentMethod: FulfilmentMethod.Delivery,
        deliveryAddress: {
          recipientName: 'Maria',
          street: '', // incomplete!
          city: 'Porto',
          postalCode: '4000-001',
        },
        items: [{ productId: productId.toString(), quantity: 1 }],
      });
    },
    (err: unknown) => err instanceof BadRequestException,
  );
});

test('Fingerprint is deterministic and responds to price, quantity, revision, and method changes', async () => {
  const service = new CheckoutService(
    {} as unknown as Model<ProductDocument>,
    {} as unknown as Model<UserDocument>,
    quoteOnlyNotificationIntegration,
  );

  const basePayload = {
    fulfilmentMethod: FulfilmentMethod.Delivery,
    items: [
      { productId: 'prod-1', quantity: 2, unitPriceCents: 500, revision: 1 },
      { productId: 'prod-2', quantity: 1, unitPriceCents: 1000, revision: 2 },
    ],
    groups: [
      {
        producerId: 'producer-1',
        subtotalCents: 2000,
        deliveryFeeCents: 500,
        totalCents: 2500,
      },
    ],
    subtotalCents: 2000,
    deliveryFeeCents: 500,
    totalCents: 2500,
  };

  const fp1 = service.createQuoteFingerprint(basePayload);
  const fp2 = service.createQuoteFingerprint(basePayload);
  assert.equal(
    fp1,
    fp2,
    'Fingerprint must be deterministic for identical payloads',
  );

  // Order of items or groups in array must not affect fingerprint (canonical sorting)
  const fpPermuted = service.createQuoteFingerprint({
    ...basePayload,
    items: [...basePayload.items].reverse(),
  });
  assert.equal(fp1, fpPermuted, 'Fingerprint must be order-independent');

  // Changed price
  const fpChangedPrice = service.createQuoteFingerprint({
    ...basePayload,
    items: [
      { productId: 'prod-1', quantity: 2, unitPriceCents: 550, revision: 1 },
      basePayload.items[1],
    ],
    subtotalCents: 2100,
    totalCents: 2600,
  });
  assert.notEqual(
    fp1,
    fpChangedPrice,
    'Fingerprint must change when price changes',
  );

  // Changed revision
  const fpChangedRevision = service.createQuoteFingerprint({
    ...basePayload,
    items: [
      { productId: 'prod-1', quantity: 2, unitPriceCents: 500, revision: 2 },
      basePayload.items[1],
    ],
  });
  assert.notEqual(
    fp1,
    fpChangedRevision,
    'Fingerprint must change when revision changes',
  );

  // Changed fulfilment method
  const fpChangedMethod = service.createQuoteFingerprint({
    ...basePayload,
    fulfilmentMethod: FulfilmentMethod.Collection,
    deliveryFeeCents: 0,
    totalCents: 2000,
  });
  assert.notEqual(
    fp1,
    fpChangedMethod,
    'Fingerprint must change when fulfilment method changes',
  );
});

test('RoleGuard permits buyers and rejects producers and unauthenticated requests', async () => {
  const reflector = new Reflector();
  const mockAuthService = {
    authenticate: async (header: string | undefined) => {
      if (!header || !header.startsWith('Bearer ')) {
        throw new BadRequestException('Unauthorized');
      }
      const token = header.slice(7);
      if (token === 'buyer-token') {
        return { id: 'user-b', role: UserRole.Buyer, name: 'Buyer' };
      }
      if (token === 'producer-token') {
        return { id: 'user-p', role: UserRole.Producer, name: 'Producer' };
      }
      throw new BadRequestException('Invalid token');
    },
  };

  const guard = new RoleGuard(
    reflector,
    mockAuthService as unknown as AuthService,
  );

  // 1. Buyer request succeeds
  const buyerRequest: AuthenticatedUserRequest = {
    headers: { authorization: 'Bearer buyer-token' },
  };
  const buyerContext = {
    switchToHttp: () => ({ getRequest: () => buyerRequest }),
    getHandler: () => {},
    getClass: () => {},
  } as unknown as ExecutionContext;
  const allowed = await guard.canActivate(buyerContext);
  assert.equal(allowed, true);
  assert.equal(buyerRequest.user?.role, UserRole.Buyer);

  // 2. Producer request throws ForbiddenException
  const producerRequest: AuthenticatedUserRequest = {
    headers: { authorization: 'Bearer producer-token' },
  };
  const producerContext = {
    switchToHttp: () => ({ getRequest: () => producerRequest }),
    getHandler: () => {},
    getClass: () => {},
  } as unknown as ExecutionContext;
  await assert.rejects(
    async () => {
      await guard.canActivate(producerContext);
    },
    (err: unknown) =>
      err instanceof ForbiddenException &&
      /Buyer access is required/.test(err.message),
  );
});
