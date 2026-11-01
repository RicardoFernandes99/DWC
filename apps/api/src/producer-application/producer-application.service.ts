import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProducerStatus,
  User,
  UserDocument,
  UserRole,
} from '../users/user.schema.js';
import {
  ProducerApplicationResponseDto,
  SubmitProducerApplicationDto,
} from './producer-application.dto.js';

function toResponse(user: UserDocument): ProducerApplicationResponseDto {
  const status = user.producerStatus ?? ProducerStatus.Pending;
  const isRejected = status === ProducerStatus.Rejected;
  const rejectionReason = isRejected
    ? (user.producerRejectionReason ?? null)
    : null;
  const app = user.producerApplication;

  return {
    status,
    rejectionReason,
    submittedAt: app
      ? (app.submittedAt instanceof Date
          ? app.submittedAt
          : new Date(app.submittedAt)
        ).toISOString()
      : null,
    application: app
      ? {
          farmName: app.farmName,
          description: app.description,
          city: app.city,
          collectionAddress: app.collectionAddress,
          latitude: app.latitude,
          longitude: app.longitude,
        }
      : null,
  };
}

@Injectable()
export class ProducerApplicationService {
  constructor(
    @InjectModel(User.name)
    private readonly users: Model<User>,
  ) {}

  async get(userId: string): Promise<ProducerApplicationResponseDto> {
    const user = await this.users.findById(userId);
    if (!user || user.role !== UserRole.Producer) {
      throw new NotFoundException('User not found.');
    }
    return toResponse(user);
  }

  async submit(
    userId: string,
    input: SubmitProducerApplicationDto,
  ): Promise<ProducerApplicationResponseDto> {
    const user = await this.users.findOneAndUpdate(
      {
        _id: new Types.ObjectId(userId),
        role: UserRole.Producer,
        producerStatus: ProducerStatus.Pending,
      },
      {
        $set: {
          producerApplication: {
            farmName: input.farmName,
            description: input.description,
            city: input.city,
            collectionAddress: input.collectionAddress,
            latitude: input.latitude,
            longitude: input.longitude,
            submittedAt: new Date(),
          },
          producerRejectionReason: null,
        },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!user) {
      const existing = await this.users.findById(userId);
      if (!existing || existing.role !== UserRole.Producer) {
        throw new NotFoundException('User not found.');
      }
      throw new ConflictException(
        'Only pending producer applications can be saved directly.',
      );
    }

    return toResponse(user);
  }

  async resubmit(
    userId: string,
    input: SubmitProducerApplicationDto,
  ): Promise<ProducerApplicationResponseDto> {
    const user = await this.users.findOneAndUpdate(
      {
        _id: new Types.ObjectId(userId),
        role: UserRole.Producer,
        producerStatus: ProducerStatus.Rejected,
      },
      {
        $set: {
          producerStatus: ProducerStatus.Pending,
          producerRejectionReason: null,
          producerApplication: {
            farmName: input.farmName,
            description: input.description,
            city: input.city,
            collectionAddress: input.collectionAddress,
            latitude: input.latitude,
            longitude: input.longitude,
            submittedAt: new Date(),
          },
        },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!user) {
      const existing = await this.users.findById(userId);
      if (!existing || existing.role !== UserRole.Producer) {
        throw new NotFoundException('User not found.');
      }
      throw new ConflictException(
        'Only rejected producer applications can be resubmitted.',
      );
    }

    return toResponse(user);
  }
}
