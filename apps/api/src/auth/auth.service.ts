import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import { UsersService } from '../users/users.service.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import { LoginDto } from './auth.dto.js';
import { SessionsService } from './sessions.service.js';

@Injectable()
export class AuthService {
  private readonly key: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    config: ConfigService,
  ) {
    this.key = new TextEncoder().encode(
      config.getOrThrow<string>('JWT_SECRET'),
    );
    this.issuer = config.getOrThrow<string>('JWT_ISSUER');
    this.audience = config.getOrThrow<string>('JWT_AUDIENCE');
  }

  private async response(
    user: UserResponseDto,
    session: { id: string; token: string; expiresAt: number },
  ) {
    const accessToken = await new SignJWT({ sid: session.id })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.key);
    return {
      body: { accessToken, expiresIn: 900, user },
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

  async login(input: LoginDto) {
    // bcrypt truncates at 72 bytes. Reject longer input rather than authenticating its prefix.
    if (Buffer.byteLength(input.password) > 72)
      throw new UnauthorizedException('Invalid email or password.');
    const user = await this.users.verifyCredentials(
      input.email,
      input.password,
    );
    if (!user) throw new UnauthorizedException('Invalid email or password.');
    return this.response(user, await this.sessions.create(user.id));
  }

  async refresh(token: string | undefined) {
    const session = await this.sessions.rotate(token);
    const user = await this.users.findCurrent(session.userId);
    if (!user) throw new UnauthorizedException();
    return this.response(user, session);
  }

  logout(token: string | undefined) {
    return this.sessions.revoke(token);
  }

  async authenticate(header: string | undefined) {
    if (!header || header.length > 2048 || !header.startsWith('Bearer '))
      throw new UnauthorizedException();
    let identity: { userId: string; sessionId: string };
    try {
      const { payload } = await jwtVerify(header.slice(7), this.key, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
        requiredClaims: ['sub', 'sid', 'iat', 'exp'],
      });
      if (
        typeof payload.sub !== 'string' ||
        !/^[0-9a-f]{24}$/.test(payload.sub) ||
        typeof payload.sid !== 'string' ||
        !/^[0-9a-f-]{36}$/.test(payload.sid)
      )
        throw new Error();
      identity = { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new UnauthorizedException();
    }
    await this.sessions.require(identity.sessionId, identity.userId);
    const user = await this.users.findCurrent(identity.userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
