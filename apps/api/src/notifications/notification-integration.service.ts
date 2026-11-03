import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import { PersonalEventPublisher } from '../realtime/personal-event.publisher.js';
import {
  type CreateNotificationInput,
  NotificationsService,
} from './notifications.service.js';
import type { NotificationDocument } from './notification.schema.js';

@Injectable()
export class NotificationIntegrationService {
  private readonly logger = new Logger(NotificationIntegrationService.name);

  constructor(
    private readonly notifications: NotificationsService,
    @Inject(PersonalEventPublisher)
    private readonly publisher: Pick<
      PersonalEventPublisher,
      'publishNotificationCreated'
    >,
  ) {}

  persist(
    input: CreateNotificationInput,
    session: ClientSession,
  ): Promise<NotificationDocument> {
    return this.notifications.createNotification(input, session);
  }

  publishCommitted(notification: NotificationDocument): void {
    const recipientId = notification.recipientId.toString();
    const notificationId = notification._id.toString();
    try {
      void Promise.resolve(
        this.publisher.publishNotificationCreated(recipientId, notificationId),
      ).catch((error: unknown) => {
        this.logDispatchFailure(notificationId, error);
      });
    } catch (error: unknown) {
      this.logDispatchFailure(notificationId, error);
    }
  }

  private logDispatchFailure(notificationId: string, error: unknown): void {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    this.logger.warn(
      `Live dispatch failed for persisted notification ${notificationId}: ${detail}`,
    );
  }
}
