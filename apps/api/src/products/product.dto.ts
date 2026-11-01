import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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
import {
  ProductCategory,
  ProductionMethod,
  ProductSeason,
  ProductUnit,
} from './product.schema.js';

function parseOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  return value;
}

export class ProductIdParamDto {
  @ApiProperty({
    example: '671f0f98ac53ba58e26c4789',
    description: 'Product identifier.',
  })
  @IsMongoId()
  id!: string;
}

// Empty on purpose: the product detail endpoint accepts no query fields.
export class GetProducerProductQueryDto {}

export class ListProducerProductsQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 1000,
    default: 1,
    example: 1,
    description: '1-based page number.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 50,
    default: 20,
    example: 20,
    description: 'Maximum number of products returned per page.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    example: false,
    description: 'Whether to include archived products in the results.',
  })
  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  includeArchived?: boolean = false;

  @ApiPropertyOptional({
    enum: ProductCategory,
    description: 'Optional product category filter.',
  })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Optional published state filter.',
  })
  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  published?: boolean;
}

export class CreateProducerProductDto {
  @ApiProperty({
    example: 'Heirloom Oxheart Tomatoes',
    minLength: 1,
    maxLength: 120,
    description: 'Product display name.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example:
      'Field-ripened organic oxheart tomatoes harvested every morning for sweet, low-acid flavor.',
    minLength: 1,
    maxLength: 2000,
    description: 'Detailed product description.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({
    enum: ProductCategory,
    example: ProductCategory.Vegetables,
    description: 'Catalogue category.',
  })
  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @ApiProperty({
    enum: ProductionMethod,
    example: ProductionMethod.Organic,
    description: 'Farming or production method.',
  })
  @IsEnum(ProductionMethod)
  productionMethod!: ProductionMethod;

  @ApiProperty({
    enum: ProductSeason,
    isArray: true,
    minItems: 1,
    maxItems: 5,
    example: [ProductSeason.Summer, ProductSeason.Autumn],
    description: 'Deduplicated list of harvest or availability seasons.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsEnum(ProductSeason, { each: true })
  seasons!: ProductSeason[];

  @ApiProperty({
    example: 380,
    minimum: 1,
    maximum: 10_000_000,
    description: 'Price per unit in integer EUR cents.',
  })
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  priceCents!: number;

  @ApiProperty({
    enum: ProductUnit,
    example: ProductUnit.Kg,
    description: 'Discrete pack or measurement unit.',
  })
  @IsEnum(ProductUnit)
  unit!: ProductUnit;

  @ApiProperty({
    example: 25,
    minimum: 0,
    maximum: 1_000_000,
    description: 'Non-negative integer stock quantity available for sale.',
  })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  availableStock!: number;

  @ApiProperty({
    example: 5,
    minimum: 0,
    maximum: 1_000_000,
    description: 'Non-negative integer threshold for low-stock warnings.',
  })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockThreshold!: number;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description:
      'Whether the product is published in the public catalogue when the producer is eligible.',
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean = true;
}

export class UpdateProducerProductDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description:
      'Current product revision to prevent stale edits or overwriting concurrent stock reservations.',
  })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiPropertyOptional({
    example: 'Heirloom Oxheart Tomatoes',
    minLength: 1,
    maxLength: 120,
    description: 'Product display name.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example:
      'Field-ripened organic oxheart tomatoes harvested every morning for sweet, low-acid flavor.',
    minLength: 1,
    maxLength: 2000,
    description: 'Detailed product description.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: ProductCategory,
    example: ProductCategory.Vegetables,
    description: 'Catalogue category.',
  })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiPropertyOptional({
    enum: ProductionMethod,
    example: ProductionMethod.Organic,
    description: 'Farming or production method.',
  })
  @IsOptional()
  @IsEnum(ProductionMethod)
  productionMethod?: ProductionMethod;

  @ApiPropertyOptional({
    enum: ProductSeason,
    isArray: true,
    minItems: 1,
    maxItems: 5,
    example: [ProductSeason.Summer, ProductSeason.Autumn],
    description: 'Deduplicated list of harvest or availability seasons.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsEnum(ProductSeason, { each: true })
  seasons?: ProductSeason[];

  @ApiPropertyOptional({
    example: 380,
    minimum: 1,
    maximum: 10_000_000,
    description: 'Price per unit in integer EUR cents.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  priceCents?: number;

  @ApiPropertyOptional({
    enum: ProductUnit,
    example: ProductUnit.Kg,
    description: 'Discrete pack or measurement unit.',
  })
  @IsOptional()
  @IsEnum(ProductUnit)
  unit?: ProductUnit;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    maximum: 1_000_000,
    description: 'Non-negative integer stock quantity available for sale.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  availableStock?: number;

  @ApiPropertyOptional({
    example: 5,
    minimum: 0,
    maximum: 1_000_000,
    description: 'Non-negative integer threshold for low-stock warnings.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockThreshold?: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether the product is published in the public catalogue when the producer is eligible.',
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class ArchiveProducerProductDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description: 'Current product revision to prevent stale archive actions.',
  })
  @IsInt()
  @Min(1)
  revision!: number;
}

export class ProducerProductResponseDto {
  @ApiProperty({ example: '671f0f98ac53ba58e26c4789' })
  id!: string;

  @ApiProperty({ example: '671f0f98ac53ba58e26c4788' })
  producerId!: string;

  @ApiProperty({ example: 'Heirloom Oxheart Tomatoes' })
  name!: string;

  @ApiProperty({
    example:
      'Field-ripened organic oxheart tomatoes harvested every morning for sweet, low-acid flavor.',
  })
  description!: string;

  @ApiProperty({
    enum: ProductCategory,
    example: ProductCategory.Vegetables,
  })
  category!: ProductCategory;

  @ApiProperty({
    enum: ProductionMethod,
    example: ProductionMethod.Organic,
  })
  productionMethod!: ProductionMethod;

  @ApiProperty({
    enum: ProductSeason,
    isArray: true,
    example: [ProductSeason.Summer, ProductSeason.Autumn],
  })
  seasons!: ProductSeason[];

  @ApiProperty({ example: 380, minimum: 1 })
  priceCents!: number;

  @ApiProperty({ enum: ProductUnit, example: ProductUnit.Kg })
  unit!: ProductUnit;

  @ApiProperty({ example: 25, minimum: 0 })
  availableStock!: number;

  @ApiProperty({ example: 0, minimum: 0 })
  reservedStock!: number;

  @ApiProperty({ example: 5, minimum: 0 })
  lowStockThreshold!: number;

  @ApiProperty({
    example: false,
    description: 'True when availableStock is at or below lowStockThreshold.',
  })
  isLowStock!: boolean;

  @ApiProperty({ example: true })
  published!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  archivedAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  moderatedAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
  })
  moderationReason!: string | null;

  @ApiProperty({
    example: false,
    description: 'Whether an image has been uploaded for this product.',
  })
  hasImage!: boolean;

  @ApiProperty({ example: 1, minimum: 1 })
  revision!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

export class ProducerProductListResponseDto {
  @ApiProperty({ type: ProducerProductResponseDto, isArray: true })
  items!: ProducerProductResponseDto[];

  @ApiProperty({ example: 1, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 50 })
  limit!: number;
}
