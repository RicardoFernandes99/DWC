import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Put,
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
import { UserRole } from '../users/user.schema.js';
import {
  GetProducerApplicationQueryDto,
  ProducerApplicationResponseDto,
  SubmitProducerApplicationDto,
} from './producer-application.dto.js';
import { ProducerApplicationService } from './producer-application.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Producer application')
@ApiBearerAuth()
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@Controller('producer/application')
export class ProducerApplicationController {
  constructor(
    private readonly auth: AuthService,
    private readonly producerApplication: ProducerApplicationService,
  ) {}

  private async producer(authorization: string | undefined) {
    const user = await this.auth.authenticate(authorization);
    if (user.role !== UserRole.Producer) {
      throw new ForbiddenException(
        'Only producers may access producer applications.',
      );
    }
    return user;
  }

  @Get()
  @ApiOkResponse({
    type: ProducerApplicationResponseDto,
    description: 'Current producer application and review status.',
  })
  @ApiBadRequestResponse({
    description: 'Unexpected query fields are not accepted.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only producers may access producer applications.',
  })
  async get(
    @Headers('authorization') authorization: string | undefined,
    @Query() _query: GetProducerApplicationQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.producer(authorization);
    return this.producerApplication.get(user.id);
  }

  @Put()
  @ApiOkResponse({
    type: ProducerApplicationResponseDto,
    description: 'Application successfully saved or updated.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid application fields, bounds or unexpected properties.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only producers may access producer applications.',
  })
  @ApiConflictResponse({
    description: 'Only pending producer applications can be saved directly.',
  })
  async submit(
    @Headers('authorization') authorization: string | undefined,
    @Body() input: SubmitProducerApplicationDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.producer(authorization);
    return this.producerApplication.submit(user.id, input);
  }

  @Post('resubmit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: ProducerApplicationResponseDto,
    description: 'Application successfully resubmitted for review.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid application fields, bounds or unexpected properties.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only producers may access producer applications.',
  })
  @ApiConflictResponse({
    description: 'Only rejected producer applications can be resubmitted.',
  })
  async resubmit(
    @Headers('authorization') authorization: string | undefined,
    @Body() input: SubmitProducerApplicationDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.producer(authorization);
    return this.producerApplication.resubmit(user.id, input);
  }
}
