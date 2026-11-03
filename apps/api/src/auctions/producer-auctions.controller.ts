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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, RoleGuard, Roles } from '../auth/role.guard.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { UserRole } from '../users/user.schema.js';
import {
  AuctionIdParamDto,
  AuctionListResponseDto,
  AuctionResponseDto,
  CancelAuctionDto,
  CreateAuctionDto,
  ListAuctionsQueryDto,
  UpdateAuctionDto,
} from './auction.dto.js';
import { AuctionsService } from './auctions.service.js';

@ApiTags('Producer auctions')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'Request input is invalid.' })
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiServiceUnavailableResponse({
  description: 'Authentication service is unavailable.',
})
@UseGuards(RoleGuard)
@Roles(UserRole.Producer)
@Controller('producer/auctions')
export class ProducerAuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated producer’s auctions.' })
  @ApiOkResponse({ type: AuctionListResponseDto })
  @ApiForbiddenResponse({ description: 'Producer access is required.' })
  list(
    @CurrentUser() user: UserResponseDto,
    @Query() query: ListAuctionsQueryDto,
  ): Promise<AuctionListResponseDto> {
    return this.auctions.listForProducer(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a scheduled auction and reserve its lot.' })
  @ApiCreatedResponse({ type: AuctionResponseDto })
  @ApiConflictResponse({ description: 'Product stock or eligibility changed.' })
  @ApiForbiddenResponse({
    description: 'Only an approved producer may create auctions.',
  })
  create(
    @CurrentUser() user: UserResponseDto,
    @Body() input: CreateAuctionDto,
  ): Promise<AuctionResponseDto> {
    return this.auctions.create(user.id, input);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Read one of the authenticated producer’s auctions.',
  })
  @ApiOkResponse({ type: AuctionResponseDto })
  @ApiNotFoundResponse({ description: 'Auction not found.' })
  get(
    @CurrentUser() user: UserResponseDto,
    @Param() param: AuctionIdParamDto,
  ): Promise<AuctionResponseDto> {
    return this.auctions.getForProducer(user.id, param.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a scheduled auction before its start.' })
  @ApiOkResponse({ type: AuctionResponseDto })
  @ApiConflictResponse({
    description: 'Auction started, revision is stale, or stock changed.',
  })
  @ApiNotFoundResponse({ description: 'Auction not found.' })
  update(
    @CurrentUser() user: UserResponseDto,
    @Param() param: AuctionIdParamDto,
    @Body() input: UpdateAuctionDto,
  ): Promise<AuctionResponseDto> {
    return this.auctions.update(user.id, param.id, input);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a scheduled auction and release its reserved lot.',
  })
  @ApiOkResponse({ type: AuctionResponseDto })
  @ApiConflictResponse({
    description:
      'Auction started, revision is stale, or stock could not be released.',
  })
  @ApiNotFoundResponse({ description: 'Auction not found.' })
  cancel(
    @CurrentUser() user: UserResponseDto,
    @Param() param: AuctionIdParamDto,
    @Body() input: CancelAuctionDto,
  ): Promise<AuctionResponseDto> {
    return this.auctions.cancel(user.id, param.id, input);
  }
}
