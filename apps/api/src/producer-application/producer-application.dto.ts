import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
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
    format: 'date-time',
    nullable: true,
    example: '2026-11-01T12:00:00.000Z',
    description: 'ISO-8601 timestamp of most recent application submission.',
  })
  submittedAt!: string | null;

  @ApiProperty({
    type: ProducerApplicationDetailsDto,
    nullable: true,
    description:
      'Current submitted application details, or null if not yet submitted.',
  })
  application!: ProducerApplicationDetailsDto | null;
}
