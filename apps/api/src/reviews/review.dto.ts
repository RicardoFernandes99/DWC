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
} from 'class-validator';
import { ReviewReportCategory } from './review-report.schema.js';

const emptyToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export class ReviewOrderIdParamDto {
  @ApiProperty({ example: '60d5ecb8b392d13b48f10b01' })
  @IsMongoId()
  orderId!: string;
}

export class ReviewIdParamDto {
  @ApiProperty({ example: '60d5ecb8b392d13b48f10b02' })
  @IsMongoId()
  reviewId!: string;
}

export class ReviewProducerIdParamDto {
  @ApiProperty({ example: '60d5ecb8b392d13b48f10b03' })
  @IsMongoId()
  producerId!: string;
}

export class CreateReviewDto {
  @ApiProperty({
    example: '60d5ecb8b392d13b48f10b01',
    description:
      'Delivered or collected order owned by the authenticated buyer.',
  })
  @IsMongoId()
  orderId!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 1000,
    description:
      'Plain-text comment, trimmed. Empty or whitespace-only becomes null. Never interpreted as HTML.',
  })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}

export class ReportReviewDto {
  @ApiProperty({ enum: ReviewReportCategory })
  @IsEnum(ReviewReportCategory)
  category!: ReviewReportCategory;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 500,
    description: 'Optional plain-text note, trimmed; empty becomes null.',
  })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ListProducerReviewsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

export class OwnReviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() orderId!: string;
  @ApiProperty() producerId!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class OrderReviewStatusDto {
  @ApiProperty({
    description:
      'True when the order is delivered or collected and has no review yet.',
  })
  eligible!: boolean;

  @ApiProperty({ type: OwnReviewDto, nullable: true })
  review!: OwnReviewDto | null;
}

export class PublicReviewDto {
  @ApiProperty() id!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
  @ApiProperty({ type: String, nullable: true }) comment!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({
    description: 'First word of the reviewer name; no other identity data.',
  })
  reviewerFirstName!: string;
}

export class ReviewSummaryDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Average of visible ratings rounded to one decimal; null without reviews.',
  })
  averageRating!: number | null;

  @ApiProperty({ description: 'Number of visible reviews.' })
  ratingCount!: number;
}

export class ProducerReviewListDto {
  @ApiProperty({ type: [PublicReviewDto] }) items!: PublicReviewDto[];
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty({ description: 'Total visible reviews.' }) total!: number;
  @ApiProperty({ type: ReviewSummaryDto }) summary!: ReviewSummaryDto;
}

export class ReviewReportResultDto {
  @ApiProperty({ example: true }) reported!: boolean;
}
