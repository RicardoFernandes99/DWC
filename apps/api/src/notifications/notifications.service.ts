import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { UserResponseDto } from '../users/user-response.dto.js';
import { ListNotificationsQueryDto } from './notification.dto.js';
import {
  Notification,
  NotificationDocument,
  NotificationEventType,
  NotificationResourceType,
} from './notification.schema.js';

export interface CreateNotificationInput {
  recipientId: string;
  eventType: NotificationEventType;
  title: string;
  message: string;
  resource: { type: NotificationResourceType; id: string };
  sourceEventKey: string;
}

interface NotificationCursor {
  createdAt: Date;
  id: string;
}

const EVENT_RESOURCE_TYPES: ReadonlyMap<
  NotificationEventType,
  NotificationResourceType
> = new Map([
  [NotificationEventType.OrderCreated, NotificationResourceType.Order],
  [NotificationEventType.OrderStatusChanged, NotificationResourceType.Order],
  [NotificationEventType.RefundRequested, NotificationResourceType.Order],
  [NotificationEventType.RefundDecision, NotificationResourceType.Order],
  [
    NotificationEventType.ProducerApplicationApproved,
    NotificationResourceType.ProducerApplication,
  ],
  [
    NotificationEventType.ProducerApplicationRejected,
    NotificationResourceType.ProducerApplication,
  ],
  [NotificationEventType.AuctionWon, NotificationResourceType.Auction],
  [NotificationEventType.AuctionLost, NotificationResourceType.Auction],
  [NotificationEventType.AuctionClosed, NotificationResourceType.Auction],
  [
    NotificationEventType.AuctionPaymentMethodExpired,
    NotificationResourceType.Auction,
  ],
]);

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notifications: Model<Notification>,
  ) {}

  async createNotification(
    input: CreateNotificationInput,
    session?: ClientSession,
  ): Promise<NotificationDocument> {
    this.validateCreationInput(input);
    const normalizedInput = {
      ...input,
      recipientId: input.recipientId.toLowerCase(),
      sourceEventKey: input.sourceEventKey.trim(),
      title: input.title.trim(),
      message: input.message.trim(),
    };
    const options = {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      ...(session ? { session } : {}),
    } as const;
    const notification = await this.notifications.findOneAndUpdate(
      {
        recipientId: normalizedInput.recipientId,
        sourceEventKey: normalizedInput.sourceEventKey,
      },
      {
        $setOnInsert: {
          ...normalizedInput,
          readAt: null,
        },
      },
      options,
    );
    if (!notification) {
      throw new BadRequestException('Notification could not be created.');
    }
    return notification;
  }

  async listNotifications(
    user: UserResponseDto,
    query: ListNotificationsQueryDto,
  ): Promise<{ items: NotificationDocument[]; nextCursor: string | null }> {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : undefined;
    const filter: Record<string, unknown> = { recipientId: user.id };
    if (query.unreadOnly) filter.readAt = null;
    if (cursor) {
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
      ];
    }
    const records = await this.notifications
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .exec();
    const hasMore = records.length > query.limit;
    const items = hasMore ? records.slice(0, query.limit) : records;
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? this.encodeCursor(last) : null,
    };
  }

  countUnread(user: UserResponseDto): Promise<number> {
    return this.notifications.countDocuments({
      recipientId: user.id,
      readAt: null,
    });
  }

  async markRead(
    user: UserResponseDto,
    notificationId: string,
  ): Promise<NotificationDocument> {
    const notification =
      (await this.notifications
        .findOneAndUpdate(
          { _id: notificationId, recipientId: user.id, readAt: null },
          { $set: { readAt: new Date() } },
          { new: true },
        )
        .exec()) ??
      (await this.notifications
        .findOne({ _id: notificationId, recipientId: user.id })
        .exec());
    if (!notification) {
      throw new NotFoundException('Notification was not found.');
    }
    return notification;
  }

  private validateCreationInput(input: CreateNotificationInput): void {
    if (
      !input.recipientId.match(/^[0-9a-f]{24}$/i) ||
      !input.resource.id.match(/^[0-9a-f]{24}$/i) ||
      !Object.values(NotificationEventType).includes(input.eventType) ||
      !Object.values(NotificationResourceType).includes(input.resource.type) ||
      EVENT_RESOURCE_TYPES.get(input.eventType) !== input.resource.type ||
      input.title.trim().length === 0 ||
      input.title.length > 120 ||
      input.message.trim().length === 0 ||
      input.message.length > 500 ||
      input.sourceEventKey.trim().length === 0 ||
      input.sourceEventKey.length > 160 ||
      /[<>]/.test(input.title) ||
      /[<>]/.test(input.message)
    ) {
      throw new BadRequestException('Notification content is invalid.');
    }
  }

  private encodeCursor(notification: NotificationDocument): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: notification.createdAt.toISOString(),
        id: notification._id.toString(),
      }),
    ).toString('base64url');
  }

  private decodeCursor(value: string): NotificationCursor {
    try {
      const decoded: unknown = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      );
      if (
        typeof decoded !== 'object' ||
        decoded === null ||
        !('createdAt' in decoded) ||
        !('id' in decoded) ||
        typeof decoded.createdAt !== 'string' ||
        typeof decoded.id !== 'string' ||
        !Number.isFinite(Date.parse(decoded.createdAt)) ||
        !/^[0-9a-f]{24}$/i.test(decoded.id)
      ) {
        throw new Error('Invalid cursor.');
      }
      return { createdAt: new Date(decoded.createdAt), id: decoded.id };
    } catch {
      throw new BadRequestException('Notification cursor is invalid.');
    }
  }
}
