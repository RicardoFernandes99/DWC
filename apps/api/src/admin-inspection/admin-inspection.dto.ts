import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { AuctionStatus } from '../auctions/auction.schema.js';
import { PaymentStatus } from '../checkout/payment.schema.js';
import {
  FulfilmentMethod,
  OrderOrigin,
  OrderStatus,
  RefundRequestStatus,
} from '../orders/order.schema.js';
import {
  ProductCategory,
  ProductSeason,
  ProductUnit,
  ProductionMethod,
} from '../products/product.schema.js';
import { BuyerStatus, ProducerStatus, UserRole } from '../users/user.schema.js';

export class AdminPageQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class AdminUsersQueryDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: ProducerStatus })
  @IsOptional()
  @IsEnum(ProducerStatus)
  producerStatus?: ProducerStatus;
}

export class AdminOrdersQueryDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderOrigin })
  @IsOptional()
  @IsEnum(OrderOrigin)
  origin?: OrderOrigin;

  @ApiPropertyOptional({ enum: FulfilmentMethod })
  @IsOptional()
  @IsEnum(FulfilmentMethod)
  fulfilmentMethod?: FulfilmentMethod;

  @ApiPropertyOptional({ example: '671f0f98ac53ba58e26c4789' })
  @IsOptional()
  @IsMongoId()
  buyerId?: string;

  @ApiPropertyOptional({ example: '671f0f98ac53ba58e26c4789' })
  @IsOptional()
  @IsMongoId()
  producerId?: string;
}

export class AdminAuctionsQueryDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ enum: AuctionStatus })
  @IsOptional()
  @IsEnum(AuctionStatus)
  status?: AuctionStatus;

  @ApiPropertyOptional({ example: '671f0f98ac53ba58e26c4789' })
  @IsOptional()
  @IsMongoId()
  producerId?: string;
}

export class AdminIdParamDto {
  @ApiProperty({ example: '671f0f98ac53ba58e26c4789' })
  @IsMongoId()
  id!: string;
}

export class AdminUserListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty({ enum: ProducerStatus, nullable: true })
  producerStatus!: ProducerStatus | null;
  @ApiProperty({ enum: BuyerStatus, nullable: true })
  buyerStatus!: BuyerStatus | null;
  @ApiProperty({ type: String, nullable: true }) farmName!: string | null;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;
}

export class AdminUsersPageDto {
  @ApiProperty({ type: () => AdminUserListItemDto, isArray: true })
  items!: AdminUserListItemDto[];
  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1, maximum: 500 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 50 }) limit!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}

export class AdminProducerApplicationDto {
  @ApiProperty() farmName!: string;
  @ApiProperty() description!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  submittedAt!: string | null;
}

export class AdminUserDetailDto extends AdminUserListItemDto {
  @ApiProperty({ type: () => AdminProducerApplicationDto, nullable: true })
  producerApplication!: AdminProducerApplicationDto | null;
  @ApiProperty({ type: String, nullable: true }) producerRejectionReason!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) producerSuspensionReason!:
    string | null;
  @ApiProperty({ minimum: 0 }) producerDecisionRevision!: number;
  @ApiProperty({ type: String, nullable: true }) producerDecisionBy!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  producerDecisionAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) buyerSuspensionReason!:
    string | null;
  @ApiProperty({ minimum: 0 }) buyerDecisionRevision!: number;
  @ApiProperty({ type: String, nullable: true }) buyerDecisionBy!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  buyerDecisionAt!: string | null;
}

export class AdminOrderListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) checkoutId!: string | null;
  @ApiProperty({ type: String, nullable: true }) auctionId!: string | null;
  @ApiProperty() buyerId!: string;
  @ApiProperty() producerId!: string;
  @ApiProperty() paymentId!: string;
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty({ enum: OrderOrigin }) origin!: OrderOrigin;
  @ApiProperty({ enum: FulfilmentMethod }) fulfilmentMethod!: FulfilmentMethod;
  @ApiProperty({ minimum: 0 }) totalCents!: number;
  @ApiProperty({ minimum: 0 }) refundedCents!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;
}

export class AdminOrdersPageDto {
  @ApiProperty({ type: () => AdminOrderListItemDto, isArray: true })
  items!: AdminOrderListItemDto[];
  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1, maximum: 500 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 50 }) limit!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}

export class AdminAuctionProductDto {
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: ProductCategory }) category!: ProductCategory;
  @ApiProperty({ enum: ProductionMethod }) productionMethod!: ProductionMethod;
  @ApiProperty({ enum: ProductSeason, isArray: true })
  seasons!: ProductSeason[];
  @ApiProperty({ enum: ProductUnit }) unit!: ProductUnit;
}

export class AdminAuctionListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() producerId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty({ type: () => AdminAuctionProductDto })
  product!: AdminAuctionProductDto;
  @ApiProperty({ enum: AuctionStatus }) status!: AuctionStatus;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ minimum: 1 }) quantity!: number;
  @ApiProperty({ type: Number, minimum: 1, nullable: true }) currentBidCents!:
    number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;
}

export class AdminAuctionsPageDto {
  @ApiProperty({ type: () => AdminAuctionListItemDto, isArray: true })
  items!: AdminAuctionListItemDto[];
  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1, maximum: 500 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 50 }) limit!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}

export class AdminAuctionBidDto {
  @ApiProperty() id!: string;
  @ApiProperty() buyerId!: string;
  @ApiProperty({ maxLength: 100 }) bidderName!: string;
  @ApiProperty({ minimum: 1 }) amountCents!: number;
  @ApiProperty({ format: 'date-time' }) acceptedAt!: string;
  @ApiProperty({ format: 'date-time' }) endsAt!: string;
  @ApiProperty({ minimum: 1 }) revision!: number;
}

export class AdminAuctionBidPageDto {
  @ApiProperty({ type: () => AdminAuctionBidDto, isArray: true })
  items!: AdminAuctionBidDto[];
  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1, maximum: 500 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 50 }) limit!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}

export class AdminAuctionProducerDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ enum: UserRole, nullable: true }) role!: UserRole | null;
  @ApiProperty({ enum: ProducerStatus, nullable: true })
  status!: ProducerStatus | null;
}

export class AdminAuctionSettlementOrderDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty({ minimum: 0 }) totalCents!: number;
  @ApiProperty() paymentId!: string;
  @ApiProperty() buyerId!: string;
  @ApiProperty() producerId!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;
}

export class AdminAuctionSettlementPaymentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiProperty({ minimum: 0 }) amountCents!: number;
  @ApiProperty({ minimum: 0 }) refundedCents!: number;
  @ApiProperty() buyerId!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: string | null;
}

export class AdminAuctionSettlementDto {
  @ApiProperty({ type: () => AdminAuctionSettlementOrderDto, nullable: true })
  order!: AdminAuctionSettlementOrderDto | null;
  @ApiProperty({ type: () => AdminAuctionSettlementPaymentDto, nullable: true })
  payment!: AdminAuctionSettlementPaymentDto | null;
}

export class AdminAuctionDetailDto extends AdminAuctionListItemDto {
  @ApiProperty({ type: () => AdminAuctionProducerDto })
  producer!: AdminAuctionProducerDto;
  @ApiProperty({ minimum: 1 }) startingPriceCents!: number;
  @ApiProperty({ minimum: 1 }) minimumIncrementCents!: number;
  @ApiProperty({ type: String, nullable: true }) currentBidderId!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) currentBidderName!:
    string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastBidAt!: string | null;
  @ApiProperty({ minimum: 1 }) revision!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt!: string | null;
  @ApiProperty({ type: () => AdminAuctionBidPageDto })
  bidHistory!: AdminAuctionBidPageDto;
  @ApiProperty({ type: () => AdminAuctionSettlementDto })
  settlement!: AdminAuctionSettlementDto;
}

export class AdminOrderOwnerDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ enum: UserRole, nullable: true }) role!: UserRole | null;
}

export class AdminOrderPaymentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiProperty({ minimum: 0 }) amountCents!: number;
  @ApiProperty({ type: String, nullable: true }) checkoutId!: string | null;
  @ApiProperty({ type: String, nullable: true }) auctionId!: string | null;
}

export class AdminOrderItemDto {
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty({ enum: ProductUnit }) productUnit!: ProductUnit;
  @ApiProperty({ minimum: 1 }) quantity!: number;
  @ApiProperty({ minimum: 0 }) unitPriceCents!: number;
  @ApiProperty({ minimum: 0 }) lineTotalCents!: number;
}

export class AdminOrderHistoryDto {
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  timestamp!: string | null;
  @ApiProperty() actorId!: string;
  @ApiProperty({ enum: UserRole }) actorRole!: UserRole;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
}

export class AdminRefundAllocationDto {
  @ApiProperty() paymentId!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  refundedAt!: string | null;
}

export class AdminRefundRequestDto {
  @ApiProperty({ enum: RefundRequestStatus }) status!: RefundRequestStatus;
  @ApiProperty() requestedBy!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  requestedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
  @ApiProperty({ type: String, nullable: true }) decidedBy!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  decidedAt!: string | null;
  @ApiProperty({ type: Number, minimum: 0, nullable: true }) refundedCents!:
    number | null;
}

export class AdminOrderDetailDto extends AdminOrderListItemDto {
  @ApiProperty({ type: () => AdminOrderOwnerDto }) buyer!: AdminOrderOwnerDto;
  @ApiProperty({ type: () => AdminOrderOwnerDto })
  producer!: AdminOrderOwnerDto;
  @ApiProperty({ type: () => AdminOrderPaymentDto, nullable: true })
  payment!: AdminOrderPaymentDto | null;
  @ApiProperty({ type: () => AdminOrderItemDto, isArray: true })
  items!: AdminOrderItemDto[];
  @ApiProperty({ type: () => AdminOrderHistoryDto, isArray: true })
  statusHistory!: AdminOrderHistoryDto[];
  @ApiProperty({ minimum: 0 }) subtotalCents!: number;
  @ApiProperty({ minimum: 0 }) deliveryFeeCents!: number;
  @ApiProperty({ type: () => AdminRefundAllocationDto, nullable: true })
  refundAllocation!: AdminRefundAllocationDto | null;
  @ApiProperty({ type: () => AdminRefundRequestDto, nullable: true })
  refundRequest!: AdminRefundRequestDto | null;
  @ApiProperty({ minimum: 1 }) revision!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt!: string | null;
}

export class AdminServiceHealthDto {
  @ApiProperty({ enum: ['ok', 'degraded'] }) status!: 'ok' | 'degraded';
  @ApiProperty({ enum: ['up'] }) api!: 'up';
  @ApiProperty({ enum: ['up', 'down'] }) mongodb!: 'up' | 'down';
  @ApiProperty({ enum: ['up', 'down'] }) redis!: 'up' | 'down';
  @ApiProperty({ enum: ['up', 'down'] }) storage!: 'up' | 'down';
  @ApiProperty({ minimum: 0, maximum: 2500 }) mongodbLatencyMs!: number;
  @ApiProperty({ minimum: 0, maximum: 2500 }) redisLatencyMs!: number;
  @ApiProperty({ minimum: 0, maximum: 2500 }) storageLatencyMs!: number;
}
