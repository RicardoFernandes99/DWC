import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import {
  type ClientSession,
  type Connection,
  type Model,
  Types,
} from 'mongoose';
import {
  Order,
  OrderDocument,
  OrderLineSnapshot,
  OrderOrigin,
  OrderStatus,
  OrderStatusHistoryEntry,
} from '../orders/order.schema.js';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service.js';
import { Product, type ProductDocument } from '../products/product.schema.js';
import {
  ProducerStatus,
  User,
  type UserDocument,
  UserRole,
} from '../users/user.schema.js';
import {
  CheckoutOrderSummaryDto,
  CheckoutQuoteIssueCode,
  CheckoutQuoteIssueDto,
  CheckoutQuoteLineDto,
  CheckoutQuoteLineIssueDto,
  CheckoutQuoteProducerGroupDto,
  CheckoutQuoteResponseDto,
  CheckoutResponseDto,
  DeliveryAddressDto,
  FulfilmentMethod,
  QuoteCheckoutDto,
  SubmitCheckoutDto,
} from './checkout.dto.js';
import { Checkout, CheckoutDocument } from './checkout.schema.js';
import { Payment, PaymentDocument, PaymentStatus } from './payment.schema.js';
import { NotificationIntegrationService } from '../notifications/notification-integration.service.js';
import {
  NotificationEventType,
  NotificationResourceType,
} from '../notifications/notification.schema.js';
import type { NotificationDocument } from '../notifications/notification.schema.js';

export const FREE_DELIVERY_THRESHOLD_CENTS = 5000;
export const STANDARD_DELIVERY_FEE_CENTS = 500;

@Injectable()
export class CheckoutService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationIntegration: NotificationIntegrationService,
    @InjectModel(Checkout.name)
    private readonly checkoutModel: Model<CheckoutDocument> = undefined as unknown as Model<CheckoutDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument> = undefined as unknown as Model<PaymentDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument> = undefined as unknown as Model<OrderDocument>,
    @InjectConnection()
    private readonly connection: Connection = undefined as unknown as Connection,
    private readonly paymentMethodsService: PaymentMethodsService = undefined as unknown as PaymentMethodsService,
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

  /**
   * Generates a deterministic SHA-256 hash of the checkout request payload.
   */
  computePayloadHash(payload: {
    items: Array<{ productId: string; quantity: number }>;
    fulfilmentMethod: FulfilmentMethod;
    deliveryAddress?: DeliveryAddressDto;
    paymentMethodId: string;
  }): string {
    const normalized = {
      items: [...payload.items]
        .map((i) => ({ productId: i.productId, quantity: i.quantity }))
        .sort((a, b) => a.productId.localeCompare(b.productId)),
      fulfilmentMethod: payload.fulfilmentMethod,
      deliveryAddress:
        payload.fulfilmentMethod === FulfilmentMethod.Delivery &&
        payload.deliveryAddress
          ? {
              recipientName: payload.deliveryAddress.recipientName.trim(),
              street: payload.deliveryAddress.street.trim(),
              city: payload.deliveryAddress.city.trim(),
              postalCode: payload.deliveryAddress.postalCode.trim(),
              country: payload.deliveryAddress.country?.trim() ?? 'Portugal',
              notes: payload.deliveryAddress.notes?.trim() ?? '',
            }
          : null,
      paymentMethodId: payload.paymentMethodId,
    };
    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /**
   * Quotes the checkout by reading live catalog state, aggregating per producer,
   * calculating delivery fees according to product decisions, and checking for
   * stock availability and producer standing.
   */
  async quote(
    buyerId: string,
    input: QuoteCheckoutDto,
  ): Promise<CheckoutQuoteResponseDto> {
    // 1. Validate delivery address presence when delivery is requested
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
        notes: input.deliveryAddress.notes?.trim() || undefined,
      };
    }

    // 2. Aggregate duplicate product requests in incoming items
    const normalizedQuantities = new Map<string, number>();
    for (const item of input.items) {
      const current = normalizedQuantities.get(item.productId) || 0;
      normalizedQuantities.set(item.productId, current + item.quantity);
    }

    const productObjectIds = Array.from(normalizedQuantities.keys()).map(
      (id) => new Types.ObjectId(id),
    );

    // 3. Fetch products from database
    const products = await this.productModel
      .find({ _id: { $in: productObjectIds } })
      .lean()
      .exec();

    const productMap = new Map<string, (typeof products)[number]>();
    for (const product of products) {
      productMap.set(product._id.toString(), product);
    }

    // 4. Fetch distinct producers
    const producerObjectIds = Array.from(
      new Set(products.map((p) => p.producerId.toString())),
    ).map((id) => new Types.ObjectId(id));

    const producers = await this.userModel
      .find({ _id: { $in: producerObjectIds }, role: UserRole.Producer })
      .lean()
      .exec();

    const producerMap = new Map<string, (typeof producers)[number]>();
    for (const producer of producers) {
      producerMap.set(producer._id.toString(), producer);
    }

    // 5. Build producer groups and quote lines
    const allIssues: CheckoutQuoteIssueDto[] = [];
    const producerGroupMap = new Map<
      string,
      {
        producerId: string;
        producerName: string;
        city: string | null;
        collectionAddress: string | null;
        items: CheckoutQuoteLineDto[];
        subtotalCents: number;
        hasIssues: boolean;
      }
    >();

    const fingerprintItems: Array<{
      productId: string;
      quantity: number;
      unitPriceCents: number;
      revision: number;
    }> = [];

    for (const [
      productId,
      requestedQuantity,
    ] of normalizedQuantities.entries()) {
      const product = productMap.get(productId);

      if (!product) {
        allIssues.push({
          productId,
          code: CheckoutQuoteIssueCode.UnavailableProduct,
          message: 'Product no longer exists in catalogue.',
          requestedQuantity,
        });
        continue;
      }

      const producer = producerMap.get(product.producerId.toString());
      const producerName =
        producer?.producerApplication?.farmName ||
        producer?.name ||
        'Unknown Producer';
      const isProducerSuspended =
        !producer || producer.producerStatus !== ProducerStatus.Approved;

      const lineIssues: CheckoutQuoteLineIssueDto[] = [];

      if (!product.published) {
        const issue: CheckoutQuoteLineIssueDto = {
          code: CheckoutQuoteIssueCode.UnavailableProduct,
          message: 'Product is currently unpublished or unavailable.',
          availableStock: product.availableStock,
          requestedQuantity,
        };
        lineIssues.push(issue);
        allIssues.push({ productId, ...issue });
      }

      if (isProducerSuspended) {
        const issue: CheckoutQuoteLineIssueDto = {
          code: CheckoutQuoteIssueCode.ProducerSuspended,
          message: 'Producer is suspended or no longer approved for sales.',
          availableStock: product.availableStock,
          requestedQuantity,
        };
        lineIssues.push(issue);
        allIssues.push({ productId, ...issue });
      }

      if (product.availableStock < requestedQuantity) {
        const issue: CheckoutQuoteLineIssueDto = {
          code: CheckoutQuoteIssueCode.InsufficientStock,
          message:
            product.availableStock === 0
              ? 'Item is out of stock.'
              : `Only ${product.availableStock} available in stock.`,
          availableStock: product.availableStock,
          requestedQuantity,
        };
        lineIssues.push(issue);
        allIssues.push({ productId, ...issue });
      }

      const lineTotalCents = product.priceCents * requestedQuantity;

      const quoteLine: CheckoutQuoteLineDto = {
        productId: product._id.toString(),
        productName: product.name,
        productUnit: product.unit,
        quantity: requestedQuantity,
        unitPriceCents: product.priceCents,
        lineTotalCents,
        producerId: product.producerId.toString(),
        producerName,
        availableStock: product.availableStock,
        issues: lineIssues,
      };

      fingerprintItems.push({
        productId: product._id.toString(),
        quantity: requestedQuantity,
        unitPriceCents: product.priceCents,
        revision: product.revision,
      });

      const producerIdStr = product.producerId.toString();
      let group = producerGroupMap.get(producerIdStr);
      if (!group) {
        group = {
          producerId: producerIdStr,
          producerName,
          city: producer?.producerApplication?.city || null,
          collectionAddress:
            producer?.producerApplication?.collectionAddress || null,
          items: [],
          subtotalCents: 0,
          hasIssues: false,
        };
        producerGroupMap.set(producerIdStr, group);
      }

      group.items.push(quoteLine);
      group.subtotalCents += lineTotalCents;
      if (lineIssues.length > 0) {
        group.hasIssues = true;
      }
    }

    // 6. Calculate delivery fees per producer according to decisions
    let combinedSubtotalCents = 0;
    let combinedDeliveryFeeCents = 0;

    const groups: CheckoutQuoteProducerGroupDto[] = [];
    for (const group of producerGroupMap.values()) {
      let deliveryFeeCents: number;
      let qualifiesForFreeDelivery: boolean;

      if (input.fulfilmentMethod === FulfilmentMethod.Delivery) {
        if (group.subtotalCents < FREE_DELIVERY_THRESHOLD_CENTS) {
          deliveryFeeCents = STANDARD_DELIVERY_FEE_CENTS;
          qualifiesForFreeDelivery = false;
        } else {
          deliveryFeeCents = 0;
          qualifiesForFreeDelivery = true;
        }
      } else {
        deliveryFeeCents = 0;
        qualifiesForFreeDelivery = true;
      }

      const totalCents = group.subtotalCents + deliveryFeeCents;
      combinedSubtotalCents += group.subtotalCents;
      combinedDeliveryFeeCents += deliveryFeeCents;

      groups.push({
        producerId: group.producerId,
        producerName: group.producerName,
        city: group.city,
        collectionAddress: group.collectionAddress,
        items: group.items,
        subtotalCents: group.subtotalCents,
        deliveryFeeCents,
        totalCents,
        qualifiesForFreeDelivery,
        hasIssues: group.hasIssues,
      });
    }

    groups.sort((a, b) => a.producerName.localeCompare(b.producerName));

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

  /**
   * Builds a CheckoutResponseDto from a stored Checkout document.
   */
  async buildCheckoutResponse(
    checkout: CheckoutDocument,
    session?: ClientSession,
  ): Promise<CheckoutResponseDto> {
    const ordersQuery = this.orderModel.find({
      _id: { $in: checkout.orderIds },
    });
    if (session) ordersQuery.session(session);
    const orders = await ordersQuery.exec();

    const producerIds = orders.map((o) => o.producerId);
    const producersQuery = this.userModel.find({ _id: { $in: producerIds } });
    if (session) producersQuery.session(session);
    const producers = await producersQuery.exec();

    const producerNameMap = new Map<string, string>();
    for (const p of producers) {
      producerNameMap.set(
        p._id.toString(),
        p.producerApplication?.farmName || p.name,
      );
    }

    const orderSummaries: CheckoutOrderSummaryDto[] = orders.map((o) => ({
      orderId: o._id.toString(),
      producerId: o.producerId.toString(),
      producerName: producerNameMap.get(o.producerId.toString()) ?? 'Producer',
      subtotalCents: o.subtotalCents,
      deliveryFeeCents: o.deliveryFeeCents,
      totalCents: o.totalCents,
      itemCount: o.items.reduce((sum, it) => sum + it.quantity, 0),
      status: o.status,
    }));

    return {
      checkoutId: checkout._id.toString(),
      paymentId: checkout.paymentId.toString(),
      fulfilmentMethod: checkout.fulfilmentMethod,
      subtotalCents: checkout.subtotalCents,
      deliveryFeeCents: checkout.deliveryFeeCents,
      totalCents: checkout.totalCents,
      orders: orderSummaries,
      createdAt: checkout.createdAt
        ? checkout.createdAt.toISOString()
        : new Date().toISOString(),
    };
  }

  /**
   * Atomically executes checkout inside a real MongoDB session transaction.
   * Performs conditional stock updates, eligibility checks, simulated payment creation,
   * per-producer orders, and idempotency tracking.
   */
  async submitCheckout(
    buyerId: string,
    input: SubmitCheckoutDto,
  ): Promise<CheckoutResponseDto> {
    // 1. Delivery address validation
    if (
      input.fulfilmentMethod === FulfilmentMethod.Delivery &&
      !input.deliveryAddress
    ) {
      throw new BadRequestException(
        'Delivery address is required when fulfilment method is delivery.',
      );
    }

    // 2. Validate saved payment method ownership and expiry
    const paymentMethod = await this.paymentMethodsService.findOwnedUnexpired(
      buyerId,
      input.paymentMethodId,
    );
    if (!paymentMethod) {
      throw new BadRequestException(
        'Selected payment method is invalid or expired.',
      );
    }

    // 3. Compute normalized payload hash for idempotency checking
    const payloadHash = this.computePayloadHash(input);

    // 4. Check if idempotency key was already recorded
    const existingCheckout = await this.checkoutModel.findOne({
      buyerId: new Types.ObjectId(buyerId),
      idempotencyKey: input.idempotencyKey,
    });

    if (existingCheckout) {
      if (existingCheckout.requestPayloadHash !== payloadHash) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          code: 'idempotency_mismatch',
          message:
            'Idempotency key has already been used with different request parameters.',
        });
      }
      return this.buildCheckoutResponse(existingCheckout);
    }

    // 5. Recompute live quote against database state
    const liveQuote = await this.quote(buyerId, {
      items: input.items,
      fulfilmentMethod: input.fulfilmentMethod,
      deliveryAddress: input.deliveryAddress,
    });

    // 6. Check for stock, unpublishing or producer suspension issues
    if (!liveQuote.isOrderable || liveQuote.issues.length > 0) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'One or more items in the cart are not available to order.',
        issues: liveQuote.issues,
      });
    }

    // 7. Verify quote fingerprint (reconfirmation on price/revision/fee change)
    if (liveQuote.fingerprint !== input.fingerprint) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'price_changed',
        message:
          'Pricing, availability or fees have changed since the quote was generated.',
        currentQuote: liveQuote,
      });
    }

    // 8. Execute atomic writes in a MongoDB transaction session
    const session = await this.connection.startSession();
    const checkoutId = new Types.ObjectId();
    const paymentId = new Types.ObjectId();
    const orderIds = liveQuote.groups.map(() => new Types.ObjectId());
    let notifications: NotificationDocument[] = [];
    let createdNewCheckout = false;
    try {
      let createdCheckoutId: Types.ObjectId | null = null;

      await session.withTransaction(async () => {
        createdCheckoutId = null;
        notifications = [];
        createdNewCheckout = false;
        // Concurrency idempotency check inside transaction
        const inTxExisting = await this.checkoutModel
          .findOne({
            buyerId: new Types.ObjectId(buyerId),
            idempotencyKey: input.idempotencyKey,
          })
          .session(session);

        if (inTxExisting) {
          if (inTxExisting.requestPayloadHash !== payloadHash) {
            throw new ConflictException({
              statusCode: HttpStatus.CONFLICT,
              code: 'idempotency_mismatch',
              message:
                'Idempotency key has already been used with different request parameters.',
            });
          }
          createdCheckoutId = inTxExisting._id;
          return;
        }

        // 8a. Recheck and lock each producer's approved eligibility
        for (const group of liveQuote.groups) {
          const producer = await this.userModel.findOneAndUpdate(
            {
              _id: new Types.ObjectId(group.producerId),
              role: UserRole.Producer,
              producerStatus: ProducerStatus.Approved,
            },
            { $inc: { __v: 0 } },
            { session, new: true },
          );
          if (!producer) {
            throw new ConflictException({
              statusCode: HttpStatus.CONFLICT,
              code: 'producer_suspended',
              message: `Producer "${group.producerName}" is not eligible to accept orders.`,
              producerId: group.producerId,
            });
          }
        }

        // 8b. Conditionally decrement stock for all items
        for (const group of liveQuote.groups) {
          for (const item of group.items) {
            const updatedProduct = await this.productModel.findOneAndUpdate(
              {
                _id: new Types.ObjectId(item.productId),
                producerId: new Types.ObjectId(group.producerId),
                published: true,
                availableStock: { $gte: item.quantity },
              },
              {
                $inc: { availableStock: -item.quantity },
              },
              { session, new: true },
            );

            if (!updatedProduct) {
              throw new ConflictException({
                statusCode: HttpStatus.CONFLICT,
                code: 'insufficient_stock',
                message: `Product "${item.productName}" is out of stock or does not have enough quantity available.`,
                productId: item.productId,
              });
            }
          }
        }

        // 8c. Record simulated payment in database
        const payment = new this.paymentModel({
          _id: paymentId,
          checkoutId,
          buyerId: new Types.ObjectId(buyerId),
          paymentMethodId: new Types.ObjectId(paymentMethod.id),
          paymentMethodSnapshot: {
            last4: paymentMethod.last4,
            expiryMonth: paymentMethod.expiryMonth,
            expiryYear: paymentMethod.expiryYear,
          },
          amountCents: liveQuote.totalCents,
          status: PaymentStatus.Succeeded,
        });
        await payment.save({ session });

        // 8d. Create Pending order per producer
        for (const [groupIndex, group] of liveQuote.groups.entries()) {
          const orderId = orderIds[groupIndex];

          const itemsSnapshot: OrderLineSnapshot[] = group.items.map((it) => ({
            productId: new Types.ObjectId(it.productId),
            productName: it.productName,
            productUnit: it.productUnit,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            lineTotalCents: it.lineTotalCents,
          }));

          const statusHistoryEntry: OrderStatusHistoryEntry = {
            status: OrderStatus.Pending,
            timestamp: new Date(),
            actorId: new Types.ObjectId(buyerId),
            actorRole: UserRole.Buyer,
            note: 'Order created via checkout',
          };

          const order = new this.orderModel({
            _id: orderId,
            checkoutId,
            buyerId: new Types.ObjectId(buyerId),
            producerId: new Types.ObjectId(group.producerId),
            paymentId,
            items: itemsSnapshot,
            fulfilmentMethod: liveQuote.fulfilmentMethod,
            deliveryAddress: liveQuote.deliveryAddress,
            subtotalCents: group.subtotalCents,
            deliveryFeeCents: group.deliveryFeeCents,
            totalCents: group.totalCents,
            status: OrderStatus.Pending,
            statusHistory: [statusHistoryEntry],
            origin: OrderOrigin.Catalogue,
            revision: 1,
          });
          await order.save({ session });
          notifications.push(
            await this.notificationIntegration.persist(
              {
                recipientId: group.producerId,
                eventType: NotificationEventType.OrderCreated,
                title: 'New order received',
                message: 'A buyer placed a new order with your farm.',
                resource: {
                  type: NotificationResourceType.Order,
                  id: orderId.toString(),
                },
                sourceEventKey: `order:${orderId.toString()}:created`,
              },
              session,
            ),
          );
        }

        // 8e. Create Checkout record with idempotency key
        const checkout = new this.checkoutModel({
          _id: checkoutId,
          buyerId: new Types.ObjectId(buyerId),
          idempotencyKey: input.idempotencyKey,
          requestPayloadHash: payloadHash,
          quoteFingerprint: liveQuote.fingerprint,
          fulfilmentMethod: liveQuote.fulfilmentMethod,
          deliveryAddress: liveQuote.deliveryAddress,
          paymentId,
          orderIds,
          subtotalCents: liveQuote.subtotalCents,
          deliveryFeeCents: liveQuote.deliveryFeeCents,
          totalCents: liveQuote.totalCents,
        });
        await checkout.save({ session });

        createdCheckoutId = checkoutId;
        createdNewCheckout = true;
      });

      // Query the committed checkout document
      const committedCheckout =
        await this.checkoutModel.findById(createdCheckoutId);
      if (!committedCheckout) {
        throw new BadRequestException('Checkout failed to persist.');
      }
      if (createdNewCheckout) {
        for (const notification of notifications) {
          this.notificationIntegration.publishCommitted(notification);
        }
      }
      return this.buildCheckoutResponse(committedCheckout);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: unknown }).code === 11000
      ) {
        const existing = await this.checkoutModel.findOne({
          buyerId: new Types.ObjectId(buyerId),
          idempotencyKey: input.idempotencyKey,
        });
        if (existing) {
          if (existing.requestPayloadHash !== payloadHash) {
            throw new ConflictException({
              statusCode: HttpStatus.CONFLICT,
              code: 'idempotency_mismatch',
              message:
                'Idempotency key has already been used with different request parameters.',
            });
          }
          return this.buildCheckoutResponse(existing);
        }
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
