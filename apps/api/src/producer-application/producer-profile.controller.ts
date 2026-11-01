import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Patch,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service.js';
import { ProducerStatus, UserRole } from '../users/user.schema.js';
import {
  GetProducerProfileQueryDto,
  ProducerProfileResponseDto,
  UpdateProducerProfileDto,
} from './producer-application.dto.js';
import { ProducerApplicationService } from './producer-application.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Producer profile')
@ApiBearerAuth()
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@Controller('producer/profile')
export class ProducerProfileController {
  constructor(
    private readonly auth: AuthService,
    private readonly producerApplication: ProducerApplicationService,
  ) {}

  private async approvedProducer(authorization: string | undefined) {
    const user = await this.auth.authenticate(authorization);
    if (
      user.role !== UserRole.Producer ||
      user.producerStatus !== ProducerStatus.Approved
    ) {
      throw new ForbiddenException(
        'Only approved producers may access or edit producer profiles.',
      );
    }
    return user;
  }

  @Get()
  @ApiOkResponse({
    type: ProducerProfileResponseDto,
    description: 'Current approved producer profile and revision.',
  })
  @ApiBadRequestResponse({
    description: 'Unexpected query fields are not accepted.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only approved producers may access producer profiles.',
  })
  async get(
    @Headers('authorization') authorization: string | undefined,
    @Query() _query: GetProducerProfileQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<ProducerProfileResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.approvedProducer(authorization);
    return this.producerApplication.getProfile(user.id);
  }

  @Patch()
  @ApiOkResponse({
    type: ProducerProfileResponseDto,
    description: 'Producer profile updated.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid profile fields, bounds or unexpected properties.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only approved producers may edit producer profiles.',
  })
  @ApiConflictResponse({
    description:
      'Producer profile was modified concurrently. Refresh and try again.',
  })
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Body() input: UpdateProducerProfileDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<ProducerProfileResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.approvedProducer(authorization);
    return this.producerApplication.updateProfile(user.id, input);
  }
}
