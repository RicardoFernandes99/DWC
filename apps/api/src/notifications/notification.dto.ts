import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  NotificationEventType,
  NotificationResourceType,
} from './notification.schema.js';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 50,
    default: 20,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the previous page.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unreadOnly = false;
}

export class NotificationIdParamDto {
  @ApiProperty()
  @IsMongoId()
  notificationId!: string;
}

export class NotificationResourceDto {
  @ApiProperty({ enum: NotificationResourceType })
  @IsEnum(NotificationResourceType)
  type!: NotificationResourceType;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  id!: string;
}

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationEventType })
  eventType!: NotificationEventType;

  @ApiProperty({ maxLength: 120 })
  title!: string;

  @ApiProperty({ maxLength: 500 })
  message!: string;

  @ApiProperty({ type: NotificationResourceDto })
  resource!: NotificationResourceDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: string | null;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class UnreadCountResponseDto {
  @ApiProperty({ minimum: 0 })
  count!: number;
}
