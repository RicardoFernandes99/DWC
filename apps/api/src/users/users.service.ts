import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { RegisterUserDto } from './register-user.dto.js';
import { ProducerStatus, User, UserDocument, UserRole } from './user.schema.js';
import { UserResponseDto } from './user-response.dto.js';

const BCRYPT_COST = 12;

function isDuplicateEmailError(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    error.code !== 11000 ||
    !('keyPattern' in error)
  ) {
    return false;
  }

  const keyPattern = error.keyPattern;
  return (
    typeof keyPattern === 'object' &&
    keyPattern !== null &&
    'email' in keyPattern
  );
}

function toUserResponse(user: UserDocument): UserResponseDto {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    producerStatus: user.producerStatus,
  };
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  async onModuleInit(): Promise<void> {
    await this.users.createIndexes();
  }

  async register(input: RegisterUserDto): Promise<UserResponseDto> {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    try {
      const user = await this.users.create({
        name: input.name.trim(),
        email,
        passwordHash,
        role: input.role,
        producerStatus:
          input.role === UserRole.Producer ? ProducerStatus.Pending : null,
      });
      return toUserResponse(user);
    } catch (error: unknown) {
      if (isDuplicateEmailError(error)) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      throw error;
    }
  }
}
