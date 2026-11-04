import assert from 'node:assert/strict';
import mongoose from '../../apps/api/node_modules/mongoose/index.js';
import bcrypt from '../../apps/api/node_modules/bcryptjs/index.js';

const base = process.env.REVIEW_API ?? 'http://localhost:3000/api';
const db = await mongoose
  .createConnection(process.env.MONGODB_URI!)
  .asPromise();
const oid = () => new mongoose.Types.ObjectId();
const now = new Date();
const password = `Review-${crypto.randomUUID()}!`;
const tag = `ticket031-${oid()}`;
const producerId = oid();
const otherProducerId = oid();
const buyerA = oid();
const buyerB = oid();
const orderIds: mongoose.Types.ObjectId[] = [];
const results: string[] = [];
interface Item {
  id: string;
  createdAt: string;
  reviewerFirstName: string;
}

function ok(label: string) {
  results.push(label);
  console.log(`ok - ${label}`);
}

async function call(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose fixture JSON
    json: text ? (JSON.parse(text) as any) : null,
  };
}

async function login(email: string) {
  const r = await call('POST', '/auth/login', undefined, { email, password });
  assert.equal(r.status, 200, `login ${email}`);
  return r.json.accessToken as string;
}

async function makeOrder(
  buyerId: mongoose.Types.ObjectId,
  status: string,
  origin: 'catalogue' | 'auction' = 'catalogue',
  producer = producerId,
) {
  const _id = oid();
  orderIds.push(_id);
  await db.collection('orders').insertOne({
    _id,
    checkoutId: null,
    auctionId: null,
    buyerId,
    producerId: producer,
    paymentId: oid(),
    items: [],
    fulfilmentMethod: origin === 'auction' ? 'collection' : 'delivery',
    deliveryAddress: null,
    subtotalCents: 1000,
    deliveryFeeCents: 0,
    totalCents: 1000,
    status,
    statusHistory: [],
    origin,
    revision: 1,
    refundRequest: null,
    createdAt: now,
    updatedAt: now,
  });
  return _id.toString();
}

function producerDoc(
  _id: mongoose.Types.ObjectId,
  passwordHash: string,
  name: string,
) {
  return {
    _id,
    name,
    email: `${tag}-${_id}@example.test`,
    passwordHash,
    role: 'producer',
    producerStatus: 'approved',
    producerApplication: {
      farmName: 'Review Farm',
      description: 'Fixture farm for review checks.',
      city: 'Coimbra',
      collectionAddress: '1 Fixture Lane',
      latitude: 40.2,
      longitude: -8.4,
      submittedAt: now,
    },
    producerDecisionAt: now,
    producerDecisionRevision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

try {
  const passwordHash = await bcrypt.hash(password, 10);
  await db.collection('users').insertMany([
    producerDoc(producerId, passwordHash, 'Fixture Producer'),
    producerDoc(otherProducerId, passwordHash, 'Other Producer'),
    {
      _id: buyerA,
      name: '  Alice   Harvest Smith ',
      email: `${tag}-a@example.test`,
      passwordHash,
      role: 'buyer',
      producerStatus: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: buyerB,
      name: 'Ben Orchard',
      email: `${tag}-b@example.test`,
      passwordHash,
      role: 'buyer',
      producerStatus: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const tokenA = await login(`${tag}-a@example.test`);
  const tokenB = await login(`${tag}-b@example.test`);
  const tokenP = await login(`${tag}-${producerId}@example.test`);

  const delivered = await makeOrder(buyerA, 'delivered');
  const collectedAuction = await makeOrder(buyerA, 'collected', 'auction');
  const pending = await makeOrder(buyerA, 'pending');
  const cancelled = await makeOrder(buyerA, 'cancelled');
  const shipped = await makeOrder(buyerA, 'shipped');
  const foreign = await makeOrder(buyerB, 'delivered');
  const concurrent = await makeOrder(buyerA, 'delivered');
  const bOrder = await makeOrder(buyerB, 'delivered');

  // Eligibility before.
  let r = await call('GET', `/reviews/orders/${delivered}`, tokenA);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { eligible: true, review: null });
  r = await call('GET', `/reviews/orders/${pending}`, tokenA);
  assert.deepEqual(r.json, { eligible: false, review: null });
  r = await call('GET', `/reviews/orders/${foreign}`, tokenA);
  assert.equal(r.status, 404);
  r = await call('GET', `/reviews/orders/${oid()}`, tokenA);
  assert.equal(r.status, 404);
  r = await call('GET', `/reviews/orders/${delivered}`);
  assert.equal(r.status, 401);
  r = await call('GET', `/reviews/orders/${delivered}`, tokenP);
  assert.equal(r.status, 403);
  ok(
    'eligibility before review (eligible / pending / foreign 404 / 401 / 403)',
  );

  // Create.
  r = await call('POST', '/reviews', tokenA, {
    orderId: delivered,
    rating: 5,
    comment: '  <b>Great</b> tomatoes  ',
  });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.rating, 5);
  assert.equal(r.json.comment, '<b>Great</b> tomatoes');
  assert.equal(r.json.producerId, producerId.toString());
  const reviewId = r.json.id as string;
  ok(
    'delivered catalogue order review -> 201 (comment trimmed, stored as plain text)',
  );

  r = await call('POST', '/reviews', tokenA, {
    orderId: collectedAuction,
    rating: 3,
    comment: '   ',
  });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.comment, null);
  ok('collected auction-origin order review -> 201 (blank comment -> null)');

  r = await call('POST', '/reviews', tokenA, { orderId: delivered, rating: 1 });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, 'review_exists');
  ok('retry -> 409 review_exists');

  r = await call('GET', `/reviews/orders/${delivered}`, tokenA);
  assert.equal(r.json.eligible, false);
  assert.equal(r.json.review.id, reviewId);
  ok('eligibility after review (eligible=false, review returned)');

  // Concurrent duplicates.
  const both = await Promise.all([
    call('POST', '/reviews', tokenA, { orderId: concurrent, rating: 4 }),
    call('POST', '/reviews', tokenA, { orderId: concurrent, rating: 2 }),
  ]);
  const statuses = both.map((x) => x.status).sort();
  assert.deepEqual(statuses, [201, 409], JSON.stringify(statuses));
  assert.equal(
    await db
      .collection('reviews')
      .countDocuments({ orderId: new mongoose.Types.ObjectId(concurrent) }),
    1,
  );
  const winner = both.find((x) => x.status === 201)!.json.rating as number;
  ok('concurrent duplicates -> one 201 + one 409, DB count 1');

  // Refusals.
  for (const [label, id] of [
    ['pending', pending],
    ['cancelled', cancelled],
    ['shipped', shipped],
  ] as const) {
    r = await call('POST', '/reviews', tokenA, { orderId: id, rating: 5 });
    assert.equal(r.status, 409, label);
    assert.equal(r.json.code, 'order_not_reviewable');
  }
  ok('pending / cancelled / shipped -> 409 order_not_reviewable');

  r = await call('POST', '/reviews', tokenA, { orderId: foreign, rating: 5 });
  assert.equal(r.status, 404);
  r = await call('POST', '/reviews', tokenA, { orderId: oid(), rating: 5 });
  assert.equal(r.status, 404);
  ok('foreign / missing order -> 404');

  for (const rating of [0, 6, 2.5, '5', null]) {
    r = await call('POST', '/reviews', tokenB, { orderId: bOrder, rating });
    assert.equal(r.status, 400, `rating ${String(rating)}`);
  }
  r = await call('POST', '/reviews', tokenB, {
    orderId: bOrder,
    rating: 5,
    comment: 'x'.repeat(1001),
  });
  assert.equal(r.status, 400);
  r = await call('POST', '/reviews', tokenB, {
    orderId: bOrder,
    rating: 5,
    extra: 1,
  });
  assert.equal(r.status, 400);
  r = await call('POST', '/reviews', undefined, { orderId: bOrder, rating: 5 });
  assert.equal(r.status, 401);
  r = await call('POST', '/reviews', tokenP, { orderId: bOrder, rating: 5 });
  assert.equal(r.status, 403);
  assert.equal(
    await db
      .collection('reviews')
      .countDocuments({ orderId: new mongoose.Types.ObjectId(bOrder) }),
    0,
  );
  ok(
    'rating 0/6/2.5/"5"/null, 1001-char comment, unknown field -> 400; no auth 401; producer 403',
  );

  r = await call('POST', '/reviews', tokenB, {
    orderId: bOrder,
    rating: 2,
    comment: 'x'.repeat(1000),
  });
  assert.equal(r.status, 201);
  const reviewBId = r.json.id as string;
  ok('1000-char comment accepted');

  // Public list.
  r = await call('GET', `/producers/${producerId}/reviews`);
  assert.equal(r.status, 200);
  assert.equal(r.json.total, 4);
  assert.equal(r.json.summary.ratingCount, 4);
  assert.equal(
    r.json.summary.averageRating,
    Math.round(((5 + 3 + winner + 2) / 4) * 10) / 10,
  );
  assert.equal(r.json.page, 1);
  assert.equal(r.json.limit, 10);
  const names = new Set(r.json.items.map((i: Item) => i.reviewerFirstName));
  assert(names.has('Alice') && names.has('Ben'));
  const dates = r.json.items.map((i: Item) => Date.parse(i.createdAt));
  assert.deepEqual(
    dates,
    [...dates].sort((a, b) => b - a),
  );
  for (const item of r.json.items) {
    assert.deepEqual(
      Object.keys(item).sort(),
      ['comment', 'createdAt', 'id', 'rating', 'reviewerFirstName'].sort(),
    );
  }
  r = await call('GET', `/producers/${producerId}/reviews?page=2&limit=3`);
  assert.equal(r.json.items.length, 1);
  assert.equal(r.json.total, 4);
  for (const q of ['limit=0', 'limit=51', 'page=0', 'page=x', 'limit=2.5']) {
    r = await call('GET', `/producers/${producerId}/reviews?${q}`);
    assert.equal(r.status, 400, q);
  }
  r = await call('GET', `/producers/${oid()}/reviews`);
  assert.equal(r.status, 404);
  r = await call('GET', `/producers/${buyerA}/reviews`);
  assert.equal(r.status, 404);
  r = await call('GET', `/producers/${otherProducerId}/reviews`);
  assert.deepEqual(r.json.summary, { averageRating: null, ratingCount: 0 });
  ok(
    'public list: pagination, newest first, first-name only DTO keys, summary, bounds 400, unknown/non-producer 404, empty summary null',
  );

  // Reports.
  r = await call('POST', `/reviews/${reviewId}/reports`, undefined, {
    category: 'spam',
  });
  assert.equal(r.status, 401);
  r = await call('POST', `/reviews/${reviewId}/reports`, tokenA, {
    category: 'spam',
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, 'own_review');
  r = await call('POST', `/reviews/${reviewId}/reports`, tokenB, {
    category: 'bogus',
  });
  assert.equal(r.status, 400);
  r = await call('POST', `/reviews/${reviewId}/reports`, tokenB, {
    category: 'other',
    note: 'y'.repeat(501),
  });
  assert.equal(r.status, 400);
  r = await call('POST', `/reviews/${reviewId}/reports`, tokenB, {});
  assert.equal(r.status, 400);
  r = await call('POST', `/reviews/${oid()}/reports`, tokenB, {
    category: 'spam',
  });
  assert.equal(r.status, 404);
  r = await call('POST', `/reviews/${reviewId}/reports`, tokenB, {
    category: 'offensive',
    note: '  rude  ',
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { reported: true });
  r = await call('POST', `/reviews/${reviewId}/reports`, tokenB, {
    category: 'spam',
    note: 'changed',
  });
  assert.equal(r.status, 200);
  const reportDocs = await db
    .collection('reviewreports')
    .find({ reviewId: new mongoose.Types.ObjectId(reviewId) })
    .toArray();
  assert.equal(reportDocs.length, 1);
  assert.equal(reportDocs[0]!.category, 'offensive');
  assert.equal(reportDocs[0]!.note, 'rude');
  assert.equal(String(reportDocs[0]!.reporterId), buyerB.toString());
  // Producer may also report.
  r = await call('POST', `/reviews/${reviewId}/reports`, tokenP, {
    category: 'false_information',
  });
  assert.equal(r.status, 200);
  assert.equal(
    await db
      .collection('reviewreports')
      .countDocuments({ reviewId: new mongoose.Types.ObjectId(reviewId) }),
    2,
  );
  ok(
    'reports: 401, own review 403, invalid 400, missing 404, duplicate idempotent (1 report, first kept), producer can report',
  );

  // Hidden.
  await db
    .collection('reviews')
    .updateOne(
      { _id: new mongoose.Types.ObjectId(reviewBId) },
      { $set: { visibility: 'hidden' } },
    );
  r = await call('GET', `/producers/${producerId}/reviews`);
  assert.equal(r.json.total, 3);
  assert.equal(r.json.summary.ratingCount, 3);
  assert.equal(
    r.json.summary.averageRating,
    Math.round(((5 + 3 + winner) / 3) * 10) / 10,
  );
  assert(!r.json.items.some((i: Item) => i.id === reviewBId));
  r = await call('POST', `/reviews/${reviewBId}/reports`, tokenA, {
    category: 'spam',
  });
  assert.equal(r.status, 404);
  ok('hidden review absent from list and summary; reporting it -> 404');

  // Privacy: no identifiers in public response.
  r = await call('GET', `/producers/${producerId}/reviews?limit=50`);
  const forbidden = [
    buyerA.toString(),
    buyerB.toString(),
    delivered,
    collectedAuction,
    concurrent,
    bOrder,
    `${tag}-a@example.test`,
    'example.test',
    'Smith',
    'Harvest Smith',
    'rude',
    'authorId',
    'orderId',
    'reporter',
  ];
  for (const needle of forbidden) {
    assert(!r.text.includes(needle), `public response leaks ${needle}`);
  }
  ok(
    'public response contains no buyer ids/emails/full names/order ids/reporter data',
  );
  console.log(`\nAll ${results.length} groups passed`);
} finally {
  const orders = orderIds;
  const reviewDocs = await db
    .collection('reviews')
    .find({ orderId: { $in: orders } }, { projection: { _id: 1 } })
    .toArray();
  const reviewIds = reviewDocs.map((d) => d._id);
  await db
    .collection('reviewreports')
    .deleteMany({ reviewId: { $in: reviewIds } });
  await db.collection('reviews').deleteMany({ _id: { $in: reviewIds } });
  await db.collection('orders').deleteMany({ _id: { $in: orders } });
  await db.collection('users').deleteMany({
    _id: { $in: [producerId, otherProducerId, buyerA, buyerB] },
  });
  // Sessions/refresh records created by login for these users.
  await db
    .collection('sessions')
    .deleteMany({ userId: { $in: [producerId, buyerA, buyerB] } })
    .catch(() => undefined);
  await db.close();
}
