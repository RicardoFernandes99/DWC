import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service.js';
import { UserRole } from '../users/user.schema.js';
import {
  GeocodeSearchQueryDto,
  GeocodeSearchResponseDto,
} from './geocoding.dto.js';
import { GeocodingService } from './geocoding.service.js';

@ApiTags('geocoding')
@ApiBearerAuth()
@Controller('geocode')
export class GeocodingController {
  constructor(
    private readonly auth: AuthService,
    private readonly geocoding: GeocodingService,
  ) {}

  @Get('search')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    type: GeocodeSearchResponseDto,
    description:
      'Up to five address matches with coordinates, from OpenStreetMap Nominatim.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only producers set collection addresses.',
  })
  @ApiServiceUnavailableResponse({
    description: 'The address search provider is unavailable.',
  })
  async search(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: GeocodeSearchQueryDto,
  ): Promise<GeocodeSearchResponseDto> {
    const user = await this.auth.authenticate(authorization);
    if (user.role !== UserRole.Producer)
      throw new ForbiddenException('Only producers can search addresses.');
    return { items: await this.geocoding.search(query.q) };
  }
}
