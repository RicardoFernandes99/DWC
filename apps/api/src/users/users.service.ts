import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { PublicRegisterRole, RegisterUserDto } from './register-user.dto.js';
import { ProducerStatus, User, UserDocument, UserRole } from './user.schema.js';
import { UserResponseDto } from './user-response.dto.js';
import {
  MAX_SIGNED_GET_URL_EXPIRES_IN_SECONDS,
  StorageService,
} from '../storage/storage.service.js';
import {
  type UploadedImageFileInput,
  validateProductImage,
} from '../products/product-image.validator.js';

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

function toUserResponse(
  user: UserDocument,
  avatarUrl: string | null,
): UserResponseDto {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    producerStatus: user.producerStatus,
    producerRejectionReason:
      user.role === UserRole.Producer &&
      user.producerStatus === ProducerStatus.Rejected
        ? (user.producerRejectionReason ?? null)
        : null,
    buyerStatus: user.buyerStatus ?? 'active',
    buyerSuspensionReason:
      user.role === UserRole.Buyer && user.buyerStatus === 'suspended'
        ? (user.buyerSuspensionReason ?? null)
        : null,
    avatarUrl,
  };
}

/** Avatar URLs last the maximum signing window; the session refetches often. */
const AVATAR_URL_SECONDS = MAX_SIGNED_GET_URL_EXPIRES_IN_SECONDS;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly storage: StorageService,
  ) {}

  private toResponse(user: UserDocument): UserResponseDto {
    let avatarUrl: string | null = null;
    if (user.avatarKey) {
      try {
        avatarUrl = this.storage.createSignedGetUrl(
          user.avatarKey,
          AVATAR_URL_SECONDS,
        ).url;
      } catch {
        // Signing is local; a failure falls back to initials.
        avatarUrl = null;
      }
    }
    return toUserResponse(user, avatarUrl);
  }

  /** Validates, stores and links a new profile picture, removing the old one. */
  async setAvatar(
    userId: string,
    file: UploadedImageFileInput | undefined,
  ): Promise<UserResponseDto> {
    const validated = validateProductImage(file, 'profile picture');
    const key = `avatars/${userId}/${randomUUID()}.${validated.extension}`;
    try {
      await this.storage.putObject({
        key,
        body: file!.buffer!,
        contentType: validated.mimeType,
        cacheControl: 'private, max-age=300',
      });
    } catch {
      this.logger.error(`Avatar upload to S3 failed for userId="${userId}".`);
      throw new ServiceUnavailableException(
        'Profile picture storage is currently unavailable.',
      );
    }
    const previous = await this.users.findByIdAndUpdate(
      userId,
      { $set: { avatarKey: key } },
      { new: false },
    );
    if (!previous) {
      await this.deleteQuietly(key);
      throw new NotFoundException('User not found.');
    }
    if (previous.avatarKey) await this.deleteQuietly(previous.avatarKey);
    const current = await this.users.findById(userId);
    return this.toResponse(current!);
  }

  async removeAvatar(userId: string): Promise<UserResponseDto> {
    const previous = await this.users.findByIdAndUpdate(
      userId,
      { $set: { avatarKey: null } },
      { new: false },
    );
    if (!previous) throw new NotFoundException('User not found.');
    if (previous.avatarKey) await this.deleteQuietly(previous.avatarKey);
    const current = await this.users.findById(userId);
    return this.toResponse(current!);
  }

  private async deleteQuietly(key: string) {
    try {
      await this.storage.deleteObject(key);
    } catch {
      this.logger.warn('Could not delete a replaced profile picture object.');
    }
  }

  async verifyCredentials(email: string, password: string) {
    const user = await this.users
      .findOne({ email: email.trim().toLowerCase() })
      .select('+passwordHash');
    // Always perform bcrypt work, including for unknown accounts.
    const hash =
      user?.passwordHash ??
      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxWxLyZfQMP.YGJkLb0F2PfZL3K';
    const valid = await bcrypt.compare(password, hash);
    return user && valid ? this.toResponse(user) : null;
  }

  async findCurrent(id: string) {
    const user = await this.users.findById(id);
    return user ? this.toResponse(user) : null;
  }

  async register(input: RegisterUserDto) {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const role =
      input.role === PublicRegisterRole.Producer
        ? UserRole.Producer
        : UserRole.Buyer;

    try {
      const user = await this.users.create({
        name: input.name.trim(),
        email,
        passwordHash,
        role,
        producerStatus:
          role === UserRole.Producer ? ProducerStatus.Pending : null,
      });
      return this.toResponse(user);
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
