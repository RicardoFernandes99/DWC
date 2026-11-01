import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Buffer } from 'node:buffer';
import { UserRole } from './user.schema.js';

@ValidatorConstraint({ name: 'passwordByteLength', async: false })
class PasswordByteLength implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const byteLength = Buffer.byteLength(value, 'utf8');
    return byteLength >= 8 && byteLength <= 72;
  }

  defaultMessage(): string {
    return 'password must be between 8 and 72 UTF-8 bytes';
  }
}

export class RegisterUserDto {
  @ApiProperty({ example: 'Ana Silva', minLength: 1, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'ana@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'long-enough-secret',
    description:
      'Must be between 8 and 72 UTF-8 bytes; whitespace is preserved.',
  })
  @IsString()
  @Validate(PasswordByteLength)
  password!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.Buyer })
  @IsEnum(UserRole)
  role!: UserRole;
}
