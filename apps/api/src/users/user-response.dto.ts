import { ApiProperty } from '@nestjs/swagger';
import { BuyerStatus, ProducerStatus, UserRole } from './user.schema.js';

export class UserResponseDto {
  @ApiProperty({ example: '671f0f98ac53ba58e26c4789' })
  id!: string;

  @ApiProperty({ example: 'Ana Silva' })
  name!: string;

  @ApiProperty({ example: 'ana@example.com' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.Buyer })
  role!: UserRole;

  @ApiProperty({
    enum: [null, ...Object.values(ProducerStatus)],
    nullable: true,
    example: null,
  })
  producerStatus!: ProducerStatus | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
  })
  producerRejectionReason!: string | null;

  @ApiProperty({ enum: BuyerStatus, example: BuyerStatus.Active })
  buyerStatus!: BuyerStatus;

  @ApiProperty({ type: String, nullable: true, example: null })
  buyerSuspensionReason!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Short-lived signed URL of the profile picture, or null when none is set.',
  })
  avatarUrl!: string | null;
}
