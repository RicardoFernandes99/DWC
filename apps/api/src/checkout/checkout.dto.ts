import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductUnit } from '../products/product.schema.js';
import { FulfilmentMethod, OrderStatus } from '../orders/order.schema.js';

export { FulfilmentMethod };

export enum CheckoutQuoteIssueCode {
  InsufficientStock = 'insufficient_stock',
  UnavailableProduct = 'unavailable_product',
  ProducerSuspended = 'producer_suspended',
}

export class DeliveryAddressDto {
  @ApiProperty({
    example: 'Maria Silva',
    description: 'Name of the recipient receiving delivery.',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(100)
  recipientName!: string;

  @ApiProperty({
    example: 'Rua das Flores 123',
    description: 'Street address including house or apartment number.',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(3)
  @MaxLength(200)
  street!: string;

  @ApiProperty({
    example: 'Porto',
    description: 'City or municipality for delivery.',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @ApiProperty({
    example: '4000-001',
    description: 'Postal code.',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(3)
  @MaxLength(20)
  postalCode!: string;

  @ApiPropertyOptional({
    example: 'Portugal',
    description: 'Country for delivery. Defaults to Portugal.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    example: 'Leave at front gate',
    description: 'Optional delivery instructions or access notes.',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(500)
  notes?: string;
}

export class QuoteCheckoutItemDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b01',
    description: 'Unique Mongo identifier of the catalog product.',
  })
  @IsMongoId()
  productId!: string;

  @ApiProperty({
    example: 2,
    description: 'Quantity of the item (strictly positive integer).',
    minimum: 1,
    maximum: 999,
  })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class QuoteCheckoutDto {
  @ApiProperty({
    type: [QuoteCheckoutItemDto],
    description: 'List of product items to quote (1 to 50 items).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteCheckoutItemDto)
  items!: QuoteCheckoutItemDto[];

  @ApiProperty({
    enum: FulfilmentMethod,
    example: FulfilmentMethod.Delivery,
    description: 'Chosen fulfilment method for the checkout.',
  })
  @IsEnum(FulfilmentMethod)
  fulfilmentMethod!: FulfilmentMethod;

  @ApiPropertyOptional({
    type: DeliveryAddressDto,
    description:
      'Delivery address. Required when fulfilmentMethod is delivery.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;
}

export class CheckoutQuoteLineIssueDto {
  @ApiProperty({
    enum: CheckoutQuoteIssueCode,
    example: CheckoutQuoteIssueCode.InsufficientStock,
    description: 'Standard issue code.',
  })
  code!: CheckoutQuoteIssueCode;

  @ApiProperty({
    example: 'Requested 5 units, but only 2 units are available.',
    description: 'Human-readable description of the issue.',
  })
  message!: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Current available stock if applicable.',
  })
  availableStock?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Requested quantity that triggered the issue.',
  })
  requestedQuantity?: number;
}

export class CheckoutQuoteLineDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b01',
    description: 'Product identifier.',
  })
  productId!: string;

  @ApiProperty({
    example: 'Fresh Organic Carrots',
    description: 'Product display name.',
  })
  productName!: string;

  @ApiProperty({
    enum: ProductUnit,
    example: ProductUnit.Kg,
    description: 'Unit of measure.',
  })
  productUnit!: ProductUnit;

  @ApiProperty({
    example: 3,
    description: 'Normalized requested quantity.',
  })
  quantity!: number;

  @ApiProperty({
    example: 250,
    description: 'Unit price in integer EUR cents.',
  })
  unitPriceCents!: number;

  @ApiProperty({
    example: 750,
    description: 'Line total in integer EUR cents (unitPriceCents * quantity).',
  })
  lineTotalCents!: number;

  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b99',
    description: 'Producer user identifier.',
  })
  producerId!: string;

  @ApiProperty({
    example: 'Valley Green Farm',
    description: 'Producer farm or business name.',
  })
  producerName!: string;

  @ApiProperty({
    example: 10,
    description: 'Current available stock.',
  })
  availableStock!: number;

  @ApiProperty({
    type: [CheckoutQuoteLineIssueDto],
    description: 'Issues affecting this line, if any.',
  })
  issues!: CheckoutQuoteLineIssueDto[];
}

export class CheckoutQuoteProducerGroupDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b99',
    description: 'Producer user identifier.',
  })
  producerId!: string;

  @ApiProperty({
    example: 'Valley Green Farm',
    description: 'Producer farm or business name.',
  })
  producerName!: string;

  @ApiPropertyOptional({
    example: 'Braga',
    description: 'Producer farm city.',
  })
  city!: string | null;

  @ApiPropertyOptional({
    example: 'Quinta das Macas, Braga',
    description: 'Producer collection address if available.',
  })
  collectionAddress!: string | null;

  @ApiProperty({
    type: [CheckoutQuoteLineDto],
    description: 'Canonical product lines belonging to this producer.',
  })
  items!: CheckoutQuoteLineDto[];

  @ApiProperty({
    example: 4500,
    description: 'Subtotal for this producer in integer EUR cents.',
  })
  subtotalCents!: number;

  @ApiProperty({
    example: 500,
    description:
      'Delivery fee for this producer in integer EUR cents. EUR 5 (500 cents) if subtotal < 5000 cents; 0 if subtotal >= 5000 cents or collection.',
  })
  deliveryFeeCents!: number;

  @ApiProperty({
    example: 5000,
    description:
      'Total for this producer in integer EUR cents (subtotalCents + deliveryFeeCents).',
  })
  totalCents!: number;

  @ApiProperty({
    example: true,
    description:
      'True if delivery is free (subtotal >= 5000 cents or collection).',
  })
  qualifiesForFreeDelivery!: boolean;

  @ApiProperty({
    example: false,
    description: 'True if any line in this group has an issue.',
  })
  hasIssues!: boolean;
}

export class CheckoutQuoteIssueDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b01',
    description: 'Product identifier with the issue.',
  })
  productId!: string;

  @ApiProperty({
    enum: CheckoutQuoteIssueCode,
    example: CheckoutQuoteIssueCode.InsufficientStock,
    description: 'Issue code.',
  })
  code!: CheckoutQuoteIssueCode;

  @ApiProperty({
    example: 'Requested 5 units, but only 2 units are available.',
    description: 'Detailed explanation.',
  })
  message!: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Available stock at quote time.',
  })
  availableStock?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Requested quantity.',
  })
  requestedQuantity?: number;
}

export class CheckoutQuoteResponseDto {
  @ApiProperty({
    enum: FulfilmentMethod,
    example: FulfilmentMethod.Delivery,
    description: 'Quoted fulfilment method.',
  })
  fulfilmentMethod!: FulfilmentMethod;

  @ApiPropertyOptional({
    type: DeliveryAddressDto,
    description: 'Delivery address if delivery was quoted.',
  })
  deliveryAddress!: DeliveryAddressDto | null;

  @ApiProperty({
    type: [CheckoutQuoteProducerGroupDto],
    description: 'Quote lines grouped by producer.',
  })
  groups!: CheckoutQuoteProducerGroupDto[];

  @ApiProperty({
    example: 4500,
    description: 'Combined product subtotal in integer EUR cents.',
  })
  subtotalCents!: number;

  @ApiProperty({
    example: 500,
    description: 'Combined delivery fee in integer EUR cents.',
  })
  deliveryFeeCents!: number;

  @ApiProperty({
    example: 5000,
    description:
      'Combined checkout total in integer EUR cents (subtotalCents + deliveryFeeCents).',
  })
  totalCents!: number;

  @ApiProperty({
    example: 3,
    description: 'Total number of items across all lines.',
  })
  itemCount!: number;

  @ApiProperty({
    example: true,
    description:
      'True if all items are valid, in stock, no producers suspended, and address complete.',
  })
  isOrderable!: boolean;

  @ApiProperty({
    type: [CheckoutQuoteIssueDto],
    description: 'Structured list of all issues found across the quote.',
  })
  issues!: CheckoutQuoteIssueDto[];

  @ApiProperty({
    example: 'a6c8...39f',
    description:
      'Deterministic SHA-256 fingerprint representing quoted prices, revisions and fees.',
  })
  fingerprint!: string;

  @ApiProperty({
    example: '2026-11-02T13:00:00.000Z',
    description: 'ISO timestamp when the quote was computed.',
  })
  createdAt!: string;
}

export class SubmitCheckoutDto {
  @ApiProperty({
    type: [QuoteCheckoutItemDto],
    description: 'List of product items to purchase.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteCheckoutItemDto)
  items!: QuoteCheckoutItemDto[];

  @ApiProperty({
    enum: FulfilmentMethod,
    example: FulfilmentMethod.Delivery,
    description: 'Chosen fulfilment method for the checkout.',
  })
  @IsEnum(FulfilmentMethod)
  fulfilmentMethod!: FulfilmentMethod;

  @ApiPropertyOptional({
    type: DeliveryAddressDto,
    description:
      'Delivery address. Required when fulfilmentMethod is delivery.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;

  @ApiProperty({
    example: 'a6c837825fd8bfa6c29bda4d347318ec7e9b0d2d38596677f2ea99a6cf80918e',
    description:
      'SHA-256 quote fingerprint returned by POST /api/checkout/quote.',
  })
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  fingerprint!: string;

  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b01',
    description:
      'MongoDB identifier of buyer-owned, unexpired saved payment method.',
  })
  @IsMongoId()
  paymentMethodId!: string;

  @ApiProperty({
    example: 'c3d526fa-8b1b-43d9-95a3-76a084bc612e',
    description: 'Client-generated idempotency key scoped to the buyer.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  idempotencyKey!: string;
}

export class CheckoutOrderSummaryDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b01',
    description: 'Unique order identifier.',
  })
  orderId!: string;

  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b99',
    description: 'Producer user identifier.',
  })
  producerId!: string;

  @ApiProperty({
    example: 'Valley Green Farm',
    description: 'Producer farm or business name.',
  })
  producerName!: string;

  @ApiProperty({
    example: 4500,
    description: 'Subtotal for this producer in integer EUR cents.',
  })
  subtotalCents!: number;

  @ApiProperty({
    example: 500,
    description: 'Delivery fee for this producer in integer EUR cents.',
  })
  deliveryFeeCents!: number;

  @ApiProperty({
    example: 5000,
    description: 'Total for this producer in integer EUR cents.',
  })
  totalCents!: number;

  @ApiProperty({
    example: 3,
    description: 'Total quantity of items for this producer.',
  })
  itemCount!: number;

  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.Pending,
    description: 'Initial order status (pending).',
  })
  status!: OrderStatus;
}

export class CheckoutResponseDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10c01',
    description: 'Unique identifier of the completed checkout.',
  })
  checkoutId!: string;

  @ApiProperty({
    example: '60d5ecb8b392d13b48f10d01',
    description: 'Identifier of the internal payment record.',
  })
  paymentId!: string;

  @ApiProperty({
    enum: FulfilmentMethod,
    example: FulfilmentMethod.Delivery,
    description: 'Fulfilment method.',
  })
  fulfilmentMethod!: FulfilmentMethod;

  @ApiProperty({
    example: 4500,
    description: 'Combined product subtotal in integer EUR cents.',
  })
  subtotalCents!: number;

  @ApiProperty({
    example: 500,
    description: 'Combined delivery fee in integer EUR cents.',
  })
  deliveryFeeCents!: number;

  @ApiProperty({
    example: 5000,
    description: 'Combined checkout total in integer EUR cents.',
  })
  totalCents!: number;

  @ApiProperty({
    type: [CheckoutOrderSummaryDto],
    description: 'Summary of created orders per producer.',
  })
  orders!: CheckoutOrderSummaryDto[];

  @ApiProperty({
    example: '2026-11-02T14:00:00.000Z',
    description: 'ISO timestamp when the checkout was recorded.',
  })
  createdAt!: string;
}

export class CheckoutPriceChangedConflictDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'price_changed' })
  code!: string;

  @ApiProperty({
    example:
      'Pricing, availability or fees have changed since the quote was generated.',
  })
  message!: string;

  @ApiProperty({ type: CheckoutQuoteResponseDto })
  currentQuote!: CheckoutQuoteResponseDto;
}
