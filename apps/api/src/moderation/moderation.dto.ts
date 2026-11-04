import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProductCategory, ProductUnit } from '../products/product.schema.js';
import { ReviewReportCategory } from '../reviews/review-report.schema.js';
import { ReviewVisibility } from '../reviews/review.schema.js';

export enum ModerationStateFilter {
  All = 'all',
  Visible = 'visible',
  Hidden = 'hidden',
}

export class ModerationIdParamDto {
  @ApiProperty({ example: '671f0f98ac53ba58e26c4789' })
  @IsMongoId()
  id!: string;
}

class PageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: ModerationStateFilter,
    default: ModerationStateFilter.All,
  })
  @IsOptional()
  @IsEnum(ModerationStateFilter)
  state?: ModerationStateFilter = ModerationStateFilter.All;
}

export class ListAdminProductsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Only products of this producer.' })
  @IsOptional()
  @IsMongoId()
  producerId?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Literal, case-insensitive product name search.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string;
}

export class ListAdminReviewReportsQueryDto extends PageQueryDto {}

export class HideContentDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: 'Current revision, to prevent stale or concurrent overwrite.',
  })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiProperty({
    example: 'Prohibited item for sale.',
    minLength: 1,
    maxLength: 500,
    description: 'Required administrator explanation.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class RestoreContentDto {
  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  revision!: number;
}

export class ModerationInfoDto {
  @ApiProperty({ format: 'date-time' })
  hiddenAt!: string;

  @ApiProperty({ nullable: true, type: String })
  reason!: string | null;

  @ApiProperty({ nullable: true, type: String })
  hiddenBy!: string | null;
}

export class AdminProductItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ProductCategory }) category!: ProductCategory;
  @ApiProperty() priceCents!: number;
  @ApiProperty({ enum: ProductUnit }) unit!: ProductUnit;
  @ApiProperty() producerId!: string;
  @ApiProperty() producerName!: string;
  @ApiProperty() published!: boolean;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  archivedAt!: string | null;
  @ApiProperty({ nullable: true, type: ModerationInfoDto })
  moderation!: ModerationInfoDto | null;
  @ApiProperty() revision!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class AdminProductDetailDto extends AdminProductItemDto {
  @ApiProperty() description!: string;
  @ApiProperty() availableStock!: number;
  @ApiProperty() reservedStock!: number;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Short-lived signed image URL, for administrators only.',
  })
  imageUrl!: string | null;
}

export class AdminProductListResponseDto {
  @ApiProperty({ type: [AdminProductItemDto] }) items!: AdminProductItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class ReviewPersonDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class ReviewProducerDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmName!: string;
}

export class AdminReviewReportItemDto {
  @ApiProperty() reviewId!: string;
  @ApiProperty() rating!: number;
  @ApiProperty({ nullable: true, type: String }) comment!: string | null;
  @ApiProperty({ enum: ReviewVisibility }) visibility!: ReviewVisibility;
  @ApiProperty({ nullable: true, type: ModerationInfoDto })
  moderation!: ModerationInfoDto | null;
  @ApiProperty() revision!: number;
  @ApiProperty({ format: 'date-time' }) reviewCreatedAt!: string;
  @ApiProperty({ type: ReviewPersonDto }) author!: ReviewPersonDto;
  @ApiProperty({ type: ReviewProducerDto }) producer!: ReviewProducerDto;
  @ApiProperty() orderId!: string;
  @ApiProperty() reportCount!: number;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  latestReportAt!: string | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'Report count by category.',
  })
  categoryCounts!: Partial<Record<ReviewReportCategory, number>>;
}

export class AdminReviewReportDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ReviewReportCategory }) category!: ReviewReportCategory;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: ReviewPersonDto }) reporter!: ReviewPersonDto;
}

export class AdminReviewDetailDto extends AdminReviewReportItemDto {
  @ApiProperty({ type: [AdminReviewReportDto] })
  reports!: AdminReviewReportDto[];
}

export class AdminReviewReportListResponseDto {
  @ApiProperty({ type: [AdminReviewReportItemDto] })
  items!: AdminReviewReportItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
