import { writeFile } from 'node:fs/promises';
import mongoose from '../../apps/api/node_modules/mongoose/index.js';
import bcrypt from '../../apps/api/node_modules/bcryptjs/index.js';

const db = await mongoose
  .createConnection(process.env.MONGODB_URI!)
  .asPromise();
const oid = () => new mongoose.Types.ObjectId();
const now = new Date();
const password = `Review-${crypto.randomUUID()}!`;
const tag = `ticket032-${oid()}`;
const passwordHash = await bcrypt.hash(password, 10);

function user(
  _id: mongoose.Types.ObjectId,
  name: string,
  email: string,
  role: 'buyer' | 'producer',
  farmName?: string,
) {
  return {
    _id,
    name,
    email,
    passwordHash,
    role,
    producerStatus: role === 'producer' ? 'approved' : null,
    ...(role === 'producer'
      ? {
          producerApplication: {
            farmName,
            description: 'Fixture farm for review screens.',
            city: 'Coimbra',
            collectionAddress: '1 Fixture Lane',
            latitude: 40.2,
            longitude: -8.4,
            submittedAt: now,
          },
          producerDecisionAt: now,
          producerDecisionRevision: 1,
        }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}

const producerId = oid();
const emptyProducerId = oid();
const buyerId = oid();
const reporterId = oid();
const emails = {
  producer: `${tag}-producer@example.test`,
  emptyProducer: `${tag}-empty@example.test`,
  buyer: `${tag}-buyer@example.test`,
  reporter: `${tag}-reporter@example.test`,
};
await db
  .collection('users')
  .insertMany([
    user(
      producerId,
      'Willow Grower',
      emails.producer,
      'producer',
      'Willow Orchard',
    ),
    user(
      emptyProducerId,
      'Quiet Grower',
      emails.emptyProducer,
      'producer',
      'Quiet Meadow',
    ),
    user(buyerId, 'Alice Harvest', emails.buyer, 'buyer'),
    user(reporterId, 'Rita Reporter', emails.reporter, 'buyer'),
  ]);

const productId = oid();
await db.collection('products').insertOne({
  _id: productId,
  producerId,
  name: 'Autumn apple box',
  description: 'A box of freshly picked orchard apples.',
  category: 'fruits',
  productionMethod: 'organic',
  seasons: ['autumn'],
  unit: 'box',
  priceCents: 650,
  availableStock: 40,
  reservedStock: 0,
  lowStockThreshold: 5,
  published: true,
  archivedAt: null,
  moderatedAt: null,
  image: null,
  revision: 1,
  createdAt: now,
  updatedAt: now,
});

const lines = [
  {
    productId,
    productName: 'Autumn apple box',
    productUnit: 'box',
    quantity: 2,
    unitPriceCents: 650,
    lineTotalCents: 1300,
  },
  {
    productId: oid(),
    productName: 'Wildflower honey',
    productUnit: 'jar',
    quantity: 1,
    unitPriceCents: 850,
    lineTotalCents: 850,
  },
];
const subtotalCents = 2150;
const deliveryFeeCents = 350;
const steps: Record<string, string[]> = {
  delivery: ['pending', 'confirmed', 'shipped', 'delivered'],
  collection: ['pending', 'confirmed', 'ready_for_collection', 'collected'],
};

async function order(
  buyer: mongoose.Types.ObjectId,
  producer: mongoose.Types.ObjectId,
  status: string,
  method = 'delivery',
) {
  const _id = oid();
  const reached = steps[method].slice(0, steps[method].indexOf(status) + 1);
  const placed = now.getTime() - 5 * 86400000;
  const fee = method === 'delivery' ? deliveryFeeCents : 0;
  await db.collection('orders').insertOne({
    _id,
    checkoutId: null,
    auctionId: null,
    buyerId: buyer,
    producerId: producer,
    paymentId: oid(),
    items: lines,
    fulfilmentMethod: method,
    deliveryAddress:
      method === 'delivery'
        ? {
            recipientName: 'Alice Harvest',
            street: '24 Orchard Street',
            city: 'Coimbra',
            postalCode: '3000-123',
            country: 'Portugal',
            notes: 'Leave with the neighbour if out.',
          }
        : null,
    subtotalCents,
    deliveryFeeCents: fee,
    totalCents: subtotalCents + fee,
    status,
    statusHistory: reached.map((step, index) => ({
      status: step,
      timestamp: new Date(placed + index * 86400000),
      actorId: index === 0 ? buyer : producer,
      actorRole: index === 0 ? 'buyer' : 'producer',
      note: null,
    })),
    origin: 'catalogue',
    revision: reached.length,
    refundRequest: null,
    createdAt: new Date(placed),
    updatedAt: now,
  });
  return _id;
}

const longComment =
  'We have bought from this farm every week since spring. The tomatoes arrive still warm from the sun, the eggs are consistently excellent, and the packaging is minimal and reusable. ' +
  'Delivery was on time even during the storm last Tuesday, and the driver took the time to carry everything to the door. '.repeat(
    2,
  ) +
  'Would happily recommend to anyone who cares where their food comes from.';
const comments: (string | null)[] = [
  'Sweet apples, great service.',
  longComment,
  '<b>html</b> should stay as plain text <script>alert(1)</script>',
  null,
  'Honey was lovely.\nSecond line of the comment.',
  'Good value.',
  null,
  'A bit late but worth the wait.',
  longComment,
  'Fresh and well packed.',
  'Nice people.',
  'Perfect.',
];
const ratings = [5, 4, 5, 4, 5, 3, 4, 5, 4, 5, 4, 3];
const names = [
  'Maria',
  'João',
  'Ana',
  'Pedro',
  'Inês',
  'Rui',
  'Sofia',
  'Tiago',
  'Carla',
  'Nuno',
  'Marta',
  'Diogo',
];
for (let i = 0; i < 12; i++) {
  const author = oid();
  await db
    .collection('users')
    .insertOne(
      user(author, `${names[i]} Fixture`, `${tag}-r${i}@example.test`, 'buyer'),
    );
  await db.collection('reviews').insertOne({
    _id: oid(),
    authorId: author,
    orderId: await order(author, producerId, 'delivered'),
    producerId,
    rating: ratings[i],
    comment: comments[i],
    visibility: 'visible',
    createdAt: new Date(now.getTime() - i * 86400000),
    updatedAt: now,
  });
}
await db.collection('reviews').insertOne({
  _id: oid(),
  authorId: reporterId,
  orderId: await order(reporterId, producerId, 'delivered'),
  producerId,
  rating: 1,
  comment: 'This hidden review must never appear.',
  visibility: 'hidden',
  createdAt: now,
  updatedAt: now,
});

const fixture = {
  password,
  emails,
  producerId: producerId.toString(),
  emptyProducerId: emptyProducerId.toString(),
  deliveredOrderId: (await order(buyerId, producerId, 'delivered')).toString(),
  collectedOrderId: (
    await order(buyerId, producerId, 'collected', 'collection')
  ).toString(),
  pendingOrderId: (await order(buyerId, producerId, 'pending')).toString(),
  extraDeliveredOrderId: (
    await order(buyerId, producerId, 'delivered')
  ).toString(),
};
await writeFile(
  'demos/ticket-032-review/fixture.json',
  JSON.stringify(fixture, null, 2),
);
console.log('fixture written', { ...fixture, password: '(hidden)' });
await db.close();
