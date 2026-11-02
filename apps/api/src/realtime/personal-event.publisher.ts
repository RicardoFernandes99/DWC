import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';

@Injectable()
export class PersonalEventPublisher {
  constructor(private readonly gateway: RealtimeGateway) {}

  publishNotificationCreated(recipientUserId: string, notificationId: string) {
    return this.gateway.publishNotificationCreated(recipientUserId, {
      notificationId,
    });
  }
}
