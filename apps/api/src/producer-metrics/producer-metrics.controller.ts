import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service.js';
import { ProducerStatus, UserRole } from '../users/user.schema.js';
import {
  ProducerMetricsQueryDto,
  ProducerMetricsResponseDto,
} from './producer-metrics.dto.js';
import { ProducerMetricsService } from './producer-metrics.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Producer metrics')
@ApiBearerAuth()
@ApiServiceUnavailableResponse({ description: 'Authentication unavailable.' })
@Controller('producer/metrics')
export class ProducerMetricsController {
  constructor(
    private readonly auth: AuthService,
    private readonly metrics: ProducerMetricsService,
  ) {}

  @Get()
  @ApiOkResponse({
    type: ProducerMetricsResponseDto,
    description:
      'Sales totals, best sellers and low-stock warnings for the authenticated producer only.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid period or unknown query fields.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description:
      'Only approved or suspended producers (historical metrics) may view metrics.',
  })
  async get(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ProducerMetricsQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<ProducerMetricsResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.auth.authenticate(authorization);
    if (
      user.role !== UserRole.Producer ||
      (user.producerStatus !== ProducerStatus.Approved &&
        user.producerStatus !== ProducerStatus.Suspended)
    ) {
      throw new ForbiddenException(
        'Only approved or suspended producers may view metrics.',
      );
    }
    return this.metrics.metrics(user.id, query.period ?? '7d');
  }
}
