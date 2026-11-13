import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Default delivery address kept on the account; limits match checkout. */
export class SavedAddressDto {
  @ApiProperty({ example: 'Rua das Flores 123' })
  @IsString()
  @Transform(trim)
  @MinLength(3)
  @MaxLength(200)
  street!: string;

  @ApiProperty({ example: 'Porto' })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: '4000-001' })
  @IsString()
  @Transform(trim)
  @MinLength(3)
  @MaxLength(20)
  postalCode!: string;
}
