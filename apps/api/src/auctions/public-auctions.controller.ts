import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, RoleGuard, Roles } from '../auth/role.guard.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { UserRole } from '../users/user.schema.js';
import {
  AuctionBuyerResultResponseDto,
  AuctionIdParamDto,
  AuctionHistoryQueryDto,
  AuctionHistoryResponseDto,
  AuctionListResponseDto,
  AuctionResponseDto,
  AuctionLiveStateDto,
  ListPublicAuctionsQueryDto,
} from './auction.dto.js';
import { AuctionsService } from './auctions.service.js';

@ApiTags('Auctions')
@Controller('auctions')
export class PublicAuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get()
  @ApiOperation({ summary: 'Browse upcoming, active and time-ended auctions.' })
  @ApiOkResponse({ type: AuctionListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination or state filter.' })
  list(
    @Query() query: ListPublicAuctionsQueryDto,
  ): Promise<AuctionListResponseDto> {
    return this.auctions.listPublic(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Read a public auction and its immutable product snapshot.',
  })
  @ApiOkResponse({ type: AuctionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid auction identifier.' })
  @ApiNotFoundResponse({
    description: 'Auction not found or not publicly visible.',
  })
  get(@Param() param: AuctionIdParamDto): Promise<AuctionResponseDto> {
    return this.auctions.getPublic(param.id);
  }

  @Get(':id/live')
  @ApiOperation({ summary: 'Read the current server auction state and time.' })
  @ApiOkResponse({ type: AuctionLiveStateDto })
  @ApiBadRequestResponse({ description: 'Invalid auction identifier.' })
  @ApiNotFoundResponse({ description: 'Auction not found.' })
  live(
    @Param() param: AuctionIdParamDto,
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ): Promise<AuctionLiveStateDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.auctions.getLiveState(param.id, 0);
  }

  @Get(':id/result')
  @UseGuards(RoleGuard)
  @Roles(UserRole.Buyer)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Read the authenticated buyer’s persisted auction result.',
  })
  @ApiOkResponse({ type: AuctionBuyerResultResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid auction identifier.' })
  @ApiUnauthorizedResponse({ description: 'Buyer session is unavailable.' })
  @ApiForbiddenResponse({ description: 'Only buyers may read this result.' })
  @ApiNotFoundResponse({ description: 'Auction not found.' })
  result(
    @Param() param: AuctionIdParamDto,
    @CurrentUser() buyer: UserResponseDto,
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ): Promise<AuctionBuyerResultResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.auctions.getBuyerResult(param.id, buyer);
  }

  @Get(':id/bids')
  @ApiOperation({ summary: 'Read public, paginated auction bid history.' })
  @ApiOkResponse({ type: AuctionHistoryResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid auction identifier or pagination.',
  })
  @ApiNotFoundResponse({ description: 'Auction not found.' })
  history(
    @Param() param: AuctionIdParamDto,
    @Query() query: AuctionHistoryQueryDto,
  ): Promise<AuctionHistoryResponseDto> {
    return this.auctions.listPublicHistory(param.id, query);
  }
}
