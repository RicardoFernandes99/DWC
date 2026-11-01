import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class CreatePaymentMethodDto {
  @ApiProperty({ pattern: '^\\d{4}$', example: '4242' })
  @IsString()
  @Matches(/^\d{4}$/)
  last4!: string;

  @ApiProperty({ minimum: 1, maximum: 12, example: 6 })
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth!: number;

  @ApiProperty({ minimum: 1000, maximum: 9999, example: 2028 })
  @IsInt()
  @Min(1000)
  @Max(9999)
  expiryYear!: number;
}

export class PaymentMethodResponseDto {
  @ApiProperty({
    pattern: '^[0-9a-f]{24}$',
    example: '65a0f1e5b9d4c0a1f2b3c4d5',
  })
  id!: string;

  @ApiProperty({ pattern: '^\\d{4}$', example: '4242' })
  last4!: string;

  @ApiProperty({ minimum: 1, maximum: 12 })
  expiryMonth!: number;

  @ApiProperty({ minimum: 1000, maximum: 9999 })
  expiryYear!: number;

  @ApiProperty({ example: false })
  expired!: boolean;
}

// Empty on purpose: the list endpoint accepts no query fields, including owner IDs.
export class ListPaymentMethodsQueryDto {}
