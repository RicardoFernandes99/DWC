import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ProductUnit } from '../products/product.schema.js';

export const METRICS_PERIODS = ['7d', '30d', '90d', 'all'] as const;
export type MetricsPeriod = (typeof METRICS_PERIODS)[number];

export class ProducerMetricsQueryDto {
  @ApiPropertyOptional({
    enum: METRICS_PERIODS,
    default: '30d',
    description:
      'Rolling window ending at server time, applied to order creation time. "all" has no lower bound.',
  })
  @IsOptional()
  @IsIn(METRICS_PERIODS)
  period?: MetricsPeriod = '30d';
}

export class SalesBreakdownDto {
  @ApiProperty({ example: 4, minimum: 0 })
  orderCount!: number;

  @ApiProperty({
    example: 12500,
    minimum: 0,
    description: 'Sum of original order line totals, in cents.',
  })
  productRevenueCents!: number;
}

export class SalesMetricsDto extends SalesBreakdownDto {
  @ApiProperty({
    example: 800,
    minimum: 0,
    description: 'Delivery fees charged on these orders, reported separately.',
  })
  deliveryFeesCents!: number;

  @ApiProperty({ type: SalesBreakdownDto })
  catalogue!: SalesBreakdownDto;

  @ApiProperty({ type: SalesBreakdownDto })
  auction!: SalesBreakdownDto;
}

export class UnitsSoldDto {
  @ApiProperty({ enum: Object.values(ProductUnit) })
  unit!: ProductUnit;

  @ApiProperty({ example: 12, minimum: 1 })
  quantity!: number;
}

export class BestSellerDto {
  @ApiProperty({ example: '665f1c2e8f1b2a0012345678' })
  productId!: string;

  @ApiProperty({ description: 'Most recent order snapshot name.' })
  productName!: string;

  @ApiProperty({ example: 3, minimum: 1 })
  orderCount!: number;

  @ApiProperty({ example: 5400, minimum: 0 })
  productRevenueCents!: number;

  @ApiProperty({
    type: [UnitsSoldDto],
    description: 'Quantities per unit; different units are never summed.',
  })
  unitsSold!: UnitsSoldDto[];
}

export class LowStockItemDto {
  @ApiProperty({ example: '665f1c2e8f1b2a0012345678' })
  productId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Object.values(ProductUnit) })
  unit!: ProductUnit;

  @ApiProperty({
    example: 2,
    description: 'Sellable stock; already excludes auction-reserved stock.',
  })
  availableStock!: number;

  @ApiProperty({
    example: 5,
    description: 'Stock held by auctions, for information.',
  })
  reservedStock!: number;

  @ApiProperty({ example: 3 })
  lowStockThreshold!: number;

  @ApiProperty()
  published!: boolean;
}

export class LowStockMetricsDto {
  @ApiProperty({
    example: 7,
    minimum: 0,
    description: 'All matching products.',
  })
  totalCount!: number;

  @ApiProperty({
    type: [LowStockItemDto],
    description: 'Up to 50 products, lowest available stock first.',
  })
  items!: LowStockItemDto[];
}

export class DailyOrdersDto {
  @ApiProperty({ example: '2026-11-08', description: 'UTC calendar day.' })
  date!: string;

  @ApiProperty({ example: 2, minimum: 0 })
  orderCount!: number;
}

export class PreviousPeriodDto {
  @ApiProperty({ example: 4, minimum: 0 })
  orderCount!: number;

  @ApiProperty({ example: 2850, minimum: 0 })
  productRevenueCents!: number;
}

export class AttentionDto {
  @ApiProperty({
    example: 1,
    minimum: 0,
    description: 'Orders awaiting confirmation.',
  })
  pendingOrders!: number;

  @ApiProperty({
    example: 1,
    minimum: 0,
    description: 'Refund requests awaiting a decision.',
  })
  openRefunds!: number;
}

export class ProducerMetricsResponseDto {
  @ApiProperty({ enum: METRICS_PERIODS })
  period!: MetricsPeriod;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Window start (inclusive); null for "all".',
  })
  from!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Server time.',
  })
  to!: string;

  @ApiProperty({
    type: SalesMetricsDto,
    description: 'All non-cancelled (so non-refunded) orders in the window.',
  })
  sales!: SalesMetricsDto;

  @ApiProperty({
    type: [BestSellerDto],
    description: 'Top 5 by revenue, then order count, then product id.',
  })
  bestSellers!: BestSellerDto[];

  @ApiProperty({ type: LowStockMetricsDto })
  lowStock!: LowStockMetricsDto;

  @ApiProperty({
    type: [DailyOrdersDto],
    description:
      'Non-cancelled orders per UTC day across the window, zero-filled. Empty for "all".',
  })
  daily!: DailyOrdersDto[];

  @ApiProperty({
    type: PreviousPeriodDto,
    nullable: true,
    description: 'Same totals for the window just before; null for "all".',
  })
  previous!: PreviousPeriodDto | null;

  @ApiProperty({
    type: AttentionDto,
    description: 'Current open work, independent of the period.',
  })
  attention!: AttentionDto;
}
