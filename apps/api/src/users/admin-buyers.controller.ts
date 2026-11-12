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
  AdminBuyerStandingDto,
  ReinstateBuyerDto,
  SuspendBuyerDto,
} from './buyer-standing.dto.js';
import { AdminIdParamDto } from '../admin-inspection/admin-inspection.dto.js';
import { BuyerStandingService } from './buyer-standing.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Admin buyers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, expired or revoked access JWT.',
})
@ApiForbiddenResponse({ description: 'Administrator access is required.' })
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@UseGuards(AdminGuard)
@Controller('admin/buyers')
export class AdminBuyersController {
  constructor(private readonly standing: BuyerStandingService) {}

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminBuyerStandingDto })
  @ApiBadRequestResponse({
    description: 'Invalid identifier, revision, or reason.',
  })
  @ApiNotFoundResponse({ description: 'Buyer not found.' })
  @ApiConflictResponse({
    description: 'Buyer standing changed or the decision is stale.',
  })
  suspend(
    @Param() { id }: AdminIdParamDto,
    @Body() input: SuspendBuyerDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    if (!request.adminUser?.id) throw new UnauthorizedException();
    response.setHeader('Cache-Control', 'no-store');
    return this.standing.suspend(id, request.adminUser.id, input);
  }

  @Post(':id/reinstate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminBuyerStandingDto })
  @ApiBadRequestResponse({ description: 'Invalid identifier or revision.' })
  @ApiNotFoundResponse({ description: 'Buyer not found.' })
  @ApiConflictResponse({
    description: 'Buyer standing changed or the decision is stale.',
  })
  reinstate(
    @Param() { id }: AdminIdParamDto,
    @Body() input: ReinstateBuyerDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    if (!request.adminUser?.id) throw new UnauthorizedException();
    response.setHeader('Cache-Control', 'no-store');
    return this.standing.reinstate(id, request.adminUser.id, input);
  }
}
