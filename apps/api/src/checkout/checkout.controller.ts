import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, RoleGuard, Roles } from '../auth/role.guard.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { UserRole } from '../users/user.schema.js';
import {
  CheckoutPriceChangedConflictDto,
  CheckoutQuoteResponseDto,
  CheckoutResponseDto,
  QuoteCheckoutDto,
  SubmitCheckoutDto,
} from './checkout.dto.js';
import { CheckoutService } from './checkout.service.js';

@ApiTags('Checkout')
@ApiBearerAuth()
@ApiServiceUnavailableResponse({
  description: 'Authentication or database storage unavailable.',
})
@UseGuards(RoleGuard)
@Roles(UserRole.Buyer)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: CheckoutQuoteResponseDto,
    description:
      'Calculated advisory quote with canonical line items, grouped producer totals, delivery fees and issues.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid item bounds, quantities, invalid product ID format, or missing delivery address.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only buyers may quote or complete checkout.',
  })
  async quote(
    @CurrentUser() user: UserResponseDto,
    @Body() input: QuoteCheckoutDto,
  ): Promise<CheckoutQuoteResponseDto> {
    return this.checkoutService.quote(user.id, input);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    type: CheckoutResponseDto,
    description:
      'Checkout completed atomically. Orders created in pending status and stock decremented.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid items, missing delivery address for delivery, or invalid/expired payment method.',
  })
  @ApiConflictResponse({
    type: CheckoutPriceChangedConflictDto,
    description:
      'Pricing/revision shifted (price_changed), stock insufficient (insufficient_stock), producer suspended (producer_suspended), or idempotency mismatch (idempotency_mismatch).',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only buyers may complete checkout.',
  })
  async checkout(
    @CurrentUser() user: UserResponseDto,
    @Body() input: SubmitCheckoutDto,
  ): Promise<CheckoutResponseDto> {
    return this.checkoutService.submitCheckout(user.id, input);
  }
}
