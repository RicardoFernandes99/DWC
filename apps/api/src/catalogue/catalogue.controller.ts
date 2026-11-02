import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CatalogueListDto,
  CatalogueProductDto,
  CatalogueQueryDto,
  ProducerIdParamDto,
  ProducerListDto,
  ProducerPublicDto,
  ProducerQueryDto,
} from './catalogue.dto.js';
import { CatalogueService } from './catalogue.service.js';

@ApiTags('Public catalogue')
@Controller()
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('products')
  @ApiOkResponse({ type: CatalogueListDto })
  @ApiBadRequestResponse({
    description: 'Invalid filters, price range, pagination or query fields.',
  })
  listProducts(@Query() query: CatalogueQueryDto): Promise<CatalogueListDto> {
    return this.catalogue.list(query);
  }

  @Get('products/:id')
  @ApiOkResponse({ type: CatalogueProductDto })
  @ApiBadRequestResponse({ description: 'Invalid product identifier.' })
  @ApiNotFoundResponse({ description: 'Product not found or unavailable.' })
  getProduct(
    @Param() params: ProducerIdParamDto,
  ): Promise<CatalogueProductDto> {
    return this.catalogue.getProduct(params.id);
  }

  @Get('producers')
  @ApiOkResponse({ type: ProducerListDto })
  @ApiBadRequestResponse({ description: 'Invalid search or pagination.' })
  listProducers(@Query() query: ProducerQueryDto): Promise<ProducerListDto> {
    return this.catalogue.listProducers(query);
  }

  @Get('producers/:id')
  @ApiOkResponse({ type: ProducerPublicDto })
  @ApiBadRequestResponse({ description: 'Invalid producer identifier.' })
  @ApiNotFoundResponse({ description: 'Producer not found or unavailable.' })
  getProducer(@Param() params: ProducerIdParamDto): Promise<ProducerPublicDto> {
    return this.catalogue.getProducer(params.id);
  }

  @Get('producers/:id/products')
  @ApiOkResponse({ type: CatalogueListDto })
  @ApiBadRequestResponse({
    description: 'Invalid producer identifier or catalogue filters.',
  })
  listProducerProducts(
    @Param() params: ProducerIdParamDto,
    @Query() query: CatalogueQueryDto,
  ): Promise<CatalogueListDto> {
    return this.catalogue.listProducerProducts(params.id, query);
  }
}
