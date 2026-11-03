import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { AuctionStatus } from './auction.schema.js';

export enum AuctionPublicState {
  Upcoming = 'upcoming',
  Active = 'active',
  Finished = 'finished',
}

export class AuctionIdParamDto {
  @ApiProperty({ example: '671f0f98ac53ba58e26c4789' })
  @IsMongoId()
  id!: string;
}

export class CreateAuctionDto {
  @ApiProperty({ example: '671f0f98ac53ba58e26c4789' })
  @IsMongoId()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 1_000_000, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @ApiProperty({ minimum: 1, maximum: 100_000_000, example: 1500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  startingPriceCents!: number;

  @ApiProperty({ minimum: 1, maximum: 100_000_000, example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  minimumIncrementCents!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-12-01T12:00:00.000Z',
  })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-12-01T13:00:00.000Z',
  })
  @IsDateString()
  endsAt!: string;
}

export class UpdateAuctionDto {
  @ApiProperty({
    minimum: 1,
    example: 1,
    description: 'Current auction revision.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1_000_000, example: 4 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100_000_000, example: 1800 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  startingPriceCents?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100_000_000, example: 150 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  minimumIncrementCents?: number;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString()
  endsAt?: string;
}

export class ListAuctionsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 1 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class ListPublicAuctionsQueryDto extends ListAuctionsQueryDto {
  @ApiPropertyOptional({ enum: AuctionPublicState })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(AuctionPublicState)
  state?: AuctionPublicState;
}

export class AuctionProductSnapshotResponseDto {
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() category!: string;
  @ApiProperty() productionMethod!: string;
  @ApiProperty({ type: String, isArray: true }) seasons!: string[];
  @ApiProperty() unit!: string;
}

export class AuctionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() producerId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty({ type: () => AuctionProductSnapshotResponseDto })
  product!: AuctionProductSnapshotResponseDto;
  @ApiProperty({ minimum: 1 }) quantity!: number;
  @ApiProperty({ minimum: 1 }) startingPriceCents!: number;
  @ApiProperty({ minimum: 1 }) minimumIncrementCents!: number;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: AuctionPublicState }) state!: AuctionPublicState;
  @ApiProperty({ enum: AuctionStatus }) status!: AuctionStatus;
  @ApiProperty({ type: Number, nullable: true }) currentBidCents!:
    number | null;
  @ApiProperty() revision!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class AuctionListResponseDto {
  @ApiProperty({ type: () => AuctionResponseDto, isArray: true })
  items!: AuctionResponseDto[];
  @ApiProperty({ minimum: 0 }) total!: number;
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 50 }) limit!: number;
}

export class CancelAuctionDto {
  @ApiProperty({
    minimum: 1,
    example: 1,
    description: 'Current auction revision.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revision!: number;
}
