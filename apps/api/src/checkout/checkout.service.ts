import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { Product, type ProductDocument } from '../products/product.schema.js';
import {
  ProducerStatus,
  User,
  type UserDocument,
  UserRole,
} from '../users/user.schema.js';
import {
  CheckoutQuoteIssueCode,
  CheckoutQuoteIssueDto,
  CheckoutQuoteLineDto,
  CheckoutQuoteLineIssueDto,
  CheckoutQuoteProducerGroupDto,
  CheckoutQuoteResponseDto,
  DeliveryAddressDto,
  FulfilmentMethod,
  QuoteCheckoutDto,
} from './checkout.dto.js';

export const FREE_DELIVERY_THRESHOLD_CENTS = 5000;
export const STANDARD_DELIVERY_FEE_CENTS = 500;

@Injectable()
export class CheckoutService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Generates a deterministic SHA-256 fingerprint for quoted pricing,
   * item quantities, product revisions and fees.
   */
  createQuoteFingerprint(payload: {
    fulfilmentMethod: FulfilmentMethod;
    items: Array<{
      productId: string;
      quantity: number;
      unitPriceCents: number;
      revision: number;
    }>;
    groups: Array<{
      producerId: string;
      subtotalCents: number;
      deliveryFeeCents: number;
      totalCents: number;
    }>;
    subtotalCents: number;
    deliveryFeeCents: number;
    totalCents: number;
  }): string {
    const canonical = {
      fulfilmentMethod: payload.fulfilmentMethod,
      items: [...payload.items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      ),
      groups: [...payload.groups].sort((a, b) =>
        a.producerId.localeCompare(b.producerId),
      ),
      subtotalCents: payload.subtotalCents,
      deliveryFeeCents: payload.deliveryFeeCents,
      totalCents: payload.totalCents,
    };
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  async quote(
    _userId: string,
    input: QuoteCheckoutDto,
  ): Promise<CheckoutQuoteResponseDto> {
    // 1. Fulfilment & Delivery Address Validation
    let deliveryAddress: DeliveryAddressDto | null = null;
    if (input.fulfilmentMethod === FulfilmentMethod.Delivery) {
      if (
        !input.deliveryAddress ||
        !input.deliveryAddress.recipientName?.trim() ||
        !input.deliveryAddress.street?.trim() ||
        !input.deliveryAddress.city?.trim() ||
        !input.deliveryAddress.postalCode?.trim()
      ) {
        throw new BadRequestException(
          'A complete delivery address (recipientName, street, city, postalCode) is required when fulfilment is delivery.',
        );
      }
      deliveryAddress = {
        recipientName: input.deliveryAddress.recipientName.trim(),
        street: input.deliveryAddress.street.trim(),
        city: input.deliveryAddress.city.trim(),
        postalCode: input.deliveryAddress.postalCode.trim(),
        country: input.deliveryAddress.country?.trim() || 'Portugal',
        ...(input.deliveryAddress.notes?.trim()
          ? { notes: input.deliveryAddress.notes.trim() }
          : {}),
      };
    }

    // 2. Normalize and deduplicate incoming product lines
    const normalizedQuantities = new Map<string, number>();
    for (const item of input.items) {
      if (!Types.ObjectId.isValid(item.productId)) {
        throw new BadRequestException(
          `Invalid product ID format: ${item.productId}`,
        );
      }
      const existing = normalizedQuantities.get(item.productId) ?? 0;
      normalizedQuantities.set(item.productId, existing + item.quantity);
    }

    const uniqueProductIds = Array.from(normalizedQuantities.keys());
    const objectIds = uniqueProductIds.map((id) => new Types.ObjectId(id));

    // 3. Fetch products via lean query (read-only advisory quote)
    const products = await this.productModel
      .find({ _id: { $in: objectIds } })
      .lean()
      .exec();

    const productMap = new Map<string, (typeof products)[number]>();
    for (const product of products) {
      productMap.set(product._id.toString(), product);
    }

    // 4. Fetch associated producers
    const producerIdStrings = Array.from(
      new Set(
        products
          .map((p) => p.producerId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const producerObjectIds = producerIdStrings.map(
      (id) => new Types.ObjectId(id),
    );
    const producers = await this.userModel
      .find({
        _id: { $in: producerObjectIds },
        role: UserRole.Producer,
      })
      .lean()
      .exec();

    const producerMap = new Map<string, (typeof producers)[number]>();
    for (const producer of producers) {
      producerMap.set(producer._id.toString(), producer);
    }

    // 5. Build structured lines, check availability and stock
    const allIssues: CheckoutQuoteIssueDto[] = [];
    const producerGroupsMap = new Map<
      string,
      {
        producerId: string;
        producerName: string;
        city: string | null;
        collectionAddress: string | null;
        items: CheckoutQuoteLineDto[];
      }
    >();

    const fingerprintItems: Array<{
      productId: string;
      quantity: number;
      unitPriceCents: number;
      revision: number;
    }> = [];

    for (const productId of uniqueProductIds) {
      const requestedQuantity = normalizedQuantities.get(productId)!;
      const product = productMap.get(productId);

      if (
        !product ||
        !product.published ||
        product.archivedAt != null ||
        product.moderatedAt != null
      ) {
        const issue: CheckoutQuoteIssueDto = {
          productId,
          code: CheckoutQuoteIssueCode.UnavailableProduct,
          message:
            'This product is no longer available or has been unpublished.',
          requestedQuantity,
        };
        allIssues.push(issue);
        continue;
      }

      const producer = producerMap.get(product.producerId.toString());
      const lineIssues: CheckoutQuoteLineIssueDto[] = [];

      if (!producer) {
        const issue: CheckoutQuoteIssueDto = {
          productId,
          code: CheckoutQuoteIssueCode.UnavailableProduct,
          message: 'The producer for this product is unavailable.',
          requestedQuantity,
        };
        allIssues.push(issue);
        lineIssues.push({
          code: issue.code,
          message: issue.message,
          requestedQuantity,
        });
      } else if (producer.producerStatus === ProducerStatus.Suspended) {
        const issue: CheckoutQuoteIssueDto = {
          productId,
          code: CheckoutQuoteIssueCode.ProducerSuspended,
          message: 'The producer is currently suspended.',
          requestedQuantity,
        };
        allIssues.push(issue);
        lineIssues.push({
          code: issue.code,
          message: issue.message,
          requestedQuantity,
        });
      } else if (producer.producerStatus !== ProducerStatus.Approved) {
        const issue: CheckoutQuoteIssueDto = {
          productId,
          code: CheckoutQuoteIssueCode.UnavailableProduct,
          message: 'The producer is not approved to sell.',
          requestedQuantity,
        };
        allIssues.push(issue);
        lineIssues.push({
          code: issue.code,
          message: issue.message,
          requestedQuantity,
        });
      }

      if (product.availableStock < requestedQuantity) {
        const issue: CheckoutQuoteIssueDto = {
          productId,
          code: CheckoutQuoteIssueCode.InsufficientStock,
          message: `Requested ${requestedQuantity} units, but only ${product.availableStock} available in stock.`,
          availableStock: product.availableStock,
          requestedQuantity,
        };
        allIssues.push(issue);
        lineIssues.push({
          code: issue.code,
          message: issue.message,
          availableStock: product.availableStock,
          requestedQuantity,
        });
      }

      const unitPriceCents = product.priceCents;
      const lineTotalCents = unitPriceCents * requestedQuantity;
      const producerId = product.producerId.toString();
      const producerName =
        producer?.producerApplication?.farmName ||
        producer?.name ||
        'Local Producer';

      const lineDto: CheckoutQuoteLineDto = {
        productId,
        productName: product.name,
        productUnit: product.unit,
        quantity: requestedQuantity,
        unitPriceCents,
        lineTotalCents,
        producerId,
        producerName,
        availableStock: product.availableStock,
        issues: lineIssues,
      };

      fingerprintItems.push({
        productId,
        quantity: requestedQuantity,
        unitPriceCents,
        revision: product.revision ?? 1,
      });

      if (!producerGroupsMap.has(producerId)) {
        producerGroupsMap.set(producerId, {
          producerId,
          producerName,
          city: producer?.producerApplication?.city ?? null,
          collectionAddress:
            producer?.producerApplication?.collectionAddress ?? null,
          items: [],
        });
      }
      producerGroupsMap.get(producerId)!.items.push(lineDto);
    }

    // 6. Calculate producer group subtotals and delivery fees
    const groups: CheckoutQuoteProducerGroupDto[] = [];
    let combinedSubtotalCents = 0;
    let combinedDeliveryFeeCents = 0;

    for (const group of producerGroupsMap.values()) {
      const groupSubtotalCents = group.items.reduce(
        (sum, item) => sum + item.lineTotalCents,
        0,
      );

      let groupDeliveryFeeCents = 0;
      if (
        input.fulfilmentMethod === FulfilmentMethod.Delivery &&
        groupSubtotalCents > 0 &&
        groupSubtotalCents < FREE_DELIVERY_THRESHOLD_CENTS
      ) {
        groupDeliveryFeeCents = STANDARD_DELIVERY_FEE_CENTS;
      }

      const groupTotalCents = groupSubtotalCents + groupDeliveryFeeCents;
      const qualifiesForFreeDelivery =
        input.fulfilmentMethod === FulfilmentMethod.Collection ||
        groupSubtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS;

      const hasIssues = group.items.some((item) => item.issues.length > 0);

      groups.push({
        producerId: group.producerId,
        producerName: group.producerName,
        city: group.city,
        collectionAddress: group.collectionAddress,
        items: group.items,
        subtotalCents: groupSubtotalCents,
        deliveryFeeCents: groupDeliveryFeeCents,
        totalCents: groupTotalCents,
        qualifiesForFreeDelivery,
        hasIssues,
      });

      combinedSubtotalCents += groupSubtotalCents;
      combinedDeliveryFeeCents += groupDeliveryFeeCents;
    }

    const combinedTotalCents = combinedSubtotalCents + combinedDeliveryFeeCents;
    const totalItemCount = Array.from(normalizedQuantities.values()).reduce(
      (sum, q) => sum + q,
      0,
    );

    const isOrderable = allIssues.length === 0;

    // 7. Compute deterministic version and pricing fingerprint
    const fingerprint = this.createQuoteFingerprint({
      fulfilmentMethod: input.fulfilmentMethod,
      items: fingerprintItems,
      groups: groups.map((g) => ({
        producerId: g.producerId,
        subtotalCents: g.subtotalCents,
        deliveryFeeCents: g.deliveryFeeCents,
        totalCents: g.totalCents,
      })),
      subtotalCents: combinedSubtotalCents,
      deliveryFeeCents: combinedDeliveryFeeCents,
      totalCents: combinedTotalCents,
    });

    return {
      fulfilmentMethod: input.fulfilmentMethod,
      deliveryAddress,
      groups,
      subtotalCents: combinedSubtotalCents,
      deliveryFeeCents: combinedDeliveryFeeCents,
      totalCents: combinedTotalCents,
      itemCount: totalItemCount,
      isOrderable,
      issues: allIssues,
      fingerprint,
      createdAt: new Date().toISOString(),
    };
  }
}
