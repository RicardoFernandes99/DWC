import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserResponseDto } from '../users/user-response.dto.js';
import { UserRole } from '../users/user.schema.js';
import { AuthService } from './auth.service.js';

export interface AdminRequest {
  headers?: {
    authorization?: string;
    [key: string]: string | string[] | undefined;
  };
  adminUser?: UserResponseDto;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const rawHeader = request.headers?.authorization;
    const authorization = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const user = await this.auth.authenticate(authorization);
    if (user.role !== UserRole.Admin) {
      throw new ForbiddenException('Administrator access is required.');
    }
    request.adminUser = user;
    return true;
  }
}
