import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, RoleGuard, Roles } from '../auth/role.guard.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { UserRole } from '../users/user.schema.js';
import {
  ListOrdersQueryDto,
  OrderIdParamDto,
  OrderListResponseDto,
  OrderResponseDto,
  UpdateOrderStatusDto,
  RefundReasonDto,
} from './order.dto.js';
import { OrdersService } from './orders.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(RoleGuard)
@Roles(UserRole.Buyer, UserRole.Producer)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOkResponse({
    type: OrderListResponseDto,
    description:
      'Paginated list of orders strictly scoped to the authenticated buyer or producer.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid pagination bounds or query parameters.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiForbiddenResponse({
    description: 'Role does not allow order listing.',
  })
  async listOrders(
    @CurrentUser() user: UserResponseDto,
    @Query() query: ListOrdersQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<OrderListResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.ordersService.listOrders(user, query);
  }

  @Get(':orderId')
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      'Complete order details including immutable snapshots, fulfilment address, integer EUR totals, and full status transition history.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid order ID format.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiNotFoundResponse({
    description:
      'Order not found or does not belong to the authenticated user.',
  })
  async getOrderById(
    @CurrentUser() user: UserResponseDto,
    @Param() { orderId }: OrderIdParamDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<OrderResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.ordersService.getOrderById(user, orderId);
  }

  @Patch(':orderId/status')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Producer)
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      'Order status advanced successfully one linear step or returned idempotently if already in target state.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid status enum, malformed payload, or invalid order ID.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiForbiddenResponse({
    description: 'Only producers may advance order fulfilment.',
  })
  @ApiNotFoundResponse({
    description: 'Order not found or does not belong to the producer.',
  })
  @ApiConflictResponse({
    description:
      'State transition violation (invalid_status_transition), optimistic revision mismatch (revision_conflict), or blocked by open refund (confirmation_blocked_by_refund).',
  })
  async advanceOrderStatus(
    @CurrentUser() user: UserResponseDto,
    @Param() { orderId }: OrderIdParamDto,
    @Body() body: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.advanceOrderStatus(user, orderId, body);
  }

  @Post(':orderId/refund-requests')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Buyer)
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      'Creates or returns the open refund request for this Pending catalogue order.',
  })
  @ApiConflictResponse({
    description: 'Order is not eligible for a refund request.',
  })
  @ApiBadRequestResponse({
    description: 'Malformed order ID or invalid refund reason.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiForbiddenResponse({
    description: 'Only the order buyer may request a refund.',
  })
  @ApiNotFoundResponse({
    description: 'Order not found or does not belong to the buyer.',
  })
  async requestRefund(
    @CurrentUser() user: UserResponseDto,
    @Param() { orderId }: OrderIdParamDto,
    @Body() body: RefundReasonDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.requestRefund(user, orderId, body);
  }

  @Post(':orderId/refund-requests/accept')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Producer)
  @ApiOkResponse({
    type: OrderResponseDto,
    description: 'Accepts the open request and refunds the exact order total.',
  })
  @ApiConflictResponse({
    description:
      'No eligible open refund request or payment allocation is unavailable.',
  })
  @ApiBadRequestResponse({ description: 'Malformed order ID.' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiForbiddenResponse({
    description: 'Only the order producer may accept a refund.',
  })
  @ApiNotFoundResponse({
    description: 'Order not found or does not belong to the producer.',
  })
  async acceptRefund(
    @CurrentUser() user: UserResponseDto,
    @Param() { orderId }: OrderIdParamDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.decideRefund(user, orderId, true);
  }

  @Post(':orderId/refund-requests/decline')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Producer)
  @ApiOkResponse({
    type: OrderResponseDto,
    description: 'Declines the request with a required producer reason.',
  })
  @ApiBadRequestResponse({
    description: 'Malformed order ID or blank/invalid decline reason.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiForbiddenResponse({
    description: 'Only the order producer may decline a refund.',
  })
  @ApiNotFoundResponse({
    description: 'Order not found or does not belong to the producer.',
  })
  @ApiConflictResponse({ description: 'No eligible open refund request.' })
  async declineRefund(
    @CurrentUser() user: UserResponseDto,
    @Param() { orderId }: OrderIdParamDto,
    @Body() body: RefundReasonDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.decideRefund(user, orderId, false, body);
  }

  @Post(':orderId/cancel-refund')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Producer)
  @ApiOkResponse({
    type: OrderResponseDto,
    description: 'Cancels a Pending catalogue order and refunds it once.',
  })
  @ApiConflictResponse({
    description: 'Order is not eligible for cancellation and refund.',
  })
  @ApiBadRequestResponse({ description: 'Malformed order ID.' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiForbiddenResponse({
    description: 'Only the order producer may cancel and refund it.',
  })
  @ApiNotFoundResponse({
    description: 'Order not found or does not belong to the producer.',
  })
  async cancelAndRefund(
    @CurrentUser() user: UserResponseDto,
    @Param() { orderId }: OrderIdParamDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancelAndRefundOrder(user, orderId);
  }
}
