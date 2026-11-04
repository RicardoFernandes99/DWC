import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProducerStatus } from '../users/user.schema.js';

export class SubmitProducerApplicationDto {
  @ApiProperty({
    example: 'Quinta do Sol',
    minLength: 1,
    maxLength: 120,
    description: 'Public name of the farm or producer enterprise.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  farmName!: string;

  @ApiProperty({
    example:
      'Family-owned organic vegetable farm specializing in heirloom tomatoes and seasonal greens.',
    minLength: 1,
    maxLength: 2000,
    description: 'Detailed overview of farming practices, products, and story.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({
    example: 'Sintra',
    minLength: 1,
    maxLength: 120,
    description: 'City or municipality of the farm.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @ApiProperty({
    example: 'Rua Principal 12, 2710-001 Sintra',
    minLength: 1,
    maxLength: 240,
    description: 'Physical address for order collections and farm visits.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  collectionAddress!: string;

  @ApiProperty({
    example: 38.8029,
    minimum: -90,
    maximum: 90,
    description: 'Latitude coordinate in decimal degrees between -90 and 90.',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({
    example: -9.3817,
    minimum: -180,
    maximum: 180,
    description:
      'Longitude coordinate in decimal degrees between -180 and 180.',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class ProducerApplicationDetailsDto {
  @ApiProperty({
    example: 'Quinta do Sol',
    minLength: 1,
    maxLength: 120,
    description: 'Public name of the farm or producer enterprise.',
  })
  farmName!: string;

  @ApiProperty({
    example:
      'Family-owned organic vegetable farm specializing in heirloom tomatoes and seasonal greens.',
    minLength: 1,
    maxLength: 2000,
    description: 'Detailed overview of farming practices, products, and story.',
  })
  description!: string;

  @ApiProperty({
    example: 'Sintra',
    minLength: 1,
    maxLength: 120,
    description: 'City or municipality of the farm.',
  })
  city!: string;

  @ApiProperty({
    example: 'Rua Principal 12, 2710-001 Sintra',
    minLength: 1,
    maxLength: 240,
    description: 'Physical address for order collections and farm visits.',
  })
  collectionAddress!: string;

  @ApiProperty({
    example: 38.8029,
    minimum: -90,
    maximum: 90,
    description: 'Latitude coordinate in decimal degrees between -90 and 90.',
  })
  latitude!: number;

  @ApiProperty({
    example: -9.3817,
    minimum: -180,
    maximum: 180,
    description:
      'Longitude coordinate in decimal degrees between -180 and 180.',
  })
  longitude!: number;
}

// Empty on purpose: the application endpoint accepts no query fields.
export class GetProducerApplicationQueryDto {}

export class ProducerApplicationResponseDto {
  @ApiProperty({
    enum: ProducerStatus,
    example: ProducerStatus.Pending,
    description: 'Review status of the producer registration.',
  })
  status!: ProducerStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Administrator explanation for application rejection, if rejected.',
  })
  rejectionReason!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Administrator explanation for the current suspension; null unless suspended.',
  })
  suspensionReason!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-11-01T12:00:00.000Z',
    description: 'ISO-8601 timestamp of most recent application submission.',
  })
  submittedAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
    description:
      'ISO-8601 timestamp of the latest administrator approval or rejection decision, if any.',
  })
  decidedAt!: string | null;

  @ApiProperty({
    type: ProducerApplicationDetailsDto,
    nullable: true,
    description:
      'Current submitted application details, or null if not yet submitted.',
  })
  application!: ProducerApplicationDetailsDto | null;
}

export class ProducerApplicationIdParamDto {
  @ApiProperty({
    example: '671f0f98ac53ba58e26c4789',
    description: 'Producer user identifier.',
  })
  @IsMongoId()
  id!: string;
}

export class ListAdminProducerApplicationsQueryDto {
  @ApiPropertyOptional({
    enum: ProducerStatus,
    description: 'Optional producer application status filter.',
  })
  @IsOptional()
  @IsEnum(ProducerStatus)
  status?: ProducerStatus;

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
    description: 'Maximum number of applications returned per page.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class ApproveProducerApplicationDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description:
      'Current application decision revision to prevent stale or concurrent overwrite.',
  })
  @IsInt()
  @Min(1)
  revision!: number;
}

export class RejectProducerApplicationDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description:
      'Current application decision revision to prevent stale or concurrent overwrite.',
  })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiProperty({
    example:
      'Please provide your complete collection street number and organic certification details.',
    minLength: 1,
    maxLength: 500,
    description: 'Required administrator explanation for rejection.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class SuspendProducerDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description:
      'Current producer decision revision to prevent stale or concurrent overwrite.',
  })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiProperty({
    example: 'Repeated reports of undelivered orders.',
    minLength: 1,
    maxLength: 500,
    description:
      'Required administrator explanation, visible to the producer and in their notification.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ReinstateProducerDto {
  @ApiProperty({
    example: 2,
    minimum: 1,
    description:
      'Current producer decision revision to prevent stale or concurrent overwrite.',
  })
  @IsInt()
  @Min(1)
  revision!: number;
}

export class AdminProducerApplicationItemDto {
  @ApiProperty({ example: '671f0f98ac53ba58e26c4789' })
  id!: string;

  @ApiProperty({ example: 'Maria Costa' })
  name!: string;

  @ApiProperty({ example: 'maria@example.com' })
  email!: string;

  @ApiProperty({ enum: ProducerStatus, example: ProducerStatus.Pending })
  status!: ProducerStatus;

  @ApiProperty({
    example: 1,
    minimum: 1,
    description:
      'Current application decision revision used for concurrency checks.',
  })
  revision!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
  })
  rejectionReason!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Reason for the current suspension; null unless suspended.',
  })
  suspensionReason!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-01T12:00:00.000Z',
  })
  submittedAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  decidedAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Administrator user ID that recorded the latest decision.',
  })
  decidedBy!: string | null;

  @ApiProperty({ type: ProducerApplicationDetailsDto })
  application!: ProducerApplicationDetailsDto;
}

export class AdminProducerApplicationListResponseDto {
  @ApiProperty({ type: AdminProducerApplicationItemDto, isArray: true })
  items!: AdminProducerApplicationItemDto[];

  @ApiProperty({ example: 1, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 50 })
  limit!: number;
}

// Empty on purpose: the profile endpoint accepts no query fields.
export class GetProducerProfileQueryDto {}

export class UpdateProducerProfileDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    description:
      'Current producer profile revision to prevent stale or concurrent overwrite.',
  })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiPropertyOptional({
    example: 'Quinta do Sol',
    minLength: 1,
    maxLength: 120,
    description: 'Public name of the farm or producer enterprise.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  farmName?: string;

  @ApiPropertyOptional({
    example:
      'Family-owned organic vegetable farm specializing in heirloom tomatoes and seasonal greens.',
    minLength: 1,
    maxLength: 2000,
    description: 'Detailed overview of farming practices, products, and story.',
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
    example: 'Sintra',
    minLength: 1,
    maxLength: 120,
    description: 'City or municipality of the farm.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({
    example: 'Rua Principal 12, 2710-001 Sintra',
    minLength: 1,
    maxLength: 240,
    description: 'Physical address for order collections and farm visits.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  collectionAddress?: string;

  @ApiPropertyOptional({
    example: 38.8029,
    minimum: -90,
    maximum: 90,
    description: 'Latitude coordinate in decimal degrees between -90 and 90.',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: -9.3817,
    minimum: -180,
    maximum: 180,
    description:
      'Longitude coordinate in decimal degrees between -180 and 180.',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class ProducerProfileResponseDto {
  @ApiProperty({
    example: 'Quinta do Sol',
    minLength: 1,
    maxLength: 120,
    description: 'Public name of the farm or producer enterprise.',
  })
  farmName!: string;

  @ApiProperty({
    example:
      'Family-owned organic vegetable farm specializing in heirloom tomatoes and seasonal greens.',
    minLength: 1,
    maxLength: 2000,
    description: 'Detailed overview of farming practices, products, and story.',
  })
  description!: string;

  @ApiProperty({
    example: 'Sintra',
    minLength: 1,
    maxLength: 120,
    description: 'City or municipality of the farm.',
  })
  city!: string;

  @ApiProperty({
    example: 'Rua Principal 12, 2710-001 Sintra',
    minLength: 1,
    maxLength: 240,
    description: 'Physical address for order collections and farm visits.',
  })
  collectionAddress!: string;

  @ApiProperty({
    example: 38.8029,
    minimum: -90,
    maximum: 90,
    description: 'Latitude coordinate in decimal degrees between -90 and 90.',
  })
  latitude!: number;

  @ApiProperty({
    example: -9.3817,
    minimum: -180,
    maximum: 180,
    description:
      'Longitude coordinate in decimal degrees between -180 and 180.',
  })
  longitude!: number;

  @ApiProperty({
    enum: [ProducerStatus.Approved],
    example: ProducerStatus.Approved,
    description: 'Current status of the approved producer.',
  })
  status!: ProducerStatus;

  @ApiProperty({
    example: 2,
    minimum: 1,
    description: 'Current producer profile revision.',
  })
  revision!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-01T12:00:00.000Z',
    description: 'ISO-8601 timestamp of the latest profile update.',
  })
  updatedAt!: string;
}
