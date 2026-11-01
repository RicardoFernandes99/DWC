import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '../users/user.schema.js';
import { AuthService } from '../auth/auth.service.js';
import {
  CreatePaymentMethodDto,
  ListPaymentMethodsQueryDto,
  PaymentMethodResponseDto,
} from './payment-method.dto.js';
import { PaymentMethodsService } from './payment-methods.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Payment methods')
@ApiBearerAuth()
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(
    private readonly auth: AuthService,
    private readonly paymentMethods: PaymentMethodsService,
  ) {}

  private async buyer(authorization: string | undefined) {
    const user = await this.auth.authenticate(authorization);
    if (user.role !== UserRole.Buyer)
      throw new ForbiddenException('Only buyers may manage payment methods.');
    return user;
  }

  @Post()
  @ApiCreatedResponse({ type: PaymentMethodResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid or expired payment method metadata, or unexpected fields.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only buyers may manage payment methods.',
  })
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() input: CreatePaymentMethodDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.buyer(authorization);
    return this.paymentMethods.create(user.id, input);
  }

  @Get()
  @ApiOkResponse({ type: PaymentMethodResponseDto, isArray: true })
  @ApiBadRequestResponse({
    description: 'Unexpected query fields are not accepted.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only buyers may manage payment methods.',
  })
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query() _query: ListPaymentMethodsQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.buyer(authorization);
    return this.paymentMethods.list(user.id);
  }
}
