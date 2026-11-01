import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterUserDto } from './register-user.dto.js';
import { UserResponseDto } from './user-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('auth')
@Controller('auth')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a buyer or producer account' })
  @ApiCreatedResponse({
    description: 'Account created. Registration does not sign the user in.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid input, unsupported role, or unknown/privileged field.',
  })
  @ApiConflictResponse({ description: 'An account already uses this email.' })
  register(@Body() input: RegisterUserDto): Promise<UserResponseDto> {
    return this.users.register(input);
  }
}
