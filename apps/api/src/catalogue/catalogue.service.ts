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
interface PublicProducerRecord {
  _id: Types.ObjectId;
  producerApplication: NonNullable<User['producerApplication']>;
}
interface ProductAggregateRow {
  _id: Types.ObjectId;
  producerId: Types.ObjectId;
  name: string;
  description: string;
  category: Product['category'];
  productionMethod: Product['productionMethod'];
  seasons: Product['seasons'];
  priceCents: number;
  unit: Product['unit'];
  availableStock: number;
  image: Product['image'];
  producer: { producerApplication: NonNullable<User['producerApplication']> };
}
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

  private pipeline(query: CatalogueQueryDto): PipelineStage[] {
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
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'users',
          let: { producerId: '$producerId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$producerId'] },
                    { $eq: ['$role', UserRole.Producer] },
                    { $eq: ['$producerStatus', ProducerStatus.Approved] },
                    { $ne: ['$producerApplication', null] },
                  ],
                },
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
      },
      { $unwind: '$producer' },
    ];
    if (query.q) {
      const regex = { $regex: literal(query.q), $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { name: regex },
            { description: regex },
            { 'producer.producerApplication.farmName': regex },
            { 'producer.producerApplication.city': regex },
          ],
        },
      });
    }
    if (query.location)
      pipeline.push({
        $match: {
          'producer.producerApplication.city': {
            $regex: literal(query.location),
            $options: 'i',
          },
        },
      });
    const sort: Record<string, 1 | -1> =
      query.sort === CatalogueSort.PriceAsc
        ? { priceCents: 1, _id: 1 }
        : query.sort === CatalogueSort.PriceDesc
          ? { priceCents: -1, _id: 1 }
          : query.sort === CatalogueSort.NameAsc
            ? { name: 1, _id: 1 }
            : { createdAt: -1, _id: -1 };
    pipeline.splice(1, 0, { $sort: sort });
    return pipeline;
  }

  async list(query: CatalogueQueryDto): Promise<CatalogueListDto> {
    const page = query.page ?? 1,
      limit = query.limit ?? 20;
    const pipeline = this.pipeline(query);
    const [result] = await this.products.aggregate<{
      items: ProductAggregateRow[];
      total: Array<{ value: number }>;
    }>([
      ...pipeline,
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
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
                producer: 1,
              },
            },
          ],
          total: [{ $count: 'value' }],
        },
      },
    ]);
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
      ...this.pipeline(new CatalogueQueryDto()).slice(1),
      { $limit: 1 },
      {
        $project: {
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
          producer: 1,
        },
      },
    ]);
    if (!item) throw new NotFoundException('Product not found.');
    return this.toProduct(item);
  }

  private toProduct(item: ProductAggregateRow): CatalogueProductDto {
    const producer = item.producer;
    return {
      id: String(item._id),
      producerId: String(item.producerId),
      producerFarmName: producer.producerApplication.farmName,
      producerCity: producer.producerApplication.city,
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
        .skip(((query.page ?? 1) - 1) * (query.limit ?? 20))
        .limit(query.limit ?? 20)
        .lean(),
      this.users.countDocuments(filter),
    ]);
    return {
      items: docs.flatMap((user) =>
        user.producerApplication
          ? [
              profile({
                _id: user._id,
                producerApplication: user.producerApplication,
              }),
            ]
          : [],
      ),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
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
    if (!user) throw new NotFoundException('Producer not found.');
    if (!user.producerApplication)
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
