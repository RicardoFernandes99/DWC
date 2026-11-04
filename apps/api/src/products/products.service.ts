import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Connection } from 'mongoose';
import {
  StorageService,
  type SignedGetUrlResult,
} from '../storage/storage.service.js';
import { ProducerStatus, User, UserRole } from '../users/user.schema.js';
import {
  ArchiveProducerProductDto,
  CreateProducerProductDto,
  ListProducerProductsQueryDto,
  ProducerProductImageMetadataDto,
  ProducerProductImagePreviewResponseDto,
  ProducerProductListResponseDto,
  ProducerProductResponseDto,
  UpdateProducerProductDto,
} from './product.dto.js';
import {
  validateProductImage,
  type UploadedImageFileInput,
} from './product-image.validator.js';
import {
  Product,
  ProductDocument,
  ProductImageMetadata,
} from './product.schema.js';

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toProducerProductImageMetadata(
  image: ProductImageMetadata | null | undefined,
): ProducerProductImageMetadataDto | null {
  if (!image) {
    return null;
  }
  return {
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    width: image.width,
    height: image.height,
    uploadedAt: formatDate(image.uploadedAt) ?? new Date(0).toISOString(),
  };
}

function canMintProductImageUrl(product: ProductDocument): boolean {
  return (
    Boolean(product.image?.objectKey) &&
    product.archivedAt === null &&
    product.moderatedAt === null
  );
}

function toProducerProductResponse(
  product: ProductDocument,
  storage: StorageService,
): ProducerProductResponseDto {
  const imageMeta = toProducerProductImageMetadata(product.image);
  const imageUrl =
    canMintProductImageUrl(product) && product.image
      ? storage.createSignedGetUrl(product.image.objectKey).url
      : null;

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
    imageUrl,
    imageMeta,
    revision: product.revision ?? 1,
    createdAt: formatDate(product.createdAt) ?? new Date(0).toISOString(),
    updatedAt: formatDate(product.updatedAt) ?? new Date(0).toISOString(),
  };
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly products: Model<Product>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    @InjectConnection() private readonly connection: Connection,
    private readonly storage: StorageService,
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

  private async cleanupStorageObject(
    objectKey: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.storage.deleteObject(objectKey);
    } catch {
      this.logger.warn(
        `Deferred S3 cleanup required for objectKey="${objectKey}" (${reason}).`,
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
      items: docs.map((doc) => toProducerProductResponse(doc, this.storage)),
      total,
      page,
      limit,
    };
  }

  async createForProducer(
    userId: string,
    input: CreateProducerProductDto,
  ): Promise<ProducerProductResponseDto> {
    const producerId = new Types.ObjectId(userId);
    const session = await this.connection.startSession();
    let product: ProductDocument | null = null;
    try {
      await session.withTransaction(async () => {
        product = null;
        // Real write on the producer: a concurrent suspension conflicts with
        // it, so the insert either commits first or the producer is refused.
        const fenced = await this.users.findOneAndUpdate(
          {
            _id: producerId,
            role: UserRole.Producer,
            producerStatus: ProducerStatus.Approved,
          },
          { $inc: { auctionEligibilityRevision: 1 } },
          { session },
        );
        if (!fenced) {
          throw new ForbiddenException(
            'Only approved producers may manage products.',
          );
        }
        const [created] = await this.products.create(
          [
            {
              producerId,
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
            },
          ],
          { session },
        );
        product = created ?? null;
      });
    } finally {
      await session.endSession();
    }
    if (!product) {
      throw new ServiceUnavailableException('Product could not be created.');
    }
    return toProducerProductResponse(product, this.storage);
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
    return toProducerProductResponse(product, this.storage);
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

    return toProducerProductResponse(updated, this.storage);
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

    return toProducerProductResponse(updated, this.storage);
  }

  async uploadImageForProducer(
    userId: string,
    id: string,
    revision: number,
    file: UploadedImageFileInput | undefined,
  ): Promise<ProducerProductResponseDto> {
    await this.requireApprovedProducer(userId);
    const validated = validateProductImage(file);

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
    if (existing.moderatedAt !== null) {
      throw new ConflictException('Moderated products cannot be edited.');
    }
    if (existing.revision !== revision) {
      throw new ConflictException(
        'Product was modified concurrently. Refresh and try again.',
      );
    }

    const objectKey = `products/${userId}/${existing._id.toString()}/${randomUUID()}.${validated.extension}`;
    try {
      await this.storage.putObject({
        key: objectKey,
        body: file!.buffer!,
        contentType: validated.mimeType,
        cacheControl: 'private, max-age=300',
      });
    } catch {
      this.logger.error(
        `Product image upload to S3 failed for productId="${existing._id.toString()}".`,
      );
      throw new ServiceUnavailableException(
        'Product image storage is currently unavailable.',
      );
    }

    const uploadedAt = new Date();
    let updated: ProductDocument | null;
    try {
      updated = await this.products.findOneAndUpdate(
        {
          _id: existing._id,
          producerId: existing.producerId,
          archivedAt: null,
          moderatedAt: null,
          revision,
        },
        {
          $set: {
            image: {
              objectKey,
              mimeType: validated.mimeType,
              sizeBytes: validated.sizeBytes,
              width: validated.width,
              height: validated.height,
              uploadedAt,
            },
          },
          $inc: { revision: 1 },
        },
        { returnDocument: 'after', runValidators: true },
      );
    } catch (error) {
      await this.cleanupStorageObject(objectKey, 'failed database update');
      throw error;
    }

    if (!updated) {
      await this.cleanupStorageObject(
        objectKey,
        'concurrent product modification',
      );
      const current = await this.products.findOne({
        _id: existing._id,
        producerId: existing.producerId,
      });
      if (!current) {
        throw new NotFoundException('Product not found.');
      }
      if (current.archivedAt !== null) {
        throw new ConflictException('Archived products cannot be edited.');
      }
      if (current.moderatedAt !== null) {
        throw new ConflictException('Moderated products cannot be edited.');
      }
      throw new ConflictException(
        'Product was modified concurrently. Refresh and try again.',
      );
    }

    const previousObjectKey = existing.image?.objectKey;
    if (previousObjectKey && previousObjectKey !== objectKey) {
      await this.cleanupStorageObject(
        previousObjectKey,
        'replaced product image',
      );
    }

    return toProducerProductResponse(updated, this.storage);
  }

  async getImagePreviewForProducer(
    userId: string,
    id: string,
  ): Promise<ProducerProductImagePreviewResponseDto> {
    await this.requireApprovedProducer(userId);
    const product = await this.products.findOne({
      _id: new Types.ObjectId(id),
      producerId: new Types.ObjectId(userId),
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    if (product.archivedAt !== null || product.moderatedAt !== null) {
      throw new ConflictException(
        'Archived or moderated products cannot mint fresh image URLs.',
      );
    }
    if (!product.image?.objectKey) {
      throw new NotFoundException('Product has no uploaded image.');
    }

    const signed = this.storage.createSignedGetUrl(product.image.objectKey);
    const meta = toProducerProductImageMetadata(product.image)!;
    return {
      url: signed.url,
      expiresInSeconds: signed.expiresInSeconds,
      ...meta,
    };
  }

  async resolvePublicImageUrl(
    productId: string,
  ): Promise<SignedGetUrlResult | null> {
    if (!Types.ObjectId.isValid(productId)) {
      return null;
    }
    const product = await this.products.findOne({
      _id: new Types.ObjectId(productId),
      published: true,
      archivedAt: null,
      moderatedAt: null,
    });
    if (!product?.image?.objectKey) {
      return null;
    }

    const producerEligible = await this.users.exists({
      _id: product.producerId,
      role: UserRole.Producer,
      producerStatus: ProducerStatus.Approved,
    });
    if (!producerEligible) {
      return null;
    }

    return this.storage.createSignedGetUrl(product.image.objectKey);
  }
}
