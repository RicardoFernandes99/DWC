import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserResponseDto } from '../users/user-response.dto.js';
import { UserRole } from '../users/user.schema.js';
import { AuthService } from './auth.service.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedUserRequest {
  headers?: {
    authorization?: string;
    [key: string]: string | string[] | undefined;
  };
  user?: UserResponseDto;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserResponseDto => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedUserRequest>();
    if (!request.user) {
      throw new ForbiddenException('User context is unavailable.');
    }
    return request.user;
  },
);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()].filter(
      (target) =>
        typeof target === 'function' ||
        (typeof target === 'object' && target !== null),
    );
    const requiredRoles =
      targets.length > 0
        ? this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, targets)
        : undefined;

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedUserRequest>();
    const rawHeader = request.headers?.authorization;
    const authorization = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    const user = await this.auth.authenticate(authorization);
    request.user = user;

    const roles = requiredRoles ?? [UserRole.Buyer];
    if (roles.length > 0 && !roles.includes(user.role)) {
      if (roles.length === 1 && roles[0] === UserRole.Buyer) {
        throw new ForbiddenException('Buyer access is required.');
      }
      throw new ForbiddenException(
        `Access requires one of: ${roles.join(', ')}.`,
      );
    }

    return true;
  }
}
