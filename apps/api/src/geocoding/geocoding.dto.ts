import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class GeocodeSearchQueryDto {
  @ApiProperty({
    example: '12 Demo Lane, Bristol',
    minLength: 3,
    maxLength: 200,
    description: 'Free-text address to look up.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 200)
  q!: string;
}

export class GeocodeResultDto {
  @ApiProperty({ example: '12 Demo Lane, Bristol, BS1 1AA, United Kingdom' })
  label!: string;

  @ApiProperty({ example: 51.4545 })
  latitude!: number;

  @ApiProperty({ example: -2.5879 })
  longitude!: number;

  @ApiProperty({ type: String, nullable: true, example: 'Bristol' })
  city!: string | null;
}

export class GeocodeSearchResponseDto {
  @ApiProperty({ type: [GeocodeResultDto] })
  items!: GeocodeResultDto[];
}
