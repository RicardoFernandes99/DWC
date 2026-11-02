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
import {
  ProductCategory,
  ProductionMethod,
  ProductSeason,
  ProductUnit,
} from '../products/product.schema.js';

export enum CatalogueSort {
  Newest = 'newest',
  PriceAsc = 'price_asc',
  PriceDesc = 'price_desc',
  NameAsc = 'name_asc',
}

export class CatalogueQueryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string;
  @ApiPropertyOptional({ enum: ProductCategory })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;
  @ApiPropertyOptional({ format: 'mongo-id' })
  @IsOptional()
  @IsMongoId()
  producerId?: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  location?: string;
  @ApiPropertyOptional({ enum: ProductSeason })
  @IsOptional()
  @IsEnum(ProductSeason)
  season?: ProductSeason;
  @ApiPropertyOptional({ enum: ProductionMethod })
  @IsOptional()
  @IsEnum(ProductionMethod)
  productionMethod?: ProductionMethod;
  @ApiPropertyOptional({ minimum: 0, maximum: 10_000_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  minPriceCents?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 10_000_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  maxPriceCents?: number;
  @ApiPropertyOptional({ enum: CatalogueSort, default: CatalogueSort.Newest })
  @IsOptional()
  @IsEnum(CatalogueSort)
  sort: CatalogueSort = CatalogueSort.Newest;
  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class CatalogueProductDto {
  @ApiProperty() id!: string;
  @ApiProperty() producerId!: string;
  @ApiProperty() producerFarmName!: string;
  @ApiProperty() producerCity!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: ProductCategory }) category!: ProductCategory;
  @ApiProperty({ enum: ProductionMethod }) productionMethod!: ProductionMethod;
  @ApiProperty({ enum: ProductSeason, isArray: true })
  seasons!: ProductSeason[];
  @ApiProperty() priceCents!: number;
  @ApiProperty({ enum: ProductUnit }) unit!: ProductUnit;
  @ApiProperty() availableStock!: number;
  @ApiProperty({ type: String, nullable: true }) imageUrl!: string | null;
}

export class CatalogueListDto {
  @ApiProperty({ type: CatalogueProductDto, isArray: true })
  items!: CatalogueProductDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
export class ProducerPublicDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmName!: string;
  @ApiProperty() description!: string;
  @ApiProperty() city!: string;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
}
export class ProducerQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
export class ProducerListDto {
  @ApiProperty({ type: ProducerPublicDto, isArray: true })
  items!: ProducerPublicDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
export class ProducerIdParamDto {
  @ApiProperty() @IsMongoId() id!: string;
}
