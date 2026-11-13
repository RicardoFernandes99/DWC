import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { UserSchema } from './users/user.schema.js';
import { ProductSchema } from './products/product.schema.js';
import { OrderSchema } from './orders/order.schema.js';
import { PaymentSchema } from './checkout/payment.schema.js';
import { CheckoutSchema } from './checkout/checkout.schema.js';
import { PaymentMethodSchema } from './payment-methods/payment-method.schema.js';
import { AuctionSchema, AuctionBidSchema } from './auctions/auction.schema.js';
import { ReviewSchema } from './reviews/review.schema.js';
import { ReviewReportSchema } from './reviews/review-report.schema.js';
import { RefundAllocationSchema } from './orders/refund-allocation.schema.js';
import {
  CORE_PRODUCT_IMAGES,
  cleanupCatalogue,
  createCatalogue,
  deleteFixtureImages,
  fixtureImage,
  fixtureImageKey,
  uploadFixtureImages,
} from './local-demo-catalogue.js';

const NAMESPACE = 'dwc-local-demo-044-v1';
const MANIFEST_COLLECTION = '_dwc_fixture_ownership';
const MANIFEST_ID = NAMESPACE;
const REVIEW_ROOT = resolve(process.cwd(), '../../demos/ticket-044-review');
const CREDENTIALS_FILE = resolve(REVIEW_ROOT, 'credentials.local.json');
const BCRYPT_COST = 12;
const FIXTURE_EMAIL_DOMAIN = 'demo.dwclocal.invalid';
const BUYER_ONE_NAME = 'Alex Carter';
const BUYER_TWO_NAME = 'Morgan Ellis';
const CORE_FARM_NAME = 'Ashcombe Orchard';
/** Display names for the core accounts; emails stay derived from the keys. */
const ACCOUNT_NAMES: Record<string, string> = {
  buyer_one: BUYER_ONE_NAME,
  buyer_two: BUYER_TWO_NAME,
  producer_approved: CORE_FARM_NAME,
  producer_pending: 'Harbourside Microgreens',
  producer_rejected: 'Clevedon Honey Co.',
  producer_suspended: 'Severn Smokehouse',
};
/** Application details per core farm, so each producer reads as a real business. */
const FARM_DETAILS: Record<
  string,
  {
    description: string;
    city: string;
    collectionAddress: string;
    latitude: number;
    longitude: number;
  }
> = {
  [CORE_FARM_NAME]: {
    description:
      'A small orchard on the edge of Bristol growing heritage apples and pears, with free-range hens and a jam kitchen in the old barn.',
    city: 'Bristol',
    collectionAddress: 'Ashcombe Farm, Long Ashton Road, Bristol, BS41 9DQ',
    latitude: 51.4296,
    longitude: -2.6493,
  },
  'Harbourside Microgreens': {
    description:
      'Microgreens and edible flowers grown indoors in a converted warehouse by the harbour, harvested to order.',
    city: 'Bristol',
    collectionAddress: 'Unit 4, Wapping Wharf, Bristol, BS1 6WP',
    latitude: 51.4469,
    longitude: -2.5973,
  },
  'Clevedon Honey Co.': {
    description:
      'Raw wildflower honey and beeswax from forty hives along the Clevedon coast.',
    city: 'Clevedon',
    collectionAddress: '7 Hill Road, Clevedon, BS21 7NE',
    latitude: 51.4385,
    longitude: -2.8546,
  },
  'Severn Smokehouse': {
    description:
      'Oak-smoked fish, cheese and charcuterie prepared in a traditional smokehouse near the Severn estuary.',
    city: 'Portishead',
    collectionAddress: 'Quay Lane, Portishead, BS20 7HL',
    latitude: 51.4863,
    longitude: -2.7671,
  },
};
const ID_NAMES = [
  'buyer_one',
  'buyer_two',
  'producer_approved',
  'producer_pending',
  'producer_rejected',
  'producer_suspended',
  'product_veg',
  'product_eggs',
  'product_jam',
  'method_buyer_one',
  'method_buyer_two',
  'payment_pending',
  'payment_open_refund',
  'payment_refunded',
  'payment_delivered',
  'payment_collected',
  'checkout_pending',
  'checkout_open_refund',
  'checkout_refunded',
  'checkout_delivered',
  'checkout_collected',
  'order_pending',
  'order_open_refund',
  'order_refunded',
  'order_delivered',
  'order_collected',
  'auction_upcoming',
  'auction_active',
  'auction_finished',
  'review_delivered',
  'review_collected',
  'refund_allocation',
  'bid_finished',
  'payment_auction',
  'order_auction',
];
const OBJECT_IDS = Object.fromEntries(
  ID_NAMES.map((name) => [
    name,
    new Types.ObjectId(
      createHash('sha256')
        .update(`${NAMESPACE}/${name}`)
        .digest('hex')
        .slice(0, 24),
    ),
  ]),
) as Record<string, Types.ObjectId>;

type OwnedCollection =
  | 'users'
  | 'products'
  | 'paymentmethods'
  | 'payments'
  | 'checkouts'
  | 'orders'
  | 'auctions'
  | 'auctionbids'
  | 'reviews'
  | 'reviewreports'
  | 'refundallocations';

interface Manifest {
  _id: string;
  namespace: string;
  version: 1;
  collections: Partial<Record<OwnedCollection, string[]>>;
  createdAt: Date;
}

interface Credentials {
  namespace: string;
  password: string;
  accounts: { email: string; name: string; role: string }[];
}

function fail(message: string): never {
  throw new Error(message);
}

function parseMode(): 'create' | 'cleanup' {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--create', '--cleanup'].includes(args[0]!)) {
    fail('Choose exactly one mode: --create or --cleanup.');
  }
  return args[0] === '--cleanup' ? 'cleanup' : 'create';
}

function assertLocalMongo(uri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    fail('MONGODB_URI is invalid.');
  }
  const host = parsed.hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    fail('MONGODB_URI must point to a local MongoDB host.');
  }
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName || dbName.includes('/'))
    fail('MONGODB_URI must name one database.');
}

async function assertApiStopped(): Promise<void> {
  const port = Number(process.env.API_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    fail('API_PORT is invalid.');
  try {
    await fetch(`http://127.0.0.1:${port}/api/health/live`, {
      signal: AbortSignal.timeout(1000),
    });
    fail(`An API responds on port ${port}. Stop it before using fixtures.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Stop it before'))
      throw error;
    if (!(
      error instanceof TypeError &&
      error.cause instanceof Error &&
      'code' in error.cause &&
      error.cause.code === 'ECONNREFUSED'
    )) {
      fail(
        `Could not confirm that API port ${port} is stopped. Check the port and retry.`,
      );
    }
  }
  if (process.env.FIXTURE_MAINTENANCE_ACK !== 'stopped') {
    fail(
      'Stop the API and other writers, then set FIXTURE_MAINTENANCE_ACK=stopped.',
    );
  }
}

function plain(document: Record<string, unknown>): Record<string, unknown> {
  return { ...document };
}

let now = new Date(0);
const id = (name: string) => OBJECT_IDS[name]!;
const oid = (name: string) => id(name);
const buyerOne = oid('buyer_one');
const buyerTwo = oid('buyer_two');
const approvedProducer = oid('producer_approved');
const productVeg = oid('product_veg');
const productEggs = oid('product_eggs');
const productJam = oid('product_jam');
const methodOne = oid('method_buyer_one');
const methodTwo = oid('method_buyer_two');

function user(
  name: string,
  key: string,
  role: 'buyer' | 'producer',
  status: string | null,
  application: Record<string, unknown> | null,
  passwordHash: string,
  extra: Record<string, unknown> = {},
) {
  return {
    _id: oid(key),
    name,
    email: `${key.replaceAll('_', '.')}@${FIXTURE_EMAIL_DOMAIN}`,
    passwordHash,
    role,
    producerStatus: status,
    producerApplication: application,
    producerRejectionReason: null,
    producerSuspensionReason: null,
    producerDecisionRevision: status ? 1 : 0,
    auctionEligibilityRevision: 0,
    producerDecisionBy: null,
    producerDecisionAt: status ? now : null,
    buyerStatus: 'active',
    buyerSuspensionReason: null,
    buyerDecisionRevision: 0,
    buyerEligibilityRevision: 0,
    buyerDecisionBy: null,
    buyerDecisionAt: null,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

function application(farmName: string) {
  return {
    farmName,
    ...FARM_DETAILS[farmName]!,
    submittedAt: now,
  };
}

function product(
  _id: Types.ObjectId,
  name: string,
  category: string,
  method: string,
  seasons: string[],
  priceCents: number,
  unit: string,
  availableStock: number,
  reservedStock: number,
  lowStockThreshold: number,
) {
  return {
    _id,
    producerId: approvedProducer,
    name,
    description: `${name} from ${CORE_FARM_NAME} near Bristol.`,
    category,
    productionMethod: method,
    seasons,
    priceCents,
    unit,
    availableStock,
    reservedStock,
    lowStockThreshold,
    published: true,
    archivedAt: null,
    moderatedAt: null,
    moderationReason: null,
    moderatedBy: null,
    image: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function paymentMethod(_id: Types.ObjectId, ownerId: Types.ObjectId) {
  return {
    _id,
    ownerId,
    last4: '4242',
    expiryMonth: 12,
    expiryYear: 2035,
    createdAt: now,
    updatedAt: now,
  };
}

function payment(
  _id: Types.ObjectId,
  checkoutId: Types.ObjectId,
  buyerId: Types.ObjectId,
  methodId: Types.ObjectId,
  amountCents: number,
  refundedCents = 0,
) {
  return {
    _id,
    checkoutId,
    auctionId: null,
    buyerId,
    paymentMethodId: methodId,
    paymentMethodSnapshot: { last4: '4242', expiryMonth: 12, expiryYear: 2035 },
    amountCents,
    status: 'succeeded',
    refundedCents,
    createdAt: now,
    updatedAt: now,
  };
}

function order(
  key: string,
  buyerId: Types.ObjectId,
  productId: Types.ObjectId,
  paymentId: Types.ObjectId,
  status: string,
  quantity: number,
  unitPriceCents: number,
  fulfilmentMethod: 'delivery' | 'collection',
  extra: Record<string, unknown> = {},
) {
  const subtotalCents = quantity * unitPriceCents;
  const deliveryFeeCents =
    fulfilmentMethod === 'delivery' && subtotalCents < 5000 ? 500 : 0;
  return {
    _id: oid(key),
    checkoutId: oid(`checkout_${key.replace('order_', '')}`),
    auctionId: null,
    buyerId,
    buyerNameSnapshot: buyerId.equals(buyerOne)
      ? BUYER_ONE_NAME
      : BUYER_TWO_NAME,
    producerId: approvedProducer,
    producerNameSnapshot: CORE_FARM_NAME,
    paymentId,
    items: [
      {
        productId,
        productName: productId.equals(productVeg)
          ? 'Market Vegetables'
          : productId.equals(productEggs)
            ? 'Free-range Eggs'
            : 'Orchard Jam',
        productUnit: productId.equals(productEggs)
          ? 'box'
          : productId.equals(productJam)
            ? 'jar'
            : 'kg',
        quantity,
        unitPriceCents,
        lineTotalCents: subtotalCents,
      },
    ],
    fulfilmentMethod,
    deliveryAddress:
      fulfilmentMethod === 'delivery'
        ? {
            recipientName: buyerId.equals(buyerOne)
              ? BUYER_ONE_NAME
              : BUYER_TWO_NAME,
            street: '42 Whiteladies Road',
            city: 'Bristol',
            postalCode: 'BS1 2AA',
            country: 'United Kingdom',
          }
        : null,
    subtotalCents,
    deliveryFeeCents,
    totalCents: subtotalCents + deliveryFeeCents,
    status,
    statusHistory: [
      {
        status,
        timestamp: now,
        actorId: buyerId,
        actorRole: 'buyer',
        note: null,
      },
    ],
    origin: 'catalogue',
    revision: 1,
    refundRequest: null,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

function checkout(
  _id: Types.ObjectId,
  buyerId: Types.ObjectId,
  paymentId: Types.ObjectId,
  orderId: Types.ObjectId,
  method: string,
  amountCents: number,
  deliveryFeeCents: number,
) {
  return {
    _id,
    buyerId,
    idempotencyKey: `fixture-044-${_id.toString()}`,
    requestPayloadHash: 'fixture-only-no-checkout-request',
    quoteFingerprint: 'fixture-only-no-live-quote',
    fulfilmentMethod: method,
    deliveryAddress:
      method === 'delivery'
        ? {
            recipientName: buyerId.equals(buyerOne)
              ? BUYER_ONE_NAME
              : BUYER_TWO_NAME,
            street: '42 Whiteladies Road',
            city: 'Bristol',
            postalCode: 'BS1 2AA',
            country: 'United Kingdom',
          }
        : null,
    paymentId,
    orderIds: [orderId],
    subtotalCents: amountCents - deliveryFeeCents,
    deliveryFeeCents,
    totalCents: amountCents,
    createdAt: now,
    updatedAt: now,
  };
}

interface FixtureProductSnapshot {
  name: string;
  description: string;
  category: string;
  productionMethod: string;
  seasons: string[];
  unit: string;
}

function auction(
  _id: Types.ObjectId,
  productId: Types.ObjectId,
  status: string,
  startsAt: Date,
  endsAt: Date,
  product: FixtureProductSnapshot,
) {
  return {
    _id,
    producerId: approvedProducer,
    productId,
    productSnapshot: {
      name: product.name,
      description: product.description,
      category: product.category,
      productionMethod: product.productionMethod,
      seasons: product.seasons,
      unit: product.unit,
    },
    quantity: 1,
    startingPriceCents: 1200,
    minimumIncrementCents: 100,
    startsAt,
    endsAt,
    status,
    currentBidCents: null,
    currentBidderId: null,
    currentBidderName: null,
    lastBidAt: null,
    revision: 1,
    closureNotificationsPending: false,
    closureNotificationCursor: null,
    closedAt: status === 'finished' ? endsAt : null,
    createdAt: now,
    updatedAt: now,
  };
}

async function credentials(): Promise<Credentials> {
  try {
    const stored = JSON.parse(
      await readFile(CREDENTIALS_FILE, 'utf8'),
    ) as Credentials;
    if (
      stored.namespace !== NAMESPACE ||
      typeof stored.password !== 'string' ||
      !Array.isArray(stored.accounts)
    )
      fail(
        'Local credentials file is malformed or belongs to another fixture namespace.',
      );
    return stored;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
      throw error;
  }
  const password = `DwcDemo-${randomBytes(18).toString('base64url')}`;
  const accounts = [
    'buyer_one',
    'buyer_two',
    'producer_approved',
    'producer_pending',
    'producer_rejected',
    'producer_suspended',
  ].map((key) => ({
    email: `${key.replaceAll('_', '.')}@${FIXTURE_EMAIL_DOMAIN}`,
    name: ACCOUNT_NAMES[key]!,
    role: key.startsWith('producer') ? 'producer' : 'buyer',
  }));
  await mkdir(dirname(CREDENTIALS_FILE), { recursive: true });
  try {
    const file = await open(CREDENTIALS_FILE, 'wx', 0o600);
    await file.writeFile(
      `${JSON.stringify({ namespace: NAMESPACE, password, accounts }, null, 2)}\n`,
      'utf8',
    );
    await file.close();
    return { namespace: NAMESPACE, password, accounts };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
      return credentials();
    throw error;
  }
}

const rawCollections: OwnedCollection[] = [
  'users',
  'products',
  'paymentmethods',
  'payments',
  'checkouts',
  'orders',
  'auctions',
  'auctionbids',
  'reviews',
  'reviewreports',
  'refundallocations',
];
const expectedOwnership: Record<OwnedCollection, string[]> = {
  users: [
    'buyer_one',
    'buyer_two',
    'producer_approved',
    'producer_pending',
    'producer_rejected',
    'producer_suspended',
  ].map((key) => oid(key).toString()),
  products: ['product_veg', 'product_eggs', 'product_jam'].map((key) =>
    oid(key).toString(),
  ),
  paymentmethods: ['method_buyer_one', 'method_buyer_two'].map((key) =>
    oid(key).toString(),
  ),
  payments: [
    'payment_pending',
    'payment_open_refund',
    'payment_refunded',
    'payment_delivered',
    'payment_collected',
    'payment_auction',
  ].map((key) => oid(key).toString()),
  checkouts: [
    'checkout_pending',
    'checkout_open_refund',
    'checkout_refunded',
    'checkout_delivered',
    'checkout_collected',
  ].map((key) => oid(key).toString()),
  orders: [
    'order_pending',
    'order_open_refund',
    'order_refunded',
    'order_delivered',
    'order_collected',
    'order_auction',
  ].map((key) => oid(key).toString()),
  auctions: ['auction_upcoming', 'auction_active', 'auction_finished'].map(
    (key) => oid(key).toString(),
  ),
  auctionbids: ['bid_finished'].map((key) => oid(key).toString()),
  reviews: ['review_delivered', 'review_collected'].map((key) =>
    oid(key).toString(),
  ),
  reviewreports: [],
  refundallocations: ['refund_allocation'].map((key) => oid(key).toString()),
};

function validateManifest(manifest: Manifest): void {
  if (manifest.namespace !== NAMESPACE || manifest.version !== 1)
    fail('Ownership manifest is not recognized.');
  if (Object.keys(manifest.collections).length !== rawCollections.length)
    fail('Ownership manifest is incomplete.');
  for (const collection of rawCollections) {
    const ids = manifest.collections[collection];
    const expected = expectedOwnership[collection];
    if (
      !Array.isArray(ids) ||
      new Set(ids).size !== ids.length ||
      ids.some((value) => !/^[0-9a-f]{24}$/.test(value))
    )
      fail('Ownership manifest is malformed.');
    if (
      ids.length !== expected.length ||
      [...ids]
        .sort()
        .some((value, index) => value !== [...expected].sort()[index])
    )
      fail('Ownership manifest contains IDs outside the fixture definition.');
  }
}

function refs(
  manifest: Manifest,
  collection: OwnedCollection,
): Types.ObjectId[] {
  return (manifest.collections[collection] ?? []).map(
    (value) => new Types.ObjectId(value),
  );
}

async function assertNoForeignReferences(
  db: mongoose.mongo.Db,
  manifest: Manifest,
  session: mongoose.ClientSession,
): Promise<void> {
  const users = refs(manifest, 'users');
  const products = refs(manifest, 'products');
  const payments = refs(manifest, 'payments');
  const orders = refs(manifest, 'orders');
  const auctions = refs(manifest, 'auctions');
  const bids = refs(manifest, 'auctionbids');
  const reviews = refs(manifest, 'reviews');
  const checks: [string, Record<string, unknown>][] = [
    [
      'users',
      {
        $or: [
          { producerDecisionBy: { $in: users } },
          { buyerDecisionBy: { $in: users } },
        ],
      },
    ],
    [
      'products',
      {
        $or: [{ producerId: { $in: users } }, { moderatedBy: { $in: users } }],
      },
    ],
    ['paymentmethods', { ownerId: { $in: users } }],
    [
      'payments',
      {
        $or: [
          { buyerId: { $in: users } },
          { paymentMethodId: { $in: refs(manifest, 'paymentmethods') } },
          { checkoutId: { $in: refs(manifest, 'checkouts') } },
          { auctionId: { $in: auctions } },
        ],
      },
    ],
    [
      'checkouts',
      {
        $or: [
          { buyerId: { $in: users } },
          { paymentId: { $in: payments } },
          { orderIds: { $in: orders } },
        ],
      },
    ],
    [
      'orders',
      {
        $or: [
          { buyerId: { $in: users } },
          { producerId: { $in: users } },
          { paymentId: { $in: payments } },
          { checkoutId: { $in: refs(manifest, 'checkouts') } },
          { auctionId: { $in: auctions } },
          { 'items.productId': { $in: products } },
          { 'statusHistory.actorId': { $in: users } },
          { 'refundRequest.requestedBy': { $in: users } },
          { 'refundRequest.decidedBy': { $in: users } },
        ],
      },
    ],
    [
      'auctions',
      {
        $or: [
          { producerId: { $in: users } },
          { productId: { $in: products } },
          { currentBidderId: { $in: users } },
          { closureNotificationCursor: { $in: bids } },
        ],
      },
    ],
    [
      'auctionbids',
      {
        $or: [
          { auctionId: { $in: auctions } },
          { buyerId: { $in: users } },
          { paymentMethodId: { $in: refs(manifest, 'paymentmethods') } },
        ],
      },
    ],
    [
      'reviews',
      {
        $or: [
          { authorId: { $in: users } },
          { producerId: { $in: users } },
          { orderId: { $in: orders } },
          { moderatedBy: { $in: users } },
        ],
      },
    ],
    [
      'reviewreports',
      {
        $or: [{ reviewId: { $in: reviews } }, { reporterId: { $in: users } }],
      },
    ],
    [
      'refundallocations',
      {
        $or: [
          { orderId: { $in: orders } },
          { paymentId: { $in: payments } },
          { buyerId: { $in: users } },
        ],
      },
    ],
    [
      'notifications',
      {
        $or: [
          { recipientId: { $in: users } },
          {
            'resource.id': {
              $in: [...users, ...products, ...orders, ...auctions],
            },
          },
        ],
      },
    ],
  ];
  for (const [collection, filter] of checks) {
    const owned = new Set(
      rawCollections.includes(collection as OwnedCollection)
        ? refs(manifest, collection as OwnedCollection).map(String)
        : [],
    );
    const matches = await db
      .collection(collection)
      .find(filter, { session })
      .project({ _id: 1 })
      .toArray();
    const foreign = matches.filter(
      (document) => !owned.has(String(document._id)),
    );
    if (foreign.length) {
      fail(
        `Cleanup found ${foreign.length} non-fixture record(s) in ${collection} that reference fixture data. Resolve those references manually, then retry. No fixture records or credentials were removed.`,
      );
    }
  }

  const referenceFields: Partial<
    Record<OwnedCollection, [string, OwnedCollection][]>
  > = {
    users: [
      ['producerDecisionBy', 'users'],
      ['buyerDecisionBy', 'users'],
    ],
    products: [
      ['producerId', 'users'],
      ['moderatedBy', 'users'],
    ],
    paymentmethods: [['ownerId', 'users']],
    payments: [
      ['buyerId', 'users'],
      ['paymentMethodId', 'paymentmethods'],
      ['checkoutId', 'checkouts'],
      ['auctionId', 'auctions'],
    ],
    checkouts: [
      ['buyerId', 'users'],
      ['paymentId', 'payments'],
      ['orderIds', 'orders'],
    ],
    orders: [
      ['buyerId', 'users'],
      ['producerId', 'users'],
      ['paymentId', 'payments'],
      ['checkoutId', 'checkouts'],
      ['auctionId', 'auctions'],
      ['items.productId', 'products'],
      ['statusHistory.actorId', 'users'],
      ['refundRequest.requestedBy', 'users'],
      ['refundRequest.decidedBy', 'users'],
    ],
    auctions: [
      ['producerId', 'users'],
      ['productId', 'products'],
      ['currentBidderId', 'users'],
      ['closureNotificationCursor', 'auctionbids'],
    ],
    auctionbids: [
      ['auctionId', 'auctions'],
      ['buyerId', 'users'],
      ['paymentMethodId', 'paymentmethods'],
    ],
    reviews: [
      ['authorId', 'users'],
      ['orderId', 'orders'],
      ['producerId', 'users'],
      ['moderatedBy', 'users'],
    ],
    reviewreports: [
      ['reviewId', 'reviews'],
      ['reporterId', 'users'],
    ],
    refundallocations: [
      ['orderId', 'orders'],
      ['paymentId', 'payments'],
      ['buyerId', 'users'],
    ],
  };
  for (const collection of rawCollections) {
    const rows = await db
      .collection(collection)
      .find({ _id: { $in: refs(manifest, collection) } }, { session })
      .toArray();
    for (const row of rows) {
      for (const [field, target] of referenceFields[collection] ?? []) {
        const parts = field.split('.');
        let value: unknown = row;
        for (const part of parts) {
          if (Array.isArray(value))
            value = value.flatMap((item) =>
              typeof item === 'object' && item !== null
                ? [(item as Record<string, unknown>)[part]]
                : [],
            );
          else
            value =
              typeof value === 'object' && value !== null
                ? (value as Record<string, unknown>)[part]
                : undefined;
        }
        const candidates = (Array.isArray(value) ? value : [value]).filter(
          (candidate) => candidate != null,
        );
        const allowed = new Set(refs(manifest, target).map(String));
        if (candidates.some((candidate) => !allowed.has(String(candidate)))) {
          fail(
            `Owned ${collection} record ${String(row._id)} now references a non-fixture ${target} record. Cleanup stopped without deleting fixture data.`,
          );
        }
      }
    }
  }
}

/** Gives fixture-owned core products an image when an older install has none. */
async function attachCoreImages(db: mongoose.mongo.Db): Promise<void> {
  for (const [key, image] of Object.entries(CORE_PRODUCT_IMAGES)) {
    const productId = oid(key);
    const existing = await db
      .collection('products')
      .findOne({ _id: productId, image: null }, { projection: { _id: 1 } });
    if (!existing) continue;
    const metadata = await fixtureImage(
      image,
      approvedProducer,
      productId,
      now,
    );
    await uploadFixtureImages([{ image, objectKey: metadata.objectKey }]);
    await db
      .collection('products')
      .updateOne(
        { _id: productId, image: null },
        { $set: { image: metadata }, $inc: { revision: 1 } },
      );
    console.log(`Attached a fixture image to core product ${key}.`);
  }
}

async function create(
  connection: mongoose.Connection,
  db: mongoose.mongo.Db,
): Promise<void> {
  const existing = await db
    .collection<Manifest>(MANIFEST_COLLECTION)
    .findOne({ _id: MANIFEST_ID });
  if (existing) {
    validateManifest(existing);
    const incomplete: string[] = [];
    for (const collection of rawCollections) {
      for (const recordId of existing.collections[collection] ?? []) {
        if (
          !(await db
            .collection(collection)
            .findOne(
              { _id: new Types.ObjectId(recordId) },
              { projection: { _id: 1 } },
            ))
        )
          incomplete.push(`${collection}:${recordId}`);
      }
    }
    if (incomplete.length)
      fail(
        `Fixture namespace exists but is incomplete (${incomplete.length} missing records). Cleanup and recreate instead of repairing or replenishing it.`,
      );
    console.log(
      `Fixture namespace ${NAMESPACE} already exists and is complete. No records or credentials were changed.`,
    );
    await attachCoreImages(db);
    return;
  }

  const storedCredentials = await credentials();
  if (storedCredentials.namespace !== NAMESPACE)
    fail('Local credentials belong to a different fixture namespace.');
  const passwordHash = await bcrypt.hash(
    storedCredentials.password,
    BCRYPT_COST,
  );
  const database = connection;
  const models = {
    users: database.model('FixtureUser', UserSchema, 'users'),
    products: database.model('FixtureProduct', ProductSchema, 'products'),
    paymentmethods: database.model(
      'FixturePaymentMethod',
      PaymentMethodSchema,
      'paymentmethods',
    ),
    payments: database.model('FixturePayment', PaymentSchema, 'payments'),
    checkouts: database.model('FixtureCheckout', CheckoutSchema, 'checkouts'),
    orders: database.model('FixtureOrder', OrderSchema, 'orders'),
    auctions: database.model('FixtureAuction', AuctionSchema, 'auctions'),
    auctionbids: database.model(
      'FixtureAuctionBid',
      AuctionBidSchema,
      'auctionbids',
    ),
    reviews: database.model('FixtureReview', ReviewSchema, 'reviews'),
    reviewreports: database.model(
      'FixtureReviewReport',
      ReviewReportSchema,
      'reviewreports',
    ),
    refundallocations: database.model(
      'FixtureRefundAllocation',
      RefundAllocationSchema,
      'refundallocations',
    ),
  };
  const credentialsByEmail = new Map(
    storedCredentials.accounts.map((account) => [account.email, account]),
  );
  const userRows = [
    user(BUYER_ONE_NAME, 'buyer_one', 'buyer', null, null, passwordHash),
    user(BUYER_TWO_NAME, 'buyer_two', 'buyer', null, null, passwordHash),
    user(
      CORE_FARM_NAME,
      'producer_approved',
      'producer',
      'approved',
      application(CORE_FARM_NAME),
      passwordHash,
    ),
    user(
      'Harbourside Microgreens',
      'producer_pending',
      'producer',
      'pending',
      application('Harbourside Microgreens'),
      passwordHash,
      // Submitting an application increments the revision, so a submitted pending application starts at 1.
      { producerDecisionAt: null },
    ),
    user(
      'Clevedon Honey Co.',
      'producer_rejected',
      'producer',
      'rejected',
      application('Clevedon Honey Co.'),
      passwordHash,
      { producerRejectionReason: 'Please add the missing collection details.' },
    ),
    user(
      'Severn Smokehouse',
      'producer_suspended',
      'producer',
      'suspended',
      application('Severn Smokehouse'),
      passwordHash,
      {
        producerSuspensionReason:
          'Repeated late deliveries reported by buyers.',
      },
    ),
  ];
  for (const row of userRows)
    if (!credentialsByEmail.has(String(row.email)))
      fail('Local credentials do not match expected fixture accounts.');

  const orderPending = order(
    'order_pending',
    buyerOne,
    productVeg,
    oid('payment_pending'),
    'pending',
    2,
    450,
    'delivery',
  );
  const orderOpen = order(
    'order_open_refund',
    buyerTwo,
    productEggs,
    oid('payment_open_refund'),
    'pending',
    1,
    600,
    'collection',
    {
      refundRequest: {
        status: 'open',
        requestedBy: buyerTwo,
        requestedAt: now,
        reason: 'I can no longer collect this order.',
        decidedBy: null,
        decidedAt: null,
        refundedCents: null,
      },
    },
  );
  const orderRefunded = order(
    'order_refunded',
    buyerOne,
    productJam,
    oid('payment_refunded'),
    'cancelled',
    2,
    750,
    'collection',
    {
      refundRequest: {
        status: 'accepted',
        requestedBy: buyerOne,
        requestedAt: now,
        reason: 'Change of plans.',
        decidedBy: approvedProducer,
        decidedAt: now,
        refundedCents: 1500,
      },
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          actorId: buyerOne,
          actorRole: 'buyer',
          note: null,
        },
        {
          status: 'cancelled',
          timestamp: now,
          actorId: approvedProducer,
          actorRole: 'producer',
          note: 'Refund accepted.',
        },
      ],
    },
  );
  const orderDelivered = order(
    'order_delivered',
    buyerTwo,
    productVeg,
    oid('payment_delivered'),
    'delivered',
    1,
    450,
    'delivery',
    {
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          actorId: buyerTwo,
          actorRole: 'buyer',
          note: null,
        },
        {
          status: 'confirmed',
          timestamp: now,
          actorId: approvedProducer,
          actorRole: 'producer',
          note: null,
        },
        {
          status: 'shipped',
          timestamp: now,
          actorId: approvedProducer,
          actorRole: 'producer',
          note: null,
        },
        {
          status: 'delivered',
          timestamp: now,
          actorId: approvedProducer,
          actorRole: 'producer',
          note: null,
        },
      ],
    },
  );
  const orderCollected = order(
    'order_collected',
    buyerOne,
    productEggs,
    oid('payment_collected'),
    'collected',
    1,
    600,
    'collection',
    {
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          actorId: buyerOne,
          actorRole: 'buyer',
          note: null,
        },
        {
          status: 'confirmed',
          timestamp: now,
          actorId: approvedProducer,
          actorRole: 'producer',
          note: null,
        },
        {
          status: 'ready_for_collection',
          timestamp: now,
          actorId: approvedProducer,
          actorRole: 'producer',
          note: null,
        },
        {
          status: 'collected',
          timestamp: now,
          actorId: approvedProducer,
          actorRole: 'producer',
          note: null,
        },
      ],
    },
  );
  const payments = [
    payment(
      oid('payment_pending'),
      oid('checkout_pending'),
      buyerOne,
      methodOne,
      Number(orderPending.totalCents),
    ),
    payment(
      oid('payment_open_refund'),
      oid('checkout_open_refund'),
      buyerTwo,
      methodTwo,
      Number(orderOpen.totalCents),
    ),
    payment(
      oid('payment_refunded'),
      oid('checkout_refunded'),
      buyerOne,
      methodOne,
      Number(orderRefunded.totalCents),
      1500,
    ),
    payment(
      oid('payment_delivered'),
      oid('checkout_delivered'),
      buyerTwo,
      methodTwo,
      Number(orderDelivered.totalCents),
    ),
    payment(
      oid('payment_collected'),
      oid('checkout_collected'),
      buyerOne,
      methodOne,
      Number(orderCollected.totalCents),
    ),
  ];
  const checkouts = [
    checkout(
      oid('checkout_pending'),
      buyerOne,
      oid('payment_pending'),
      oid('order_pending'),
      'delivery',
      Number(orderPending.totalCents),
      Number(orderPending.deliveryFeeCents),
    ),
    checkout(
      oid('checkout_open_refund'),
      buyerTwo,
      oid('payment_open_refund'),
      oid('order_open_refund'),
      'collection',
      Number(orderOpen.totalCents),
      Number(orderOpen.deliveryFeeCents),
    ),
    checkout(
      oid('checkout_refunded'),
      buyerOne,
      oid('payment_refunded'),
      oid('order_refunded'),
      'collection',
      Number(orderRefunded.totalCents),
      Number(orderRefunded.deliveryFeeCents),
    ),
    checkout(
      oid('checkout_delivered'),
      buyerTwo,
      oid('payment_delivered'),
      oid('order_delivered'),
      'delivery',
      Number(orderDelivered.totalCents),
      Number(orderDelivered.deliveryFeeCents),
    ),
    checkout(
      oid('checkout_collected'),
      buyerOne,
      oid('payment_collected'),
      oid('order_collected'),
      'collection',
      Number(orderCollected.totalCents),
      Number(orderCollected.deliveryFeeCents),
    ),
  ];
  const products = [
    product(
      productVeg,
      'Market Vegetables',
      'vegetables',
      'organic',
      ['summer', 'autumn'],
      450,
      'kg',
      14,
      1,
      4,
    ),
    product(
      productEggs,
      'Free-range Eggs',
      'eggs',
      'sustainable',
      ['year_round'],
      600,
      'box',
      2,
      1,
      3,
    ),
    product(
      productJam,
      'Orchard Jam',
      'pantry',
      'artisanal',
      ['year_round'],
      750,
      'jar',
      10,
      0,
      2,
    ),
  ];
  for (const row of products) {
    const key = (
      Object.keys(CORE_PRODUCT_IMAGES) as (keyof typeof CORE_PRODUCT_IMAGES)[]
    ).find((name) => oid(name).equals(row._id))!;
    Object.assign(row, {
      image: await fixtureImage(
        CORE_PRODUCT_IMAGES[key],
        approvedProducer,
        row._id,
        now,
      ),
    });
  }
  const auctions = [
    auction(
      oid('auction_upcoming'),
      productVeg,
      'scheduled',
      new Date(now.getTime() + 60 * 60_000),
      new Date(now.getTime() + 90 * 60_000),
      products.find((product) => product._id.equals(productVeg))!,
    ),
    auction(
      oid('auction_active'),
      productEggs,
      'active',
      new Date(now.getTime() - 5 * 60_000),
      new Date(now.getTime() + 25 * 60_000),
      products.find((product) => product._id.equals(productEggs))!,
    ),
    {
      ...auction(
        oid('auction_finished'),
        productVeg,
        'finished',
        new Date(now.getTime() - 90 * 60_000),
        new Date(now.getTime() - 60 * 60_000),
        products.find((product) => product._id.equals(productVeg))!,
      ),
      quantity: 2,
      currentBidCents: 1500,
      currentBidderId: buyerTwo,
      currentBidderName: BUYER_TWO_NAME,
      lastBidAt: new Date(now.getTime() - 70 * 60_000),
      revision: 2,
      createdAt: new Date(now.getTime() - 100 * 60_000),
    },
  ];
  const reviews = [
    {
      _id: oid('review_delivered'),
      authorId: buyerTwo,
      orderId: oid('order_delivered'),
      producerId: approvedProducer,
      rating: 5,
      comment: 'Fresh vegetables and careful packing.',
      visibility: 'visible',
      revision: 1,
      moderatedAt: null,
      moderationReason: null,
      moderatedBy: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: oid('review_collected'),
      authorId: buyerOne,
      orderId: oid('order_collected'),
      producerId: approvedProducer,
      rating: 4,
      comment: 'Friendly collection and good eggs.',
      visibility: 'visible',
      revision: 1,
      moderatedAt: null,
      moderationReason: null,
      moderatedBy: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const winningBidId = oid('bid_finished');
  const auctionPayment = {
    _id: oid('payment_auction'),
    checkoutId: null,
    auctionId: oid('auction_finished'),
    buyerId: buyerTwo,
    paymentMethodId: methodTwo,
    paymentMethodSnapshot: { last4: '4242', expiryMonth: 12, expiryYear: 2035 },
    amountCents: 1500,
    status: 'succeeded',
    refundedCents: 0,
    createdAt: new Date(now.getTime() - 60 * 60_000),
    updatedAt: new Date(now.getTime() - 60 * 60_000),
  };
  const auctionOrder = {
    _id: oid('order_auction'),
    checkoutId: null,
    auctionId: oid('auction_finished'),
    buyerId: buyerTwo,
    buyerNameSnapshot: BUYER_TWO_NAME,
    producerId: approvedProducer,
    producerNameSnapshot: CORE_FARM_NAME,
    paymentId: oid('payment_auction'),
    items: [
      {
        productId: productVeg,
        productName: 'Market Vegetables (lot of 2 kgs)',
        productUnit: 'kg',
        quantity: 1,
        unitPriceCents: 1500,
        lineTotalCents: 1500,
      },
    ],
    fulfilmentMethod: 'collection',
    deliveryAddress: null,
    subtotalCents: 1500,
    deliveryFeeCents: 0,
    totalCents: 1500,
    status: 'confirmed',
    statusHistory: [
      {
        status: 'confirmed',
        timestamp: new Date(now.getTime() - 60 * 60_000),
        actorId: approvedProducer,
        actorRole: 'producer',
        note: 'Auction lot paid and confirmed automatically.',
      },
    ],
    origin: 'auction',
    revision: 1,
    refundRequest: null,
    createdAt: new Date(now.getTime() - 60 * 60_000),
    updatedAt: new Date(now.getTime() - 60 * 60_000),
  };
  const bids = [
    {
      _id: winningBidId,
      auctionId: oid('auction_finished'),
      buyerId: buyerTwo,
      bidderName: BUYER_TWO_NAME,
      paymentMethodId: methodTwo,
      paymentMethodSnapshot: {
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2035,
      },
      requestId: '04400000-0000-4000-8000-000000000001',
      amountCents: 1500,
      startingPriceCents: 1200,
      minimumIncrementCents: 100,
      acceptedAt: new Date(now.getTime() - 70 * 60_000),
      endsAt: new Date(now.getTime() - 60 * 60_000),
      revision: 2,
      createdAt: new Date(now.getTime() - 70 * 60_000),
    },
  ];
  const refundAllocations = [
    {
      _id: oid('refund_allocation'),
      orderId: oid('order_refunded'),
      paymentId: oid('payment_refunded'),
      buyerId: buyerOne,
      amountCents: 1500,
      refundedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const rows: Partial<Record<OwnedCollection, Record<string, unknown>[]>> = {
    users: userRows,
    products,
    paymentmethods: [
      paymentMethod(methodOne, buyerOne),
      paymentMethod(methodTwo, buyerTwo),
    ],
    payments: [...payments, auctionPayment],
    checkouts,
    orders: [
      orderPending,
      orderOpen,
      orderRefunded,
      orderDelivered,
      orderCollected,
      auctionOrder,
    ],
    auctions,
    auctionbids: bids,
    reviews,
    reviewreports: [],
    refundallocations: refundAllocations,
  };
  const ownership: Manifest = {
    _id: MANIFEST_ID,
    namespace: NAMESPACE,
    version: 1,
    collections: {},
    createdAt: now,
  };
  for (const collection of rawCollections)
    ownership.collections[collection] = (rows[collection] ?? []).map((row) =>
      String(row._id),
    );
  for (const collection of rawCollections) {
    const ids = (rows[collection] ?? []).map(
      (row) => row._id as Types.ObjectId,
    );
    if (
      ids.length &&
      (await db
        .collection(collection)
        .findOne({ _id: { $in: ids } }, { projection: { _id: 1 } }))
    ) {
      fail(
        `A record ID in ${collection} is already in use without this fixture's ownership manifest. No records were changed.`,
      );
    }
  }

  const coreImages = products.map((row) => ({
    image:
      CORE_PRODUCT_IMAGES[
        (
          Object.keys(
            CORE_PRODUCT_IMAGES,
          ) as (keyof typeof CORE_PRODUCT_IMAGES)[]
        ).find((name) => oid(name).equals(row._id))!
      ],
    objectKey: fixtureImageKey(approvedProducer, row._id),
  }));
  await uploadFixtureImages(coreImages);
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      for (const collection of rawCollections) {
        const documents = rows[collection] ?? [];
        if (documents.length)
          await (
            models[collection] as unknown as mongoose.Model<
              Record<string, unknown>
            >
          ).insertMany(documents.map(plain), { session, ordered: true });
      }
      await db
        .collection<Manifest>(MANIFEST_COLLECTION)
        .insertOne(ownership, { session });
    });
  } finally {
    await session.endSession();
  }
  console.log(
    `Created ${Object.values(ownership.collections).reduce((total, values) => total + (values?.length ?? 0), 0)} records in ${NAMESPACE}. Credentials are in demos/ticket-044-review/credentials.local.json; passwords and hashes are never printed.`,
  );
}

async function cleanup(
  connection: mongoose.Connection,
  db: mongoose.mongo.Db,
): Promise<void> {
  const manifest = await db
    .collection<Manifest>(MANIFEST_COLLECTION)
    .findOne({ _id: MANIFEST_ID });
  if (!manifest) {
    console.log(
      `No fixture namespace ${NAMESPACE} exists. Nothing was removed.`,
    );
    return;
  }
  validateManifest(manifest);
  const session = await connection.startSession();
  const dependencyOrder: OwnedCollection[] = [
    'reviewreports',
    'reviews',
    'refundallocations',
    'orders',
    'checkouts',
    'payments',
    'auctionbids',
    'auctions',
    'products',
    'paymentmethods',
    'users',
  ];
  try {
    await session.withTransaction(async () => {
      await assertNoForeignReferences(db, manifest, session);
      for (const collection of dependencyOrder) {
        const ids = refs(manifest, collection);
        if (ids.length) {
          const result = await db
            .collection(collection)
            .deleteMany({ _id: { $in: ids } }, { session });
          if (result.deletedCount > ids.length)
            throw new Error(`Cleanup count mismatch in ${collection}.`);
        }
      }
      await db
        .collection<{ _id: string }>(MANIFEST_COLLECTION)
        .deleteOne({ _id: MANIFEST_ID }, { session });
    });
  } finally {
    await session.endSession();
  }
  try {
    await unlink(CREDENTIALS_FILE);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
      throw error;
  }
  await deleteFixtureImages(
    refs(manifest, 'products').map((productId) =>
      fixtureImageKey(approvedProducer, productId),
    ),
  );
  console.log(`Removed only manifest-owned records for ${NAMESPACE}.`);
}

let connection: mongoose.Connection | undefined;
try {
  const mode = parseMode();
  await assertApiStopped();
  const mongoUri = process.env.MONGODB_URI;
  if (typeof mongoUri !== 'string' || !mongoUri.trim())
    fail('MONGODB_URI is required.');
  assertLocalMongo(mongoUri);
  connection = await mongoose
    .createConnection(mongoUri, { serverSelectionTimeoutMS: 5000 })
    .asPromise();
  const db = connection.db;
  if (!db) fail('MongoDB connection has no selected database.');
  const hello = (await db.admin().command({ hello: 1 })) as {
    localTime?: Date;
  };
  if (!(hello.localTime instanceof Date))
    fail('MongoDB did not provide server time.');
  now = hello.localTime;
  if (mode === 'create') {
    await create(connection, db);
    const stored = await credentials();
    const models = {
      users: connection.model('CatalogueUser', UserSchema, 'users'),
      products: connection.model('CatalogueProduct', ProductSchema, 'products'),
      paymentmethods: connection.model(
        'CataloguePaymentMethod',
        PaymentMethodSchema,
        'paymentmethods',
      ),
      payments: connection.model('CataloguePayment', PaymentSchema, 'payments'),
      checkouts: connection.model(
        'CatalogueCheckout',
        CheckoutSchema,
        'checkouts',
      ),
      orders: connection.model('CatalogueOrder', OrderSchema, 'orders'),
      auctions: connection.model('CatalogueAuction', AuctionSchema, 'auctions'),
      auctionbids: connection.model(
        'CatalogueAuctionBid',
        AuctionBidSchema,
        'auctionbids',
      ),
      reviews: connection.model('CatalogueReview', ReviewSchema, 'reviews'),
    } as unknown as Parameters<typeof createCatalogue>[2];
    await createCatalogue(connection, db, models, {
      now,
      passwordHash: await bcrypt.hash(stored.password, BCRYPT_COST),
    });
  } else {
    await cleanupCatalogue(connection, db);
    await cleanup(connection, db);
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Fixture command failed.',
  );
  process.exitCode = 1;
} finally {
  await connection?.close();
}
