import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import mongoose, { Types } from 'mongoose';

/**
 * Larger local demo catalogue layered on top of the ticket-044 fixture.
 * It owns its own namespace and manifest, so it can be created and removed
 * without touching the core fixture records.
 */
export const CATALOGUE_NAMESPACE = 'dwc-local-demo-catalogue-v1';
const MANIFEST_COLLECTION = '_dwc_fixture_ownership';
const EMAIL_DOMAIN = 'demo.dwclocal.invalid';
const IMAGE_DIR = resolve(process.cwd(), 'fixtures/images');
const IMAGE_WIDTH = 900;
const IMAGE_HEIGHT = 675;
const DAY = 24 * 60 * 60_000;
/** Farm whose producer account carries the long sales history for demos. */
const SHOWCASE_FARM = 'hillside';
const SHOWCASE_ORDER_COUNT = 140;
/** How long the showcase auctions stay live after seeding. */
const SHOWCASE_AUCTION_DAYS = 3;

type Collection =
  | 'users'
  | 'products'
  | 'paymentmethods'
  | 'payments'
  | 'checkouts'
  | 'orders'
  | 'auctions'
  | 'auctionbids'
  | 'reviews';
const COLLECTIONS: Collection[] = [
  'users',
  'products',
  'paymentmethods',
  'payments',
  'checkouts',
  'orders',
  'auctions',
  'auctionbids',
  'reviews',
];
const DELETE_ORDER: Collection[] = [
  'reviews',
  'orders',
  'checkouts',
  'payments',
  'auctionbids',
  'auctions',
  'products',
  'paymentmethods',
  'users',
];

interface CatalogueManifest {
  _id: string;
  namespace: string;
  version: 1;
  collections: Partial<Record<Collection, string[]>>;
  imageKeys: string[];
  createdAt: Date;
}

type Row = Record<string, unknown> & { _id: Types.ObjectId };

const oid = (name: string) =>
  new Types.ObjectId(
    createHash('sha256')
      .update(`${CATALOGUE_NAMESPACE}/${name}`)
      .digest('hex')
      .slice(0, 24),
  );

/** Small deterministic PRNG so the generated history is stable per run. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

interface Farm {
  key: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
}

const FARMS: Farm[] = [
  {
    key: 'hillside',
    name: 'Hillside Market Garden',
    city: 'Bath',
    address: '3 Combe Lane, Bath, BA2 5AA',
    latitude: 51.3781,
    longitude: -2.3597,
    description:
      'A family market garden growing seasonal vegetables on the slopes above Bath, picked the morning they are sold.',
  },
  {
    key: 'avon_valley',
    name: 'Avon Valley Fruit',
    city: 'Keynsham',
    address: 'Orchard Barn, Keynsham, BS31 1BB',
    latitude: 51.4135,
    longitude: -2.4966,
    description:
      'Traditional orchards and soft-fruit polytunnels along the River Avon, pressing our own juice every autumn.',
  },
  {
    key: 'mendip_dairy',
    name: 'Mendip Dairy',
    city: 'Wells',
    address: 'Priddy Road, Wells, BA5 3CC',
    latitude: 51.2094,
    longitude: -2.6474,
    description:
      'A grass-fed herd on the Mendip Hills. Milk, cheese and yoghurt made in our own dairy.',
  },
  {
    key: 'stoke_lane',
    name: 'Stoke Lane Bakery',
    city: 'Bristol',
    address: '18 Stoke Lane, Bristol, BS9 3DD',
    latitude: 51.4862,
    longitude: -2.6201,
    description:
      'Slow-fermented bread and pastries baked overnight with flour from local mills.',
  },
  {
    key: 'cotswold_pasture',
    name: 'Cotswold Pasture Farm',
    city: 'Stroud',
    address: 'Bisley Road, Stroud, GL6 7EE',
    latitude: 51.7446,
    longitude: -2.2152,
    description:
      'Pasture-raised lamb, beef, pork and poultry, butchered on site and sold direct.',
  },
  {
    key: 'chew_valley',
    name: 'Chew Valley Pantry',
    city: 'Chew Magna',
    address: 'Mill House, Chew Magna, BS40 8FF',
    latitude: 51.3657,
    longitude: -2.6094,
    description:
      'Honey from our own hives, cold-pressed oil and small-batch preserves from the Chew Valley.',
  },
  {
    key: 'frome_cider',
    name: 'Frome Cider & Flowers',
    city: 'Frome',
    address: 'Vallis Farm, Frome, BA11 3GG',
    latitude: 51.2287,
    longitude: -2.3215,
    description:
      'Farmhouse cider, cordials and cut flowers from a mixed smallholding outside Frome.',
  },
];

interface CatalogueProduct {
  image: string;
  farm: string;
  name: string;
  description: string;
  category: string;
  method: string;
  seasons: string[];
  priceCents: number;
  unit: string;
  stock: number;
  lowStock: number;
  /** Unsplash photo id; see fixtures/CREDITS.md. */
  photo: string;
}

const p = (
  image: string,
  farm: string,
  name: string,
  description: string,
  category: string,
  method: string,
  seasons: string[],
  priceCents: number,
  unit: string,
  stock: number,
  lowStock: number,
  photo: string,
): CatalogueProduct => ({
  image,
  farm,
  name,
  description,
  category,
  method,
  seasons,
  priceCents,
  unit,
  stock,
  lowStock,
  photo,
});

const YR = ['year_round'];
export const CATALOGUE_PRODUCTS: CatalogueProduct[] = [
  p(
    'heritage_carrots',
    'hillside',
    'Heritage Carrots',
    'Mixed bunch of orange, purple and yellow carrots with their tops on.',
    'vegetables',
    'organic',
    ['summer', 'autumn'],
    250,
    'bunch',
    30,
    5,
    'IZq1FV87qpM',
  ),
  p(
    'vine_tomatoes',
    'hillside',
    'Vine Tomatoes',
    'Sweet tomatoes ripened on the vine in an unheated greenhouse.',
    'vegetables',
    'organic',
    ['summer'],
    380,
    'g_500',
    24,
    5,
    '2iU0MzpJIZA',
  ),
  p(
    'new_potatoes',
    'hillside',
    'New Potatoes',
    'Waxy early potatoes, lifted by hand and sold unwashed.',
    'vegetables',
    'sustainable',
    ['spring', 'summer'],
    320,
    'kg',
    40,
    8,
    'O9p8KIv39gA',
  ),
  p(
    'kale',
    'hillside',
    'Curly Kale',
    'Crisp curly kale, picked young for salads or quick cooking.',
    'vegetables',
    'organic',
    ['autumn', 'winter'],
    220,
    'bag',
    18,
    4,
    'w46WZBxI_uk',
  ),
  p(
    'courgettes',
    'hillside',
    'Courgettes',
    'Firm green courgettes picked small for the best flavour.',
    'vegetables',
    'organic',
    ['summer'],
    290,
    'kg',
    3,
    4,
    'ttyJGdk2kmU',
  ),
  p(
    'red_onions',
    'hillside',
    'Red Onions',
    'Sweet, mild red onions dried and cured on the farm.',
    'vegetables',
    'conventional',
    YR,
    180,
    'kg',
    50,
    10,
    'SSIwIRCu7bM',
  ),
  p(
    'beetroot',
    'hillside',
    'Beetroot',
    'Earthy beetroot, sold with leaves when in season.',
    'vegetables',
    'organic',
    ['summer', 'autumn', 'winter'],
    240,
    'bunch',
    22,
    5,
    'v-8GWPhPQfI',
  ),
  p(
    'leeks',
    'hillside',
    'Leeks',
    'Long white leeks for soups and winter cooking.',
    'vegetables',
    'sustainable',
    ['autumn', 'winter'],
    260,
    'bunch',
    16,
    4,
    '7CcXR5wIhEY',
  ),
  p(
    'butternut_squash',
    'hillside',
    'Butternut Squash',
    'Dense, sweet squash cured for keeping through winter.',
    'vegetables',
    'organic',
    ['autumn', 'winter'],
    200,
    'unit',
    35,
    6,
    'RB88SaWi0qc',
  ),
  p(
    'salad_leaves',
    'hillside',
    'Butterhead Lettuce',
    'Soft-leaved butterhead lettuce cut the same morning.',
    'vegetables',
    'organic',
    ['spring', 'summer'],
    150,
    'unit',
    0,
    4,
    '5MU_4hPl67Y',
  ),
  p(
    'asparagus',
    'hillside',
    'English Asparagus',
    'Tender green spears from a short spring season.',
    'vegetables',
    'sustainable',
    ['spring'],
    450,
    'bunch',
    12,
    3,
    'ybvFj-HdCwY',
  ),
  p(
    'sweetcorn',
    'hillside',
    'Sweetcorn',
    'Sweetcorn cobs picked and sold within a day.',
    'vegetables',
    'conventional',
    ['summer', 'autumn'],
    90,
    'unit',
    60,
    10,
    'HE_MjmWh9eQ',
  ),
  p(
    'bramley_apples',
    'avon_valley',
    'Orchard Apples',
    'Crisp eating apples from standard trees in our old orchard.',
    'fruits',
    'sustainable',
    ['autumn', 'winter'],
    280,
    'kg',
    45,
    8,
    'xYWFcQVbSFE',
  ),
  p(
    'conference_pears',
    'avon_valley',
    'Conference Pears',
    'Juicy Conference pears, ripen on the windowsill.',
    'fruits',
    'sustainable',
    ['autumn'],
    300,
    'kg',
    25,
    5,
    'RW6Wz9QaoKk',
  ),
  p(
    'strawberries',
    'avon_valley',
    'Strawberries',
    'Sweet, deep-red strawberries picked at first light.',
    'fruits',
    'conventional',
    ['summer'],
    450,
    'g_500',
    20,
    5,
    'GaE4GzIjAlY',
  ),
  p(
    'raspberries',
    'avon_valley',
    'Raspberries',
    'Delicate summer raspberries in compostable punnets.',
    'fruits',
    'organic',
    ['summer'],
    400,
    'g_250',
    14,
    4,
    'gQyTxSrctvw',
  ),
  p(
    'blackberries',
    'avon_valley',
    'Blackberries',
    'Thornless blackberries from hedgerow-trained canes.',
    'fruits',
    'organic',
    ['summer', 'autumn'],
    350,
    'g_250',
    2,
    3,
    'n82i__VV8ps',
  ),
  p(
    'plums',
    'avon_valley',
    'Victoria Plums',
    'Classic Victoria plums for eating fresh or baking.',
    'fruits',
    'sustainable',
    ['summer', 'autumn'],
    320,
    'kg',
    18,
    4,
    'vKJS93Y6zbI',
  ),
  p(
    'rhubarb',
    'avon_valley',
    'Forced Rhubarb',
    'Pink, tender stems for crumbles and compotes.',
    'fruits',
    'conventional',
    ['winter', 'spring'],
    280,
    'bunch',
    10,
    3,
    'hEquyvpEsWQ',
  ),
  p(
    'apple_juice',
    'avon_valley',
    'Pressed Apple Juice',
    'Cloudy juice pressed from our own apples, nothing added.',
    'beverages',
    'sustainable',
    YR,
    450,
    'bottle',
    40,
    8,
    '5aOzeDw_hcc',
  ),
  p(
    'whole_milk',
    'mendip_dairy',
    'Whole Milk',
    'Pasteurised, non-homogenised whole milk from grass-fed cows.',
    'dairy',
    'organic',
    YR,
    140,
    'l',
    50,
    10,
    '4PhVsBICtJQ',
  ),
  p(
    'farmhouse_cheddar',
    'mendip_dairy',
    'Farmhouse Cheddar',
    'Cloth-bound cheddar matured for twelve months.',
    'dairy',
    'artisanal',
    YR,
    650,
    'g_250',
    30,
    6,
    'JJcT6VJWDlg',
  ),
  p(
    'greek_yoghurt',
    'mendip_dairy',
    'Strained Yoghurt',
    'Thick, strained yoghurt made from our whole milk.',
    'dairy',
    'organic',
    YR,
    320,
    'g_500',
    20,
    5,
    'z71M3cfW40c',
  ),
  p(
    'sourdough',
    'stoke_lane',
    'Country Sourdough',
    'A 36-hour fermented loaf with a dark, crackling crust.',
    'bakery',
    'artisanal',
    YR,
    480,
    'unit',
    24,
    5,
    'H_PXix_4Bwc',
  ),
  p(
    'seeded_loaf',
    'stoke_lane',
    'Seeded Rye Loaf',
    'Rye and wheat loaf packed with sunflower and pumpkin seeds.',
    'bakery',
    'artisanal',
    YR,
    520,
    'unit',
    18,
    4,
    'rsWZ-P9FbQ4',
  ),
  p(
    'croissants',
    'stoke_lane',
    'Butter Croissants',
    'Laminated by hand with cultured butter. Box of four.',
    'bakery',
    'artisanal',
    YR,
    900,
    'box',
    12,
    3,
    'yOnOXMYpMoQ',
  ),
  p(
    'scones',
    'stoke_lane',
    'Cranberry Scones',
    'Crumbly scones with cranberries. Box of four.',
    'bakery',
    'artisanal',
    YR,
    650,
    'box',
    15,
    3,
    'hEbGdDt06U8',
  ),
  p(
    'focaccia',
    'stoke_lane',
    'Rosemary Focaccia',
    'Olive-oil focaccia topped with rosemary and sea salt.',
    'bakery',
    'artisanal',
    YR,
    550,
    'unit',
    10,
    3,
    'NZ8UM4NCkbQ',
  ),
  p(
    'lamb_steaks',
    'cotswold_pasture',
    'Lamb Leg Steaks',
    'Pasture-raised lamb, dry-aged for seven days.',
    'meat',
    'sustainable',
    ['spring', 'summer', 'autumn'],
    1200,
    'g_500',
    16,
    4,
    'cvj-7TZjvA0',
  ),
  p(
    'ribeye_steaks',
    'cotswold_pasture',
    'Ribeye Steaks',
    'Grass-fed beef ribeye, dry-aged for 28 days. Pack of two.',
    'meat',
    'sustainable',
    YR,
    1800,
    'box',
    10,
    3,
    'E5GBbE74cLc',
  ),
  p(
    'pork_sausages',
    'cotswold_pasture',
    'Pork Sausages',
    'Coarse outdoor-reared pork sausages with sage. Pack of six.',
    'meat',
    'sustainable',
    YR,
    600,
    'box',
    25,
    5,
    'YlAmh_X_SsE',
  ),
  p(
    'whole_chicken',
    'cotswold_pasture',
    'Free-range Chicken',
    'Slow-grown free-range whole chicken, around 1.8 kg.',
    'meat',
    'organic',
    YR,
    1400,
    'unit',
    8,
    3,
    'T4QUfXJNwZc',
  ),
  p(
    'smoked_bacon',
    'cotswold_pasture',
    'Smoked Streaky Bacon',
    'Dry-cured and smoked over beech on the farm.',
    'meat',
    'artisanal',
    YR,
    550,
    'g_250',
    20,
    5,
    '7oBtznwaP6o',
  ),
  p(
    'duck_eggs',
    'cotswold_pasture',
    'Duck Eggs',
    'Rich duck eggs from our free-ranging flock. Box of six.',
    'eggs',
    'sustainable',
    ['spring', 'summer'],
    420,
    'box',
    14,
    4,
    '8dWfCsb_Eo4',
  ),
  p(
    'quail_eggs',
    'cotswold_pasture',
    'Quail Eggs',
    'Speckled quail eggs. Box of twelve.',
    'eggs',
    'sustainable',
    YR,
    380,
    'box',
    9,
    3,
    'vlXj7z9nhkE',
  ),
  p(
    'wildflower_honey',
    'chew_valley',
    'Wildflower Honey',
    'Raw honey from hives among meadows and hedgerows.',
    'pantry',
    'artisanal',
    YR,
    850,
    'jar',
    30,
    6,
    'Rcj302Npzis',
  ),
  p(
    'chutney',
    'chew_valley',
    'Fruit Chutney',
    'Slow-cooked fruit chutney, good with cheese.',
    'pantry',
    'artisanal',
    ['autumn', 'winter'],
    480,
    'jar',
    22,
    5,
    'HNpRl_jxNM8',
  ),
  p(
    'rapeseed_oil',
    'chew_valley',
    'Cold-pressed Rapeseed Oil',
    'Golden oil pressed from rapeseed grown on the farm.',
    'pantry',
    'sustainable',
    YR,
    700,
    'ml_500',
    28,
    5,
    'W1OjZrc7XAo',
  ),
  p(
    'porridge_oats',
    'chew_valley',
    'Porridge Oats',
    'Rolled jumbo oats from a neighbouring mill.',
    'pantry',
    'organic',
    YR,
    380,
    'kg',
    35,
    6,
    'r1VY6AeI7bY',
  ),
  p(
    'pickles',
    'chew_valley',
    'Pickled Vegetables',
    'Garlic and green vegetables pickled in cider vinegar.',
    'pantry',
    'artisanal',
    YR,
    520,
    'jar',
    16,
    4,
    'Cac5P_x4jaI',
  ),
  p(
    'beeswax_candles',
    'chew_valley',
    'Beeswax Candles',
    'Hand-dipped candles from our own beeswax. Pair.',
    'other',
    'artisanal',
    YR,
    900,
    'box',
    12,
    3,
    'vVizq_1y5Jo',
  ),
  p(
    'cider',
    'frome_cider',
    'Farmhouse Cider',
    'Dry, still cider from traditional cider apples.',
    'beverages',
    'artisanal',
    YR,
    550,
    'bottle',
    36,
    6,
    'L4KR3M8Hb14',
  ),
  p(
    'elderflower_cordial',
    'frome_cider',
    'Elderflower Cordial',
    'Made from elderflowers picked in early summer.',
    'beverages',
    'artisanal',
    YR,
    600,
    'bottle',
    20,
    4,
    '3y-lli--lik',
  ),
  p(
    'herbal_tea',
    'frome_cider',
    'Garden Herbal Tea',
    'Loose-leaf blend of mint, lemon balm and chamomile.',
    'beverages',
    'organic',
    YR,
    650,
    'g_250',
    18,
    4,
    'L82-kkEBOd0',
  ),
  p(
    'cut_flowers',
    'frome_cider',
    'Seasonal Flower Bunch',
    'A hand-tied bunch of whatever is flowering this week.',
    'other',
    'sustainable',
    ['spring', 'summer', 'autumn'],
    1500,
    'bunch',
    8,
    2,
    '74QmIJDTD-c',
  ),
  p(
    'herb_pots',
    'frome_cider',
    'Potted Herbs',
    'Peat-free potted herbs ready for the windowsill.',
    'other',
    'organic',
    ['spring', 'summer'],
    350,
    'unit',
    25,
    5,
    'IRrUkB8Fq-0',
  ),
  p(
    'mushrooms',
    'frome_cider',
    'Oyster Mushrooms',
    'Grown on spent coffee grounds in our barn.',
    'vegetables',
    'sustainable',
    YR,
    450,
    'g_250',
    11,
    3,
    'OV0tdYvMAlg',
  ),
];

/** Images for the three ticket-044 core products. */
export const CORE_PRODUCT_IMAGES = {
  product_veg: 'market_vegetables',
  product_eggs: 'free_range_eggs',
  product_jam: 'orchard_jam',
} as const;

const BUYERS = [
  ['buyer_sam', 'Sam Okafor'],
  ['buyer_priya', 'Priya Shah'],
  ['buyer_tom', 'Tom Hughes'],
  ['buyer_lena', 'Lena Novak'],
  ['buyer_jamie', 'Jamie Clarke'],
  ['buyer_rosa', 'Rosa Martins'],
] as const;

function s3(): { client: S3Client; bucket: string } {
  const env = (name: string) => {
    const value = process.env[name];
    if (!value)
      throw new Error(`${name} is required to upload fixture images.`);
    return value;
  };
  return {
    bucket: env('S3_BUCKET'),
    client: new S3Client({
      endpoint: env('S3_ENDPOINT'),
      region: env('S3_REGION'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: env('S3_ACCESS_KEY_ID'),
        secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
      },
    }),
  };
}

export function fixtureImageKey(
  producerId: Types.ObjectId,
  productId: Types.ObjectId,
): string {
  return `products/${producerId.toString()}/${productId.toString()}/fixture.jpg`;
}

/** Builds product image metadata from the committed JPEG. */
export async function fixtureImage(
  image: string,
  producerId: Types.ObjectId,
  productId: Types.ObjectId,
  uploadedAt: Date,
) {
  const { size } = await stat(resolve(IMAGE_DIR, `${image}.jpg`));
  return {
    objectKey: fixtureImageKey(producerId, productId),
    mimeType: 'image/jpeg',
    sizeBytes: size,
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    uploadedAt,
  };
}

export async function uploadFixtureImages(
  images: { image: string; objectKey: string }[],
): Promise<void> {
  const { client, bucket } = s3();
  try {
    for (const { image, objectKey } of images) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: await readFile(resolve(IMAGE_DIR, `${image}.jpg`)),
          ContentType: 'image/jpeg',
        }),
      );
    }
  } finally {
    client.destroy();
  }
}

export async function deleteFixtureImages(keys: string[]): Promise<void> {
  const fixtureKeys = keys.filter((key) => key.endsWith('/fixture.jpg'));
  if (!fixtureKeys.length) return;
  const { client, bucket } = s3();
  try {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: fixtureKeys.map((Key) => ({ Key })) },
      }),
    );
  } finally {
    client.destroy();
  }
}

interface BuildContext {
  now: Date;
  passwordHash: string;
}

async function build(context: BuildContext) {
  const { now, passwordHash } = context;
  const ago = (days: number, hours = 0) =>
    new Date(now.getTime() - days * DAY - hours * 60 * 60_000);
  const rand = random(44);
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(rand() * items.length)]!;

  const farmIds = new Map(
    FARMS.map((farm) => [farm.key, oid(`farm_${farm.key}`)]),
  );
  const farmNames = new Map(FARMS.map((farm) => [farm.key, farm.name]));

  const baseUser = (createdAt: Date) => ({
    passwordHash,
    producerRejectionReason: null,
    producerSuspensionReason: null,
    auctionEligibilityRevision: 0,
    producerDecisionBy: null,
    buyerStatus: 'active',
    buyerSuspensionReason: null,
    buyerDecisionRevision: 0,
    buyerEligibilityRevision: 0,
    buyerDecisionBy: null,
    buyerDecisionAt: null,
    createdAt,
    updatedAt: createdAt,
  });

  const users: Row[] = [
    ...FARMS.map((farm, index) => {
      const createdAt = ago(120 - index * 3);
      return {
        _id: farmIds.get(farm.key)!,
        name: farm.name,
        email: `${farm.key.replaceAll('_', '.')}@${EMAIL_DOMAIN}`,
        role: 'producer',
        producerStatus: 'approved',
        producerApplication: {
          farmName: farm.name,
          description: farm.description,
          city: farm.city,
          collectionAddress: farm.address,
          latitude: farm.latitude,
          longitude: farm.longitude,
          submittedAt: createdAt,
        },
        producerDecisionRevision: 1,
        producerDecisionAt: new Date(createdAt.getTime() + DAY),
        ...baseUser(createdAt),
      };
    }),
    ...BUYERS.map(([key, name], index) => ({
      _id: oid(key),
      name,
      email: `${key.replaceAll('_', '.')}@${EMAIL_DOMAIN}`,
      role: 'buyer',
      producerStatus: null,
      producerApplication: null,
      producerDecisionRevision: 0,
      producerDecisionAt: null,
      ...baseUser(ago(100 - index * 4)),
    })),
  ];

  const buyers = BUYERS.map(([key, name]) => ({
    id: oid(key),
    name,
    method: oid(`method_${key}`),
  }));
  const paymentmethods: Row[] = buyers.map((buyer, index) => ({
    _id: buyer.method,
    ownerId: buyer.id,
    last4: '4242',
    expiryMonth: ((index * 5) % 12) + 1,
    expiryYear: 2030 + index,
    createdAt: ago(90),
    updatedAt: ago(90),
  }));
  const methodSnapshot = (index: number) => ({
    last4: '4242',
    expiryMonth: ((index * 5) % 12) + 1,
    expiryYear: 2030 + index,
  });

  const products: Row[] = [];
  const images: { image: string; objectKey: string }[] = [];
  for (const [index, item] of CATALOGUE_PRODUCTS.entries()) {
    const _id = oid(`product_${item.image}`);
    const producerId = farmIds.get(item.farm)!;
    const createdAt = ago(110 - index);
    const image = await fixtureImage(item.image, producerId, _id, createdAt);
    images.push({ image: item.image, objectKey: image.objectKey });
    products.push({
      _id,
      producerId,
      name: item.name,
      description: item.description,
      category: item.category,
      productionMethod: item.method,
      seasons: item.seasons,
      priceCents: item.priceCents,
      unit: item.unit,
      availableStock: item.stock,
      reservedStock: 0,
      lowStockThreshold: item.lowStock,
      published: true,
      archivedAt: null,
      moderatedAt: null,
      moderationReason: null,
      moderatedBy: null,
      image,
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    });
  }
  const productsByFarm = new Map<string, CatalogueProduct[]>();
  for (const item of CATALOGUE_PRODUCTS)
    productsByFarm.set(item.farm, [
      ...(productsByFarm.get(item.farm) ?? []),
      item,
    ]);

  const address = (name: string, index: number) => ({
    recipientName: name,
    street: `${10 + index * 7} ${pick(['High Street', 'Mill Road', 'Church Lane', 'Park Avenue', 'Station Road'])}`,
    city: pick(['Bristol', 'Bath', 'Wells', 'Frome']),
    postalCode: `BS${1 + (index % 9)} ${index % 10}AB`,
    country: 'United Kingdom',
  });

  const payments: Row[] = [];
  const checkouts: Row[] = [];
  const orders: Row[] = [];
  const reviews: Row[] = [];
  const REVIEW_TEXT = [
    'Beautiful quality and very fresh. Will order again.',
    'Exactly as described, packed carefully.',
    'Lovely produce, friendly collection.',
    'Great flavour, a real step up from the supermarket.',
    'Arrived quickly and in perfect condition.',
    'Good value. One item was smaller than expected.',
    'The best carrots we have had in years. The kids actually ate them.',
    'Always reliable, and the weekly box is great value.',
    'Picked that morning and you can tell.',
    'Generous portions and lovely to deal with.',
  ];
  type Buyer = (typeof buyers)[number];
  type Item = {
    productId: Types.ObjectId;
    productName: string;
    productUnit: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  };
  const lineItems = (farmKey: string, maxLines: number, maxQuantity = 3) => {
    const farmProducts = productsByFarm.get(farmKey)!;
    const lineCount =
      1 + Math.floor(rand() * Math.min(maxLines, farmProducts.length));
    return [...farmProducts]
      .sort(() => rand() - 0.5)
      .slice(0, lineCount)
      .map((item) => {
        const quantity = 1 + Math.floor(rand() * maxQuantity);
        return {
          productId: oid(`product_${item.image}`),
          productName: item.name,
          productUnit: item.unit,
          quantity,
          unitPriceCents: item.priceCents,
          lineTotalCents: quantity * item.priceCents,
        };
      });
  };

  /** Adds one paid catalogue order with its checkout, payment and optional review. */
  const addOrder = (spec: {
    key: string;
    buyer: Buyer;
    farm: Farm;
    status: string;
    createdAt: Date;
    items: Item[];
    addressIndex: number;
    review: { rating: number; comment: string } | null;
    openRefundReason?: string;
  }) => {
    const { key, buyer, farm, status, createdAt, items } = spec;
    const farmId = farmIds.get(farm.key)!;
    const collection = ['collected', 'ready_for_collection'].includes(status)
      ? true
      : ['delivered', 'shipped'].includes(status)
        ? false
        : rand() < 0.5;
    const method = collection ? 'collection' : 'delivery';
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.lineTotalCents,
      0,
    );
    const deliveryFeeCents =
      method === 'delivery' && subtotalCents < 5000 ? 500 : 0;
    const totalCents = subtotalCents + deliveryFeeCents;
    const orderId = oid(`order_${key}`);
    const paymentId = oid(`payment_${key}`);
    const checkoutId = oid(`checkout_${key}`);
    const deliveryAddress =
      method === 'delivery' ? address(buyer.name, spec.addressIndex) : null;

    const path =
      status === 'cancelled'
        ? ['pending', 'cancelled']
        : method === 'delivery'
          ? ['pending', 'confirmed', 'shipped', 'delivered']
          : ['pending', 'confirmed', 'ready_for_collection', 'collected'];
    const steps = path.slice(0, path.indexOf(status) + 1);
    // Space status changes up to 18 hours apart without passing the seed time.
    const stepGap = Math.min(
      18 * 60 * 60_000,
      (now.getTime() - createdAt.getTime()) / steps.length,
    );
    const history = steps.map((step, stepIndex) => ({
      status: step,
      timestamp: new Date(createdAt.getTime() + stepIndex * stepGap),
      actorId: step === 'pending' ? buyer.id : farmId,
      actorRole: step === 'pending' ? 'buyer' : 'producer',
      note:
        step === 'cancelled' ? 'Out of stock on the day, refund issued.' : null,
    }));
    const updatedAt = history.at(-1)!.timestamp;
    const refundedCents = status === 'cancelled' ? totalCents : 0;

    payments.push({
      _id: paymentId,
      checkoutId,
      auctionId: null,
      buyerId: buyer.id,
      paymentMethodId: buyer.method,
      paymentMethodSnapshot: methodSnapshot(buyers.indexOf(buyer)),
      amountCents: totalCents,
      status: 'succeeded',
      refundedCents,
      createdAt,
      updatedAt,
    });
    checkouts.push({
      _id: checkoutId,
      buyerId: buyer.id,
      idempotencyKey: `fixture-catalogue-${checkoutId.toString()}`,
      requestPayloadHash: 'fixture-only-no-checkout-request',
      quoteFingerprint: 'fixture-only-no-live-quote',
      fulfilmentMethod: method,
      deliveryAddress,
      paymentId,
      orderIds: [orderId],
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      createdAt,
      updatedAt: createdAt,
    });
    orders.push({
      _id: orderId,
      checkoutId,
      auctionId: null,
      buyerId: buyer.id,
      buyerNameSnapshot: buyer.name,
      producerId: farmId,
      producerNameSnapshot: farm.name,
      paymentId,
      items,
      fulfilmentMethod: method,
      deliveryAddress,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      status,
      statusHistory: history,
      origin: 'catalogue',
      revision: history.length,
      refundRequest:
        status === 'cancelled'
          ? {
              status: 'accepted',
              requestedBy: buyer.id,
              requestedAt: createdAt,
              reason: 'Producer could not fulfil the order.',
              decidedBy: farmId,
              decidedAt: updatedAt,
              refundedCents,
            }
          : spec.openRefundReason
            ? {
                status: 'open',
                requestedBy: buyer.id,
                requestedAt: updatedAt,
                reason: spec.openRefundReason,
                decidedBy: null,
                decidedAt: null,
                refundedCents: null,
              }
            : null,
      createdAt,
      updatedAt,
    });
    if (spec.review && ['delivered', 'collected'].includes(status)) {
      const reviewedAt = new Date(
        Math.min(updatedAt.getTime() + DAY, now.getTime()),
      );
      reviews.push({
        _id: oid(`review_${key}`),
        authorId: buyer.id,
        orderId,
        producerId: farmId,
        rating: spec.review.rating,
        comment: spec.review.comment,
        visibility: 'visible',
        revision: 1,
        moderatedAt: null,
        moderationReason: null,
        moderatedBy: null,
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
      });
    }
  };

  // Status mix weighted towards completed orders so dashboards have history.
  const STATUSES = [
    'delivered',
    'collected',
    'delivered',
    'collected',
    'delivered',
    'collected',
    'confirmed',
    'pending',
    'shipped',
    'ready_for_collection',
    'cancelled',
    'delivered',
    'collected',
    'pending',
  ];
  const ACTIVE = ['pending', 'confirmed', 'shipped', 'ready_for_collection'];
  const ORDER_COUNT = 42;
  for (let index = 0; index < ORDER_COUNT; index += 1) {
    const status = STATUSES[index % STATUSES.length]!;
    const farm = FARMS[(index * 3) % FARMS.length]!;
    // Active orders are recent; completed ones spread across 90 days.
    const createdAt = ACTIVE.includes(status)
      ? ago(index % 4, 2 + (index % 5))
      : ago(
          3 + Math.floor((index / ORDER_COUNT) * 85) + (index % 3),
          index % 12,
        );
    addOrder({
      key: String(index),
      buyer: buyers[index % buyers.length]!,
      farm,
      status,
      createdAt,
      items: lineItems(farm.key, 3),
      addressIndex: index,
      review:
        index % 5 !== 4
          ? {
              rating: index % 7 === 3 ? 3 : index % 3 === 0 ? 4 : 5,
              comment: REVIEW_TEXT[index % 6]!,
            }
          : null,
    });
  }

  // The showcase producer gets a long, growing sales history so its
  // dashboard, order list and reviews look like an established business.
  const heroFarm = FARMS.find((farm) => farm.key === SHOWCASE_FARM)!;
  let openRefundAdded = false;
  for (let index = 0; index < SHOWCASE_ORDER_COUNT; index += 1) {
    // Skewed towards recent days so weekly sales trend upwards over 150 days.
    const days = Math.floor(150 * rand() ** 1.6);
    const status =
      days < 1
        ? pick(['pending', 'pending', 'confirmed'])
        : days < 3
          ? pick(['confirmed', 'shipped', 'ready_for_collection'])
          : rand() < 0.06
            ? 'cancelled'
            : pick(['delivered', 'collected']);
    const openRefund = status === 'pending' && !openRefundAdded;
    if (openRefund) openRefundAdded = true;
    const roll = rand();
    addOrder({
      key: `${SHOWCASE_FARM}_${index}`,
      buyer: buyers[(index * 5 + Math.floor(rand() * 3)) % buyers.length]!,
      farm: heroFarm,
      status,
      createdAt: ago(days, 1 + Math.floor(rand() * 10)),
      items: lineItems(heroFarm.key, 5, 5),
      addressIndex: ORDER_COUNT + index,
      review:
        roll < 0.65
          ? {
              rating: roll < 0.05 ? 3 : roll < 0.22 ? 4 : 5,
              comment: REVIEW_TEXT[index % REVIEW_TEXT.length]!,
            }
          : null,
      openRefundReason: openRefund
        ? 'I ordered the wrong week, could I cancel this one please?'
        : undefined,
    });
  }

  // Auctions: five upcoming, five live, five finished with paid winners, plus
  // two long-running showcase lots that stay live for parallel bidding demos.
  const auctions: Row[] = [];
  const auctionbids: Row[] = [];
  const AUCTION_LOTS: [string, number, number][] = [
    ['ribeye_steaks', 3, 2500],
    ['farmhouse_cheddar', 4, 1500],
    ['wildflower_honey', 6, 2800],
    ['cut_flowers', 2, 1800],
    ['croissants', 3, 1500],
    ['strawberries', 5, 1200],
    ['whole_chicken', 2, 2000],
    ['cider', 6, 2200],
    ['asparagus', 4, 1200],
    ['sourdough', 3, 1000],
    ['butternut_squash', 6, 900],
    ['apple_juice', 6, 1800],
    ['smoked_bacon', 4, 1600],
    ['beeswax_candles', 3, 1700],
    ['raspberries', 4, 1100],
  ];
  const lots = AUCTION_LOTS.map(
    ([image, quantity, startingPriceCents], index) => {
      const kind = index < 5 ? 'scheduled' : index < 10 ? 'active' : 'finished';
      const startsAt =
        kind === 'scheduled'
          ? new Date(now.getTime() + (index + 1) * 5 * 60 * 60_000)
          : kind === 'active'
            ? new Date(now.getTime() - (index - 4) * 20 * 60_000)
            : ago(index - 8, 4);
      const endsAt =
        kind === 'active'
          ? new Date(now.getTime() + (index - 4) * 45 * 60_000)
          : new Date(startsAt.getTime() + 2 * 60 * 60_000);
      const bidCount =
        kind === 'scheduled'
          ? 0
          : kind === 'active'
            ? index - 5
            : 2 + (index % 3);
      return {
        image,
        quantity,
        startingPriceCents,
        kind,
        startsAt,
        endsAt,
        bidCount,
      };
    },
  );
  lots.push(
    {
      image: 'heritage_carrots',
      quantity: 10,
      startingPriceCents: 1500,
      kind: 'active',
      startsAt: ago(0, 1),
      endsAt: new Date(now.getTime() + SHOWCASE_AUCTION_DAYS * DAY),
      bidCount: 2,
    },
    {
      image: 'vine_tomatoes',
      quantity: 6,
      startingPriceCents: 1200,
      kind: 'active',
      startsAt: ago(0, 1),
      endsAt: new Date(
        now.getTime() + SHOWCASE_AUCTION_DAYS * DAY + 4 * 60 * 60_000,
      ),
      bidCount: 0,
    },
  );
  for (const [
    index,
    { image, quantity, startingPriceCents, kind, startsAt, endsAt, bidCount },
  ] of lots.entries()) {
    const item = CATALOGUE_PRODUCTS.find((product) => product.image === image)!;
    const farmId = farmIds.get(item.farm)!;
    const auctionId = oid(`auction_${index}`);
    const increment = 100;
    if (kind !== 'finished') {
      // Scheduled and live lots hold their quantity as reserved stock, which
      // settlement later consumes (winner) or releases (no bids).
      const productRow = products.find((row) =>
        row._id.equals(oid(`product_${item.image}`)),
      )!;
      productRow.reservedStock = Number(productRow.reservedStock) + quantity;
    }
    let amount = startingPriceCents;
    let lastBid: {
      buyer: (typeof buyers)[number];
      at: Date;
      id: Types.ObjectId;
    } | null = null;
    for (let bid = 0; bid < bidCount; bid += 1) {
      const buyer = buyers[(index + bid * 2) % buyers.length]!;
      if (bid > 0) amount += increment * (1 + (bid % 3));
      const span =
        Math.min(endsAt.getTime(), now.getTime()) - startsAt.getTime();
      const at = new Date(
        startsAt.getTime() + ((bid + 1) / (bidCount + 1)) * span,
      );
      const bidId = oid(`bid_${index}_${bid}`);
      auctionbids.push({
        _id: bidId,
        auctionId,
        buyerId: buyer.id,
        bidderName: buyer.name,
        paymentMethodId: buyer.method,
        paymentMethodSnapshot: methodSnapshot(buyers.indexOf(buyer)),
        requestId: `0c47a100-0000-4000-8000-${String(index * 100 + bid).padStart(12, '0')}`,
        amountCents: amount,
        startingPriceCents,
        minimumIncrementCents: increment,
        acceptedAt: at,
        endsAt,
        revision: bid + 2,
        createdAt: at,
      });
      lastBid = { buyer, at, id: bidId };
    }
    const createdAt = new Date(
      Math.min(startsAt.getTime(), now.getTime()) - 2 * DAY,
    );
    auctions.push({
      _id: auctionId,
      producerId: farmId,
      productId: oid(`product_${item.image}`),
      productSnapshot: {
        name: item.name,
        description: item.description,
        category: item.category,
        productionMethod: item.method,
        seasons: item.seasons,
        unit: item.unit,
      },
      quantity,
      startingPriceCents,
      minimumIncrementCents: increment,
      startsAt,
      endsAt,
      status: kind,
      currentBidCents: lastBid ? amount : null,
      currentBidderId: lastBid?.buyer.id ?? null,
      currentBidderName: lastBid?.buyer.name ?? null,
      lastBidAt: lastBid?.at ?? null,
      revision: bidCount + 1,
      closureNotificationsPending: false,
      closureNotificationCursor: null,
      closedAt: kind === 'finished' ? endsAt : null,
      createdAt,
      updatedAt: lastBid?.at ?? createdAt,
    });
    if (kind === 'finished' && lastBid) {
      const paymentId = oid(`payment_auction_${index}`);
      const orderId = oid(`order_auction_${index}`);
      payments.push({
        _id: paymentId,
        checkoutId: null,
        auctionId,
        buyerId: lastBid.buyer.id,
        paymentMethodId: lastBid.buyer.method,
        paymentMethodSnapshot: methodSnapshot(buyers.indexOf(lastBid.buyer)),
        amountCents: amount,
        status: 'succeeded',
        refundedCents: 0,
        createdAt: endsAt,
        updatedAt: endsAt,
      });
      orders.push({
        _id: orderId,
        checkoutId: null,
        auctionId,
        buyerId: lastBid.buyer.id,
        buyerNameSnapshot: lastBid.buyer.name,
        producerId: farmId,
        producerNameSnapshot: farmNames.get(item.farm),
        paymentId,
        items: [
          {
            productId: oid(`product_${item.image}`),
            productName: `${item.name} (lot of ${quantity})`,
            productUnit: item.unit,
            quantity: 1,
            unitPriceCents: amount,
            lineTotalCents: amount,
          },
        ],
        fulfilmentMethod: 'collection',
        deliveryAddress: null,
        subtotalCents: amount,
        deliveryFeeCents: 0,
        totalCents: amount,
        status: 'confirmed',
        statusHistory: [
          {
            status: 'confirmed',
            timestamp: endsAt,
            actorId: farmId,
            actorRole: 'producer',
            note: 'Auction lot paid and confirmed automatically.',
          },
        ],
        origin: 'auction',
        revision: 1,
        refundRequest: null,
        createdAt: endsAt,
        updatedAt: endsAt,
      });
    }
  }

  const rows: Record<Collection, Row[]> = {
    users,
    products,
    paymentmethods,
    payments,
    checkouts,
    orders,
    auctions,
    auctionbids,
    reviews,
  };
  return { rows, images };
}

export async function createCatalogue(
  connection: mongoose.Connection,
  db: mongoose.mongo.Db,
  models: Record<Collection, mongoose.Model<unknown>>,
  context: BuildContext,
): Promise<void> {
  const manifests = db.collection<CatalogueManifest>(MANIFEST_COLLECTION);
  if (await manifests.findOne({ _id: CATALOGUE_NAMESPACE })) {
    console.log(
      `Fixture namespace ${CATALOGUE_NAMESPACE} already exists. No records were changed.`,
    );
    return;
  }
  const { rows, images } = await build(context);
  for (const collection of COLLECTIONS) {
    const ids = rows[collection].map((row) => row._id);
    if (
      await db
        .collection(collection)
        .findOne({ _id: { $in: ids } }, { projection: { _id: 1 } })
    )
      throw new Error(
        `A record ID in ${collection} is already in use outside ${CATALOGUE_NAMESPACE}. No catalogue records were changed.`,
      );
  }
  await uploadFixtureImages(images);
  const manifest: CatalogueManifest = {
    _id: CATALOGUE_NAMESPACE,
    namespace: CATALOGUE_NAMESPACE,
    version: 1,
    collections: Object.fromEntries(
      COLLECTIONS.map((collection) => [
        collection,
        rows[collection].map((row) => row._id.toString()),
      ]),
    ),
    imageKeys: images.map((image) => image.objectKey),
    createdAt: context.now,
  };
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      for (const collection of COLLECTIONS)
        await (
          models[collection] as unknown as mongoose.Model<
            Record<string, unknown>
          >
        ).insertMany(
          rows[collection].map((row) => ({ ...row })),
          {
            session,
            ordered: true,
          },
        );
      await manifests.insertOne(manifest, { session });
    });
  } catch (error) {
    await deleteFixtureImages(manifest.imageKeys);
    throw error;
  } finally {
    await session.endSession();
  }
  const total = COLLECTIONS.reduce((sum, c) => sum + rows[c].length, 0);
  console.log(
    `Created ${total} records and ${images.length} product images in ${CATALOGUE_NAMESPACE} (${FARMS.length} farms, ${CATALOGUE_PRODUCTS.length} products, ${rows.orders.length} orders, ${rows.auctions.length} auctions).`,
  );
}

export async function cleanupCatalogue(
  connection: mongoose.Connection,
  db: mongoose.mongo.Db,
): Promise<void> {
  const manifests = db.collection<CatalogueManifest>(MANIFEST_COLLECTION);
  const manifest = await manifests.findOne({ _id: CATALOGUE_NAMESPACE });
  if (!manifest) {
    console.log(
      `No fixture namespace ${CATALOGUE_NAMESPACE} exists. Nothing was removed.`,
    );
    return;
  }
  if (manifest.namespace !== CATALOGUE_NAMESPACE || manifest.version !== 1)
    throw new Error('Catalogue ownership manifest is not recognized.');
  const users = (manifest.collections.users ?? []).map(
    (id) => new Types.ObjectId(id),
  );
  const ownedOrders = new Set(manifest.collections.orders ?? []);
  // Refuse cleanup if live activity (new orders or bids) now references fixture users.
  const foreignOrder = await db.collection('orders').findOne(
    {
      $or: [{ buyerId: { $in: users } }, { producerId: { $in: users } }],
      _id: { $nin: [...ownedOrders].map((id) => new Types.ObjectId(id)) },
    },
    { projection: { _id: 1 } },
  );
  if (foreignOrder)
    throw new Error(
      'Orders created after seeding reference catalogue fixture users. Nothing was removed.',
    );
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      for (const collection of DELETE_ORDER) {
        const ids = (manifest.collections[collection] ?? []).map(
          (id) => new Types.ObjectId(id),
        );
        if (ids.length)
          await db
            .collection(collection)
            .deleteMany({ _id: { $in: ids } }, { session });
      }
      await manifests.deleteOne({ _id: CATALOGUE_NAMESPACE }, { session });
    });
  } finally {
    await session.endSession();
  }
  await deleteFixtureImages(manifest.imageKeys ?? []);
  console.log(
    `Removed only manifest-owned records and images for ${CATALOGUE_NAMESPACE}.`,
  );
}
