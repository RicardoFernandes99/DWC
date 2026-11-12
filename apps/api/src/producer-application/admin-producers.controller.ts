import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, type AdminRequest } from '../auth/admin.guard.js';
import {
  AdminProducerApplicationItemDto,
  ProducerApplicationIdParamDto,
  ReinstateProducerDto,
  SuspendProducerDto,
} from './producer-application.dto.js';
import { ProducerApplicationService } from './producer-application.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Admin producers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, expired or revoked access JWT.',
})
@ApiForbiddenResponse({
  description: 'Administrator access is required.',
})
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@UseGuards(AdminGuard)
@Controller('admin/producers')
export class AdminProducersController {
  constructor(
    private readonly producerApplication: ProducerApplicationService,
  ) {}

  private requireAdminId(request: AdminRequest): string {
    if (!request.adminUser?.id) {
      throw new UnauthorizedException();
    }
    return request.adminUser.id;
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AdminProducerApplicationItemDto,
    description:
      'Approved producer suspended. New sales and auctions stop; existing orders and active auctions continue.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid producer identifier, revision, or missing/invalid reason.',
  })
  @ApiNotFoundResponse({ description: 'Producer account not found.' })
  @ApiConflictResponse({
    description:
      'Producer is not approved, or its revision changed concurrently.',
  })
  async suspend(
    @Param() params: ProducerApplicationIdParamDto,
    @Body() input: SuspendProducerDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProducerApplicationItemDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.producerApplication.suspend(
      params.id,
      this.requireAdminId(request),
      input,
    );
  }

  @Post(':id/reinstate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AdminProducerApplicationItemDto,
    description:
      'Suspended producer reinstated to approved. Product moderation and publication flags are unchanged.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid producer identifier or revision.',
  })
  @ApiNotFoundResponse({ description: 'Producer account not found.' })
  @ApiConflictResponse({
    description:
      'Producer is not suspended, or its revision changed concurrently.',
  })
  async reinstate(
    @Param() params: ProducerApplicationIdParamDto,
    @Body() input: ReinstateProducerDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProducerApplicationItemDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.producerApplication.reinstate(
      params.id,
      this.requireAdminId(request),
      input,
    );
  }
}
