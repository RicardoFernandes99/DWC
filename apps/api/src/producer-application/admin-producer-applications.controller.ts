import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
  AdminProducerApplicationListResponseDto,
  ApproveProducerApplicationDto,
  ListAdminProducerApplicationsQueryDto,
  ProducerApplicationIdParamDto,
  RejectProducerApplicationDto,
} from './producer-application.dto.js';
import { ProducerApplicationService } from './producer-application.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Admin producer applications')
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
@Controller('admin/producer-applications')
export class AdminProducerApplicationsController {
  constructor(
    private readonly producerApplication: ProducerApplicationService,
  ) {}

  private requireAdminId(request: AdminRequest): string {
    if (!request.adminUser?.id) {
      throw new UnauthorizedException();
    }
    return request.adminUser.id;
  }

  @Get()
  @ApiOkResponse({
    type: AdminProducerApplicationListResponseDto,
    description:
      'Paginated list of submitted producer applications ordered by most recent submission.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid pagination bounds, status filter or query fields.',
  })
  async list(
    @Query() query: ListAdminProducerApplicationsQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProducerApplicationListResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.producerApplication.listForAdmin(query);
  }

  @Get(':id')
  @ApiOkResponse({
    type: AdminProducerApplicationItemDto,
    description: 'Producer application details and review metadata.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid producer user identifier.',
  })
  @ApiNotFoundResponse({
    description:
      'Producer account not found or has not submitted an application.',
  })
  async get(
    @Param() params: ProducerApplicationIdParamDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProducerApplicationItemDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.producerApplication.getForAdmin(params.id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AdminProducerApplicationItemDto,
    description: 'Producer application approved.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid producer user identifier or revision payload.',
  })
  @ApiNotFoundResponse({
    description: 'Producer account not found.',
  })
  @ApiConflictResponse({
    description:
      'Application is unsubmitted, not pending, or its revision changed concurrently.',
  })
  async approve(
    @Param() params: ProducerApplicationIdParamDto,
    @Body() input: ApproveProducerApplicationDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProducerApplicationItemDto> {
    response.setHeader('Cache-Control', 'no-store');
    const adminId = this.requireAdminId(request);
    return this.producerApplication.approve(params.id, adminId, input);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AdminProducerApplicationItemDto,
    description: 'Producer application rejected with administrator feedback.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid producer user identifier, revision payload, or missing/invalid rejection reason.',
  })
  @ApiNotFoundResponse({
    description: 'Producer account not found.',
  })
  @ApiConflictResponse({
    description:
      'Application is unsubmitted, not pending, or its revision changed concurrently.',
  })
  async reject(
    @Param() params: ProducerApplicationIdParamDto,
    @Body() input: RejectProducerApplicationDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProducerApplicationItemDto> {
    response.setHeader('Cache-Control', 'no-store');
    const adminId = this.requireAdminId(request);
    return this.producerApplication.reject(params.id, adminId, input);
  }
}
