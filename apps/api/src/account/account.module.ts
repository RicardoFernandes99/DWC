import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountController } from './account.controller.js';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AccountController],
})
export class AccountModule {}
