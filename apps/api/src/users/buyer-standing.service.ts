import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';
import { NotificationIntegrationService } from '../notifications/notification-integration.service.js';
import {
  NotificationEventType,
  NotificationResourceType,
} from '../notifications/notification.schema.js';
import type { NotificationDocument } from '../notifications/notification.schema.js';
import { BuyerStatus, User, UserRole } from './user.schema.js';
import type { UserDocument } from './user.schema.js';
import type {
  ReinstateBuyerDto,
  SuspendBuyerDto,
} from './buyer-standing.dto.js';

@Injectable()
export class BuyerStandingService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly notifications: NotificationIntegrationService,
  ) {}

  suspend(id: string, adminId: string, input: SuspendBuyerDto) {
    return this.transition(
      id,
      adminId,
      input.revision,
      BuyerStatus.Active,
      input.reason,
    );
  }

  reinstate(id: string, adminId: string, input: ReinstateBuyerDto) {
    return this.transition(
      id,
      adminId,
      input.revision,
      BuyerStatus.Suspended,
      null,
    );
  }

  private async transition(
    id: string,
    adminId: string,
    revision: number,
    from: BuyerStatus,
    reason: string | null,
  ) {
    const to =
      from === BuyerStatus.Active ? BuyerStatus.Suspended : BuyerStatus.Active;
    const now = new Date();
    const session = await this.connection.startSession();
    let result: {
      id: string;
      status: BuyerStatus;
      revision: number;
      reason: string | null;
      decidedBy: string | null;
      decidedAt: string | null;
    } | null = null;
    let notification: NotificationDocument | null = null;
    try {
      await session.withTransaction(async () => {
        result = null;
        notification = null;
        const updated = await this.users.findOneAndUpdate(
          {
            _id: id,
            role: UserRole.Buyer,
            $and: [
              revision === 0
                ? {
                    $or: [
                      { buyerDecisionRevision: 0 },
                      { buyerDecisionRevision: { $exists: false } },
                    ],
                  }
                : { buyerDecisionRevision: revision },
              from === BuyerStatus.Active
                ? {
                    $or: [
                      { buyerStatus: BuyerStatus.Active },
                      { buyerStatus: { $exists: false } },
                    ],
                  }
                : { buyerStatus: from },
            ],
          },
          {
            $set: {
              buyerStatus: to,
              ...(to === BuyerStatus.Suspended
                ? { buyerSuspensionReason: reason }
                : {}),
              buyerDecisionBy: adminId,
              buyerDecisionAt: now,
            },
            $inc: { buyerDecisionRevision: 1, buyerEligibilityRevision: 1 },
          },
          { returnDocument: 'after', runValidators: true, session },
        );

        if (updated) {
          const suspended = to === BuyerStatus.Suspended;
          notification = await this.notifications.persist(
            {
              recipientId: id,
              eventType: suspended
                ? NotificationEventType.BuyerSuspended
                : NotificationEventType.BuyerReinstated,
              title: suspended
                ? 'Buyer account suspended'
                : 'Buyer account reinstated',
              message: suspended
                ? 'Your account has been suspended. View your account for details.'
                : 'Your account has been reinstated. You can place orders and bids again.',
              resource: { type: NotificationResourceType.BuyerAccount, id },
              sourceEventKey: `buyer:${id}:decision:${revision + 1}`,
            },
            session,
          );
          result = {
            id: updated._id.toString(),
            status: updated.buyerStatus,
            revision: updated.buyerDecisionRevision,
            reason:
              updated.buyerStatus === BuyerStatus.Suspended
                ? updated.buyerSuspensionReason
                : null,
            decidedBy: updated.buyerDecisionBy?.toString() ?? null,
            decidedAt: updated.buyerDecisionAt?.toISOString() ?? null,
          };
        }
      });
    } finally {
      await session.endSession();
    }
    if (!result) {
      const existing = await this.users.findById(id);
      if (!existing || existing.role !== UserRole.Buyer)
        throw new NotFoundException('Buyer not found.');
      throw new ConflictException(
        'Buyer standing changed or this decision is stale. Refresh and try again.',
      );
    }
    if (notification) this.notifications.publishCommitted(notification);
    return result;
  }
}
