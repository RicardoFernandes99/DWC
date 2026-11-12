import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  MinLength,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProductUnit } from '../products/product.schema.js';
import { UserRole } from '../users/user.schema.js';
import {
  FulfilmentMethod,
  OrderOrigin,
  OrderStatus,
  RefundRequestStatus,
} from './order.schema.js';
import { PaymentStatus } from '../checkout/payment.schema.js';

export class OrderIdParamDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b01',
    description:
      'Unique 24-character hexadecimal MongoDB ObjectId of the order.',
  })
  @IsMongoId()
  orderId!: string;
}

/** Groups of fulfilment statuses used by the order list tabs. */
export enum OrderStage {
  Open = 'open',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export const ORDER_STAGE_STATUSES: Record<OrderStage, readonly OrderStatus[]> =
  {
    [OrderStage.Open]: [
      OrderStatus.Pending,
      OrderStatus.Confirmed,
      OrderStatus.Shipped,
      OrderStatus.ReadyForCollection,
    ],
    [OrderStage.Completed]: [OrderStatus.Delivered, OrderStatus.Collected],
    [OrderStage.Cancelled]: [OrderStatus.Cancelled],
  };

export class ListOrdersQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    example: 1,
    description: '1-based page number.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
    description: 'Maximum number of orders returned per page (1 to 100).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Filter orders by fulfilment status.',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: OrderStage,
    description:
      'Filter by status group: open (pending, confirmed, shipped, ready_for_collection), completed (delivered, collected) or cancelled. Combined with status, only orders matching both are returned.',
  })
  @IsOptional()
  @IsEnum(OrderStage)
  stage?: OrderStage;
}

export class OrderLineItemDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10a01',
    description: 'Product identifier at purchase time.',
  })
  productId!: string;

  @ApiProperty({
    example: 'Organic Gala Apples',
    description: 'Immutable product name snapshot at purchase time.',
  })
  productName!: string;

  @ApiProperty({
    enum: ProductUnit,
    example: ProductUnit.Kg,
    description: 'Unit of measure.',
  })
  productUnit!: ProductUnit;

  @ApiProperty({
    example: 2,
    description: 'Quantity ordered in integer units.',
  })
  quantity!: number;

  @ApiProperty({
    example: 350,
    description: 'Historical unit price in integer EUR cents.',
  })
  unitPriceCents!: number;

  @ApiProperty({
    example: 700,
    description: 'Historical line total in integer EUR cents.',
  })
  lineTotalCents!: number;
}

export class OrderDeliveryAddressDto {
  @ApiProperty({ example: 'Maria Silva' })
  recipientName!: string;

  @ApiProperty({ example: 'Rua das Flores 123' })
  street!: string;

  @ApiProperty({ example: '4000-001' })
  postalCode!: string;

  @ApiProperty({ example: 'Porto' })
  city!: string;

  @ApiProperty({ example: 'Portugal' })
  country!: string;

  @ApiPropertyOptional({ example: 'Leave at front gate', nullable: true })
  notes?: string | null;
}

export class OrderStatusHistoryDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.Pending,
    description: 'Fulfilment status recorded in this step.',
  })
  status!: OrderStatus;

  @ApiProperty({
    example: '2026-11-02T14:30:00.000Z',
    description: 'ISO-8601 timestamp when this transition occurred.',
  })
  timestamp!: string;

  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b01',
    description: 'User identifier who authored the transition.',
  })
  actorId!: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.Buyer,
    description: 'Role of the actor who executed the transition.',
  })
  actorRole!: UserRole;

  @ApiPropertyOptional({
    example: 'Dispatched via carrier tracking #PT-12345',
    description: 'Optional note or tracking details.',
    nullable: true,
  })
  note!: string | null;
}

export class OrderPaymentSummaryDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10c01',
    description: 'Unique payment identifier.',
  })
  paymentId!: string;

  @ApiProperty({
    enum: PaymentStatus,
    example: PaymentStatus.Succeeded,
    description: 'Status of the payment.',
  })
  status!: PaymentStatus;

  @ApiProperty({
    example: '4242',
    description: 'Last 4 digits of the payment card.',
  })
  cardLast4!: string;

  @ApiProperty({
    example: 12,
    description: 'Expiry month of the card (1-12).',
  })
  cardExpiryMonth!: number;

  @ApiProperty({
    example: 2028,
    description: 'Expiry year of the card.',
  })
  cardExpiryYear!: number;

  @ApiProperty({
    example: 4500,
    description:
      'Total amount paid for this checkout transaction in integer EUR cents.',
  })
  amountCents!: number;
}

export class RefundRequestResponseDto {
  @ApiProperty({ enum: RefundRequestStatus }) status!: RefundRequestStatus;
  @ApiProperty({ example: '2026-11-02T14:30:00.000Z' }) requestedAt!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Unable to collect the order.',
  })
  reason!: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-02T15:00:00.000Z',
  })
  decidedAt!: string | null;
  @ApiProperty({ type: Number, nullable: true, example: 4000 }) refundedCents!:
    number | null;
}

export class OrderResponseDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10d01',
    description: 'Unique order identifier.',
  })
  id!: string;

  @ApiProperty({
    type: String,
    example: '60d5ecb8b392d13b48f10e01',
    description: 'Associated checkout session, or null for an auction order.',
    nullable: true,
  })
  checkoutId!: string | null;

  @ApiProperty({
    example: '60d5ecb8b392d13b48f10f01',
    description: 'Buyer user identifier.',
  })
  buyerId!: string;

  @ApiPropertyOptional({
    example: 'Maria Silva',
    description: 'Name of the buyer.',
    nullable: true,
  })
  buyerName!: string | null;

  @ApiProperty({
    example: '60d5ecb8b392d13b48f10f02',
    description: 'Producer user identifier.',
  })
  producerId!: string;

  @ApiPropertyOptional({
    example: 'Quinta do Sol',
    description: 'Farm name or legal name of the producer.',
    nullable: true,
  })
  producerName!: string | null;

  @ApiProperty({
    type: [OrderLineItemDto],
    description: 'Immutable item snapshots purchased from this producer.',
  })
  items!: OrderLineItemDto[];

  @ApiProperty({
    enum: FulfilmentMethod,
    example: FulfilmentMethod.Delivery,
    description: 'Fulfilment method selected by the buyer at checkout.',
  })
  fulfilmentMethod!: FulfilmentMethod;

  @ApiPropertyOptional({
    type: OrderDeliveryAddressDto,
    description: 'Delivery destination address, or null for collection orders.',
    nullable: true,
  })
  deliveryAddress!: OrderDeliveryAddressDto | null;

  @ApiProperty({
    example: 3500,
    description: 'Subtotal for this producer in integer EUR cents.',
  })
  subtotalCents!: number;

  @ApiProperty({
    example: 500,
    description:
      'Delivery fee in integer EUR cents (0 for collection or free delivery).',
  })
  deliveryFeeCents!: number;

  @ApiProperty({
    example: 4000,
    description: 'Total order amount in integer EUR cents.',
  })
  totalCents!: number;

  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.Pending,
    description: 'Current fulfilment status.',
  })
  status!: OrderStatus;

  @ApiProperty({
    type: [OrderStatusHistoryDto],
    description:
      'Chronological audit trail of all status transitions for this order.',
  })
  statusHistory!: OrderStatusHistoryDto[];

  @ApiProperty({
    enum: OrderOrigin,
    example: OrderOrigin.Catalogue,
    description: 'Origin of the order (catalogue checkout or auction win).',
  })
  origin!: OrderOrigin;

  @ApiProperty({
    example: 1,
    description:
      'Monotonically increasing revision counter for optimistic concurrency.',
  })
  revision!: number;

  @ApiProperty({
    example: '2026-11-02T14:30:00.000Z',
    description: 'Creation timestamp.',
  })
  createdAt!: string;

  @ApiProperty({
    example: '2026-11-02T14:30:00.000Z',
    description: 'Last update timestamp.',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    type: OrderPaymentSummaryDto,
    description: 'Simulated card payment summary.',
    nullable: true,
  })
  payment!: OrderPaymentSummaryDto | null;

  @ApiPropertyOptional({
    type: RefundRequestResponseDto,
    nullable: true,
    description: 'Latest buyer refund request and producer decision.',
  })
  refundRequest!: RefundRequestResponseDto | null;
}

export class RefundReasonDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 500,
    example: 'I can no longer collect this order.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class OrderListResponseDto {
  @ApiProperty({
    type: [OrderResponseDto],
    description: 'List of order records for the current page.',
  })
  items!: OrderResponseDto[];

  @ApiProperty({
    example: 12,
    description: 'Total number of orders matching the query.',
  })
  total!: number;

  @ApiProperty({
    example: 1,
    description: 'Current 1-based page number.',
  })
  page!: number;

  @ApiProperty({
    example: 20,
    description: 'Maximum items per page.',
  })
  limit!: number;

  @ApiProperty({
    example: 1,
    description: 'Total number of pages.',
  })
  totalPages!: number;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.Confirmed,
    description:
      'Target fulfilment status. Must follow strict sequential state progression.',
  })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Expected current revision of the order for optimistic concurrency control.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedRevision?: number;

  @ApiPropertyOptional({
    example: 'Dispatched via carrier tracking #PT-12345',
    description:
      'Optional note or tracking details recorded in the transition history.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
