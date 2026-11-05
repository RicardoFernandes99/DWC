import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class SuspendBuyerDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) revision!: number;
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ReinstateBuyerDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) revision!: number;
}

export class AdminBuyerStandingDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['active', 'suspended'] }) status!:
    'active' | 'suspended';
  @ApiProperty({ minimum: 0 }) revision!: number;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
  @ApiProperty({ type: String, nullable: true }) decidedBy!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  decidedAt!: string | null;
}
