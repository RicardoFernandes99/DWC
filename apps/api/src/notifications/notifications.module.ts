import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { Notification, NotificationSchema } from './notification.schema.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationIntegrationService } from './notification-integration.service.js';

@Module({
  imports: [
    AuthModule,
    RealtimeModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationIntegrationService],
  exports: [NotificationsService, NotificationIntegrationService],
})
export class NotificationsModule {}
