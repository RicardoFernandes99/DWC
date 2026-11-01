import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service.js';
import { ProducerStatus, UserRole } from '../users/user.schema.js';
import {
  ArchiveProducerProductDto,
  CreateProducerProductDto,
  GetProducerProductQueryDto,
  ListProducerProductsQueryDto,
  ProductIdParamDto,
  ProducerProductListResponseDto,
  ProducerProductResponseDto,
  UpdateProducerProductDto,
} from './product.dto.js';
import { ProductsService } from './products.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Producer products')
@ApiBearerAuth()
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@Controller('producer/products')
export class ProducerProductsController {
  constructor(
    private readonly auth: AuthService,
    private readonly products: ProductsService,
  ) {}

  private async approvedProducer(authorization: string | undefined) {
    const user = await this.auth.authenticate(authorization);
    if (
      user.role !== UserRole.Producer ||
      user.producerStatus !== ProducerStatus.Approved
    ) {
      throw new ForbiddenException(
        'Only approved producers may manage products.',
      );
    }
    return user;
  }

  @Get()
  @ApiOkResponse({
    type: ProducerProductListResponseDto,
    description: 'Paginated list of the producer’s own products.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid pagination bounds, filters or query fields.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only approved producers may manage products.',
  })
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListProducerProductsQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<ProducerProductListResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.approvedProducer(authorization);
    return this.products.listForProducer(user.id, query);
  }

  @Post()
  @ApiCreatedResponse({
    type: ProducerProductResponseDto,
    description: 'Product created.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid product fields, bounds or unexpected properties.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only approved producers may manage products.',
  })
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() input: CreateProducerProductDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<ProducerProductResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.approvedProducer(authorization);
    return this.products.createForProducer(user.id, input);
  }

  @Get(':id')
  @ApiOkResponse({
    type: ProducerProductResponseDto,
    description: 'Producer product details and current stock/revision.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid product identifier or unexpected query fields.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only approved producers may manage products.',
  })
  @ApiNotFoundResponse({
    description: 'Product not found.',
  })
  async get(
    @Headers('authorization') authorization: string | undefined,
    @Param() params: ProductIdParamDto,
    @Query() _query: GetProducerProductQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<ProducerProductResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.approvedProducer(authorization);
    return this.products.getForProducer(user.id, params.id);
  }

  @Patch(':id')
  @ApiOkResponse({
    type: ProducerProductResponseDto,
    description: 'Product updated.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid product identifier, fields or unexpected properties.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only approved producers may manage products.',
  })
  @ApiNotFoundResponse({
    description: 'Product not found.',
  })
  @ApiConflictResponse({
    description:
      'Product is archived or its revision/stock changed concurrently.',
  })
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param() params: ProductIdParamDto,
    @Body() input: UpdateProducerProductDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<ProducerProductResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.approvedProducer(authorization);
    return this.products.updateForProducer(user.id, params.id, input);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: ProducerProductResponseDto,
    description:
      'Product archived and unpublished while preserving historical references.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid product identifier or revision payload.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired or revoked access JWT.',
  })
  @ApiForbiddenResponse({
    description: 'Only approved producers may manage products.',
  })
  @ApiNotFoundResponse({
    description: 'Product not found.',
  })
  @ApiConflictResponse({
    description:
      'Product is already archived or its revision changed concurrently.',
  })
  async archive(
    @Headers('authorization') authorization: string | undefined,
    @Param() params: ProductIdParamDto,
    @Body() input: ArchiveProducerProductDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<ProducerProductResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    const user = await this.approvedProducer(authorization);
    return this.products.archiveForProducer(user.id, params.id, input);
  }
}
