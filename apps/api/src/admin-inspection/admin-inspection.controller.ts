import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import {
  AdminAuctionsQueryDto,
  AdminAuctionDetailDto,
  AdminAuctionsPageDto,
  AdminIdParamDto,
  AdminOrderDetailDto,
  AdminOrdersPageDto,
  AdminOrdersQueryDto,
  AdminPageQueryDto,
  AdminServiceHealthDto,
  AdminUserDetailDto,
  AdminUsersPageDto,
  AdminUsersQueryDto,
} from './admin-inspection.dto.js';
import { AdminInspectionService } from './admin-inspection.service.js';

@ApiTags('Admin inspection')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, expired or revoked access token.',
})
@ApiForbiddenResponse({ description: 'Administrator access is required.' })
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminInspectionController {
  constructor(private readonly inspection: AdminInspectionService) {}

  @Get('users')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AdminUsersPageDto })
  @ApiBadRequestResponse({ description: 'Invalid filter or pagination.' })
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.inspection.listUsers(query);
  }

  @Get('users/:id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AdminUserDetailDto })
  @ApiBadRequestResponse({ description: 'Malformed user ID.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  getUser(@Param() { id }: AdminIdParamDto) {
    return this.inspection.getUser(id);
  }

  @Get('orders')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AdminOrdersPageDto })
  @ApiBadRequestResponse({ description: 'Invalid filter or pagination.' })
  listOrders(@Query() query: AdminOrdersQueryDto) {
    return this.inspection.listOrders(query);
  }

  @Get('orders/:id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AdminOrderDetailDto })
  @ApiBadRequestResponse({ description: 'Malformed order ID.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  getOrder(@Param() { id }: AdminIdParamDto) {
    return this.inspection.getOrder(id);
  }

  @Get('auctions')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AdminAuctionsPageDto })
  @ApiBadRequestResponse({ description: 'Invalid filter or pagination.' })
  listAuctions(@Query() query: AdminAuctionsQueryDto) {
    return this.inspection.listAuctions(query);
  }

  @Get('auctions/:id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AdminAuctionDetailDto })
  @ApiBadRequestResponse({ description: 'Malformed auction ID or pagination.' })
  @ApiNotFoundResponse({ description: 'Auction not found.' })
  getAuction(
    @Param() { id }: AdminIdParamDto,
    @Query() query: AdminPageQueryDto,
  ) {
    return this.inspection.getAuction(id, query.page, query.limit);
  }

  @Get('health')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AdminServiceHealthDto })
  serviceHealth() {
    return this.inspection.serviceHealth();
  }
}
