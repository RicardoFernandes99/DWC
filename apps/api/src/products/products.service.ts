import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProducerStatus, User, UserRole } from '../users/user.schema.js';
import {
  ArchiveProducerProductDto,
  CreateProducerProductDto,
  ListProducerProductsQueryDto,
  ProducerProductListResponseDto,
  ProducerProductResponseDto,
  UpdateProducerProductDto,
} from './product.dto.js';
import { Product, ProductDocument } from './product.schema.js';

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toProducerProductResponse(
  product: ProductDocument,
): ProducerProductResponseDto {
  return {
    id: product._id.toString(),
    producerId: product.producerId.toString(),
    name: product.name,
    description: product.description,
    category: product.category,
    productionMethod: product.productionMethod,
    seasons: [...product.seasons],
    priceCents: product.priceCents,
    unit: product.unit,
    availableStock: product.availableStock,
    reservedStock: product.reservedStock ?? 0,
    lowStockThreshold: product.lowStockThreshold,
    isLowStock: product.availableStock <= product.lowStockThreshold,
    published: product.published,
    archivedAt: formatDate(product.archivedAt),
    moderatedAt: formatDate(product.moderatedAt),
    moderationReason: product.moderationReason ?? null,
    hasImage: Boolean(product.image),
    revision: product.revision ?? 1,
    createdAt: formatDate(product.createdAt) ?? new Date(0).toISOString(),
    updatedAt: formatDate(product.updatedAt) ?? new Date(0).toISOString(),
  };
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly products: Model<Product>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
  ) {}

  private async requireApprovedProducer(userId: string): Promise<void> {
    const approved = await this.users.exists({
      _id: new Types.ObjectId(userId),
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Approved,
    });
    if (!approved) {
      throw new ForbiddenException(
        'Only approved producers may manage products.',
      );
    }
  }

  async listForProducer(
    userId: string,
    query: ListProducerProductsQueryDto,
  ): Promise<ProducerProductListResponseDto> {
    await this.requireApprovedProducer(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      producerId: new Types.ObjectId(userId),
    };
    if (!query.includeArchived) {
      filter.archivedAt = null;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.published !== undefined) {
      filter.published = query.published;
    }

    const [docs, total] = await Promise.all([
      this.products
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.products.countDocuments(filter),
    ]);

    return {
      items: docs.map((doc) => toProducerProductResponse(doc)),
      total,
      page,
      limit,
    };
  }

  async createForProducer(
    userId: string,
    input: CreateProducerProductDto,
  ): Promise<ProducerProductResponseDto> {
    await this.requireApprovedProducer(userId);
    const product = await this.products.create({
      producerId: new Types.ObjectId(userId),
      name: input.name,
      description: input.description,
      category: input.category,
      productionMethod: input.productionMethod,
      seasons: input.seasons,
      priceCents: input.priceCents,
      unit: input.unit,
      availableStock: input.availableStock,
      reservedStock: 0,
      lowStockThreshold: input.lowStockThreshold,
      published: input.published ?? true,
      archivedAt: null,
      moderatedAt: null,
      moderationReason: null,
      image: null,
      revision: 1,
    });
    return toProducerProductResponse(product);
  }

  async getForProducer(
    userId: string,
    id: string,
  ): Promise<ProducerProductResponseDto> {
    await this.requireApprovedProducer(userId);
    const product = await this.products.findOne({
      _id: new Types.ObjectId(id),
      producerId: new Types.ObjectId(userId),
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return toProducerProductResponse(product);
  }

  async updateForProducer(
    userId: string,
    id: string,
    input: UpdateProducerProductDto,
  ): Promise<ProducerProductResponseDto> {
    await this.requireApprovedProducer(userId);
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) {
      updates.name = input.name;
    }
    if (input.description !== undefined) {
      updates.description = input.description;
    }
    if (input.category !== undefined) {
      updates.category = input.category;
    }
    if (input.productionMethod !== undefined) {
      updates.productionMethod = input.productionMethod;
    }
    if (input.seasons !== undefined) {
      updates.seasons = input.seasons;
    }
    if (input.priceCents !== undefined) {
      updates.priceCents = input.priceCents;
    }
    if (input.unit !== undefined) {
      updates.unit = input.unit;
    }
    if (input.availableStock !== undefined) {
      updates.availableStock = input.availableStock;
    }
    if (input.lowStockThreshold !== undefined) {
      updates.lowStockThreshold = input.lowStockThreshold;
    }
    if (input.published !== undefined) {
      updates.published = input.published;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'At least one product field must be provided.',
      );
    }

    const updated = await this.products.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        producerId: new Types.ObjectId(userId),
        archivedAt: null,
        revision: input.revision,
      },
      {
        $set: updates,
        $inc: { revision: 1 },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      const existing = await this.products.findOne({
        _id: new Types.ObjectId(id),
        producerId: new Types.ObjectId(userId),
      });
      if (!existing) {
        throw new NotFoundException('Product not found.');
      }
      if (existing.archivedAt !== null) {
        throw new ConflictException('Archived products cannot be edited.');
      }
      throw new ConflictException(
        'Product was modified or stock changed concurrently. Refresh and try again.',
      );
    }

    return toProducerProductResponse(updated);
  }

  async archiveForProducer(
    userId: string,
    id: string,
    input: ArchiveProducerProductDto,
  ): Promise<ProducerProductResponseDto> {
    await this.requireApprovedProducer(userId);
    const updated = await this.products.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        producerId: new Types.ObjectId(userId),
        archivedAt: null,
        revision: input.revision,
      },
      {
        $set: {
          archivedAt: new Date(),
          published: false,
        },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      const existing = await this.products.findOne({
        _id: new Types.ObjectId(id),
        producerId: new Types.ObjectId(userId),
      });
      if (!existing) {
        throw new NotFoundException('Product not found.');
      }
      if (existing.archivedAt !== null) {
        throw new ConflictException('Product is already archived.');
      }
      throw new ConflictException(
        'Product was modified concurrently. Refresh and try again.',
      );
    }

    return toProducerProductResponse(updated);
  }
}
