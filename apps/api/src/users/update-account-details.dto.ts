import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SavedAddressDto } from './saved-address.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Full replacement of the editable account details. */
export class UpdateAccountDetailsDto {
  @ApiProperty({ example: 'Ana Silva' })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '+351 912 345 678',
    description:
      'Digits with optional +, spaces, dashes or brackets; null or empty clears it.',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Matches(/^$|^\+?[0-9][0-9 ()-]{5,18}$/, {
    message: 'Enter a valid phone number.',
  })
  phone!: string | null;

  @ApiProperty({ type: SavedAddressDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavedAddressDto)
  deliveryAddress!: SavedAddressDto | null;
}
