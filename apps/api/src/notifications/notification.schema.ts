import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum NotificationEventType {
  OrderCreated = 'order_created',
  OrderStatusChanged = 'order_status_changed',
  RefundRequested = 'refund_requested',
  RefundDecision = 'refund_decision',
  ProducerApplicationApproved = 'producer_application_approved',
  ProducerApplicationRejected = 'producer_application_rejected',
  ProducerSuspended = 'producer_suspended',
  ProducerReinstated = 'producer_reinstated',
  AuctionWon = 'auction_won',
  AuctionLost = 'auction_lost',
  AuctionClosed = 'auction_closed',
  AuctionPaymentMethodExpired = 'auction_payment_method_expired',
}

export enum NotificationResourceType {
  Order = 'order',
  ProducerApplication = 'producer_application',
  Auction = 'auction',
}

@Schema({ _id: false })
export class NotificationResource {
  @Prop({ required: true, enum: Object.values(NotificationResourceType) })
  type!: NotificationResourceType;

  @Prop({ type: SchemaTypes.ObjectId, required: true })
  id!: Types.ObjectId;
}

export const NotificationResourceSchema =
  SchemaFactory.createForClass(NotificationResource);

@Schema({ timestamps: { createdAt: true, updatedAt: false }, autoIndex: true })
export class Notification {
  @Prop({ type: SchemaTypes.ObjectId, required: true, ref: 'User' })
  recipientId!: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(NotificationEventType) })
  eventType!: NotificationEventType;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  message!: string;

  @Prop({ type: NotificationResourceSchema, required: true })
  resource!: NotificationResource;

  @Prop({ required: true, trim: true, maxlength: 160 })
  sourceEventKey!: string;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;

  createdAt!: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index(
  { recipientId: 1, sourceEventKey: 1 },
  { unique: true, name: 'notification_recipient_source_unique' },
);
NotificationSchema.index({ recipientId: 1, createdAt: -1, _id: -1 });
NotificationSchema.index({ recipientId: 1, readAt: 1 });
