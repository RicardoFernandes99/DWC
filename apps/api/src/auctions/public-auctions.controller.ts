import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuctionIdParamDto,
  AuctionListResponseDto,
  AuctionResponseDto,
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
}
