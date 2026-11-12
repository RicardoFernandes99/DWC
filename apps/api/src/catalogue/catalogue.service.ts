import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { StorageService } from '../storage/storage.service.js';
import { Product } from '../products/product.schema.js';
import { ProducerStatus, User, UserRole } from '../users/user.schema.js';
import {
  CatalogueListDto,
  CatalogueProductDto,
  CatalogueQueryDto,
  CatalogueSort,
  ProducerListDto,
  ProducerPublicDto,
  ProducerQueryDto,
} from './catalogue.dto.js';

function literal(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SORT_ORDERS: Record<CatalogueSort, Record<string, 1 | -1>> = {
  [CatalogueSort.Newest]: { createdAt: -1, _id: -1 },
  [CatalogueSort.PriceAsc]: { priceCents: 1, _id: 1 },
  [CatalogueSort.PriceDesc]: { priceCents: -1, _id: 1 },
  [CatalogueSort.NameAsc]: { name: 1, _id: 1 },
};

const ELIGIBLE_PRODUCER_LOOKUP = {
  $lookup: {
    from: 'users',
    localField: 'producerId',
    foreignField: '_id',
    pipeline: [
      {
        $match: {
          role: UserRole.Producer,
          producerStatus: ProducerStatus.Approved,
          producerApplication: { $ne: null },
        },
      },
      {
        $project: {
          'producerApplication.farmName': 1,
          'producerApplication.city': 1,
        },
      },
    ],
    as: 'producer',
  },
} satisfies PipelineStage.Lookup;

const PUBLIC_PRODUCT_PROJECTION = {
  _id: 1,
  producerId: 1,
  name: 1,
  description: 1,
  category: 1,
  productionMethod: 1,
  seasons: 1,
  priceCents: 1,
  unit: 1,
  availableStock: 1,
  image: 1,
  producerFarmName: '$producer.producerApplication.farmName',
  producerCity: '$producer.producerApplication.city',
};

interface PublicProducerRecord {
  _id: Types.ObjectId;
  producerApplication: NonNullable<User['producerApplication']>;
}
type ProductAggregateRow = Pick<
  Product,
  | 'name'
  | 'description'
  | 'category'
  | 'productionMethod'
  | 'seasons'
  | 'priceCents'
  | 'unit'
  | 'availableStock'
  | 'image'
> & {
  _id: Types.ObjectId;
  producerId: Types.ObjectId;
  producerFarmName: string;
  producerCity: string;
};
function profile(user: PublicProducerRecord): ProducerPublicDto {
  const application = user.producerApplication;
  return {
    id: user._id.toString(),
    farmName: application.farmName,
    description: application.description,
    city: application.city,
    latitude: application.latitude,
    longitude: application.longitude,
  };
}

@Injectable()
export class CatalogueService {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly storage: StorageService,
  ) {}

  async list(query: CatalogueQueryDto): Promise<CatalogueListDto> {
    if (
      query.minPriceCents !== undefined &&
      query.maxPriceCents !== undefined &&
      query.minPriceCents > query.maxPriceCents
    )
      throw new BadRequestException(
        'Minimum price cannot exceed maximum price.',
      );
    const match: Record<string, unknown> = {
      published: true,
      archivedAt: null,
      moderatedAt: null,
    };
    if (query.category) match.category = query.category;
    if (query.producerId)
      match.producerId = new Types.ObjectId(query.producerId);
    if (query.season) match.seasons = query.season;
    if (query.productionMethod) match.productionMethod = query.productionMethod;
    if (
      query.minPriceCents !== undefined ||
      query.maxPriceCents !== undefined
    ) {
      const price: Record<string, number> = {};
      if (query.minPriceCents !== undefined) price.$gte = query.minPriceCents;
      if (query.maxPriceCents !== undefined) price.$lte = query.maxPriceCents;
      match.priceCents = price;
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: SORT_ORDERS[query.sort ?? CatalogueSort.Newest] },
      ELIGIBLE_PRODUCER_LOOKUP,
      { $unwind: '$producer' },
    ];
    if (query.q) {
      const search = { $regex: literal(query.q), $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { name: search },
            { description: search },
            { 'producer.producerApplication.farmName': search },
            { 'producer.producerApplication.city': search },
          ],
        },
      });
    }
    if (query.location) {
      pipeline.push({
        $match: {
          'producer.producerApplication.city': {
            $regex: literal(query.location),
            $options: 'i',
          },
        },
      });
    }
    pipeline.push(
      { $project: PUBLIC_PRODUCT_PROJECTION },
      {
        $facet: {
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: 'value' }],
        },
      },
    );
    const [result] = await this.products.aggregate<{
      items: ProductAggregateRow[];
      total: Array<{ value: number }>;
    }>(pipeline);
    const items = (result?.items ?? []).map((item) => this.toProduct(item));
    return { items, total: result?.total?.[0]?.value ?? 0, page, limit };
  }

  async getProduct(id: string): Promise<CatalogueProductDto> {
    const [item] = await this.products.aggregate<ProductAggregateRow>([
      {
        $match: {
          _id: new Types.ObjectId(id),
          published: true,
          archivedAt: null,
          moderatedAt: null,
        },
      },
      ELIGIBLE_PRODUCER_LOOKUP,
      { $unwind: '$producer' },
      { $project: PUBLIC_PRODUCT_PROJECTION },
      { $limit: 1 },
    ]);
    if (!item) throw new NotFoundException('Product not found.');
    return this.toProduct(item);
  }

  private toProduct(item: ProductAggregateRow): CatalogueProductDto {
    return {
      id: String(item._id),
      producerId: String(item.producerId),
      producerFarmName: item.producerFarmName,
      producerCity: item.producerCity,
      name: item.name,
      description: item.description,
      category: item.category,
      productionMethod: item.productionMethod,
      seasons: item.seasons,
      priceCents: item.priceCents,
      unit: item.unit,
      availableStock: item.availableStock,
      imageUrl: item.image?.objectKey
        ? this.storage.createSignedGetUrl(String(item.image.objectKey)).url
        : null,
    };
  }

  async listProducers(query: ProducerQueryDto): Promise<ProducerListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Approved,
      producerApplication: { $ne: null },
    };
    if (query.q) {
      const regex = { $regex: literal(query.q), $options: 'i' };
      filter.$or = [
        { 'producerApplication.farmName': regex },
        { 'producerApplication.city': regex },
        { 'producerApplication.description': regex },
      ];
    }
    const [docs, total] = await Promise.all([
      this.users
        .find(filter)
        .select({ _id: 1, producerApplication: 1 })
        .sort({ 'producerApplication.farmName': 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.users.countDocuments(filter),
    ]);
    const items: ProducerPublicDto[] = [];
    for (const user of docs) {
      if (!user.producerApplication) continue;
      items.push(
        profile({
          _id: user._id,
          producerApplication: user.producerApplication,
        }),
      );
    }
    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getProducer(id: string): Promise<ProducerPublicDto> {
    const user = await this.users
      .findOne({
        _id: new Types.ObjectId(id),
        role: UserRole.Producer,
        producerStatus: ProducerStatus.Approved,
        producerApplication: { $ne: null },
      })
      .select({ _id: 1, producerApplication: 1 })
      .lean();
    if (!user?.producerApplication)
      throw new NotFoundException('Producer not found.');
    return profile({
      _id: user._id,
      producerApplication: user.producerApplication,
    });
  }

  async listProducerProducts(
    id: string,
    query: CatalogueQueryDto,
  ): Promise<CatalogueListDto> {
    return this.list({ ...query, producerId: id });
  }
}
