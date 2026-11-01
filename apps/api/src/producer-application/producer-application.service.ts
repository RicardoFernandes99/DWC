import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  AdminProducerApplicationItemDto,
  AdminProducerApplicationListResponseDto,
  ApproveProducerApplicationDto,
  ListAdminProducerApplicationsQueryDto,
  ProducerApplicationResponseDto,
  ProducerProfileResponseDto,
  RejectProducerApplicationDto,
  SubmitProducerApplicationDto,
  UpdateProducerProfileDto,
} from './producer-application.dto.js';

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

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
    submittedAt: app ? formatDate(app.submittedAt) : null,
    decidedAt: formatDate(user.producerDecisionAt),
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

function toAdminItem(user: UserDocument): AdminProducerApplicationItemDto {
  const app = user.producerApplication;
  if (!app) {
    throw new NotFoundException('Producer has not submitted an application.');
  }
  const status = user.producerStatus ?? ProducerStatus.Pending;
  const isRejected = status === ProducerStatus.Rejected;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    status,
    revision: user.producerDecisionRevision ?? 1,
    rejectionReason: isRejected ? (user.producerRejectionReason ?? null) : null,
    submittedAt: formatDate(app.submittedAt) ?? new Date(0).toISOString(),
    decidedAt: formatDate(user.producerDecisionAt),
    decidedBy: user.producerDecisionBy
      ? user.producerDecisionBy.toString()
      : null,
    application: {
      farmName: app.farmName,
      description: app.description,
      city: app.city,
      collectionAddress: app.collectionAddress,
      latitude: app.latitude,
      longitude: app.longitude,
    },
  };
}

function toProfileResponse(user: UserDocument): ProducerProfileResponseDto {
  const app = user.producerApplication;
  if (!app) {
    throw new NotFoundException('Producer profile not found.');
  }
  const updatedAt =
    formatDate(user.updatedAt) ??
    formatDate(user.producerDecisionAt) ??
    formatDate(app.submittedAt) ??
    new Date(0).toISOString();

  return {
    farmName: app.farmName,
    description: app.description,
    city: app.city,
    collectionAddress: app.collectionAddress,
    latitude: app.latitude,
    longitude: app.longitude,
    status: user.producerStatus ?? ProducerStatus.Approved,
    revision: user.producerDecisionRevision ?? 1,
    updatedAt,
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
          producerDecisionBy: null,
          producerDecisionAt: null,
        },
        $inc: { producerDecisionRevision: 1 },
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
          producerDecisionBy: null,
          producerDecisionAt: null,
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
        $inc: { producerDecisionRevision: 1 },
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

  async listForAdmin(
    query: ListAdminProducerApplicationsQueryDto,
  ): Promise<AdminProducerApplicationListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      role: UserRole.Producer,
      producerApplication: { $ne: null },
    };
    if (query.status) {
      filter.producerStatus = query.status;
    }

    const [docs, total] = await Promise.all([
      this.users
        .find(filter)
        .sort({ 'producerApplication.submittedAt': -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.users.countDocuments(filter),
    ]);

    return {
      items: docs.map((doc) => toAdminItem(doc)),
      total,
      page,
      limit,
    };
  }

  async getForAdmin(id: string): Promise<AdminProducerApplicationItemDto> {
    const user = await this.users.findById(id);
    if (!user || user.role !== UserRole.Producer) {
      throw new NotFoundException('Producer application not found.');
    }
    if (!user.producerApplication) {
      throw new NotFoundException('Producer has not submitted an application.');
    }
    return toAdminItem(user);
  }

  async approve(
    id: string,
    adminId: string,
    input: ApproveProducerApplicationDto,
  ): Promise<AdminProducerApplicationItemDto> {
    const now = new Date();
    const updated = await this.users.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        role: UserRole.Producer,
        producerStatus: ProducerStatus.Pending,
        producerApplication: { $ne: null },
        producerDecisionRevision: input.revision,
      },
      {
        $set: {
          producerStatus: ProducerStatus.Approved,
          producerRejectionReason: null,
          producerDecisionBy: new Types.ObjectId(adminId),
          producerDecisionAt: now,
        },
        $inc: { producerDecisionRevision: 1 },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      return await this.throwDecisionConflict(id, 'approved');
    }

    return toAdminItem(updated);
  }

  async reject(
    id: string,
    adminId: string,
    input: RejectProducerApplicationDto,
  ): Promise<AdminProducerApplicationItemDto> {
    const now = new Date();
    const updated = await this.users.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        role: UserRole.Producer,
        producerStatus: ProducerStatus.Pending,
        producerApplication: { $ne: null },
        producerDecisionRevision: input.revision,
      },
      {
        $set: {
          producerStatus: ProducerStatus.Rejected,
          producerRejectionReason: input.reason,
          producerDecisionBy: new Types.ObjectId(adminId),
          producerDecisionAt: now,
        },
        $inc: { producerDecisionRevision: 1 },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      return await this.throwDecisionConflict(id, 'rejected');
    }

    return toAdminItem(updated);
  }

  private async throwDecisionConflict(
    id: string,
    action: 'approved' | 'rejected',
  ): Promise<never> {
    const existing = await this.users.findById(id);
    if (!existing || existing.role !== UserRole.Producer) {
      throw new NotFoundException('Producer application not found.');
    }
    if (!existing.producerApplication) {
      throw new ConflictException('Producer has not submitted an application.');
    }
    if (existing.producerStatus !== ProducerStatus.Pending) {
      throw new ConflictException(
        `Producer application is already ${existing.producerStatus ?? 'unsubmitted'} and cannot be ${action}.`,
      );
    }
    throw new ConflictException(
      'Producer application was updated or decided concurrently. Refresh and try again.',
    );
  }

  async getProfile(userId: string): Promise<ProducerProfileResponseDto> {
    const user = await this.users.findById(userId);
    if (!user || user.role !== UserRole.Producer) {
      throw new ForbiddenException(
        'Only approved producers may access producer profiles.',
      );
    }
    if (user.producerStatus !== ProducerStatus.Approved) {
      throw new ForbiddenException(
        'Only approved producers may access producer profiles.',
      );
    }
    if (!user.producerApplication) {
      throw new NotFoundException('Producer profile not found.');
    }
    return toProfileResponse(user);
  }

  async updateProfile(
    userId: string,
    input: UpdateProducerProfileDto,
  ): Promise<ProducerProfileResponseDto> {
    const updates: Record<string, unknown> = {};
    if (input.farmName !== undefined) {
      updates['producerApplication.farmName'] = input.farmName;
    }
    if (input.description !== undefined) {
      updates['producerApplication.description'] = input.description;
    }
    if (input.city !== undefined) {
      updates['producerApplication.city'] = input.city;
    }
    if (input.collectionAddress !== undefined) {
      updates['producerApplication.collectionAddress'] =
        input.collectionAddress;
    }
    if (input.latitude !== undefined) {
      updates['producerApplication.latitude'] = input.latitude;
    }
    if (input.longitude !== undefined) {
      updates['producerApplication.longitude'] = input.longitude;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'At least one profile field must be provided.',
      );
    }

    const updated = await this.users.findOneAndUpdate(
      {
        _id: new Types.ObjectId(userId),
        role: UserRole.Producer,
        producerStatus: ProducerStatus.Approved,
        'producerApplication.submittedAt': { $exists: true },
        producerDecisionRevision: input.revision,
      },
      {
        $set: updates,
        $inc: { producerDecisionRevision: 1 },
      },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      const existing = await this.users.findById(userId);
      if (
        !existing ||
        existing.role !== UserRole.Producer ||
        existing.producerStatus !== ProducerStatus.Approved
      ) {
        throw new ForbiddenException(
          'Only approved producers may edit producer profiles.',
        );
      }
      if (!existing.producerApplication) {
        throw new NotFoundException('Producer profile not found.');
      }
      throw new ConflictException(
        'Producer profile was modified concurrently. Refresh and try again.',
      );
    }

    return toProfileResponse(updated);
  }
}
