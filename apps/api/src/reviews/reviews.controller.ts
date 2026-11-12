import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
  CreateReviewDto,
  ListProducerReviewsQueryDto,
  OrderReviewStatusDto,
  OwnReviewDto,
  ProducerReviewListDto,
  ReportReviewDto,
  ReviewIdParamDto,
  ReviewOrderIdParamDto,
  ReviewProducerIdParamDto,
  ReviewReportResultDto,
} from './review.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(RoleGuard)
  @Roles(UserRole.Buyer)
  @ApiCreatedResponse({
    type: OwnReviewDto,
    description:
      'Review created for the producer of a delivered or collected order owned by the buyer (auction orders included).',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid order ID, rating (integer 1-5) or comment (max 1000 characters).',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiForbiddenResponse({ description: 'Only buyers may create reviews.' })
  @ApiNotFoundResponse({
    description: 'Order not found or not owned by the buyer.',
  })
  @ApiConflictResponse({
    description:
      'order_not_reviewable (order not delivered/collected) or review_exists (order already reviewed).',
  })
  create(
    @CurrentUser() user: UserResponseDto,
    @Body() body: CreateReviewDto,
  ): Promise<OwnReviewDto> {
    return this.reviews.create(user, body);
  }

  @Get('orders/:orderId')
  @ApiBearerAuth()
  @UseGuards(RoleGuard)
  @Roles(UserRole.Buyer)
  @ApiOkResponse({
    type: OrderReviewStatusDto,
    description:
      'Whether the buyer may review this order now, and the existing review if any.',
  })
  @ApiBadRequestResponse({ description: 'Invalid order ID.' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiForbiddenResponse({ description: 'Only buyers may use this endpoint.' })
  @ApiNotFoundResponse({
    description: 'Order not found or not owned by the buyer.',
  })
  getOrderStatus(
    @CurrentUser() user: UserResponseDto,
    @Param() { orderId }: ReviewOrderIdParamDto,
  ): Promise<OrderReviewStatusDto> {
    return this.reviews.getOrderStatus(user, orderId);
  }

  @Post(':reviewId/reports')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(RoleGuard)
  @Roles(UserRole.Buyer, UserRole.Producer)
  @ApiOkResponse({
    type: ReviewReportResultDto,
    description:
      'Report recorded. Retries by the same user are idempotent and keep the first report. Reporter identity is never exposed.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid review ID, category (spam, offensive, off_topic, false_information, other) or note (max 500 characters).',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access token.',
  })
  @ApiForbiddenResponse({
    description:
      'Role not allowed, or own_review: authors cannot report their own review.',
  })
  @ApiNotFoundResponse({ description: 'Review not found or not visible.' })
  report(
    @CurrentUser() user: UserResponseDto,
    @Param() { reviewId }: ReviewIdParamDto,
    @Body() body: ReportReviewDto,
  ): Promise<ReviewReportResultDto> {
    return this.reviews.report(user, reviewId, body);
  }
}

@ApiTags('Reviews')
@Controller('producers/:producerId/reviews')
export class ProducerReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOkResponse({
    type: ProducerReviewListDto,
    description:
      'Public, newest-first page of visible reviews with a visible-only rating summary. Exposes the reviewer first name only.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid producer ID or pagination (page >= 1, limit 1-50).',
  })
  @ApiNotFoundResponse({ description: 'Producer not found or unavailable.' })
  list(
    @Param() { producerId }: ReviewProducerIdParamDto,
    @Query() query: ListProducerReviewsQueryDto,
  ): Promise<ProducerReviewListDto> {
    return this.reviews.listForProducer(producerId, query);
  }
}
