import {
  Controller,
  Delete,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service.js';
import {
  MAX_PRODUCT_IMAGE_BYTES,
  type UploadedImageFileInput,
} from '../products/product-image.validator.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { UsersService } from '../users/users.service.js';

class UploadAvatarSwaggerDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: unknown;
}

@ApiTags('account')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, expired or revoked access JWT.',
})
@Controller('account')
export class AccountController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Put('avatar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: UploadAvatarSwaggerDto,
    description:
      'Raster image (JPEG, PNG or WebP; SVG rejected; max 5 MB; 1..4096 px per side). Replaces any existing picture.',
  })
  @ApiOkResponse({
    type: UserResponseDto,
    description:
      'Profile picture stored privately; the signed URL is returned.',
  })
  @ApiBadRequestResponse({
    description:
      'Missing file, unsupported or spoofed format, or invalid dimensions.',
  })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds 5 MB.' })
  @ApiServiceUnavailableResponse({ description: 'Image storage unavailable.' })
  async uploadAvatar(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile() file: UploadedImageFileInput | undefined,
  ): Promise<UserResponseDto> {
    const user = await this.auth.authenticate(authorization);
    return this.users.setAvatar(user.id, file);
  }

  @Delete('avatar')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'Profile picture removed; initials are shown instead.',
  })
  async removeAvatar(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<UserResponseDto> {
    const user = await this.auth.authenticate(authorization);
    return this.users.removeAvatar(user.id);
  }
}
