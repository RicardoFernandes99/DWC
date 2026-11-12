import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserResponseDto } from '../users/user-response.dto.js';
import { AuthResponseDto, LoginDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

interface CookieResponse {
  setHeader(name: string, value: string): void;
}
const COOKIE = 'dwc_refresh';

@ApiTags('Authentication')
@ApiServiceUnavailableResponse({
  description: 'Authentication storage unavailable.',
})
@Controller('auth')
export class AuthController {
  private readonly webOrigin: string;
  private readonly backofficeOrigin: string;
  private readonly secure: boolean;
  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.webOrigin = config.getOrThrow<string>('WEB_ORIGIN');
    this.backofficeOrigin = config.getOrThrow<string>('BACKOFFICE_ORIGIN');
    this.secure = config.getOrThrow<string>('AUTH_COOKIE_SECURE') === 'true';
  }

  private credential(cookie: string | undefined) {
    return cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
  }
  private checkOrigin(origin: string | undefined) {
    if (origin !== this.webOrigin && origin !== this.backofficeOrigin)
      throw new ForbiddenException('Origin is not allowed.');
  }
  private cookie(response: CookieResponse, token: string, expiresAt: number) {
    const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    response.setHeader(
      'Set-Cookie',
      `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=${maxAge}; Expires=${new Date(expiresAt).toUTCString()}${this.secure ? '; Secure' : ''}`,
    );
    response.setHeader('Cache-Control', 'no-store');
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @ApiOkResponse({
    type: AuthResponseDto,
    description:
      'Access JWT and HttpOnly dwc_refresh cookie. Session expires absolutely after 7 days.',
  })
  @ApiBadRequestResponse({ description: 'Invalid or oversized input.' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @ApiTooManyRequestsResponse({
    description:
      'At most 10 login attempts per IP per minute. Retry after the indicated delay.',
  })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const result = await this.auth.login(input);
    this.cookie(response, result.token, result.expiresAt);
    return result.body;
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth('refresh')
  @ApiHeader({
    name: 'Origin',
    required: true,
    description:
      'Must equal configured WEB_ORIGIN or BACKOFFICE_ORIGIN, including non-browser clients.',
  })
  @ApiOkResponse({
    type: AuthResponseDto,
    description:
      'Rotates the refresh cookie once without extending the original session expiry.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, expired, invalid or reused cookie.',
  })
  @ApiForbiddenResponse({ description: 'Missing or untrusted Origin.' })
  async refresh(
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    this.checkOrigin(origin);
    const result = await this.auth.refresh(this.credential(cookie));
    this.cookie(response, result.token, result.expiresAt);
    return result.body;
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth('refresh')
  @ApiHeader({
    name: 'Origin',
    required: true,
    description: 'Must equal configured WEB_ORIGIN or BACKOFFICE_ORIGIN.',
  })
  @ApiNoContentResponse({
    description:
      'Revokes only this cookie session and clears the cookie. Also succeeds for absent or invalid cookies. Do not refresh/retry automatically.',
  })
  @ApiForbiddenResponse({ description: 'Missing or untrusted Origin.' })
  async logout(
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    this.checkOrigin(origin);
    await this.auth.logout(this.credential(cookie));
    this.cookie(response, '', 0);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired or revoked access JWT, or missing user.',
  })
  async me(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.auth.authenticate(authorization);
  }
}
