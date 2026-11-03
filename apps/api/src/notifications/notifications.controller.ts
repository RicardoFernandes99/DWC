import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, RoleGuard, Roles } from '../auth/role.guard.js';
import { UserResponseDto } from '../users/user-response.dto.js';
import {
  ListNotificationsQueryDto,
  NotificationIdParamDto,
  NotificationListResponseDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
} from './notification.dto.js';
import { NotificationDocument } from './notification.schema.js';
import { NotificationsService } from './notifications.service.js';

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(RoleGuard)
@Roles()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({ type: NotificationListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination or cursor.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Account is not permitted.' })
  async list(
    @CurrentUser() user: UserResponseDto,
    @Query() query: ListNotificationsQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<NotificationListResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    const result = await this.notifications.listNotifications(user, query);
    return {
      items: result.items.map((item) => this.toResponse(item)),
      nextCursor: result.nextCursor,
    };
  }

  @Get('unread-count')
  @ApiOkResponse({ type: UnreadCountResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Account is not permitted.' })
  async unreadCount(
    @CurrentUser() user: UserResponseDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<UnreadCountResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    return { count: await this.notifications.countUnread(user) };
  }

  @Patch(':notificationId/read')
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid notification ID.' })
  @ApiUnauthorizedResponse({ description: 'Authentication is required.' })
  @ApiForbiddenResponse({ description: 'Account is not permitted.' })
  @ApiNotFoundResponse({
    description: 'Notification not found or does not belong to the account.',
  })
  async markRead(
    @CurrentUser() user: UserResponseDto,
    @Param() { notificationId }: NotificationIdParamDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<NotificationResponseDto> {
    response.setHeader('Cache-Control', 'no-store');
    return this.toResponse(
      await this.notifications.markRead(user, notificationId),
    );
  }

  private toResponse(item: NotificationDocument): NotificationResponseDto {
    return {
      id: item._id.toString(),
      eventType: item.eventType,
      title: item.title,
      message: item.message,
      resource: {
        type: item.resource.type,
        id: item.resource.id.toString(),
      },
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
    };
  }
}
