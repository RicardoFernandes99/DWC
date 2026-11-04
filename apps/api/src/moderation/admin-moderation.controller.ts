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
  AdminProductDetailDto,
  AdminProductListResponseDto,
  AdminReviewDetailDto,
  AdminReviewReportListResponseDto,
  HideContentDto,
  ListAdminProductsQueryDto,
  ListAdminReviewReportsQueryDto,
  ModerationIdParamDto,
  RestoreContentDto,
} from './moderation.dto.js';
import { ModerationService } from './moderation.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

const requireAdminId = (request: AdminRequest): string => {
  if (!request.adminUser?.id) throw new UnauthorizedException();
  return request.adminUser.id;
};

const noStore = (response: HeaderResponse): void =>
  response.setHeader('Cache-Control', 'no-store');

@ApiTags('Admin moderation')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, expired or revoked access JWT.',
})
@ApiForbiddenResponse({ description: 'Administrator access is required.' })
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@UseGuards(AdminGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  @ApiOkResponse({
    type: AdminProductListResponseDto,
    description: 'Products of any producer status, hidden or visible.',
  })
  @ApiBadRequestResponse({ description: 'Invalid query.' })
  async list(
    @Query() query: ListAdminProductsQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProductListResponseDto> {
    noStore(response);
    return this.moderation.listProducts(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminProductDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid product identifier.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  async get(
    @Param() params: ModerationIdParamDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProductDetailDto> {
    noStore(response);
    return this.moderation.getProduct(params.id);
  }

  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AdminProductDetailDto,
    description:
      'Product hidden from public views and checkout. Publication, stock and auctions are unchanged; the producer is notified.',
  })
  @ApiBadRequestResponse({ description: 'Invalid identifier or body.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({
    description: 'Code `already_hidden` or `stale_revision`.',
  })
  async hide(
    @Param() params: ModerationIdParamDto,
    @Body() input: HideContentDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProductDetailDto> {
    noStore(response);
    return this.moderation.hideProduct(
      params.id,
      requireAdminId(request),
      input,
    );
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AdminProductDetailDto,
    description:
      'Moderation cleared. The product is public again only if still published, unarchived and its producer is approved.',
  })
  @ApiBadRequestResponse({ description: 'Invalid identifier or body.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({
    description: 'Code `not_hidden` or `stale_revision`.',
  })
  async restore(
    @Param() params: ModerationIdParamDto,
    @Body() input: RestoreContentDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminProductDetailDto> {
    noStore(response);
    return this.moderation.restoreProduct(params.id, input);
  }
}

@ApiTags('Admin moderation')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, expired or revoked access JWT.',
})
@ApiForbiddenResponse({ description: 'Administrator access is required.' })
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminReviewsController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('review-reports')
  @ApiOkResponse({
    type: AdminReviewReportListResponseDto,
    description: 'Reported reviews, latest report first.',
  })
  @ApiBadRequestResponse({ description: 'Invalid query.' })
  async listReports(
    @Query() query: ListAdminReviewReportsQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminReviewReportListResponseDto> {
    noStore(response);
    return this.moderation.listReviewReports(query);
  }

  @Get('reviews/:id')
  @ApiOkResponse({
    type: AdminReviewDetailDto,
    description: 'Review with moderation state and its reports.',
  })
  @ApiBadRequestResponse({ description: 'Invalid review identifier.' })
  @ApiNotFoundResponse({ description: 'Review not found.' })
  async get(
    @Param() params: ModerationIdParamDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminReviewDetailDto> {
    noStore(response);
    return this.moderation.getReview(params.id);
  }

  @Post('reviews/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AdminReviewDetailDto,
    description: 'Review hidden from public lists and rating aggregates.',
  })
  @ApiBadRequestResponse({ description: 'Invalid identifier or body.' })
  @ApiNotFoundResponse({ description: 'Review not found.' })
  @ApiConflictResponse({
    description: 'Code `already_hidden` or `stale_revision`.',
  })
  async hide(
    @Param() params: ModerationIdParamDto,
    @Body() input: HideContentDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminReviewDetailDto> {
    noStore(response);
    return this.moderation.hideReview(
      params.id,
      requireAdminId(request),
      input,
    );
  }

  @Post('reviews/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminReviewDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid identifier or body.' })
  @ApiNotFoundResponse({ description: 'Review not found.' })
  @ApiConflictResponse({
    description: 'Code `not_hidden` or `stale_revision`.',
  })
  async restore(
    @Param() params: ModerationIdParamDto,
    @Body() input: RestoreContentDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<AdminReviewDetailDto> {
    noStore(response);
    return this.moderation.restoreReview(params.id, input);
  }
}
